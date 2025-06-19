import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { SAPLoadtestBatch } from "./batch-task-definition";
import {
  DATABASE_PREFIX,
  APPLICATION_PREFIX,
  PROJECT_PREFIX,
} from "../constants";
import { ECRDockerConstruct } from "./ecr-docker-construct";
import { CommonInfrastructureBatch } from "./batch-common-infrastructure";
import { Code, Function } from "aws-cdk-lib/aws-lambda";

import path = require("path");
import { NagSuppressions } from "cdk-nag";

export interface BatchConstructProps {
  vpcId: string;
  subnetIds: string[];
  s3BucketForArtefacts: cdk.aws_s3.Bucket;
}

export class BatchConstruct extends Construct {
  readonly batchJobQueue: cdk.aws_batch.CfnJobQueue;
  readonly applicationK6BatchJobDefinition: cdk.aws_batch.CfnJobDefinition;
  readonly applicationK6SubmitJobFunction: Function;
  readonly databaseK6BatchJobDefinition: cdk.aws_batch.CfnJobDefinition;
  readonly databaseK6SubmitJobFunction: Function;

  constructor(scope: Construct, id: string, props: BatchConstructProps) {
    super(scope, id);

    const ecrDocker = new ECRDockerConstruct(this, "ECRDocker");

    const commonBatchInfrastructure = new CommonInfrastructureBatch(
      this,
      "CommonInfrastructureBatch",
      {
        vpcId: props.vpcId,
        subnetIds: props.subnetIds,
        s3BucketForArtefacts: props.s3BucketForArtefacts,
      }
    );
    this.batchJobQueue = commonBatchInfrastructure.batchJobQueue;

    // const cloudWatchContainerDefinition = {
    //   name: "cloudwatch-agent",
    //   image: "amazon/cloudwatch-agent:latest",
    //   resourceRequirements: [
    //     { type: "VCPU", value: "2" },
    //     { type: "MEMORY", value: "4096" },
    //   ],
    //   essential: true,
    //   environment: [
    //     {
    //       name: "CW_CONFIG_CONTENT",
    //       value: `{
    //                       \"metrics\": {
    //                           \"namespace\": \"K6\",
    //                           \"metrics_collected\": {
    //                               \"statsd\": {
    //                                   \"service_address\": \":8125\",
    //                                   \"metrics_collection_interval\": 1,
    //                                   \"metrics_aggregation_interval\": 0
    //                               }
    //                           }
    //                       }
    //                   }`,
    //     },
    //   ],
    //   logConfiguration: {
    //     logDriver: "awslogs",
    //   },
    // };

    const applicationK6Batch = new SAPLoadtestBatch(this, "K6LoadtestBatch", {
      executorPrefix: APPLICATION_PREFIX,
      batchComputeEnv: commonBatchInfrastructure.batchComputeEnv,
      batchJobQueue: commonBatchInfrastructure.batchJobQueue,
      batchJobExecRole: commonBatchInfrastructure.batchJobExecRole,
      batchJobRole: commonBatchInfrastructure.batchJobRole,
      s3BucketForArtefacts: props.s3BucketForArtefacts,
      ecrImageDeployment: ecrDocker.applicationK6DockerImageDeploy,
      containers: [
        {
          name: `${APPLICATION_PREFIX}-executor`,
          image: ecrDocker.applicationK6DockerImage,
          resourceRequirements: [
            { type: "VCPU", value: "6" },
            { type: "MEMORY", value: "12288" },
          ],
          logConfiguration: {
            logDriver: "awslogs",
          },
        },
        this.cloudwatchAgentConfig(APPLICATION_PREFIX),
      ],
    });
    this.applicationK6BatchJobDefinition =
      applicationK6Batch.batchJobDefinition;
    const applicationK6SubmitJobFunction = new Function(
      this,
      `${PROJECT_PREFIX}-${APPLICATION_PREFIX}SubmitJobFunction`,
      {
        functionName: `${PROJECT_PREFIX}-${APPLICATION_PREFIX}SubmitJobFunction`,
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.lambda_handler",
        code: Code.fromAsset(
          path.resolve(
            __dirname,
            "../../resources/lambdas/applicationSubmitBatchJob/src/"
          )
        ),
        environment: {
          JOB_DEFINITION_ARN:
            applicationK6Batch.batchJobDefinition.attrJobDefinitionArn,
          JOB_QUEUE_ARN:
            commonBatchInfrastructure.batchJobQueue.attrJobQueueArn,
          CONTAINER_NAME: applicationK6Batch.containerExecutorName,
        },
      }
    );
    this.applicationK6SubmitJobFunction = applicationK6SubmitJobFunction;

    NagSuppressions.addResourceSuppressions(
      applicationK6SubmitJobFunction.node.findChild("ServiceRole").node
        .defaultChild as cdk.CfnResource,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources",
        },
      ],
      true
    );

    applicationK6SubmitJobFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [
          applicationK6Batch.batchJobDefinition.attrJobDefinitionArn,
          commonBatchInfrastructure.batchJobQueue.attrJobQueueArn,
          `${commonBatchInfrastructure.batchJobQueue.attrJobQueueArn}/*`,
        ],
      })
    );

    const hanaBatch = new SAPLoadtestBatch(this, "HanaLoadtestBatch", {
      executorPrefix: DATABASE_PREFIX,
      batchComputeEnv: commonBatchInfrastructure.batchComputeEnv,
      batchJobQueue: commonBatchInfrastructure.batchJobQueue,
      batchJobExecRole: commonBatchInfrastructure.batchJobExecRole,
      batchJobRole: commonBatchInfrastructure.batchJobRole,
      s3BucketForArtefacts: props.s3BucketForArtefacts,
      ecrImageDeployment: ecrDocker.databaseK6DockerImageDeploy,
      containers: [
        {
          name: `${DATABASE_PREFIX}-executor`,
          image: ecrDocker.databaseK6DockerImage,
          resourceRequirements: [
            { type: "VCPU", value: "6" },
            { type: "MEMORY", value: "12288" },
          ],
          logConfiguration: {
            logDriver: "awslogs",
          },
        },
        this.cloudwatchAgentConfig(DATABASE_PREFIX),
      ],
    });
    this.databaseK6BatchJobDefinition = hanaBatch.batchJobDefinition;

    const databaseK6SubmitJobFunction = new Function(
      this,
      `${PROJECT_PREFIX}-${DATABASE_PREFIX}SubmitJobFunction`,
      {
        functionName: `${PROJECT_PREFIX}-${DATABASE_PREFIX}SubmitJobFunction`,
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
        handler: "lambda_function.lambda_handler",
        code: Code.fromAsset(
          path.resolve(
            __dirname,
            "../../resources/lambdas/databaseSubmitBatchJob/src/"
          )
        ),
        environment: {
          JOB_DEFINITION_ARN: hanaBatch.batchJobDefinition.attrJobDefinitionArn,
          JOB_QUEUE_ARN:
            commonBatchInfrastructure.batchJobQueue.attrJobQueueArn,
          CONTAINER_NAME: hanaBatch.containerExecutorName,
        },
      }
    );
    this.databaseK6SubmitJobFunction = databaseK6SubmitJobFunction;
    NagSuppressions.addResourceSuppressions(
      databaseK6SubmitJobFunction.node.findChild("ServiceRole").node
        .defaultChild as cdk.CfnResource,
      // .node.findChild("DefaultPolicy").node.defaultChild as cdk.CfnResource,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources",
        },
      ],
      true
    );
    databaseK6SubmitJobFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [
          hanaBatch.batchJobDefinition.attrJobDefinitionArn,
          commonBatchInfrastructure.batchJobQueue.attrJobQueueArn,
          `${commonBatchInfrastructure.batchJobQueue.attrJobQueueArn}/*`,
        ],
      })
    );

    NagSuppressions.addResourceSuppressions(
      scope.node
        .findChild(
          scope.node.children.filter((child) =>
            child.node.id.startsWith("Custom::CDKECRDeployment")
          )[0].node.id
        )
        .node.findChild("ServiceRole").node.defaultChild as cdk.CfnResource,
      // .node.findChild("DefaultPolicy").node.defaultChild as cdk.CfnResource,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      scope.node
        .findChild(
          scope.node.children.filter((child) =>
            child.node.id.startsWith("Custom::CDKECRDeployment")
          )[0].node.id
        )
        .node.findChild("ServiceRole")
        .node.findChild("DefaultPolicy").node.defaultChild as cdk.CfnResource,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources",
        },
      ],
      true
    );
  }

  private cloudwatchAgentConfig(testType: string) {
    let namespace = "K6";
    if (testType === DATABASE_PREFIX) {
      namespace += "-HANA";
    }

    return {
      name: "cloudwatch-agent",
      image: "amazon/cloudwatch-agent:latest",
      resourceRequirements: [
        { type: "VCPU", value: "2" },
        { type: "MEMORY", value: "4096" },
      ],
      essential: true,
      environment: [
        {
          name: "CW_CONFIG_CONTENT",
          value: `{
                          \"agent\":{  
                              \"metrics_collection_interval\": 10
                          },
                          \"metrics\": {
                              \"namespace\": \"${namespace}\",
                              \"metrics_collected\": {
                                  \"statsd\": {
                                      \"service_address\": \":8125\",
                                      \"metrics_collection_interval\": 1,
                                      \"metrics_aggregation_interval\": 0
                                  }
                              }
                          }
                      }`,
        },
      ],
      logConfiguration: {
        logDriver: "awslogs",
      },
    };
  }
}
