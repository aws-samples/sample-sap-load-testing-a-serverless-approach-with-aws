import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BATCH_JOB_DEFINITION_NAME_PREFIX, PROJECT_PREFIX } from "../constants";
import { ExecutorLoadtestBatchProps } from "./batch-common-infrastructure";
import { NagSuppressions } from "cdk-nag";

export class SAPLoadtestBatch extends Construct {
  readonly batchJobDefinition: cdk.aws_batch.CfnJobDefinition;
  readonly batchJobQueue: cdk.aws_batch.CfnJobQueue;
  readonly submitJobFunction: Function;
  readonly containerExecutorName: string;

  constructor(scope: Construct, id: string, props: ExecutorLoadtestBatchProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const CONTAINER_NAME = `${props.executorPrefix}-executor`;
    this.containerExecutorName = CONTAINER_NAME;
    const batchJobDefinition = new cdk.aws_batch.CfnJobDefinition(
      this,
      `${BATCH_JOB_DEFINITION_NAME_PREFIX}-${props.executorPrefix}`,
      {
        jobDefinitionName: `${BATCH_JOB_DEFINITION_NAME_PREFIX}-${props.executorPrefix}`,
        retryStrategy: { attempts: 1 },
        type: "container",
        platformCapabilities: ["FARGATE"],
        ecsProperties: {
          taskProperties: [
            {
              executionRoleArn: props.batchJobExecRole.roleArn,
              taskRoleArn: props.batchJobRole.roleArn,

              runtimePlatform: {
                cpuArchitecture: "ARM64",
              },
              containers: props.containers,
            },
          ],
        },
      }
    );
    this.batchJobDefinition = batchJobDefinition;

    NagSuppressions.addResourceSuppressions(
      batchJobDefinition,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "The batchJobRole require these permissions",
        },
      ],
      true
    );

    batchJobDefinition.node.addDependency(props.ecrImageDeployment);
  }
}
