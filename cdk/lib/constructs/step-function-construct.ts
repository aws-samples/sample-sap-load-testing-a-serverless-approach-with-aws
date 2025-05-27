import * as cdk from "aws-cdk-lib";
import * as statemachines from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import * as mustache from "mustache";
import * as fs from "fs";
import { Code, Runtime, Function, Alias } from "aws-cdk-lib/aws-lambda";
import { ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { SNS_TOPIC_NAME, STEP_FUNCTION_NAME } from "../constants";
import { CfnJobDefinition, CfnJobQueue } from "aws-cdk-lib/aws-batch";
import { NagSuppressions } from "cdk-nag";

export interface StepFunctionProps {
  startAllTestsFunction: Function;
  checkSSMFunction: Function;
  cwPushMetricsFunction: Function;
  applicationK6BatchJobDefinition: CfnJobDefinition;
  applicationK6SubmitJobFunction: Function;
  databaseK6BatchJobDefinition: CfnJobDefinition;
  databaseK6SubmitJobFunction: Function;
  checkBatchJobStatusFunction: Function;
  batchJobQueue: CfnJobQueue;
}

export class StepFunctionConstruct extends Construct {
  public stateMachine: statemachines.StateMachine;

  constructor(scope: Construct, id: string, props: StepFunctionProps) {
    super(scope, id);

    const snsTopic = new cdk.aws_sns.Topic(this, "SAPLoadTestSnsTopic", {
      topicName: SNS_TOPIC_NAME,
    });

    NagSuppressions.addResourceSuppressions(
      snsTopic,
      [
        {
          id: "AwsSolutions-SNS3",
          reason: "No sensitive data in topic",
        },
      ],
      true
    );

    const lambdaInvokeStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["lambda:InvokeFunction"],
      resources: [
        props.startAllTestsFunction.functionArn,
        props.checkSSMFunction.functionArn,
        props.cwPushMetricsFunction.functionArn,
        props.applicationK6SubmitJobFunction.functionArn,
        props.checkBatchJobStatusFunction.functionArn,
        props.databaseK6SubmitJobFunction.functionArn,

        `${props.startAllTestsFunction.functionArn}:*`,
        `${props.checkSSMFunction.functionArn}:*`,
        `${props.cwPushMetricsFunction.functionArn}:*`,
        `${props.applicationK6SubmitJobFunction.functionArn}:*`,
        `${props.checkBatchJobStatusFunction.functionArn}:*`,
        `${props.databaseK6SubmitJobFunction.functionArn}:*`,
      ],
    });

    const snsPublishStatement = new cdk.aws_iam.PolicyStatement({
      actions: ["sns:Publish"],
      resources: [snsTopic.topicArn],
    });

    const xrayStatement = new cdk.aws_iam.PolicyStatement({
      actions: [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords",
        "xray:GetSamplingRules",
        "xray:GetSamplingTargets",
        "xray:GetSamplingStatisticSummaries",
      ],
      resources: ["*"],
    });

    const sapLoadTestStateMachineDefinition = mustache.render(
      fs
        .readFileSync(
          "./resources/statemachines/sap-load-tests.json.mustache",
          "utf-8"
        )
        .toString(),
      {
        startAllTestsFunctionArn: props.startAllTestsFunction.functionArn,
        checkSSMFunctionArn: props.checkSSMFunction.functionArn,
        cwPushMetricsFunction: props.cwPushMetricsFunction.functionArn,
        applicationK6SubmitJobFunctionArn:
          props.applicationK6SubmitJobFunction.functionArn,
        databaseK6SubmitJobFunctionArn:
          props.databaseK6SubmitJobFunction.functionArn,
        checkBatchJobStatusFunctionArn:
          props.checkBatchJobStatusFunction.functionArn,
        applicationK6BatchJobDefinitionArn:
          props.applicationK6BatchJobDefinition.attrJobDefinitionArn,
        databaseK6BatchJobDefinitionArn:
          props.databaseK6BatchJobDefinition.attrJobDefinitionArn,
        batchJobQueueArn: props.batchJobQueue.attrJobQueueArn,
      }
    );

    const stateMachine = new statemachines.StateMachine(
      this,
      "SAPLoadTestStateMachine",
      {
        stateMachineName: STEP_FUNCTION_NAME,
        definitionBody: statemachines.DefinitionBody.fromString(
          sapLoadTestStateMachineDefinition
        ),
        logs: {
          destination: new cdk.aws_logs.LogGroup(this, "SAPLoadTestLogGroup", {
            logGroupName: "/sap-load-tests/step-function-logs",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
          level: statemachines.LogLevel.ALL,
        },
        tracingEnabled: true,
      }
    );

    // this.stepFunction.addToRolePolicy(new PolicyStatement(
    //     { ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess") }))

    // stepFunction.addToRolePolicy

    //add AmazonS3FullAccess managed policy to stepfunction execution role
    stateMachine.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonEventBridgeFullAccess")
    );
    stateMachine.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AWSGlueConsoleFullAccess")
    );
    stateMachine.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess")
    );
    stateMachine.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AWSBatchFullAccess")
    );

    stateMachine.addToRolePolicy(lambdaInvokeStatement);
    stateMachine.addToRolePolicy(snsPublishStatement);
    stateMachine.addToRolePolicy(xrayStatement);

    NagSuppressions.addResourceSuppressions(
      stateMachine,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "The state machine require these permissions",
        },
      ],
      true
    );

    this.stateMachine = stateMachine;

    NagSuppressions.addResourceSuppressions(
      stateMachine,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "step function requires these premissions",
        },
      ],
      true
    );
  }
}
