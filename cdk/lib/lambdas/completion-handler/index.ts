import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    UpdateCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { SFNClient, GetExecutionHistoryCommand } from "@aws-sdk/client-sfn";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sfnClient = new SFNClient({});

interface StepFunctionsEvent {
    source: string;
    "detail-type": string;
    detail: {
        executionArn: string;
        stateMachineArn: string;
        status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "ABORTED";
        input: string;
        output?: string;
    };
}

interface ExecutionInput {
    interview_id?: string;
    user_id?: string;
    video_key?: string;
    bucket?: string;
    recording_name?: string;
}

interface ExecutionOutput {
    bucket?: string;
    analysis_key?: string;
    transcript_key?: string;
    status?: string;
    structured?: boolean;
    total_score?: number;
    segment?: string;
}

export async function handler(event: StepFunctionsEvent): Promise<void> {
    const tableName = process.env.TABLE_NAME;
    const recordingsTableName = process.env.RECORDINGS_TABLE;

    if (!tableName) {
        throw new Error("TABLE_NAME environment variable is not set");
    }

    const { executionArn, status, input, output } = event.detail;

    // 実行入力をパースして interview_id を取得
    let executionInput: ExecutionInput = {};
    try {
        executionInput = JSON.parse(input);
    } catch {
        console.warn("Failed to parse execution input:", input);
    }

    // 実行出力をパースして analysis_key と transcript_key を取得
    let executionOutput: ExecutionOutput = {};
    if (output) {
        try {
            executionOutput = JSON.parse(output);
        } catch {
            console.warn("Failed to parse execution output:", output);
        }
    }

    const interviewId = executionInput.interview_id;

    if (!interviewId) {
        console.warn("No interview_id found in execution input, skipping update");
        return;
    }

    console.log(`Processing completion event for interview: ${interviewId}, status: ${status}`);

    const now = new Date().toISOString();

    if (status === "SUCCEEDED") {
        // 利用可能な出力に基づいて更新式を動的に構築
        const updateParts = [
            "#status = :status",
            "#progress = :progress",
            "#current_step = :current_step",
            "#updated_at = :updated_at",
        ];
        const expressionNames: Record<string, string> = {
            "#status": "status",
            "#progress": "progress",
            "#current_step": "current_step",
            "#updated_at": "updated_at",
        };
        const expressionValues: Record<string, unknown> = {
            ":status": "completed",
            ":progress": 100,
            ":current_step": "completed",
            ":updated_at": now,
        };

        // llm_analysis の出力から analysis_key が利用可能な場合に追加
        if (executionOutput.analysis_key) {
            updateParts.push("analysis_key = :analysis_key");
            expressionValues[":analysis_key"] = executionOutput.analysis_key;
            console.log(`Adding analysis_key: ${executionOutput.analysis_key}`);
        }

        // transcript_key を追加 - 直接利用できない場合は analysis_key から導出
        // llm_analysis は analysis_key を出力し、transcript は transcripts/{base}_transcript.json にある
        if (executionOutput.analysis_key) {
            // analysis_key からベース名を抽出: analysis/xxx_structured.json -> xxx
            const analysisKey = executionOutput.analysis_key;
            const baseName = analysisKey
                .replace("analysis/", "")
                .replace("_structured.json", "")
                .replace("_analysis.txt", "");
            const transcriptKey = `transcripts/${baseName}_transcript.json`;
            updateParts.push("transcript_key = :transcript_key");
            expressionValues[":transcript_key"] = transcriptKey;
            console.log(`Adding transcript_key: ${transcriptKey}`);
        }

        // total_score が利用可能な場合に追加
        if (executionOutput.total_score !== undefined) {
            updateParts.push("total_score = :total_score");
            expressionValues[":total_score"] = executionOutput.total_score;
        }

        // 分析結果を含む完了ステータスに更新
        await docClient.send(
            new UpdateCommand({
                TableName: tableName,
                Key: { interview_id: interviewId },
                UpdateExpression: "SET " + updateParts.join(", "),
                ExpressionAttributeNames: expressionNames,
                ExpressionAttributeValues: expressionValues,
            })
        );

        console.log(`Interview ${interviewId} marked as completed with analysis results`);

        // 該当する場合は録画テーブルを更新
        if (recordingsTableName && executionInput.user_id) {
            await updateRecordingsTable(
                recordingsTableName,
                executionInput.user_id,
                interviewId,
                "ANALYZED"
            );
        }
    } else if (status === "FAILED" || status === "TIMED_OUT" || status === "ABORTED") {
        // 実行履歴からエラー詳細を取得
        let errorMessage = "";

        if (status === "TIMED_OUT") {
            errorMessage = "Execution timed out";
        } else if (status === "ABORTED") {
            errorMessage = "Execution was aborted";
        } else {
            try {
                const historyResponse = await sfnClient.send(
                    new GetExecutionHistoryCommand({
                        executionArn,
                        reverseOrder: true,
                        maxResults: 10,
                    })
                );

                // 失敗イベントを探す
                for (const historyEvent of historyResponse.events || []) {
                    if (historyEvent.type === "ExecutionFailed") {
                        const details = historyEvent.executionFailedEventDetails;
                        if (details) {
                            errorMessage = `${details.error || "Unknown error"}: ${details.cause || "No details"}`;
                        }
                        break;
                    }
                    if (historyEvent.type === "LambdaFunctionFailed") {
                        const details = historyEvent.lambdaFunctionFailedEventDetails;
                        if (details) {
                            errorMessage = `Lambda error: ${details.error || "Unknown"} - ${details.cause || "No details"}`;
                        }
                        break;
                    }
                    if (historyEvent.type === "TaskFailed") {
                        const details = historyEvent.taskFailedEventDetails;
                        if (details) {
                            errorMessage = `Task error: ${details.error || "Unknown"} - ${details.cause || "No details"}`;
                        }
                        break;
                    }
                }
            } catch (err) {
                console.error("Failed to get execution history:", err);
                errorMessage = "Failed to retrieve error details";
            }
        }

        if (!errorMessage) {
            errorMessage = `Execution ${status.toLowerCase()}`;
        }

        // エラーメッセージとともに失敗ステータスに更新
        await docClient.send(
            new UpdateCommand({
                TableName: tableName,
                Key: { interview_id: interviewId },
                UpdateExpression:
                    "SET #status = :status, #error_message = :error_message, #updated_at = :updated_at",
                ExpressionAttributeNames: {
                    "#status": "status",
                    "#error_message": "error_message",
                    "#updated_at": "updated_at",
                },
                ExpressionAttributeValues: {
                    ":status": "failed",
                    ":error_message": errorMessage,
                    ":updated_at": now,
                },
            })
        );

        console.log(`Interview ${interviewId} marked as failed: ${errorMessage}`);

        // 該当する場合は録画テーブルを更新
        if (recordingsTableName && executionInput.user_id) {
            await updateRecordingsTable(
                recordingsTableName,
                executionInput.user_id,
                interviewId,
                "ERROR"
            );
        }
    }
}

/**
 * interview_id に基づいて録画テーブルのステータスを更新
 * 一致する interview_id を持つ録画を検索し、そのステータスを更新する
 */
async function updateRecordingsTable(
    tableName: string,
    userId: string,
    interviewId: string,
    newStatus: "ANALYZED" | "ERROR"
): Promise<void> {
    try {
        // user_id で録画をクエリし、一致する interview_id を持つものを見つける
        const queryResult = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: "user_id = :uid",
                FilterExpression: "interview_id = :iid",
                ExpressionAttributeValues: {
                    ":uid": userId,
                    ":iid": interviewId,
                },
            })
        );

        if (!queryResult.Items || queryResult.Items.length === 0) {
            console.log(`No recording found with interview_id: ${interviewId}`);
            return;
        }

        const now = new Date().toISOString();

        // 一致する各録画を更新
        for (const item of queryResult.Items) {
            const recordingName = item.recording_name as string;
            await docClient.send(
                new UpdateCommand({
                    TableName: tableName,
                    Key: {
                        user_id: userId,
                        recording_name: recordingName,
                    },
                    UpdateExpression: "SET #status = :status, updated_at = :updated_at",
                    ExpressionAttributeNames: {
                        "#status": "status",
                    },
                    ExpressionAttributeValues: {
                        ":status": newStatus,
                        ":updated_at": now,
                    },
                })
            );
            console.log(`Recording ${recordingName} marked as ${newStatus}`);
        }
    } catch (err) {
        console.error(`Failed to update recordings table:`, err);
        // スローしない - これは非クリティカルな更新
    }
}
