#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as grafana from "aws-cdk-lib/aws-grafana";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import { PolicyStatement, PolicyDocument } from "aws-cdk-lib/aws-iam";
import {
  GRAFANA_WORKSPACE_NAME,
  GLUE_DATABASE_NAME,
  ATHENA_WORKGROUP_NAME,
  METRICS_S3_BUCKET_NAME_PREFIX
} from "../constants";
import { NagSuppressions } from "cdk-nag";
import * as path from "path";
import * as fs from "fs";

/**
 * Standalone Amazon Managed Grafana Stack
 * This stack is completely isolated and can be deployed independently
 * It references existing Athena and Glue resources by name/ARN
 */

export interface GrafanaStackProps extends cdk.StackProps {
  // Optional: Override default resource names if needed
  athenaWorkgroupName?: string;
  glueDatabaseName?: string;
  s3BucketNamePrefix?: string;
  // Optional: Admin user email for automatic assignment
  adminUserEmail?: string;
}

export class GrafanaStack extends cdk.Stack {
  public readonly grafanaWorkspace: grafana.CfnWorkspace;

  constructor(scope: Construct, id: string, props?: GrafanaStackProps) {
    super(scope, id, props);

    // Use provided names or defaults from constants
    const athenaWorkgroupName = props?.athenaWorkgroupName || ATHENA_WORKGROUP_NAME;
    const glueDatabaseName = props?.glueDatabaseName || GLUE_DATABASE_NAME;
    const s3BucketPrefix = props?.s3BucketNamePrefix || METRICS_S3_BUCKET_NAME_PREFIX;

    // Construct S3 bucket name using the same pattern as the infrastructure stack
    const s3BucketName = `${s3BucketPrefix}-${this.account}-${this.region}`;

    // Create IAM role for Grafana to access AWS services
    const grafanaServiceRole = new iam.Role(this, "GrafanaServiceRole", {
      assumedBy: new iam.ServicePrincipal("grafana.amazonaws.com"),
      description: "Service role for Amazon Managed Grafana to access AWS services",
      inlinePolicies: {
        CloudWatchAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "cloudwatch:DescribeAlarmsForMetric",
                "cloudwatch:DescribeAlarmHistory",
                "cloudwatch:DescribeAlarms",
                "cloudwatch:ListMetrics",
                "cloudwatch:GetMetricStatistics",
                "cloudwatch:GetMetricData",
                "cloudwatch:GetInsightRuleReport",
              ],
              resources: ["*"],
            }),
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:GetLogEvents",
                "logs:StartQuery",
                "logs:StopQuery",
                "logs:GetQueryResults",
                "logs:GetLogRecord",
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:*`,
              ],
            }),
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "ec2:DescribeTags",
                "ec2:DescribeInstances",
                "ec2:DescribeRegions",
              ],
              resources: ["*"],
            }),
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "tag:GetResources",
              ],
              resources: ["*"],
            }),
          ],
        }),
        AthenaAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "athena:BatchGetQueryExecution",
                "athena:GetDatabase",
                "athena:GetDataCatalog",
                "athena:GetQueryExecution",
                "athena:GetQueryResults",
                "athena:GetTableMetadata",
                "athena:GetWorkGroup",
                "athena:ListDatabases",
                "athena:ListDataCatalogs",
                "athena:ListQueryExecutions",
                "athena:ListTableMetadata",
                "athena:ListTagsForResource",
                "athena:ListWorkGroups",
                "athena:StartQueryExecution",
                "athena:StopQueryExecution",
              ],
              resources: [
                `arn:aws:athena:${this.region}:${this.account}:workgroup/${athenaWorkgroupName}`,
                `arn:aws:athena:${this.region}:${this.account}:datacatalog/*`,
              ],
            }),
          ],
        }),
        GlueAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "glue:GetDatabase",
                "glue:GetDatabases",
                "glue:GetTable",
                "glue:GetTables",
                "glue:GetPartition",
                "glue:GetPartitions",
                "glue:BatchGetPartition",
                "glue:GetTableVersions",
              ],
              resources: [
                `arn:aws:glue:${this.region}:${this.account}:catalog`,
                `arn:aws:glue:${this.region}:${this.account}:database/${glueDatabaseName}`,
                `arn:aws:glue:${this.region}:${this.account}:table/${glueDatabaseName}/*`,
              ],
            }),
          ],
        }),
        S3Access: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:ListMultipartUploadParts",
                "s3:AbortMultipartUpload",
                "s3:PutObject",
              ],
              resources: [
                `arn:aws:s3:::${s3BucketName}`,
                `arn:aws:s3:::${s3BucketName}/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Create Amazon Managed Grafana workspace
    this.grafanaWorkspace = new grafana.CfnWorkspace(this, "GrafanaWorkspace", {
      name: GRAFANA_WORKSPACE_NAME,
      description: "SAP Load Tests Grafana Workspace with CloudWatch and Athena data sources",
      accountAccessType: "CURRENT_ACCOUNT",
      authenticationProviders: ["AWS_SSO"],
      permissionType: "SERVICE_MANAGED",
      dataSources: ["CLOUDWATCH", "ATHENA"],
      roleArn: grafanaServiceRole.roleArn,
      stackSetName: undefined, // Not using stack sets
      organizationRoleName: undefined, // Not using organization access
    });

    // Output the Grafana workspace information
    new cdk.CfnOutput(this, "GrafanaWorkspaceUrl", {
      value: `https://${this.grafanaWorkspace.attrEndpoint}`,
      description: "Amazon Managed Grafana workspace URL",
      exportName: `${this.stackName}-GrafanaWorkspaceUrl`,
    });

    new cdk.CfnOutput(this, "GrafanaWorkspaceId", {
      value: this.grafanaWorkspace.attrId,
      description: "Amazon Managed Grafana workspace ID",
      exportName: `${this.stackName}-GrafanaWorkspaceId`,
    });

    new cdk.CfnOutput(this, "AthenaDataSourceInfo", {
      value: JSON.stringify({
        database: glueDatabaseName,
        workgroup: athenaWorkgroupName,
        region: this.region,
        s3Bucket: s3BucketName
      }),
      description: "Athena data source configuration for Grafana (JSON format)",
      exportName: `${this.stackName}-AthenaDataSourceInfo`,
    });

    new cdk.CfnOutput(this, "GrafanaServiceRoleArn", {
      value: grafanaServiceRole.roleArn,
      description: "IAM role ARN used by Grafana for AWS service access",
      exportName: `${this.stackName}-GrafanaServiceRoleArn`,
    });

    // Output instructions for user assignment
    new cdk.CfnOutput(this, "UserAssignmentInstructions", {
      value: `To grant access: 1) Go to AWS SSO Console -> Applications, 2) Find Grafana workspace, 3) Assign users with Admin permissions. Workspace ID: ${this.grafanaWorkspace.attrId}`,
      description: "Instructions to assign users to the Grafana workspace",
    });

    // Output CloudWatch data source information
    new cdk.CfnOutput(this, "CloudWatchDataSourceInfo", {
      value: JSON.stringify({
        region: this.region,
        defaultRegion: this.region,
        assumeRoleArn: grafanaServiceRole.roleArn
      }),
      description: "CloudWatch data source configuration for Grafana (JSON format)",
      exportName: `${this.stackName}-CloudWatchDataSourceInfo`,
    });



    // Create Lambda function for dashboard deployment
    const dashboardDeployerRole = new iam.Role(this, "DashboardDeployerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Role for Lambda function to deploy Grafana dashboards",
      inlinePolicies: {
        LambdaExecutionPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`,
              ],
            }),
          ],
        }),
        GrafanaAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "grafana:CreateWorkspaceApiKey",
                "grafana:DeleteWorkspaceApiKey",
                "grafana:DescribeWorkspace",
                "grafana:DescribeWorkspaceAuthentication",
                "grafana:DescribeWorkspaceConfiguration",
                "grafana:ListWorkspaces",
                "grafana:UpdateWorkspaceConfiguration",
              ],
              resources: [
                `arn:aws:grafana:${this.region}:${this.account}:/workspaces/${this.grafanaWorkspace.attrId}`,
                `arn:aws:grafana:${this.region}:${this.account}:/workspaces/*`,
              ],
            }),
          ],
        }),
        SecretsManagerAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "secretsmanager:CreateSecret",
                "secretsmanager:GetSecretValue",
                "secretsmanager:PutSecretValue",
                "secretsmanager:DeleteSecret",
                "secretsmanager:DescribeSecret",
                "secretsmanager:TagResource",
              ],
              resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:grafana-api-key-*`,
              ],
            }),
          ],
        }),
      },
    });

    // Read dashboard JSON file
    const dashboardPath = path.join(__dirname, "../../resources/grafana-dashboards/SAPLoadTestsDashboard.json");
    let dashboardJson: any;
    try {
      dashboardJson = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));
      // Update the dashboard to use a generic CloudWatch data source
      dashboardJson.id = null; // Remove ID to allow Grafana to assign a new one
      dashboardJson.uid = null; // Remove UID to allow Grafana to assign a new one
      dashboardJson.version = 1; // Reset version
    } catch (error) {
      console.warn("Could not read dashboard file, dashboard deployment will be skipped");
      dashboardJson = null;
    }

    if (dashboardJson) {
      // Create Lambda function to deploy dashboard
      const dashboardDeployer = new lambda.Function(this, "DashboardDeployer", {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: "index.handler",
        role: dashboardDeployerRole,
        timeout: cdk.Duration.minutes(10), // Timeout for Grafana API operations
        code: lambda.Code.fromAsset(path.join(__dirname, "../../resources/lambdas/dashboard-deployer")),
        environment: {
          WORKSPACE_ID: this.grafanaWorkspace.attrId,
          SERVICE_ROLE_ARN: grafanaServiceRole.roleArn,
          REGION: this.region,
        },
      });

      // Add explicit dependency on workspace
      dashboardDeployer.node.addDependency(this.grafanaWorkspace);

      // Create custom resource to automatically invoke the dashboard deployer during CDK deployment
      const dashboardDeployment = new cr.AwsCustomResource(this, "DashboardDeployment", {
        onCreate: {
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: dashboardDeployer.functionName,
            Payload: JSON.stringify({}),
          },
          physicalResourceId: cr.PhysicalResourceId.of("dashboard-deployment"),
        },
        onUpdate: {
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: dashboardDeployer.functionName,
            Payload: JSON.stringify({}),
          },
          physicalResourceId: cr.PhysicalResourceId.of("dashboard-deployment"),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["lambda:InvokeFunction"],
            resources: [dashboardDeployer.functionArn],
          }),
        ]),
        timeout: cdk.Duration.minutes(15),
      });

      // Ensure the custom resource runs after the Lambda function is ready
      dashboardDeployment.node.addDependency(dashboardDeployer);

      // Output Lambda function name for manual invocation
      new cdk.CfnOutput(this, "DashboardDeployerFunction", {
        value: dashboardDeployer.functionName,
        description: "Lambda function name for dashboard deployment",
      });

      // Output dashboard deployment status
      new cdk.CfnOutput(this, "DashboardDeploymentStatus", {
        value: "Dashboard automatically deployed during CDK deployment",
        description: "Status of the dashboard deployment",
      });

      // Add specific suppressions for the dashboard deployer Lambda
      NagSuppressions.addResourceSuppressions(
        dashboardDeployer,
        [
          {
            id: "AwsSolutions-L1",
            reason: "Lambda function uses Python 3.12 which is the latest available runtime version",
          },
        ]
      );

      // Add specific suppressions for the dashboard deployer role
      NagSuppressions.addResourceSuppressions(
        dashboardDeployerRole,
        [
          {
            id: "AwsSolutions-IAM4",
            reason: "Custom inline policies are used instead of AWS managed policies for better security control",
          },
        ]
      );

      // Output manual deployment instructions (if needed)
      new cdk.CfnOutput(this, "ManualDeploymentInstructions", {
        value: `If needed, manually run: aws lambda invoke --function-name ${dashboardDeployer.functionName} --payload '{}' response.json && cat response.json`,
        description: "Command to manually redeploy the dashboard if needed",
      });
    } else {
      // Output dashboard deployment information if no dashboard file found
      new cdk.CfnOutput(this, "DashboardDeploymentStatus", {
        value: "Dashboard file not found. Manual import required.",
        description: "Status of the dashboard deployment",
      });
    }

    // Output sample dashboard location
    new cdk.CfnOutput(this, "SAPLoadTestsDashboardLocation", {
      value: "resources/grafana-dashboards/SAPLoadTestsDashboard.json",
      description: "Location of the SAP Load Tests dashboard JSON file",
    });

    // Add CDK-nag suppressions
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/SAPLoadTests-GrafanaStack`,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Grafana requires broad permissions to access CloudWatch, Athena, Glue, and S3 resources for data visualization",
        },
        {
          id: "AwsSolutions-IAM4",
          reason: "Custom inline policies are used instead of AWS managed policies for better security control",
        },
        {
          id: "AwsSolutions-L1",
          reason: "Lambda function uses Python 3.12 which is the latest available runtime version",
        },
      ],
      true
    );
  }
}