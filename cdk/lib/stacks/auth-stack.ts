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
            userPoolName: `concordia-users-${environment}`,
            selfSignUpEnabled: true, // 招待ベースまたは自己登録

            // サインインエイリアス
            signInAliases: {
                email: true,
                username: true,
            },

            // パスワードポリシー
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
            },

            // アカウント回復
            accountRecovery: cognito.AccountRecovery.PHONE_WITHOUT_MFA_AND_EMAIL,

            // 検証メール
            autoVerify: {
                email: true,
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

            // OAuth 設定
            oAuth: {
                flows: {
                    implicitCodeGrant: true,
                },
                scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
                callbackUrls: [
                    "http://localhost:5173",
                    "http://localhost:5173/",
                    "http://localhost:5173/api/auth/cognito/callback",
                    "https://d3c6naoshv8a7s.cloudfront.net",
                    "https://d3c6naoshv8a7s.cloudfront.net/",
                ],
                logoutUrls: [
                    "http://localhost:5173",
                    "https://d3c6naoshv8a7s.cloudfront.net",
                ],
            },
        });

        // 3. User Pool Domain (ホステッドUI用)
        // 必要に応じて有効化。今回の要件では必須ではないかもしれないが、あると便利。
        const userPoolDomain = this.userPool.addDomain("ConcordiaAuthDomain", {
            cognitoDomain: {
                domainPrefix: `concordia-auth-${this.account}-${environment}`, // グローバルに一意である必要がある
            },
        });

        new cognito.CfnUserPoolUICustomizationAttachment(
            this,
            "UiCustomization",
            {
                clientId: this.userPoolClient.userPoolClientId,
                userPoolId: this.userPool.userPoolId,
                css: `
            .background-customizable {
                background-color: #0c1020 !important;
                font-family: "Segoe UI", sans-serif;
            }
            .submitButton-customizable {
                background-color: #667eea !important;
                border-radius: 4px;
                font-weight: bold;
            }
            .label-customizable {
                color: #e6f2ff !important;
            }
            .textDescription-customizable {
                color: #b0c4de !important;
            }
            .inputField-customizable {
                background-color: #2a3b55 !important;
                color: #ffffff !important;
                border: 1px solid #777;
            }
            .redirect-customizable {
                color: #7bd6ff !important;
            }
            .legalText-customizable {
                color: #7bd6ff !important;
            }
        `,
            }
        );

        // 4. オーナーのOpenID (SSMパラメータストアから取得するなど)
        // ここではデモ用にハードコードするか、環境変数から取得
        // 実際には、管理者の Cognito `sub` (Subject ID) を指定します。
        // デプロイ後に手動で設定するか、Lookup で取得する構成にします。
        // 今回はプレースホルダーを設定し、後で SSM などで注入可能な形にします。
        this.ownerOpenId = "placeholder-owner-id";

        // Outputs
        new cdk.CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
        });

        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: this.userPoolClient.userPoolClientId,
        });

        new cdk.CfnOutput(this, "AuthDomain", {
            value: userPoolDomain.baseUrl(),
        });
    }
}
