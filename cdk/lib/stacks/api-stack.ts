import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2_authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
    environment: string;
    realtimeTranscribeFn: lambda.IFunction;
    coachFn: lambda.IFunction;
    userPool: cognito.IUserPool;
    userPoolClient: cognito.IUserPoolClient;
}

export class ApiStack extends cdk.Stack {
    public readonly httpApi: apigwv2.HttpApi;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const { environment, realtimeTranscribeFn, coachFn, userPool, userPoolClient } = props;

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

        // Outputs
        new cdk.CfnOutput(this, "ApiEndpoint", {
            value: this.httpApi.apiEndpoint,
            exportName: `${id}-ApiEndpoint`,
        });
    }
}
