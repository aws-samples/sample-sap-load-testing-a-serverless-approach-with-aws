import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Code, Runtime, Function, Alias } from "aws-cdk-lib/aws-lambda";
import { PythonLayerVersion } from "@aws-cdk/aws-lambda-python-alpha";
import path = require("path");
//import { LAMBDA_CHECK_SSM_FUNCTION_NAME, LAMBDA_CW_PUSH_METRICS_FUNCTION_NAME, LAMBDA_LAYER_NAME, LAMBDA_START_ALL_TEST_FUNCTION_NAME, SECRET_MANAGER_NAME_PREFIX } from '../constants';
import {
  BATCH_JOB_DEFINITION_NAME_PREFIX,
  BATCH_JOB_QUEUE_NAME,
  GLUE_DATABASE_NAME,
  GLUE_TABLE_NAME,
  LAMBDA_CHECK_BATCH_STATUS_FUNCTION_NAME,
  LAMBDA_CHECK_SSM_FUNCTION_NAME,
  LAMBDA_CW_PUSH_METRICS_FUNCTION_NAME,
  LAMBDA_GET_PRESIGNED_S3_URL_FUNCTION_NAME,
  LAMBDA_LAYER_NAME,
  LAMBDA_START_ALL_TEST_FUNCTION_NAME,
  SECRET_MANAGER_NAME_PREFIX,
} from "../constants";
import { NagSuppressions } from "cdk-nag";

export interface LambdaProps {
  s3BucketForMetrics: cdk.aws_s3.Bucket;
  s3BucketForArtefacts: cdk.aws_s3.Bucket;
}

export class LambdaConstruct extends Construct {
  readonly startAllTestsFunction: Function;
  readonly checkSSMFunction: Function;
  readonly cwPushMetricsFunction: Function;
  readonly checkBatchJobStatusFunction: Function;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const ec2Statement = new cdk.aws_iam.PolicyStatement({
      actions: [
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
      ],
      resources: ["*"],
    });
    const ssmStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["ssm:*"],
      resources: ["*"],
    });

    const batchJobStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["batch:*"],
      resources: [
        `arn:aws:batch:${region}:${accountId}:job-definition:${BATCH_JOB_DEFINITION_NAME_PREFIX}*`,
        `arn:aws:batch:${region}:${accountId}:job-definition:${BATCH_JOB_DEFINITION_NAME_PREFIX}*:*`,
        `arn:aws:batch:${region}:${accountId}:job-queue:${BATCH_JOB_QUEUE_NAME}`,
      ],
    });

    const batchListJobStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["batch:DescribeJobs"],
      resources: ["*"],
    });

    const presignedS3UrlStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["s3:*"],
      resources: [
        props.s3BucketForArtefacts.bucketArn,
        `${props.s3BucketForArtefacts.bucketArn}/*`,
      ],
    });

    const secretsmanagereadonlyStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [
        `arn:aws:secretsmanager:${region}:${accountId}:secret:${SECRET_MANAGER_NAME_PREFIX}*`,
      ],
    });
    const athenaStatement = new cdk.aws_iam.PolicyStatement({
      actions: [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "s3:GetBucketLocation",
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:BatchCreatePartition",
      ],
      resources: ["*"],
    });

    const ec2CwStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["ec2:DescribeInstances"],
      resources: ["*"],
    });

    const cloudwatchStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["cloudwatch:GetMetricData"],
      resources: ["*"],
    });

    const s3MetricsStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["s3:PutObject", "s3:GetObject", "s3:ListObjects"],
      resources: [
        props.s3BucketForMetrics.bucketArn,
        `${props.s3BucketForMetrics.bucketArn}/*`,
      ],
    });

    const lambdaLayer = new PythonLayerVersion(this, `${id}LambdaLayer`, {
      layerVersionName: LAMBDA_LAYER_NAME,
      entry: path.join(__dirname, "../../resources/lambdas/common/layer"),
      compatibleRuntimes: [Runtime.PYTHON_3_13],
      description: "A layer that contains the required modules",
      license: "MIT License",
    });

    const startAllTestsFunction = new Function(
      this,
      `StartAllTestsLambdaFunction`,
      {
        functionName: LAMBDA_START_ALL_TEST_FUNCTION_NAME,
        runtime: Runtime.PYTHON_3_13,
        code: Code.fromAsset(
          path.resolve(
            __dirname,
            "../../resources/lambdas/starts_all_tests/src/"
          )
        ),
        handler: "lambda_function.lambda_handler",
        layers: [lambdaLayer],
        environment: {
          SECRET_NAME_PREFIX: SECRET_MANAGER_NAME_PREFIX, //probably not needed as the full secret name in the step function payload
        },
        timeout: cdk.Duration.seconds(300),
      }
    );
    startAllTestsFunction.addToRolePolicy(ec2Statement);
    startAllTestsFunction.addToRolePolicy(ssmStatement);
    startAllTestsFunction.addToRolePolicy(secretsmanagereadonlyStatement);
    new cdk.CfnOutput(this, "StartAllTestsLambdaFunctionName", {
      value: startAllTestsFunction.functionName,
      exportName: "startAllTestsFunction",
    });
    this.startAllTestsFunction = startAllTestsFunction;

    NagSuppressions.addResourceSuppressions(
      startAllTestsFunction,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources in Lambda",
        },
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources in Lambda",
        },
      ],
      true
    );

    const checkSSMFunction = new Function(this, `CheckSSMLambdaFunction`, {
      functionName: LAMBDA_CHECK_SSM_FUNCTION_NAME,
      runtime: Runtime.PYTHON_3_13,
      code: Code.fromAsset(
        path.resolve(__dirname, "../../resources/lambdas/checkSSM/src/")
      ),
      handler: "lambda_function.lambda_handler",
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(300),
    });
    checkSSMFunction.addToRolePolicy(ssmStatement);
    new cdk.CfnOutput(this, "CheckSSMLambdaFunctionName", {
      value: checkSSMFunction.functionName,
      exportName: "CheckSSMLambdaFunction",
    });
    this.checkSSMFunction = checkSSMFunction;

    NagSuppressions.addResourceSuppressions(
      checkSSMFunction,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources in Lambda",
        },
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources in Lambda",
        },
      ],
      true
    );

    //this function checks the status of a particular AWS Batch Job with JobID
    const checkBatchJobStatusFunction = new Function(
      this,
      `CheckBatchJobStatusLambdaFunction`,
      {
        functionName: LAMBDA_CHECK_BATCH_STATUS_FUNCTION_NAME,
        runtime: Runtime.PYTHON_3_13,
        code: Code.fromAsset(
          path.resolve(__dirname, "../../resources/lambdas/checkBatchJob/src/")
        ),
        handler: "lambda_function.lambda_handler",
        layers: [lambdaLayer],
        timeout: cdk.Duration.seconds(300),
      }
    );
    checkBatchJobStatusFunction.addToRolePolicy(batchJobStatement);
    checkBatchJobStatusFunction.addToRolePolicy(batchListJobStatement);

    NagSuppressions.addResourceSuppressions(
      checkBatchJobStatusFunction,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources in Lambda",
        },
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources in Lambda",
        },
      ],
      true
    );

    new cdk.CfnOutput(this, "CheckBatchJobStatusLambdaFunctionName", {
      value: checkBatchJobStatusFunction.functionName,
      exportName: "CheckBatchJobStatusLambdaFunction",
    });
    this.checkBatchJobStatusFunction = checkBatchJobStatusFunction;

    const cwPushMetricsFunction = new Function(this, `CWPushMetricsFunction`, {
      functionName: LAMBDA_CW_PUSH_METRICS_FUNCTION_NAME,
      runtime: Runtime.PYTHON_3_13,
      code: Code.fromAsset(
        path.resolve(__dirname, "../../resources/lambdas/cwPushMetrics/src/")
      ),
      environment: {
        DB: GLUE_DATABASE_NAME,
        TABLE: GLUE_TABLE_NAME,
        METRICS_BUCKET_NAME: props.s3BucketForMetrics.bucketName,
      },
      handler: "lambda_function.lambda_handler",
      layers: [lambdaLayer],
      timeout: cdk.Duration.seconds(300),
    });
    cwPushMetricsFunction.addToRolePolicy(athenaStatement);
    cwPushMetricsFunction.addToRolePolicy(ec2CwStatement);
    cwPushMetricsFunction.addToRolePolicy(cloudwatchStatement);
    cwPushMetricsFunction.addToRolePolicy(s3MetricsStatement);
    cwPushMetricsFunction.addToRolePolicy(secretsmanagereadonlyStatement);

    NagSuppressions.addResourceSuppressions(
      cwPushMetricsFunction,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources in Lambda",
        },
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources in Lambda",
        },
      ],
      true
    );

    this.cwPushMetricsFunction = cwPushMetricsFunction;
  }
}
