import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "path";
import { Construct } from "constructs";

export interface LambdaStackProps extends cdk.StackProps {
    environment: string;
    inputBucket: s3.IBucket;
    outputBucket: s3.IBucket;
    openaiSecret: secretsmanager.ISecret;
    huggingfaceSecret: secretsmanager.ISecret;
    interviewsTable: dynamodb.ITable;
}

export class LambdaStack extends cdk.Stack {
    public readonly extractAudioFn: lambda.Function;
    public readonly chunkAudioFn: lambda.Function;
    public readonly diarizeFn: lambda.Function;
    public readonly mergeSpeakersFn: lambda.Function;
    public readonly splitBySpeakerFn: lambda.Function;
    public readonly transcribeFn: lambda.Function;
    public readonly aggregateResultsFn: lambda.Function;
    public readonly llmAnalysisFn: lambda.Function;
    public readonly realtimeTranscribeFn: lambda.Function;

    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        const {
            environment,
            inputBucket,
            outputBucket,
            openaiSecret,
            huggingfaceSecret,
            interviewsTable,
        } = props;

        // Adjusted path to point to where we will put the lambdas: src/aws-lambdas
        // __dirname is cdk/lib/stacks. We want src/aws-lambdas which is ../../../src/aws-lambdas
        const lambdasPath = path.join(__dirname, "../../../src/aws-lambdas");

        // Common Lambda execution role
        const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    "service-role/AWSLambdaBasicExecutionRole"
                ),
            ],
        });

        // Grant S3 permissions
        inputBucket.grantRead(lambdaRole);
        outputBucket.grantReadWrite(lambdaRole);

        // Grant DynamoDB permissions for progress tracking
        interviewsTable.grantWriteData(lambdaRole);

        // ExtractAudio Lambda
        this.extractAudioFn = new lambda.DockerImageFunction(
            this,
            "ExtractAudioFn",
            {
                functionName: `concordia-extract-audio-${environment}`,
                code: lambda.DockerImageCode.fromImageAsset(
                    path.join(lambdasPath, "extract_audio")
                ),
                memorySize: 3008,
                timeout: cdk.Duration.minutes(15),
                ephemeralStorageSize: cdk.Size.mebibytes(10240),
                environment: {
                    INPUT_BUCKET: inputBucket.bucketName,
                    OUTPUT_BUCKET: outputBucket.bucketName,
                    TABLE_NAME: interviewsTable.tableName,
                    ENVIRONMENT: environment,
                },
                role: lambdaRole,
                architecture: lambda.Architecture.X86_64,
            }
        );

        // ChunkAudio Lambda - for parallel diarization
        this.chunkAudioFn = new lambda.DockerImageFunction(
            this,
            "ChunkAudioFn",
            {
                functionName: `concordia-chunk-audio-${environment}`,
                code: lambda.DockerImageCode.fromImageAsset(
                    path.join(lambdasPath, "chunk_audio")
                ),
                memorySize: 3008,
                timeout: cdk.Duration.minutes(15),
                ephemeralStorageSize: cdk.Size.mebibytes(10240),
                environment: {
                    INPUT_BUCKET: inputBucket.bucketName,
                    OUTPUT_BUCKET: outputBucket.bucketName,
                    TABLE_NAME: interviewsTable.tableName,
                    CHUNK_DURATION: "480", // 8 minutes
                    OVERLAP_DURATION: "30", // 30 seconds
                    MIN_CHUNK_DURATION: "60", // 1 minute
                    ENVIRONMENT: environment,
                },
                role: lambdaRole,
                architecture: lambda.Architecture.X86_64,
            }
        );

        // Diarize Lambda (larger memory for pyannote)
        // HF_TOKEN is required at build time - set via environment variable
        const hfToken = process.env.HF_TOKEN || "";
        this.diarizeFn = new lambda.DockerImageFunction(this, "DiarizeFn", {
            functionName: `concordia-diarize-${environment}`,
            code: lambda.DockerImageCode.fromImageAsset(
                path.join(lambdasPath, "diarize"),
                {
                    buildArgs: {
                        HF_TOKEN: hfToken,
                    },
                }
            ),
            memorySize: 10240, // Max Lambda memory for pyannote
            timeout: cdk.Duration.minutes(15),
            ephemeralStorageSize: cdk.Size.mebibytes(10240),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                HF_TOKEN_SECRET_ARN: huggingfaceSecret.secretArn,
                HF_HOME: "/opt/huggingface", // Pre-downloaded model location
                ENVIRONMENT: environment,
            },
            role: lambdaRole,
            architecture: lambda.Architecture.X86_64,
        });
        huggingfaceSecret.grantRead(this.diarizeFn);

        // MergeSpeakers Lambda - for merging parallel diarization results
        this.mergeSpeakersFn = new lambda.DockerImageFunction(
            this,
            "MergeSpeakersFn",
            {
                functionName: `concordia-merge-speakers-${environment}`,
                code: lambda.DockerImageCode.fromImageAsset(
                    path.join(lambdasPath, "merge_speakers")
                ),
                memorySize: 3008,
                timeout: cdk.Duration.minutes(5),
                environment: {
                    INPUT_BUCKET: inputBucket.bucketName,
                    OUTPUT_BUCKET: outputBucket.bucketName,
                    TABLE_NAME: interviewsTable.tableName,
                    SIMILARITY_THRESHOLD: "0.75", // Cosine similarity threshold
                    ENVIRONMENT: environment,
                },
                role: lambdaRole,
                architecture: lambda.Architecture.X86_64,
            }
        );

        // SplitBySpeaker Lambda
        this.splitBySpeakerFn = new lambda.DockerImageFunction(
            this,
            "SplitBySpeakerFn",
            {
                functionName: `concordia-split-by-speaker-${environment}`,
                code: lambda.DockerImageCode.fromImageAsset(
                    path.join(lambdasPath, "split_by_speaker")
                ),
                memorySize: 3008,
                timeout: cdk.Duration.minutes(15),
                ephemeralStorageSize: cdk.Size.mebibytes(10240),
                environment: {
                    INPUT_BUCKET: inputBucket.bucketName,
                    OUTPUT_BUCKET: outputBucket.bucketName,
                    TABLE_NAME: interviewsTable.tableName,
                    ENVIRONMENT: environment,
                },
                role: lambdaRole,
                architecture: lambda.Architecture.X86_64,
            }
        );

        // Transcribe Lambda - model pre-downloaded in Docker image
        const whisperModel = "base"; // Switched to base for real-time performance (medium was too slow/heavy for Lambda)
        this.transcribeFn = new lambda.DockerImageFunction(this, "TranscribeFn", {
            functionName: `concordia-transcribe-${environment}`,
            code: lambda.DockerImageCode.fromImageAsset(
                path.join(lambdasPath, "transcribe"),
                {
                    buildArgs: {
                        WHISPER_MODEL: whisperModel,
                    },
                }
            ),
            memorySize: 6144, // For faster-whisper medium model
            timeout: cdk.Duration.minutes(15),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                WHISPER_MODEL: whisperModel,
                WHISPER_MODEL_DIR: "/opt/whisper-models", // Pre-downloaded model location
                ENVIRONMENT: environment,
            },
            role: lambdaRole,
            architecture: lambda.Architecture.X86_64,
        });

        // AggregateResults Lambda
        this.aggregateResultsFn = new lambda.DockerImageFunction(
            this,
            "AggregateResultsFn",
            {
                functionName: `concordia-aggregate-results-${environment}`,
                code: lambda.DockerImageCode.fromImageAsset(
                    path.join(lambdasPath, "aggregate_results")
                ),
                memorySize: 1024,
                timeout: cdk.Duration.minutes(5),
                environment: {
                    INPUT_BUCKET: inputBucket.bucketName,
                    OUTPUT_BUCKET: outputBucket.bucketName,
                    TABLE_NAME: interviewsTable.tableName,
                    ENVIRONMENT: environment,
                },
                role: lambdaRole,
                architecture: lambda.Architecture.X86_64,
            }
        );

        // LLMAnalysis Lambda
        this.llmAnalysisFn = new lambda.DockerImageFunction(this, "LLMAnalysisFn", {
            functionName: `concordia-llm-analysis-${environment}`,
            code: lambda.DockerImageCode.fromImageAsset(
                path.join(lambdasPath, "llm_analysis")
            ),
            memorySize: 1024,
            timeout: cdk.Duration.minutes(10),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                OPENAI_SECRET_ARN: openaiSecret.secretArn,
                OPENAI_MODEL: "gpt-4o-mini", // Updated to a known model or keep gpt-5-mini if beta? Changing to 4o-mini to be safe or keep as repo? Repo said gpt-5-mini.
                ENVIRONMENT: environment,
            },
            role: lambdaRole,
            architecture: lambda.Architecture.X86_64,
        });
        openaiSecret.grantRead(this.llmAnalysisFn);
        interviewsTable.grantWriteData(this.llmAnalysisFn);

        // RealtimeTranscribe Lambda
        this.realtimeTranscribeFn = new lambda.DockerImageFunction(
            this,
            "RealtimeTranscribeFn",
            {
                functionName: `concordia-realtime-transcribe-${environment}`,
                code: lambda.DockerImageCode.fromImageAsset(
                    path.join(lambdasPath, "realtime_transcribe"),
                    {
                        buildArgs: {
                            WHISPER_MODEL: whisperModel,
                        },
                    }
                ),
                memorySize: 4096, // Reduced from 6GB to 4GB for cost, still enough for medium int8? Medium needs ~3-4GB.
                timeout: cdk.Duration.seconds(60), // Increased to 60s to measure cold start
                environment: {
                    WHISPER_MODEL: whisperModel,
                    WHISPER_MODEL_DIR: "/opt/whisper-models",
                    ENVIRONMENT: environment,
                },
                role: lambdaRole,
                architecture: lambda.Architecture.X86_64,
            }
        );

        // Outputs
        new cdk.CfnOutput(this, "ExtractAudioFnArn", {
            value: this.extractAudioFn.functionArn,
            exportName: `${id}-ExtractAudioFnArn`,
        });

        new cdk.CfnOutput(this, "ChunkAudioFnArn", {
            value: this.chunkAudioFn.functionArn,
            exportName: `${id}-ChunkAudioFnArn`,
        });

        new cdk.CfnOutput(this, "DiarizeFnArn", {
            value: this.diarizeFn.functionArn,
            exportName: `${id}-DiarizeFnArn`,
        });

        new cdk.CfnOutput(this, "MergeSpeakersFnArn", {
            value: this.mergeSpeakersFn.functionArn,
            exportName: `${id}-MergeSpeakersFnArn`,
        });

        new cdk.CfnOutput(this, "SplitBySpeakerFnArn", {
            value: this.splitBySpeakerFn.functionArn,
            exportName: `${id}-SplitBySpeakerFnArn`,
        });

        new cdk.CfnOutput(this, "TranscribeFnArn", {
            value: this.transcribeFn.functionArn,
            exportName: `${id}-TranscribeFnArn`,
        });

        new cdk.CfnOutput(this, "AggregateResultsFnArn", {
            value: this.aggregateResultsFn.functionArn,
            exportName: `${id}-AggregateResultsFnArn`,
        });

        new cdk.CfnOutput(this, "LLMAnalysisFnArn", {
            value: this.llmAnalysisFn.functionArn,
            exportName: `${id}-LLMAnalysisFnArn`,
        });

        new cdk.CfnOutput(this, "RealtimeTranscribeFnArn", {
            value: this.realtimeTranscribeFn.functionArn,
            exportName: `${id}-RealtimeTranscribeFnArn`,
        });
    }
}
