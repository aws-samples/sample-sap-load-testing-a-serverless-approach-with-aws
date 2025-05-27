import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  BATCH_JOB_QUEUE_NAME,
  PROJECT_PREFIX,
  SECRET_MANAGER_NAME_PREFIX,
} from "../constants";
import { Role } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { ECRDeployment } from "cdk-ecr-deployment";
import { CfnJobDefinition } from "aws-cdk-lib/aws-batch";
import { NagSuppressions } from "cdk-nag";

export interface CommonInfrastructureBatchProps {
  vpcId: string;
  subnetIds: string[];
  s3BucketForArtefacts: Bucket;
}

export interface ExecutorLoadtestBatchProps {
  executorPrefix: string;
  batchComputeEnv: cdk.aws_batch.CfnComputeEnvironment;
  batchJobQueue: cdk.aws_batch.CfnJobQueue;
  s3BucketForArtefacts: Bucket;
  ecrImageDeployment: ECRDeployment;
  batchJobExecRole: Role;
  batchJobRole: Role;
  containers:
    | cdk.IResolvable
    | CfnJobDefinition.TaskContainerPropertiesProperty[];
}

export class CommonInfrastructureBatch extends Construct {
  readonly batchComputeEnv: cdk.aws_batch.CfnComputeEnvironment;
  readonly batchJobQueue: cdk.aws_batch.CfnJobQueue;
  readonly batchJobRole: Role;
  readonly batchJobExecRole: Role;

  constructor(
    scope: Construct,
    id: string,
    props: CommonInfrastructureBatchProps
  ) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, `${PROJECT_PREFIX}-VPC`, {
      isDefault: false,
      vpcId: props?.vpcId,
    });

    //create segurity group for batch compute environment
    const securityGroup = new cdk.aws_ec2.SecurityGroup(
      this,
      `${PROJECT_PREFIX}-SecurityGroupBatchComputeEnvironment`,
      {
        vpc: vpc,
        securityGroupName: `${PROJECT_PREFIX}-SecurityGroupBatchComputeEnvironment`,
        description:
          "Security group for AWS Batch compute environment to run K6",
        allowAllOutbound: true,
      }
    );

    // =====================================================================================
    // Building IAM Resources for Batch inference image and pushing to ECR
    // =====================================================================================
    const batchJobRole = new cdk.aws_iam.Role(
      this,
      `${PROJECT_PREFIX}-BatchJobRole`,
      {
        roleName: `${PROJECT_PREFIX}-BatchJobRole`,
        assumedBy: new cdk.aws_iam.CompositePrincipal(
          new cdk.aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
          new cdk.aws_iam.ServicePrincipal("ecs.amazonaws.com"),
          new cdk.aws_iam.ServicePrincipal("batch.amazonaws.com"),
          new cdk.aws_iam.ServicePrincipal("ec2.amazonaws.com")
        ),
        managedPolicies: [
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonECSTaskExecutionRolePolicy"
          ),
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonEC2ContainerServiceforEC2Role"
          ),
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            "CloudWatchFullAccess"
          ),
        ],
      }
    );
    // Add specific permissions needed for Batch operations
    batchJobRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: [
          "batch:SubmitJob",
          "batch:DescribeJobs",
          "batch:TerminateJob",
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ],
        resources: ["*"],
      })
    );

    batchJobRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        resources: [
          props.s3BucketForArtefacts.bucketArn,
          `${props.s3BucketForArtefacts.bucketArn}/*`,
        ],
        actions: ["s3:ListBucket", "s3:GetObject", "s3:PutObject"],
        effect: cdk.aws_iam.Effect.ALLOW,
      })
    );

    batchJobRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        resources: ["*"],
        actions: ["ec2:DescribeInstances"],
        effect: cdk.aws_iam.Effect.ALLOW,
      })
    );
    batchJobRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        resources: [
          `arn:aws:secretsmanager:${region}:${accountId}:secret:${SECRET_MANAGER_NAME_PREFIX}*`,
        ],
        actions: ["secretsmanager:GetSecretValue"],
        effect: cdk.aws_iam.Effect.ALLOW,
      })
    );
    this.batchJobRole = batchJobRole;

    NagSuppressions.addResourceSuppressions(
      batchJobRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "The role requires the access to ECS",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "The role requires the access to EC2 describe instances",
        },
      ],
      true
    );

    const batchJobExecRole = new cdk.aws_iam.Role(
      this,
      `${PROJECT_PREFIX}-BatchExecRole`,

      {
        assumedBy: new cdk.aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        managedPolicies: [
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonECSTaskExecutionRolePolicy"
          ),
        ],
      }
    );

    batchJobExecRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      })
    );
    this.batchJobExecRole = batchJobExecRole;

    NagSuppressions.addResourceSuppressions(
      batchJobExecRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "The role requires the access to ECS",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "The role requires the access to EC2 describe instances",
        },
      ],
      true
    );

    const compEnvSvcRole = cdk.aws_iam.Role.fromRoleArn(
      this,
      `${PROJECT_PREFIX}-ComputeRole`,
      `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/batch.amazonaws.com/AWSServiceRoleForBatch`,
      { mutable: false }
    );

    // =====================================================================================
    // Configuring AWS Batch
    // example: https://github.com/aws-samples/aws-serverless-for-machine-learning-inference/blob/7955501e52064e300a47036e320734d205a74608/app/lib/batch-resources.ts
    // =====================================================================================

    const batchComputeEnv = new cdk.aws_batch.CfnComputeEnvironment(
      this,
      `${PROJECT_PREFIX}-BatchComputeEnvironment`,
      {
        computeEnvironmentName: `${PROJECT_PREFIX}-batch-compute-env`,
        type: "MANAGED",
        state: "ENABLED",
        computeResources: {
          maxvCpus: 256,
          type: "FARGATE",
          subnets: props.subnetIds,
          securityGroupIds: [securityGroup.securityGroupId],
        },
        serviceRole: compEnvSvcRole.roleArn,
      }
    );

    const batchJobQueue = new cdk.aws_batch.CfnJobQueue(
      this,
      BATCH_JOB_QUEUE_NAME,
      {
        computeEnvironmentOrder: [
          {
            order: 1,
            computeEnvironment: batchComputeEnv.ref,
          },
        ],
        priority: 1,
        state: "ENABLED",
        jobQueueName: BATCH_JOB_QUEUE_NAME,
      }
    );

    this.batchJobQueue = batchJobQueue;
  }
}
