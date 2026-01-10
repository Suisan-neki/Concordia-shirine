import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface AuthStackProps extends cdk.StackProps {
    environment: string;
    frontendUrl?: string; // Optional CloudFront URL
}

export class AuthStack extends cdk.Stack {
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;

    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);

        const { environment } = props;

        // 1. User Pool
        this.userPool = new cognito.UserPool(this, "ConcordiaUserPool", {
            userPoolName: `concordia-users-${environment}`,
            selfSignUpEnabled: true, // Allow users to sign up themselves for now
            signInAliases: {
                email: true,
                username: true,
            },
            autoVerify: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For prototype; RETAIN for prod
        });

        // 2. User Pool Client
        this.userPoolClient = this.userPool.addClient("ConcordiaClient", {
            userPoolClientName: `concordia-client-${environment}`,
            generateSecret: false, // Public client (Single Page App)
            oAuth: {
                flows: {
                    implicitCodeGrant: true, // Returns tokens directly in URL hash
                },
                scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
                callbackUrls: [
                    "http://localhost:5173",
                    "http://localhost:5173/",
                    ...(props.frontendUrl ? [props.frontendUrl, `${props.frontendUrl}/`] : [])
                ],
                logoutUrls: [
                    "http://localhost:5173",
                    ...(props.frontendUrl ? [props.frontendUrl] : [])
                ],
            },
        });

        // 3. User Pool Domain (Hosted UI)
        // Adding a random-ish suffix to ensure uniqueness globally
        const domainPrefix = `concordia-auth-${this.account}-${environment}`;
        const domain = this.userPool.addDomain("ConcordiaAuthDomain", {
            cognitoDomain: {
                domainPrefix: domainPrefix,
            },
        });

        // 4. UI Customization
        // Match the app's dark blue/purple theme (Simplified for debugging)
        const css = `
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
        `;

        // Renamed to Force-Recreate because the previous one might be stuck
        new cognito.CfnUserPoolUICustomizationAttachment(this, "UiCustomization", {
            userPoolId: this.userPool.userPoolId,
            clientId: this.userPoolClient.userPoolClientId,
            css: css,
        });

        // Outputs
        new cdk.CfnOutput(this, "UserPoolId", {
            value: this.userPool.userPoolId,
        });
        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: this.userPoolClient.userPoolClientId,
        });
        new cdk.CfnOutput(this, "AuthDomain", {
            value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com`,
        });
    }
}
