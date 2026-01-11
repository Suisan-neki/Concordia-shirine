import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface AuthStackProps extends cdk.StackProps {
    environment: string;
    domainName?: string; // オプション: カスタムドメイン
}

export class AuthStack extends cdk.Stack {
    public readonly userPool: cognito.IUserPool;
    public readonly userPoolClient: cognito.IUserPoolClient;
    public readonly ownerOpenId: string;

    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);

        const { environment } = props;

        // 1. User Pool の定義
        this.userPool = new cognito.UserPool(this, "ConcordiaUserPool", {
            userPoolName: `concordia-user-pool-${environment}`,
            selfSignUpEnabled: true, // 招待ベースまたは自己登録

            // サインインエイリアス
            signInAliases: {
                email: true,
                username: false,
            },

            // パスワードポリシー
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(7),
            },

            // アカウント回復
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

            // 検証メール
            autoVerify: {
                email: true,
            },
            userVerification: {
                emailSubject: "Concordia アカウントの検証",
                emailBody: "あなたの検証コードは {####} です。",
                emailStyle: cognito.VerificationEmailStyle.CODE,
            },

            // 標準属性
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                fullname: {
                    required: true,
                    mutable: true,
                },
            },

            // 削除ポリシー
            removalPolicy: environment === "prod"
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });

        // 2. User Pool Client の定義
        this.userPoolClient = this.userPool.addClient("ConcordiaClient", {
            userPoolClientName: `concordia-client-${environment}`,
            generateSecret: false, // SPA (Single Page App) のため false

            // 認証フロー
            authFlows: {
                userSrp: true,
                custom: true,
            },

            // トークンの有効性
            accessTokenValidity: cdk.Duration.minutes(60),
            idTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(30),

            // 属性の読み書き権限
            readAttributes: new cognito.ClientAttributes().withStandardAttributes({
                email: true,
                emailVerified: true,
                fullname: true,
            }),
            writeAttributes: new cognito.ClientAttributes().withStandardAttributes({
                email: true,
                fullname: true,
            }),
        });

        // 3. User Pool Domain (ホステッドUI用)
        // 必要に応じて有効化。今回の要件では必須ではないかもしれないが、あると便利。
        const userPoolDomain = this.userPool.addDomain("ConcordiaDomain", {
            cognitoDomain: {
                domainPrefix: `concordia-${environment}-${this.account}`, // グローバルに一意である必要がある
            },
        });

        // 4. オーナーのOpenID (SSMパラメータストアから取得するなど)
        // ここではデモ用にハードコードするか、環境変数から取得
        // 実際には、管理者の Cognito `sub` (Subject ID) を指定します。
        // デプロイ後に手動で設定するか、Lookup で取得する構成にします。
        // 今回はプレースホルダーを設定し、後で SSM などで注入可能な形にします。
        this.ownerOpenId = "placeholder-owner-id";

        // Outputs
        new cdk.CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
            exportName: `${id}-UserPoolId`,
        });

        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: this.userPoolClient.userPoolClientId,
            exportName: `${id}-UserPoolClientId`,
        });

        new cdk.CfnOutput(this, "UserPoolDomain", {
            value: userPoolDomain.domainName,
            exportName: `${id}-UserPoolDomain`,
        });
    }
}
