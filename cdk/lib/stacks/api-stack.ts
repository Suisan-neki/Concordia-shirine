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
    // tRPC 用の環境変数
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

        // Authorizer の定義
        const authorizer = new apigwv2_authorizers.HttpUserPoolAuthorizer(
            "ConcordiaAuthorizer",
            userPool,
            {
                userPoolClients: [userPoolClient],
            }
        );

        // HTTP API の定義
        this.httpApi = new apigwv2.HttpApi(this, "ConcordiaApi", {
            apiName: `concordia-api-${environment}`,
            description: "API for Concordia Real-time Transcription",
            createDefaultStage: false, // 設定付きの手動ステージを作成するため
            corsPreflight: {
                allowOrigins: ["*"], // CloudFront オリジンを許可
                allowMethods: [
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.OPTIONS,
                    apigwv2.CorsHttpMethod.GET,
                ],
                allowHeaders: ["Content-Type", "Authorization"],
                maxAge: cdk.Duration.days(1),
            },
        });

        // アクセスロググループ
        const logGroup = new logs.LogGroup(this, "ApiAccessLogs", {
            logGroupName: `/aws/vendedlogs/http-api/${environment}-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_WEEK,
        });

        // スロットリング付きのデフォルトステージ
        const stage = new apigwv2.HttpStage(this, "DefaultStage", {
            httpApi: this.httpApi,
            stageName: "$default",
            autoDeploy: true,
            throttle: {
                rateLimit: 100, // 毎秒100リクエスト
                burstLimit: 200, // バースト200リクエスト
            },
        });

        // CfnStage 経由でアクセスログを追加 (柔軟性/互換性のため)
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
                user: "$context.authorizer.claims.email" // 利用可能な場合ユーザーのメールをログ記録
            }),
        };

        // Transcribe 用のルートを追加 (保護あり)
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

        // Coach 用のルートを追加 (保護あり)
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
                COGNITO_REGION: cdk.Stack.of(this).region,
                COGNITO_USER_POOL_ID: userPool.userPoolId,
                COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
            },
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ["@aws-sdk/client-s3"], // Lambda ランタイムで利用可能
            },
        });

        const trpcIntegration = new apigwv2_integrations.HttpLambdaIntegration(
            "TrpcIntegration",
            this.trpcFn
        );

        // tRPC 用のルートを追加 (Public & Protected は tRPC ルーター自体で処理)
        // Note: すべての tRPC 呼び出しに Authorizer が必要な場合はここで設定しますが、
        // 通常 tRPC は public/protected プロシージャを処理します。
        // 簡単のため、ここは開放し、tRPC ルーターにコンテキスト経由で認証ロジックを処理させます。
        this.httpApi.addRoutes({
            path: "/trpc/{proxy+}",
            methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
            integration: trpcIntegration,
            // authorizer: authorizer, // オプション: tRPC ミドルウェアに任せる
        });


        // Outputs
        new cdk.CfnOutput(this, "ApiEndpoint", {
            value: this.httpApi.apiEndpoint,
            exportName: `${id}-ApiEndpoint`,
        });
    }
}
