#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { InfrastructureStack } from "../lib/stacks/infrastructure-stack";
import { AnalyticsStack } from "../lib/stacks/analytics-stack";
import { PROJECT_PREFIX } from "../lib/constants";
import { SAPSystemDefinitionStack } from "../lib/stacks/sap-system-definition-stack";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new cdk.App();
//// Enable cdk-nag
cdk.Aspects.of(app).add(new AwsSolutionsChecks());
const bundlingStacks = app.node.tryGetContext(
  "aws:cdk:bundling-stacks"
) as Array<string>;
const buildAllStacks = bundlingStacks.includes("**");

const vpcId = app.node.tryGetContext("vpcId") || "";
const subnetIds = app.node.tryGetContext("subnetIds") || "";

const deployAnalytics =
  app.node.tryGetContext("deployAnalytics")?.toLowerCase() == "true" || false;

console.log("deployAnalytics", deployAnalytics);

//administrator email
const administratorEmail = app.node.tryGetContext("adminEmail") || "";

//This dummy Stack is needed to allow `cdk bootstrap` to complete
const dummyStack = new cdk.Stack(app, "DummyStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

//set global tags
cdk.Tags.of(app).add("Application", "SAP Load Tests");
cdk.Tags.of(app).add("Project", PROJECT_PREFIX);

let s3BucketForMetrics: any;
if (vpcId !== undefined && vpcId !== "") {
  if (administratorEmail === undefined || administratorEmail === "") {
    console.error(
      "Please provide an administrator email address by specifiying adminEmail context param: `--context adminEmail=email@example.com`"
    );
    process.exit(1);
  }
  const infrastructureStack = new InfrastructureStack(
    app,
    "SAPLoadTests-InfrastructureStack",
    {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
      vpcId: vpcId,
      subnetIds: subnetIds.split(","),
      administratorEmail: administratorEmail,
    }
  );
  s3BucketForMetrics = infrastructureStack.s3BucketForMetrics;

  if (deployAnalytics) {
    console.log("Deploying the analytics stack");
    const analyticsStack = new AnalyticsStack(
      infrastructureStack,
      "SAPLoadTests-AnalyticsStack",
      {
        env: {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: process.env.CDK_DEFAULT_REGION,
        },
        s3BucketForMetrics: s3BucketForMetrics,
      }
    );
  } else {
    console.log(
      "Skipping analytics stack deployment. To deploy please pass the context parameter 'deployAnalytics' when deploying the stack"
    );
  }
} else {
  console.log(
    "Skipping infrastructure stack deployment. To deploy please pass the context parameter 'vpcId' and the other required parameters when deploying the stack"
  );
}

const sapSID = app.node.tryGetContext("sapSID");
if (sapSID !== undefined && sapSID !== "") {
  const sapSystemStack = new SAPSystemDefinitionStack(
    app,
    `SAPLoadTestsDataStack-${sapSID}`,
    {
      sapSID: sapSID,
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
    }
  );
  cdk.Tags.of(sapSystemStack).add("sapSID", sapSID);
} else {
  console.log(
    "Skipping load test stack deployment. To deploy please pass the context parameter 'sapSid' with the other system parameters when deploying the stack"
  );
}
