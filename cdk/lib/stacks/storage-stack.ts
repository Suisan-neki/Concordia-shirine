import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface StorageStackProps extends cdk.StackProps {
    environment: string;
}

export class StorageStack extends cdk.Stack {
    public readonly inputBucket: s3.Bucket;
    public readonly outputBucket: s3.Bucket;
    public readonly interviewsTable: dynamodb.Table;

    constructor(scope: Construct, id: string, props: StorageStackProps) {
        super(scope, id, props);

        const { environment } = props;

        // Input bucket for video uploads
        this.inputBucket = new s3.Bucket(this, "InputBucket", {
            bucketName: `concordia-input-${environment}-${this.account}`, // Renamed for project
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true, // Enable Versioning for Data Protection
            eventBridgeEnabled: true, // Enable EventBridge for S3 events
            removalPolicy:
                environment === "prod"
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: environment !== "prod",
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedOrigins: ["http://localhost:5173"],
                    allowedHeaders: ["*"],
                },
            ],
            lifecycleRules: [
                {
                    id: "DeleteIncompleteMultipartUploads",
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
                {
                    id: "TransitionToIA",
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                },
            ],
        });

        // Output bucket for processed results
        this.outputBucket = new s3.Bucket(this, "OutputBucket", {
            bucketName: `concordia-output-${environment}-${this.account}`, // Renamed for project
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            versioned: true, // Enable Versioning for Data Protection
            removalPolicy:
                environment === "prod"
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: environment !== "prod",
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowedOrigins: ["http://localhost:5173"],
                    allowedHeaders: ["*"],
                    exposedHeaders: ["ETag"],
                },
            ],
            lifecycleRules: [
                {
                    id: "DeleteOldResults",
                    expiration: cdk.Duration.days(90),
                },
            ],
        });

        // DynamoDB table for interview data
        this.interviewsTable = new dynamodb.Table(this, "InterviewsTable", {
            tableName: `concordia-interviews-${environment}`,
            partitionKey: {
                name: "interview_id",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy:
                environment === "prod"
                    ? cdk.RemovalPolicy.RETAIN
                    : cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "expires_at",
            pointInTimeRecovery: environment === "prod",
        });

        // GSI for segment-based queries
        this.interviewsTable.addGlobalSecondaryIndex({
            indexName: "segment-index",
            partitionKey: {
                name: "segment",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "created_at",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // Outputs
        new cdk.CfnOutput(this, "InputBucketName", {
            value: this.inputBucket.bucketName,
            exportName: `${id}-InputBucketName`,
        });

        new cdk.CfnOutput(this, "OutputBucketName", {
            value: this.outputBucket.bucketName,
            exportName: `${id}-OutputBucketName`,
        });

        new cdk.CfnOutput(this, "InterviewsTableName", {
            value: this.interviewsTable.tableName,
            exportName: `${id}-InterviewsTableName`,
        });

        new cdk.CfnOutput(this, "InterviewsTableArn", {
            value: this.interviewsTable.tableArn,
            exportName: `${id}-InterviewsTableArn`,
        });
    }
}
