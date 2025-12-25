import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "../lib/stacks/storage-stack";
import { LambdaStack } from "../lib/stacks/lambda-stack";
import { StepFunctionsStack } from "../lib/stacks/stepfunctions-stack";
import { ApiStack } from "../lib/stacks/api-stack";
import { AuthStack } from "../lib/stacks/auth-stack";

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext("environment") || "dev";

// Common props
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "ap-northeast-1",
};

// Auth Stack
const authStack = new AuthStack(app, `ConcordiaAuth-${environment}`, {
    env,
    environment,
    description: "Cognito User Pool for Concordia Pipeline",
});

// Storage Stack
const storageStack = new StorageStack(app, `ConcordiaStorage-${environment}`, {
    env,
    environment,
    description: "S3 buckets and Secrets Manager for Concordia Pipeline",
});

// Lambda Stack
const lambdaStack = new LambdaStack(app, `ConcordiaLambda-${environment}`, {
    env,
    environment,
    inputBucket: storageStack.inputBucket,
    outputBucket: storageStack.outputBucket,
    openaiSecret: storageStack.openaiSecret,
    huggingfaceSecret: storageStack.huggingfaceSecret,
    interviewsTable: storageStack.interviewsTable,
    description: "Lambda functions for Concordia Pipeline",
});
lambdaStack.addDependency(storageStack);

// Step Functions Stack
const stepFunctionsStack = new StepFunctionsStack(
    app,
    `ConcordiaStepFunctions-${environment}`,
    {
        env,
        environment,
        inputBucket: storageStack.inputBucket,
        outputBucket: storageStack.outputBucket,
        interviewsTable: storageStack.interviewsTable,
        extractAudioFn: lambdaStack.extractAudioFn,
        chunkAudioFn: lambdaStack.chunkAudioFn,
        diarizeFn: lambdaStack.diarizeFn,
        mergeSpeakersFn: lambdaStack.mergeSpeakersFn,
        splitBySpeakerFn: lambdaStack.splitBySpeakerFn,
        transcribeFn: lambdaStack.transcribeFn,
        aggregateResultsFn: lambdaStack.aggregateResultsFn,
        llmAnalysisFn: lambdaStack.llmAnalysisFn,
        description: "Step Functions state machine for Concordia Pipeline",
    }
);
stepFunctionsStack.addDependency(lambdaStack);
stepFunctionsStack.addDependency(storageStack);

// API Stack
const apiStack = new ApiStack(app, `ConcordiaApi-${environment}`, {
    environment,
    realtimeTranscribeFn: lambdaStack.realtimeTranscribeFn,
    coachFn: lambdaStack.coachFn,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    crossRegionReferences: true,
});
apiStack.addDependency(lambdaStack);
apiStack.addDependency(authStack);
