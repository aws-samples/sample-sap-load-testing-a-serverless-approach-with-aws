import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import {
  EXECUTIONS_ASSETS_S3_PREFIX,
  PROJECT_PREFIX,
  SECRET_MANAGER_NAME_PREFIX,
} from "../../constants";
import { NagSuppressions } from "cdk-nag";

export class LambdaAPIConstruct extends Construct {
  readonly listStateMachineFunction: lambda.Function;
  readonly listSAPSystemsFunction: lambda.Function;
  readonly launchNewTestFunction: lambda.Function;
  readonly getPresignedS3UrlFunction: lambda.Function;
  readonly getExecutionDetailsFunction: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: {
      stateMachine: cdk.aws_stepfunctions.StateMachine;
      s3BucketForArtefacts: cdk.aws_s3.Bucket;
    }
  ) {
    super(scope, id);
    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    //List State Machines
    const listStateMachineFunction = new lambda.Function(
      scope,
      "ListStateMachineFunction",
      {
        functionName: "ListStateMachineFunction",
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.get_state_machine_executions",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../resources/lambdas/frontend-api/ui-api-services/"
          )
        ),
        environment: {
          STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
        },
        timeout: cdk.Duration.seconds(180),
      }
    );
    listStateMachineFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:*"],
        resources: [
          props.stateMachine.stateMachineArn,
          `${props.stateMachine.stateMachineArn}:*`,
          `arn:aws:states:${cdk.Stack.of(scope).region}:${
            cdk.Stack.of(scope).account
          }:execution:*:*`,
        ],
      })
    );

    this.listStateMachineFunction = listStateMachineFunction;

    //List SAP Systems
    const listSAPSystemsFunction = new lambda.Function(
      scope,
      "ListSAPSystemsFunction",
      {
        functionName: "ListSAPSystemsFunction",
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.get_sap_systems",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../resources/lambdas/frontend-api/ui-api-services/"
          )
        ),
        environment: {
          SAP_LOAD_TEST_TAG_PROJECT_PREFIX: PROJECT_PREFIX,
        },
        timeout: cdk.Duration.seconds(180),
      }
    );
    listSAPSystemsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:ListSecrets"],
        resources: [
          // `arn:aws:secretsmanager:${region}:${account}:secret:${SECRET_MANAGER_NAME_PREFIX}*`,
          "*",
        ],
      })
    );

    NagSuppressions.addResourceSuppressions(
      listSAPSystemsFunction,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources in Lambda",
        },
      ],
      true
    );

    this.listSAPSystemsFunction = listSAPSystemsFunction;

    //List SAP Systems
    const launchNewTestFunction = new lambda.Function(scope, "LaunchNewTest", {
      functionName: "LaunchNewTest",
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "lambda_function.launch_new_test",
      code: lambda.Code.fromAsset(
        path.join(
          __dirname,
          "../../../resources/lambdas/frontend-api/ui-api-services/"
        )
      ),
      environment: {
        S3_ASSETS_BUCKET_NAME: props.s3BucketForArtefacts.bucketName,
        STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
        SECRET_MANAGER_NAME_PREFIX: SECRET_MANAGER_NAME_PREFIX,
        EXECUTIONS_ASSETS_S3_PREFIX: EXECUTIONS_ASSETS_S3_PREFIX,
      },
      timeout: cdk.Duration.seconds(180),
    });

    launchNewTestFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "states:ListStateMachines",
          "states:ListActivities",
          "states:DescribeStateMachine",
          "states:DescribeStateMachineForExecution",
          "states:ListExecutions",
          "states:DescribeExecution",
          "states:GetExecutionHistory",
          "states:DescribeActivity",
          "states:ListTagsForResource",
          "states:DescribeMapRun",
          "states:ListMapRuns",
          "states:DescribeStateMachineAlias",
          "states:ListStateMachineAliases",
          "states:ListStateMachineVersions",
          "states:ValidateStateMachineDefinition",
          "states:StartExecution",
          "states:DescribeExecution",
          "states:StopExecution",
        ],
        resources: [props.stateMachine.stateMachineArn],
      })
    );
    launchNewTestFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:GetBucketLocation",
          "s3:ListBucket",
          "s3:PutObject",
          "s3:PutObjectAcl",
        ],
        resources: [
          props.s3BucketForArtefacts.bucketArn,
          `${props.s3BucketForArtefacts.bucketArn}/*`,
        ],
      })
    );
    this.launchNewTestFunction = launchNewTestFunction;

    //Get S3 presigned Url for file upload.
    //Reference: https://raffaeu.medium.com/generate-an-amazon-s3-pre-signed-url-with-aws-lambda-and-amazon-api-gateway-4ffbea99207d
    const getPresignedS3UrlFunction = new lambda.Function(
      scope,
      "GetPresignedS3UrlFunction",
      {
        functionName: "GetPresignedS3UrlFunction",
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.create_presigned_url",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../resources/lambdas/frontend-api/ui-api-services/"
          )
        ),
        environment: {
          S3_ASSETS_BUCKET_NAME: props.s3BucketForArtefacts.bucketName,
          TEST_K6_SCRIPTS_ASSETS_S3_PREFIX: "k6-scripts",
        },
        timeout: cdk.Duration.seconds(180),
      }
    );
    getPresignedS3UrlFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:GetBucketLocation",
          "s3:ListBucket",
          "s3:PutObject",
        ],
        resources: [
          props.s3BucketForArtefacts.bucketArn,
          `${props.s3BucketForArtefacts.bucketArn}/*`,
        ],
      })
    );

    this.getPresignedS3UrlFunction = getPresignedS3UrlFunction;

    const getExecutionDetailsFunction = new lambda.Function(
      scope,
      "GetExecutionDetailsFunction",
      {
        functionName: "GetExecutionDetails",
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.get_execution_details",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../../resources/lambdas/frontend-api/ui-api-services/"
          )
        ),
        environment: {
          S3_ASSETS_BUCKET_NAME: props.s3BucketForArtefacts.bucketName,
          EXECUTIONS_ASSETS_S3_PREFIX: EXECUTIONS_ASSETS_S3_PREFIX,
        },
        timeout: cdk.Duration.seconds(180),
      }
    );
    getExecutionDetailsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:GetBucketLocation",
          "s3:ListBucket",
          "s3:PutObject",
        ],
        resources: [
          props.s3BucketForArtefacts.bucketArn,
          `${props.s3BucketForArtefacts.bucketArn}/*`,
        ],
      })
    );
    this.getExecutionDetailsFunction = getExecutionDetailsFunction;
  }
}
