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

    // 1. ウェブサイトホスティング用の S3 バケット
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `concordia-web-${environment}-${this.account}`,
      removalPolicy:
        environment === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== "prod",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // セキュリティのベストプラクティス
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // 2. CloudFront ディストリビューション
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
          responsePagePath: "/index.html", // SPA ルーティングのサポート
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

    // 3. デプロイ (dist フォルダのアップロード)
    // Note: フロントエンドはデプロイ前にビルドされていると想定
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../../dist/public"))],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ["/index.html"], // SPA entry only to reduce invalidation cost
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
