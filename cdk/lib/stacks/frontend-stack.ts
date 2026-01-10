import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";

export interface FrontendStackProps extends cdk.StackProps {
  environment: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly distributionDomain: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // 1. S3 Bucket for Website Hosting
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `concordia-web-${environment}-${this.account}`,
      removalPolicy:
        environment === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== "prod",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Security Best Practice
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // 2. CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html", // SPA Routing support
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
      comment: `Concordia Shrine Frontend (${environment})`,
    });

    this.distributionDomain = `https://${distribution.distributionDomainName}`;

    // 3. Deployment (Upload dist folder)
    // Note: We assume the frontend is built before deploying
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../../dist/public"))],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ["/*"], // Invalidate cache on deploy
    });

    // Outputs
    new cdk.CfnOutput(this, "SiteUrl", {
      value: this.distributionDomain,
      description: "CloudFront URL for the website",
      exportName: `${id}-SiteUrl`,
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      exportName: `${id}-DistributionId`,
    });
  }
}
