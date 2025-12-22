import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigwv2_authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
    environment: string;
    realtimeTranscribeFn: lambda.IFunction;
    userPool: cognito.IUserPool;
    userPoolClient: cognito.IUserPoolClient;
}

export class ApiStack extends cdk.Stack {
    public readonly httpApi: apigwv2.HttpApi;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const { environment, realtimeTranscribeFn, userPool, userPoolClient } = props;

        // Define Authorizer
        const authorizer = new apigwv2_authorizers.HttpUserPoolAuthorizer(
            "ConcordiaAuthorizer",
            userPool,
            {
                userPoolClients: [userPoolClient],
            }
        );

        // Define HTTP API (cheaper and faster than REST API)
        this.httpApi = new apigwv2.HttpApi(this, "ConcordiaApi", {
            apiName: `concordia-api-${environment}`,
            description: "API for Concordia Real-time Transcription",
            corsPreflight: {
                allowOrigins: ["http://localhost:5173"], // Restrict to localhost for now
                allowMethods: [
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: ["Content-Type", "Authorization"], // Authorization header is critical
                maxAge: cdk.Duration.days(1),
            },
        });

        // Add Route for Transcribe (Protected)
        const transcribeIntegration = new apigwv2_integrations.HttpLambdaIntegration(
            "TranscribeIntegration",
            realtimeTranscribeFn
        );

        this.httpApi.addRoutes({
            path: "/transcribe",
            methods: [apigwv2.HttpMethod.POST],
            integration: transcribeIntegration,
            authorizer: authorizer, // Attach Authorizer
        });

        // Outputs
        new cdk.CfnOutput(this, "ApiEndpoint", {
            value: this.httpApi.apiEndpoint,
            exportName: `${id}-ApiEndpoint`,
        });
    }
}
