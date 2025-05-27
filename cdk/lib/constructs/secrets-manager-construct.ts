import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

import path = require("path");
import { SAPSystemProps } from "../parameters";
import { SECRET_MANAGER_NAME_PREFIX } from "../constants";
import { NagSuppressions } from "cdk-nag";

export interface SecretsManagerProps {
  sapSystem: SAPSystemProps;
}

export class SecretsManagerConstruct extends Construct {
  public secret: secretsmanager.Secret;
  constructor(scope: Construct, id: string, props: SecretsManagerProps) {
    super(scope, id);
    this.secret = new secretsmanager.Secret(
      this,
      `Secret-${props.sapSystem.sid}`,
      {
        secretName: `${SECRET_MANAGER_NAME_PREFIX}-${props.sapSystem.sid.toUpperCase()}`,
        secretObjectValue: {
          sapSID: new cdk.SecretValue(props.sapSystem.sid),
          sapInstanceIds: new cdk.SecretValue(
            props.sapSystem.appNodes.map((node) => node.instanceId).join(",")
          ),
          sapBaseUrl: new cdk.SecretValue(props.sapSystem.baseUrl),
          sapClient: new cdk.SecretValue(props.sapSystem.client),
          dbInstanceId: new cdk.SecretValue(props.sapSystem.dbNode.instanceId),
          dbPort: new cdk.SecretValue(props.sapSystem.dbNode.port),
          dbName: new cdk.SecretValue(props.sapSystem.dbNode.dbName),

          //users
          dbUser: new cdk.SecretValue("XXXXXXXX"),
          dbPassword: new cdk.SecretValue("XXXXXXXX"),
          sapUser: new cdk.SecretValue("XXXXXXXX"),
          sapPassword: new cdk.SecretValue("XXXXXXXX"),
        },
      }
    );

    NagSuppressions.addResourceSuppressions(this.secret, [
      {
        id: "AwsSolutions-SMG4",
        reason: "Secrets are not encrypted using KMS and do not need rotation",
      },
    ]);
  }
}
