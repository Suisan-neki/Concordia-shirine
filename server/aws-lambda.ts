import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { appRouter } from "./routers";
import { authenticateRequest } from "./_core/cognito";
import type { TrpcContext } from "./_core/context";
import type { Request } from "express";

// AWS Lambda 用のコンテキストを作成
const createContext = async ({
    event,
}: {
    event: APIGatewayProxyEvent;
}): Promise<TrpcContext> => {
    // Authorization header to verify Cognito tokens
    const mockReq = {
        headers: event.headers || {},
    } as unknown as Request;

    let user = null;
    try {
        user = await authenticateRequest(mockReq, { updateUser: false });
    } catch (error) {
        // 認証失敗またはオプション
        console.warn("Authentication failed in Lambda context:", error);
    }

    return {
        req: mockReq as any,
        res: {} as any, // 必要であればレスポンスをモック化
        user,
    };
};

export const handler = awsLambdaRequestHandler({
    router: appRouter,
    createContext,
});
