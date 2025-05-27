#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { LambdaConstruct } from "../constructs/lambda-construct";
import { StepFunctionConstruct } from "../constructs/step-function-construct";
import { Construct } from "constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";

import { StorageConstruct } from "../constructs/storage-construct";
import { FrontendAPIConstruct } from "../constructs/frontend-api-construct";
import { WebApp } from "../constructs/webapp-construct";

import { BatchConstruct } from "../constructs/batch-construct";
import { NagSuppressions } from "cdk-nag";

export interface InfrastructureStackProps extends cdk.StackProps {
  vpcId: string;
  subnetIds: string[];
  administratorEmail: string;
}

export class InfrastructureStack extends cdk.Stack {
  readonly s3BucketForMetrics: Bucket;

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const S3_NAME_SUFFIX = `${cdk.Stack.of(this).account}-${
      cdk.Stack.of(this).region
    }`;

    const storage = new StorageConstruct(this, "Storage");
    this.s3BucketForMetrics = storage.s3BucketForMetrics;

    new cdk.CfnOutput(this, "S3BucketForArtefactsName", {
      value: storage.s3BucketForArtefacts.bucketName,
    });

    const lambdas = new LambdaConstruct(this, "Lambdas", {
      s3BucketForMetrics: storage.s3BucketForMetrics,
      s3BucketForArtefacts: storage.s3BucketForArtefacts,
    });

    const batch = new BatchConstruct(this, "Batch", {
      vpcId: props.vpcId,
      subnetIds: props.subnetIds,
      s3BucketForArtefacts: storage.s3BucketForArtefacts,
    });

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/SAPLoadTests-InfrastructureStack/Batch",
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "The batch tasks require these permissions",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "The batch tasks require to list all the relevant secrets",
        },
      ],
      true
    );

    const statemachines = new StepFunctionConstruct(this, "StepFunctions", {
      startAllTestsFunction: lambdas.startAllTestsFunction,
      checkSSMFunction: lambdas.checkSSMFunction,
      cwPushMetricsFunction: lambdas.cwPushMetricsFunction,
      applicationK6SubmitJobFunction: batch.applicationK6SubmitJobFunction,
      databaseK6SubmitJobFunction: batch.databaseK6SubmitJobFunction,
      checkBatchJobStatusFunction: lambdas.checkBatchJobStatusFunction,
      applicationK6BatchJobDefinition: batch.applicationK6BatchJobDefinition,
      databaseK6BatchJobDefinition: batch.databaseK6BatchJobDefinition,
      batchJobQueue: batch.batchJobQueue,
    });

    ///////// MOVE THIS TO A DEDICATE STACK
    ////UI Application component definition
    // API GAteway and Cognito
    const frontendApi = new FrontendAPIConstruct(this, "FrontendAPIConstruct", {
      stateMachine: statemachines.stateMachine,
      s3BucketForArtefacts: storage.s3BucketForArtefacts,
      administratorEmail: props.administratorEmail,
    });

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/SAPLoadTests-InfrastructureStack/FrontendAPIConstruct",
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "The lambda function requires these permissions",
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "The lambda function requires to list all the relevant secrets",
        },
      ],
      true
    );

    // Frontend application (React)
    const webapp = new WebApp(this, "WebApp", {
      restApiBaseEndpoint: frontendApi.restAPIEndpoint,
      cognitoAuthority: frontendApi.cognitoAuthority,
      cognitoDomain: frontendApi.cognitoDomain,
      cognitoClientId: frontendApi.cognitoClientId,
      cognitoUserPoolClient: frontendApi.cognitoUserPoolClient,
      cognitoUserPool: frontendApi.cognitoUserPool,
      s3BucketForArtefacts: storage.s3BucketForArtefacts,
    });

    NagSuppressions.addResourceSuppressions(
      [webapp],
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda service role AWSLambdaBasicExecutionRole has managed policies assigned by default",
        },
      ]
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/SAPLoadTests-InfrastructureStack`,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Lambda function handle the service roles",
        },
        {
          id: "AwsSolutions-L1",
          reason: "Lambda function handle the service roles",
        },
      ],
      true
    );
  }
}
