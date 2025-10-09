#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as glue from "@aws-cdk/aws-glue-alpha";
import { aws_athena as athena } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { PolicyStatement, PolicyDocument } from "aws-cdk-lib/aws-iam";
import { Code, Runtime, Function, Alias } from "aws-cdk-lib/aws-lambda";
import path = require("path");
import {
  GLUE_DATABASE_NAME,
  GLUE_TABLE_NAME,
  ATHENA_WORKGROUP_NAME,
  LAMBDA_CW_PUSH_METRICS_FUNCTION_NAME,
  SECRET_MANAGER_NAME_PREFIX,
} from "../constants";
import { CfnTable } from "aws-cdk-lib/aws-glue";
import { NagSuppressions } from "cdk-nag";

/**
 * Defines Glue / Athena Stack
 */

export interface AnalyticsStackProps extends cdk.StackProps {
  s3BucketForMetrics: cdk.aws_s3.Bucket;
}

export class AnalyticsStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: AnalyticsStackProps) {
    super(scope, id, props);

    new cdk.CfnOutput(this, "S3BucketForMetricsName", {
      value: props.s3BucketForMetrics.bucketName,
    });

    // Create Athena role
    const jobRole = new iam.Role(this, "AthenaGlueRole", {
      assumedBy: new iam.ServicePrincipal("glue"),
      inlinePolicies: {
        S3Access: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                "s3:Abort*",
                "s3:DeleteObject*",
                "s3:GetBucket*",
                "s3:GetObject*",
                "s3:List*",
                "s3:PutObject",
                "s3:PutObjectLegalHold",
                "s3:PutObjectRetention",
                "s3:PutObjectTagging",
                "s3:PutObjectVersionTagging",
              ],
              resources: [
                "arn:aws:s3:::aws-glue-*/*",
                "arn:aws:s3:::*/*aws-glue-*/*",
                "arn:aws:s3:::crawler-public*",
                `${props.s3BucketForMetrics.bucketArn}/*`,
              ],
            }),
          ],
        }),
        CWLogsAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:AssociateKmsKey",
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws-glue/*`,
              ],
            }),
            new PolicyStatement({
              actions: ["cloudwatch:PutMetricData"],
              resources: ["*"],
            }),
          ],
        }),
        KMSAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:GenerateDataKey",
                "kms:ReEncrypt",
              ],
              resources: [`arn:aws:kms:${this.region}:${this.account}:key/*`],
            }),
          ],
        }),
        SSMAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["secretsmanager:GetSecretValue"],
              resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${SECRET_MANAGER_NAME_PREFIX}*`,
              ],
            }),
          ],
        }),
        IamAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["iam:PassRole"],
              resources: [
                `arn:aws:iam::${this.account}:role/AWSGlueServiceRole*`,
              ],
              conditions: {
                StringLike: {
                  "iam:PassedToService": "glue.amazonaws.com",
                },
              },
            }),
          ],
        }),
        GlueAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                "glue:GetDatabase",
                "glue:GetDatabases",
                "glue:GetTable",
                "glue:GetTables",
                "glue:GetPartition",
                "glue:GetPartitions",
                "glue:BatchGetPartition",
                "glue:GetSecurityConfiguration",
                "glue:BatchCreatePartition",
                "glue:UpdateSchema",
                "glue:UpdateTable",
              ],
              resources: ["*"],
            }),
          ],
        }),
        AthenaAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                "athena:GetDatabase",
                "athena:GetDataCatalog",
                "athena:GetTableMetadata",
                "athena:ListDatabases",
                "athena:ListDataCatalogs",
                "athena:ListTableMetadata",
                "athena:ListWorkGroups",
              ],
              resources: ["*"],
            }),
            new PolicyStatement({
              actions: [
                "athena:GetQueryExecution",
                "athena:GetQueryResults",
                "athena:GetWorkGroup",
                "athena:StartQueryExecution",
                "athena:StopQueryExecution",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // Create GlueDatabase
    const glueDatabase = new glue.Database(this, "GlueDatabase", {
      ...{ databaseName: GLUE_DATABASE_NAME },
    });

    // Create Glue Table
    const glueTable = new glue.S3Table(this, "GlueTable", {
      tableName: GLUE_TABLE_NAME,
      database: glueDatabase,
      bucket: props.s3BucketForMetrics,
      compressed: false,
      description: "SAP Load Tests Metrics Table",
      dataFormat: glue.DataFormat.CSV,
      columns: [
        { name: "timestamp", type: glue.Schema.STRING },
        { name: "test_run_id", type: glue.Schema.STRING },
        { name: "test_type", type: glue.Schema.STRING },
        { name: "sid", type: glue.Schema.STRING },
        { name: "instance_id", type: glue.Schema.STRING },
        { name: "instance_type", type: glue.Schema.STRING },
        { name: "dia", type: glue.Schema.STRING },
        { name: "db", type: glue.Schema.STRING },
        { name: "rfc", type: glue.Schema.STRING },
        { name: "ping", type: glue.Schema.STRING },
        { name: "dumps", type: glue.Schema.STRING },
        { name: "cpu", type: glue.Schema.STRING },
        { name: "free_mem_perc", type: glue.Schema.STRING },
        { name: "k6_vus", type: glue.Schema.STRING },
      ],
      partitionKeys: [
        { name: "year", type: glue.Schema.INTEGER },
        { name: "month", type: glue.Schema.INTEGER },
        { name: "day", type: glue.Schema.INTEGER },
      ],
      storageParameters: [
        glue.StorageParameter.skipHeaderLineCount(1),
        glue.StorageParameter.compressionType(glue.CompressionType.SNAPPY),
      ],
    });

    const cfnTable = glueTable.node.defaultChild as CfnTable;
    cfnTable.addPropertyOverride("TableInput.Parameters", {
      "skip.header.line.count": "1",
    });

    // Create an Athena workgroup
    new athena.CfnWorkGroup(this, "AthenaWorkgroup", {
      name: ATHENA_WORKGROUP_NAME,
      description: "Athena workgroup",
      workGroupConfiguration: {
        enforceWorkGroupConfiguration: true,
        executionRole: jobRole.roleArn,
        resultConfiguration: {
          outputLocation: `s3://${props.s3BucketForMetrics.bucketName}/athena/`,
        },
      },
      tags: [
        {
          key: "GrafanaDataSource",
          value: "true",
        },
      ],
    });

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      "/SAPLoadTests-InfrastructureStack/SAPLoadTests-AnalyticsStack",
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Athena and Glue require these permissions",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Athena and Glue require these permissions",
        },
      ],
      true
    );
  }
}
