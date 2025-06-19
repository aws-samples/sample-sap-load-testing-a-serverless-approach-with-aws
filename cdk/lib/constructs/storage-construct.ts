import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

import {
  ARTEFACTS_S3_BUCKET_NAME_PREFIX,
  EXECUTIONS_ASSETS_S3_PREFIX,
  METRICS_S3_BUCKET_NAME_PREFIX,
} from "../constants";
import { NagSuppressions } from "cdk-nag";

export class StorageConstruct extends Construct {
  readonly s3BucketForMetrics: cdk.aws_s3.Bucket;
  readonly s3BucketForArtefacts: cdk.aws_s3.Bucket;

  private s3BucketForMetricsName = `sap-load-test-cw-metrics-${
    cdk.Stack.of(this).account
  }-${cdk.Stack.of(this).region}`;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const S3_NAME_SUFFIX = `${cdk.Stack.of(this).account}-${
      cdk.Stack.of(this).region
    }`;

    //create s3 bucket
    const bucketForArtefacts = new cdk.aws_s3.Bucket(
      this,
      "S3BucketForArtefacts",
      {
        bucketName: `${ARTEFACTS_S3_BUCKET_NAME_PREFIX}-${S3_NAME_SUFFIX}`,
        versioned: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        autoDeleteObjects: true,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        //ADD CORS CONFIGURATION
        cors: [
          {
            allowedMethods: [
              cdk.aws_s3.HttpMethods.GET,
              cdk.aws_s3.HttpMethods.POST,
              cdk.aws_s3.HttpMethods.PUT,
            ],
            allowedOrigins: ["*"],
            allowedHeaders: ["*"],
          },
        ],
      }
    );
    this.s3BucketForArtefacts = bucketForArtefacts;

    //suppress nag rule AwsSolutions-S1 because access logs are not needed
    NagSuppressions.addResourceSuppressions(bucketForArtefacts, [
      {
        id: "AwsSolutions-S1",
        reason: "Access logs are not needed for this bucket",
      },
    ]);

    new s3deploy.BucketDeployment(this, "DeployTestExecutionsAssetsDirectory", {
      sources: [cdk.aws_s3_deployment.Source.asset("resources/dummy")],
      destinationBucket: bucketForArtefacts,
      destinationKeyPrefix: `${EXECUTIONS_ASSETS_S3_PREFIX}`,
    });

    var customDeployment = scope.node.children.filter((node) =>
      node.node.id.startsWith("Custom::CDKBucketDeployment")
    )[0].node.id;
    NagSuppressions.addResourceSuppressions(
      scope.node.findChild(customDeployment) as cdk.CfnResource,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Can't control managed policie resources in BucketDeployments",
        },
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Can't control managed policie resources in BucketDeployments",
        },
        {
          id: "AwsSolutions-L1",
          reason:
            "Can't control managed policie resources in BucketDeployments",
        },
      ],
      true
    );

    //create s3 bucket with s3BucketForMetricsName name
    const s3BucketForMetrics = new cdk.aws_s3.Bucket(
      this,
      "s3BucketForMetrics",
      {
        bucketName: `${METRICS_S3_BUCKET_NAME_PREFIX}-${S3_NAME_SUFFIX}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      }
    );
    this.s3BucketForMetrics = s3BucketForMetrics;

    //suppress nag rule AwsSolutions-S1 because access logs are not needed
    NagSuppressions.addResourceSuppressions(s3BucketForMetrics, [
      {
        id: "AwsSolutions-S1",
        reason: "Access logs are not needed for this bucket",
      },
    ]);
  }
}
