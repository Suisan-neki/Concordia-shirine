import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2_authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
    environment: string;
    realtimeTranscribeFn: lambda.IFunction;
    coachFn: lambda.IFunction;
    userPool: cognito.IUserPool;
    userPoolClient: cognito.IUserPoolClient;
    // Env vars for tRPC
    databaseUrl: string;
    jwtSecret: string;
    appId: string;
    oauthServerUrl: string;
    ownerOpenId: string;
}

export class ApiStack extends cdk.Stack {
    public readonly httpApi: apigwv2.HttpApi;
    public readonly trpcFn: lambda_nodejs.NodejsFunction;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const {
            environment,
            realtimeTranscribeFn,
            coachFn,
            userPool,
            userPoolClient,
            databaseUrl,
            jwtSecret,
            appId,
            oauthServerUrl,
            ownerOpenId
        } = props;

        // Define Authorizer
        const authorizer = new apigwv2_authorizers.HttpUserPoolAuthorizer(
            "ConcordiaAuthorizer",
            userPool,
            {
                userPoolClients: [userPoolClient],
            }
        );

        // Define HTTP API
        this.httpApi = new apigwv2.HttpApi(this, "ConcordiaApi", {
            apiName: `concordia-api-${environment}`,
            description: "API for Concordia Real-time Transcription",
            createDefaultStage: false, // We will create a manual stage with settings
            corsPreflight: {
                allowOrigins: ["*"], // Allow CloudFront origin
                allowMethods: [
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.OPTIONS,
                    apigwv2.CorsHttpMethod.GET,
                ],
                allowHeaders: ["Content-Type", "Authorization"],
                maxAge: cdk.Duration.days(1),
            },
        });

        // Access Logs Group
        const logGroup = new logs.LogGroup(this, "ApiAccessLogs", {
            logGroupName: `/aws/vendedlogs/http-api/${environment}-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_WEEK,
        });

        // Default Stage with Throttling
        const stage = new apigwv2.HttpStage(this, "DefaultStage", {
            httpApi: this.httpApi,
            stageName: "$default",
            autoDeploy: true,
            throttle: {
                rateLimit: 100, // 100 requests per second
                burstLimit: 200, // 200 requests burst
            },
        });

        // Add Access Logs via CfnStage (Escape Hatch for flexibility/compatibility)
        const cfnStage = stage.node.defaultChild as apigwv2.CfnStage;
        cfnStage.accessLogSettings = {
            destinationArn: logGroup.logGroupArn,
            format: JSON.stringify({
                requestId: "$context.requestId",
                ip: "$context.identity.sourceIp",
                requestTime: "$context.requestTime",
                httpMethod: "$context.httpMethod",
                routeKey: "$context.routeKey",
                status: "$context.status",
                protocol: "$context.protocol",
                responseLength: "$context.responseLength",
                errorMessage: "$context.error.message",
                user: "$context.authorizer.claims.email" // Log user email if available
            }),
        };

        // Add Route for Transcribe (Protected)
        const transcribeIntegration = new apigwv2_integrations.HttpLambdaIntegration(
            "TranscribeIntegration",
            realtimeTranscribeFn
        );

        this.httpApi.addRoutes({
            path: "/transcribe",
            methods: [apigwv2.HttpMethod.POST],
            integration: transcribeIntegration,
            authorizer: authorizer,
        });

        // Add Route for Coach (Protected)
        const coachIntegration = new apigwv2_integrations.HttpLambdaIntegration(
            "CoachIntegration",
            coachFn
        );

        this.httpApi.addRoutes({
            path: "/coach",
            methods: [apigwv2.HttpMethod.POST],
            integration: coachIntegration,
            authorizer: authorizer,
        });

        // tRPC Lambda
        this.trpcFn = new lambda_nodejs.NodejsFunction(this, "TrpcFn", {
            entry: path.join(__dirname, "../../../server/aws-lambda.ts"),
            handler: "handler",
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.ARM_64,
            memorySize: 512,
            timeout: cdk.Duration.seconds(10),
            environment: {
                DATABASE_URL: databaseUrl,
                JWT_SECRET: jwtSecret,
                VITE_APP_ID: appId,
                OAUTH_SERVER_URL: oauthServerUrl,
                OWNER_OPEN_ID: ownerOpenId,
                NODE_ENV: "production",
            },
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ["@aws-sdk/client-s3"], // Available in Lambda runtime
            },
        });

        const trpcIntegration = new apigwv2_integrations.HttpLambdaIntegration(
            "TrpcIntegration",
            this.trpcFn
        );

        // Add Route for tRPC (Public & Protected handled by tRPC router itself)
        // Note: We might want Authorizer here if ALL tRPC calls need it, 
        // but typically tRPC handles public/protected procedures.
        // For simplicity, we open it up and let tRPC router handle auth logic via context.
        this.httpApi.addRoutes({
            path: "/trpc/{proxy+}",
            methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
            integration: trpcIntegration,
            // authorizer: authorizer, // Optional: let tRPC middleware handle it
        });


        // Outputs
        new cdk.CfnOutput(this, "ApiEndpoint", {
            value: this.httpApi.apiEndpoint,
            exportName: `${id}-ApiEndpoint`,
        });
    }
}
