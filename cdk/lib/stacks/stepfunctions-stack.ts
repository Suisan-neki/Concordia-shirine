import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { Construct } from "constructs";

export interface StepFunctionsStackProps extends cdk.StackProps {
    environment: string;
    inputBucket: s3.IBucket;
    outputBucket: s3.IBucket;
    interviewsTable: dynamodb.ITable;
    extractAudioFn: lambda.IFunction;
    chunkAudioFn: lambda.IFunction;
    diarizeFn: lambda.IFunction;
    mergeSpeakersFn: lambda.IFunction;
    splitBySpeakerFn: lambda.IFunction;
    transcribeFn: lambda.IFunction;
    aggregateResultsFn: lambda.IFunction;
    llmAnalysisFn: lambda.IFunction;
}

export class StepFunctionsStack extends cdk.Stack {
    public readonly stateMachine: sfn.StateMachine;

    constructor(scope: Construct, id: string, props: StepFunctionsStackProps) {
        super(scope, id, props);

        const {
            environment,
            inputBucket,
            outputBucket,
            interviewsTable,
            extractAudioFn,
            chunkAudioFn,
            diarizeFn,
            mergeSpeakersFn,
            splitBySpeakerFn,
            transcribeFn,
            aggregateResultsFn,
            llmAnalysisFn,
        } = props;

        // ステートマシンのロググループ
        const logGroup = new logs.LogGroup(this, "StateMachineLogGroup", {
            logGroupName: `/aws/stepfunctions/concordia-transcript-${environment}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy:
                environment === "prod"
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
        });

        // エラーハンドラーステート
        const handleError = new sfn.Pass(this, "HandleError", {
            parameters: {
                "error.$": "$.error",
                "cause.$": "$.cause",
                status: "FAILED",
            },
        });

        // ExtractAudio タスク
        const extractAudioTask = new tasks.LambdaInvoke(this, "ExtractAudio", {
            lambdaFunction: extractAudioFn,
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        extractAudioTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 2,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });
        extractAudioTask.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // ChunkAudio タスク - 並列処理のために音声をチャンクに分割
        const chunkAudioTask = new tasks.LambdaInvoke(this, "ChunkAudio", {
            lambdaFunction: chunkAudioFn,
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        chunkAudioTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 2,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });
        chunkAudioTask.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // Diarize タスク (単一チャンク)
        const diarizeTask = new tasks.LambdaInvoke(this, "DiarizeChunk", {
            lambdaFunction: diarizeFn,
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        diarizeTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 2,
            interval: cdk.Duration.seconds(10),
            backoffRate: 2,
        });

        // チャンクの話者分離を並列実行するための Map ステート
        const diarizeChunks = new sfn.Map(this, "DiarizeChunks", {
            itemsPath: "$.chunks",
            maxConcurrency: 5, // リソース枯渇を防ぐため並列数を制限
            parameters: {
                "bucket.$": "$.bucket",
                "audio_key.$": "$.audio_key",
                "chunk.$": "$$.Map.Item.Value",
            },
            resultPath: "$.chunk_results",
        });
        diarizeChunks.itemProcessor(diarizeTask);
        diarizeChunks.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // MergeSpeakers タスク - 並列話者分離結果をマージ
        const mergeSpeakersTask = new tasks.LambdaInvoke(this, "MergeSpeakers", {
            lambdaFunction: mergeSpeakersFn,
            payload: sfn.TaskInput.fromObject({
                "bucket.$": "$.bucket",
                "audio_key.$": "$.audio_key",
                "chunk_results.$": "$.chunk_results",
                "chunk_config.$": "$.chunk_config",
            }),
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        mergeSpeakersTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 2,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });
        mergeSpeakersTask.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // SplitBySpeaker タスク
        const splitBySpeakerTask = new tasks.LambdaInvoke(this, "SplitBySpeaker", {
            lambdaFunction: splitBySpeakerFn,
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        splitBySpeakerTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 2,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });
        splitBySpeakerTask.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // Transcribe タスク (単一セグメント)
        const transcribeTask = new tasks.LambdaInvoke(this, "Transcribe", {
            lambdaFunction: transcribeFn,
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        transcribeTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 3,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });

        // 並列文字起こしのための Map ステート
        const transcribeSegments = new sfn.Map(this, "TranscribeSegments", {
            itemsPath: "$.segment_files",
            maxConcurrency: 10,
            parameters: {
                "bucket.$": "$.bucket",
                "segment_file.$": "$$.Map.Item.Value",
            },
            resultPath: sfn.JsonPath.DISCARD,
        });
        transcribeSegments.itemProcessor(transcribeTask);
        transcribeSegments.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // AggregateResults タスク
        const aggregateResultsTask = new tasks.LambdaInvoke(
            this,
            "AggregateResults",
            {
                lambdaFunction: aggregateResultsFn,
                outputPath: "$.Payload",
                retryOnServiceExceptions: true,
            }
        );
        aggregateResultsTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 2,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });
        aggregateResultsTask.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // LLMAnalysis タスク
        const llmAnalysisTask = new tasks.LambdaInvoke(this, "LLMAnalysis", {
            lambdaFunction: llmAnalysisFn,
            outputPath: "$.Payload",
            retryOnServiceExceptions: true,
        });
        llmAnalysisTask.addRetry({
            errors: ["States.ALL"],
            maxAttempts: 3,
            interval: cdk.Duration.seconds(10),
            backoffRate: 2,
        });
        llmAnalysisTask.addCatch(handleError, {
            errors: ["States.ALL"],
            resultPath: "$.error",
        });

        // 成功ステート
        const succeed = new sfn.Succeed(this, "ProcessingComplete", {
            comment: "Transcription pipeline completed successfully",
        });

        // ワークフローの定義
        const definition = extractAudioTask
            .next(chunkAudioTask)
            .next(diarizeChunks)
            .next(mergeSpeakersTask)
            .next(splitBySpeakerTask)
            .next(transcribeSegments)
            .next(aggregateResultsTask)
            .next(llmAnalysisTask)
            .next(succeed);

        // ステートマシンの作成
        this.stateMachine = new sfn.StateMachine(this, "TranscriptPipeline", {
            stateMachineName: `concordia-transcript-pipeline-${environment}`,
            definitionBody: sfn.DefinitionBody.fromChainable(definition),
            timeout: cdk.Duration.hours(12),
            tracingEnabled: false,
            logs: {
                destination: logGroup,
                level: sfn.LogLevel.ERROR,
                includeExecutionData: false,
            },
        });

        // S3 トリガー Lambda
        // Note: コードは cdk/lib/lambdas/start-pipeline に配置されと想定
        const startPipelineLambda = new lambdaNodejs.NodejsFunction(
            this,
            "StartPipelineLambda",
            {
                functionName: `concordia-start-pipeline-${environment}`,
                runtime: lambda.Runtime.NODEJS_20_X,
                entry: path.join(__dirname, "../lambdas/start-pipeline/index.ts"),
                handler: "handler",
                environment: {
                    STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
                    TABLE_NAME: interviewsTable.tableName,
                },
                timeout: cdk.Duration.seconds(30),
                memorySize: 256,
                bundling: {
                    minify: true,
                    sourceMap: false,
                    externalModules: [],
                },
            }
        );

        // Lambda への権限付与
        this.stateMachine.grantStartExecution(startPipelineLambda);
        interviewsTable.grantReadWriteData(startPipelineLambda);

        // S3 動画アップロード時に Lambda をトリガーする EventBridge ルール
        const s3UploadRule = new events.Rule(this, "S3UploadRule", {
            ruleName: `concordia-s3-upload-${environment}`,
            eventPattern: {
                source: ["aws.s3"],
                detailType: ["Object Created"],
                detail: {
                    bucket: {
                        name: [inputBucket.bucketName],
                    },
                    object: {
                        key: [{ prefix: "uploads/" }],
                    },
                },
            },
        });

        // S3 アップロードイベントのターゲットとして Lambda を追加
        s3UploadRule.addTarget(new targets.LambdaFunction(startPipelineLambda));

        // 完了ハンドラー Lambda
        // Note: コードは cdk/lib/lambdas/completion-handler に配置されると想定
        const completionHandlerLambda = new lambdaNodejs.NodejsFunction(
            this,
            "CompletionHandlerLambda",
            {
                functionName: `concordia-completion-handler-${environment}`,
                runtime: lambda.Runtime.NODEJS_20_X,
                entry: path.join(__dirname, "../lambdas/completion-handler/index.ts"),
                handler: "handler",
                environment: {
                    TABLE_NAME: interviewsTable.tableName,
                },
                timeout: cdk.Duration.seconds(30),
                memorySize: 256,
                bundling: {
                    minify: true,
                    sourceMap: false,
                    externalModules: [],
                },
            }
        );

        // 完了ハンドラーへの権限付与
        interviewsTable.grantWriteData(completionHandlerLambda);

        // 実行履歴読み取り権限の付与
        completionHandlerLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["states:GetExecutionHistory"],
                resources: [this.stateMachine.stateMachineArn + ":*"],
            })
        );

        // 完了通知用の EventBridge ルール
        const completionRule = new events.Rule(this, "CompletionRule", {
            ruleName: `concordia-completion-${environment}`,
            eventPattern: {
                source: ["aws.states"],
                detailType: ["Step Functions Execution Status Change"],
                detail: {
                    stateMachineArn: [this.stateMachine.stateMachineArn],
                    status: ["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"],
                },
            },
        });

        // ターゲットとして完了ハンドラーを追加
        completionRule.addTarget(new targets.LambdaFunction(completionHandlerLambda));

        // Outputs
        new cdk.CfnOutput(this, "StateMachineArn", {
            value: this.stateMachine.stateMachineArn,
            exportName: `${id}-StateMachineArn`,
        });

        new cdk.CfnOutput(this, "StateMachineName", {
            value: this.stateMachine.stateMachineName!,
            exportName: `${id}-StateMachineName`,
        });
    }
}
