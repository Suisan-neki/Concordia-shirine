import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface AuthStackProps extends cdk.StackProps {
    environment: string;
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
                callbackUrls: ["http://localhost:5173", "http://localhost:5173/"], // Localhost for dev
                logoutUrls: ["http://localhost:5173"],
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
        // Match the app's dark blue/purple theme (using CSS gradients only, no Data URI to avoid issues)
        const css = `
            .background-customizable {
                background-color: #0c1020;
                background-image: 
                    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 40%),
                    radial-gradient(circle at 80% 10%, rgba(255,255,255,0.05), transparent 45%),
                    linear-gradient(135deg, #0b1326, #0c1b2f 50%, #0c1020);
                font-family: "Segoe UI", sans-serif;
            }
            .banner-customizable {
                background-color: transparent;
            }
            .submitButton-customizable {
                background: linear-gradient(135deg, #667eea, #764ba2);
                border: none;
                border-radius: 4px;
                font-weight: bold;
                transition: transform 0.1s ease;
            }
            .submitButton-customizable:hover {
                background: linear-gradient(135deg, #764ba2, #667eea);
                transform: translateY(-1px);
            }
            .label-customizable {
                color: #e6f2ff;
                font-weight: 400;
            }
            .textDescription-customizable {
                color: #b0c4de;
            }
            .inputField-customizable {
                background-color: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                border-radius: 4px;
            }
            .inputField-customizable:focus {
                border-color: #7bd6ff;
                box-shadow: 0 0 0 1px #7bd6ff;
            }
            .redirect-customizable {
                color: #7bd6ff;
            }
            .legalText-customizable {
                color: #7bd6ff;
            }
        `;

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
