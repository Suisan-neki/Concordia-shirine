import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import type { Request } from "express";

// Create context for AWS Lambda
const createContext = async ({
    event,
}: {
    event: APIGatewayProxyEvent;
}): Promise<TrpcContext> => {
    // Mock Express Request object for SDK authentication
    // SDK needs req.headers.cookie
    const mockReq = {
        headers: event.headers || {},
        cookies: event.headers?.cookie || event.headers?.Cookie || "",
    } as unknown as Request;

    let user = null;
    try {
        user = await sdk.authenticateRequest(mockReq);
    } catch (error) {
        // Auth failed or optional
        console.warn("Authentication failed in Lambda context:", error);
    }

    return {
        req: mockReq as any,
        res: {} as any, // Mock response if needed
        user,
    };
};

export const handler = awsLambdaRequestHandler({
    router: appRouter,
    createContext,
});
