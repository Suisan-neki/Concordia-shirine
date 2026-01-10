import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "../lib/stacks/storage-stack";
import { FrontendStack } from "../lib/stacks/frontend-stack";
import { LambdaStack } from "../lib/stacks/lambda-stack";
import { StepFunctionsStack } from "../lib/stacks/stepfunctions-stack";
import { AuthStack } from "../lib/stacks/auth-stack";
import { ApiStack } from "../lib/stacks/api-stack";

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext("env") || "dev";

// Common props
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "ap-northeast-1",
};

// 0. Frontend Stack (Website Hosting)
const frontendStack = new FrontendStack(app, `ConcordiaFrontend-${environment}`, {
    env,
    environment,
});

// 1. Storage Stack (DynamoDB, S3)
const storageStack = new StorageStack(app, `ConcordiaStorage-${environment}`, {
    env,
    environment,
});

// 2. Auth Stack (Cognito)
const authStack = new AuthStack(app, `ConcordiaAuth-${environment}`, {
    env,
    environment,
    frontendUrl: frontendStack.distributionDomain,
});

// 3. Lambda Stack (Now Dockerless / ARM64)
const lambdaStack = new LambdaStack(app, `ConcordiaLambda-${environment}`, {
    env,
    environment,
    inputBucket: storageStack.inputBucket,
    outputBucket: storageStack.outputBucket,
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    hfToken: process.env.HF_TOKEN || "",
    interviewsTable: storageStack.interviewsTable,
});
lambdaStack.addDependency(storageStack);

// 4. Step Functions Stack (Orchestration)
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
    }
);
stepFunctionsStack.addDependency(lambdaStack);
stepFunctionsStack.addDependency(storageStack);

// 6. API Stack (Gateway)
const apiStack = new ApiStack(app, `ConcordiaApi-${environment}`, {
    env,
    environment,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    realtimeTranscribeFn: lambdaStack.realtimeTranscribeFn,
    coachFn: lambdaStack.coachFn,
    // Env vars for tRPC & Auth
    databaseUrl: process.env.DATABASE_URL || "",
    jwtSecret: process.env.JWT_SECRET || "",
    appId: process.env.VITE_APP_ID || "",
    oauthServerUrl: process.env.OAUTH_SERVER_URL || "",
    ownerOpenId: process.env.OWNER_OPEN_ID || "",
});
apiStack.addDependency(lambdaStack);
apiStack.addDependency(authStack);
