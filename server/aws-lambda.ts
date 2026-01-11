import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import type { Request } from "express";

// AWS Lambda 用のコンテキストを作成
const createContext = async ({
    event,
}: {
    event: APIGatewayProxyEvent;
}): Promise<TrpcContext> => {
    // SDK認証のために Express Request オブジェクトをモック化
    // SDK は req.headers.cookie を必要とします
    const mockReq = {
        headers: event.headers || {},
        cookies: event.headers?.cookie || event.headers?.Cookie || "",
    } as unknown as Request;

    let user = null;
    try {
        user = await sdk.authenticateRequest(mockReq);
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
