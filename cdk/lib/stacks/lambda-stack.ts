import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import { Construct } from "constructs";

export interface LambdaStackProps extends cdk.StackProps {
    environment: string;
    inputBucket: s3.IBucket;
    outputBucket: s3.IBucket;
    openaiApiKey: string;
    hfToken: string;
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
    public readonly coachFn: lambda.Function;

    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        const {
            environment,
            inputBucket,
            outputBucket,
            openaiApiKey,
            hfToken,
            interviewsTable,
        } = props;

        const lambdasPath = path.join(__dirname, "../../../src/aws-lambdas");

        // 共通の Lambda 実行ロール
        const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    "service-role/AWSLambdaBasicExecutionRole"
                ),
            ],
        });

        // S3 権限の付与
        inputBucket.grantRead(lambdaRole);
        outputBucket.grantReadWrite(lambdaRole);
        interviewsTable.grantWriteData(lambdaRole);

        // 共通プロパティ
        const commonProps = {
            runtime: lambda.Runtime.PYTHON_3_12,
            architecture: lambda.Architecture.ARM_64,
            handler: "lambda_function.lambda_handler",
            role: lambdaRole,
        };

        // ExtractAudio Lambda
        this.extractAudioFn = new lambda.Function(this, "ExtractAudioFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "extract_audio/dist")),
            memorySize: 2048,
            timeout: cdk.Duration.minutes(15),
            ephemeralStorageSize: cdk.Size.mebibytes(2048), // ffmpeg 処理のために増加
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                ENVIRONMENT: environment,
                PATH: "/var/task:$PATH" // ルートにある ffmpeg を確実に見つける
            },
        });

        // ChunkAudio Lambda
        this.chunkAudioFn = new lambda.Function(this, "ChunkAudioFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "chunk_audio/dist")),
            memorySize: 2048,
            timeout: cdk.Duration.minutes(15),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                CHUNK_DURATION: "480",
                OVERLAP_DURATION: "30",
                MIN_CHUNK_DURATION: "60",
                ENVIRONMENT: environment,
                PATH: "/var/task:$PATH",
            },
        });

        // Diarize Lambda (ダミー - Dist なし)
        this.diarizeFn = new lambda.Function(this, "DiarizeFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "dummy_diarize")),
            memorySize: 128,
            timeout: cdk.Duration.minutes(1),
            ephemeralStorageSize: cdk.Size.mebibytes(512),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                HF_TOKEN: hfToken,
                HF_HOME: "/tmp/huggingface", // 書き込み可能な場所
                ENVIRONMENT: environment,
            },
        });

        // MergeSpeakers Lambda
        this.mergeSpeakersFn = new lambda.Function(this, "MergeSpeakersFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "merge_speakers/dist")),
            memorySize: 2048,
            timeout: cdk.Duration.minutes(5),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                SIMILARITY_THRESHOLD: "0.75",
                ENVIRONMENT: environment,
            },
        });

        // SplitBySpeaker Lambda
        this.splitBySpeakerFn = new lambda.Function(this, "SplitBySpeakerFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "split_by_speaker/dist")),
            memorySize: 2048,
            timeout: cdk.Duration.minutes(15),
            ephemeralStorageSize: cdk.Size.mebibytes(2048),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                ENVIRONMENT: environment,
                PATH: "/var/task:$PATH",
            },
        });

        // Transcribe Lambda
        this.transcribeFn = new lambda.Function(this, "TranscribeFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "transcribe/dist")),
            memorySize: 256, // 軽量APIコール
            timeout: cdk.Duration.minutes(5),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                OPENAI_API_KEY: openaiApiKey,
                ENVIRONMENT: environment,
            },
        });

        // AggregateResults Lambda
        this.aggregateResultsFn = new lambda.Function(this, "AggregateResultsFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "aggregate_results/dist")),
            memorySize: 1024,
            timeout: cdk.Duration.minutes(5),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                ENVIRONMENT: environment,
            },
        });

        // LLMAnalysis Lambda
        this.llmAnalysisFn = new lambda.Function(this, "LLMAnalysisFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "llm_analysis/dist")),
            memorySize: 1024,
            timeout: cdk.Duration.minutes(10),
            environment: {
                INPUT_BUCKET: inputBucket.bucketName,
                OUTPUT_BUCKET: outputBucket.bucketName,
                TABLE_NAME: interviewsTable.tableName,
                OPENAI_API_KEY: openaiApiKey,
                OPENAI_MODEL: "gpt-5-mini",
                ENVIRONMENT: environment,
            },
        });

        // RealtimeTranscribe Lambda
        this.realtimeTranscribeFn = new lambda.Function(this, "RealtimeTranscribeFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "realtime_transcribe/dist")),
            memorySize: 256,
            timeout: cdk.Duration.seconds(30),
            environment: {
                OPENAI_API_KEY: openaiApiKey,
                ENVIRONMENT: environment,
            },
        });

        // Coach Lambda
        this.coachFn = new lambda.Function(this, "CoachFn", {
            ...commonProps,
            code: lambda.Code.fromAsset(path.join(lambdasPath, "coach/dist")),
            memorySize: 1024,
            timeout: cdk.Duration.seconds(30),
            environment: {
                OPENAI_API_KEY: openaiApiKey,
                ENVIRONMENT: environment,
            },
        });

        // Outputs
        const outputFn = (name: string, fn: lambda.Function) => {
            new cdk.CfnOutput(this, `${name}Arn`, {
                value: fn.functionArn,
                exportName: `${id}-${name}Arn`,
            });
        };

        outputFn("ExtractAudioFn", this.extractAudioFn);
        outputFn("ChunkAudioFn", this.chunkAudioFn);
        outputFn("DiarizeFn", this.diarizeFn);
        outputFn("MergeSpeakersFn", this.mergeSpeakersFn);
        outputFn("SplitBySpeakerFn", this.splitBySpeakerFn);
        outputFn("TranscribeFn", this.transcribeFn);
        outputFn("AggregateResultsFn", this.aggregateResultsFn);
        outputFn("LLMAnalysisFn", this.llmAnalysisFn);
        outputFn("RealtimeTranscribeFn", this.realtimeTranscribeFn);
        outputFn("CoachFn", this.coachFn);
    }
}
