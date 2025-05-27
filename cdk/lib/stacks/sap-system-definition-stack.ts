#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { SecretsManagerConstruct } from "../constructs/secrets-manager-construct";
import { Construct } from "constructs";
import { CloudWatchDashboardConstruct } from "../constructs/cloudwatch-construct";
import { SAPApplicationNodeProps, SAPSystemProps } from "../parameters";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

import {
  ARTEFACTS_S3_BUCKET_NAME_PREFIX,
  CLOUDWATCH_DASHBOARD_NAME_PREFIX,
  SAP_SYSTEM_ASSETS_S3_PREFIX,
} from "../constants";

export interface SAPSystemDefinitionStackProps extends cdk.StackProps {
  sapSID: string;
  // k6InstanceId: string;
  // k6BaseUrl: string;
  // sapSystem: SAPSystemProps
}

export class SAPSystemDefinitionStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SAPSystemDefinitionStackProps
  ) {
    super(scope, id, props);

    const S3_NAME_SUFFIX = `${cdk.Stack.of(this).account}-${
      cdk.Stack.of(this).region
    }`;

    const sapApplicationIntanceIds = this.node.tryGetContext(
      "sapApplicationIntanceIds"
    );
    const sapBaseUrl = this.node.tryGetContext("sapBaseUrl");
    const sapClient = this.node.tryGetContext("sapClient");
    const dbInstanceId = this.node.tryGetContext("dbInstanceId");
    const dbPort = this.node.tryGetContext("dbPort") || "30015";
    const dbName = this.node.tryGetContext("dbName") || "HDB";

    const sapSystem: SAPSystemProps = {
      sid: props.sapSID,
      client: sapClient,
      appNodes: parseSAPApplicationParameters(
        sapApplicationIntanceIds.split(",")
      ),
      baseUrl: sapBaseUrl,
      dbNode: {
        instanceId: dbInstanceId,
        port: dbPort,
        dbName: dbName,
      },
    };
    //// CONSTANTS
    const CW_DASHBOARD_SUFFIX = `${props?.sapSID.toLowerCase()}`;

    const sapSecretsManager = new SecretsManagerConstruct(
      this,
      `SecretsManagerConstruct-${props?.sapSID}`,
      {
        sapSystem: sapSystem,
      }
    );

    const cloudwatchDashboard = new CloudWatchDashboardConstruct(
      this,
      `CloudWatchDashboardStack-${props?.sapSID}`,
      {
        dashboardName: `${CLOUDWATCH_DASHBOARD_NAME_PREFIX}${CW_DASHBOARD_SUFFIX}`,
        sapSystem: sapSystem,
        // k6BaseUrl: k6BaseUrl,
      }
    );
  }
}

function parseSAPApplicationParameters(
  instanceIds: string[]
): SAPApplicationNodeProps[] {
  let sapApplication: SAPApplicationNodeProps[] = [];
  try {
    instanceIds.forEach((value: string) => {
      sapApplication.push({
        instanceId: value,
      });
    });
  } catch (error) {
    throw error;
  } finally {
    return sapApplication;
  }
}
