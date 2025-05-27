// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cr from "aws-cdk-lib/custom-resources";

import { Construct } from "constructs";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { NagSuppressions } from "cdk-nag";

export class CognitoUserConstruct extends Construct {
  readonly restAPIEndpoint: string;

  private ADMIN_PASSWORD_OUTPUT = "AdministratorPasswordForFrontend";

  constructor(
    scope: Construct,
    id: string,
    props: {
      cognitoUserPool: UserPool;
      administratorEmail: string;
    }
  ) {
    super(scope, id);
    const username = "administrator";

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    const password = newPasswordGenerator();

    new cdk.CfnOutput(this, "AdministratorPasswordForFrontend", {
      value: password,
      exportName: "administratorPasswordForFrontend",
    });

    // Refer to API details on https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminCreateUser.html
    const adminCreateUser = new AwsCustomResource(
      this,
      "AwsCustomResource-CreateUser",
      {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminCreateUser",
          parameters: {
            UserPoolId: props.cognitoUserPool.userPoolId,
            Username: username,
            MessageAction: "SUPPRESS",
            TemporaryPassword: password,
            UserAttributes: [
              {
                Name: "email",
                Value: props.administratorEmail,
              },
            ],
          },
          physicalResourceId: PhysicalResourceId.of(
            `AwsCustomResource-CreateUser-${username}`
          ),
        },

        onDelete: {
          service: "CognitoIdentityServiceProvider",
          action: "adminDeleteUser",
          parameters: {
            UserPoolId: props.cognitoUserPool.userPoolId,
            Username: username,
          },
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
        installLatestAwsSdk: true,
      }
    );

    NagSuppressions.addResourceSuppressions(
      adminCreateUser,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "We need to create a user.",
        },
      ],
      true
    );

    // Force the password for the user, since new users created are in FORCE_PASSWORD_CHANGE status by default, such new user has no way to change it though
    // Refer to API details on https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminSetUserPassword.html
    const adminSetUserPassword = new AwsCustomResource(
      this,
      "AwsCustomResource-ForcePassword",
      {
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminSetUserPassword",
          parameters: {
            UserPoolId: props.cognitoUserPool.userPoolId,
            Username: username,
            Password: password,
            Permanent: true,
          },
          physicalResourceId: PhysicalResourceId.of(
            `AwsCustomResource-ForcePassword-${username}`
          ),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
        installLatestAwsSdk: true,
      }
    );
    adminSetUserPassword.node.addDependency(adminCreateUser);

    NagSuppressions.addResourceSuppressions(
      adminSetUserPassword,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "We need to set th epassword.",
        },
      ],
      true
    );
  }
}

function newPasswordGenerator() {
  const specials = "!@#$%^&*()_+{}:\"<>?|[];',./`~";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";

  var password = "";
  password += pick(specials, 3, 3);
  password += pick(lowercase, 5, 5);
  password += pick(uppercase, 5, 5);
  password += pick(numbers, 3, 3);
  password = shuffle(password);

  return password;
}

function shuffle(theString: string) {
  var array = theString.split("");
  var tmp,
    current,
    top = array.length;

  if (top)
    while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = array[current];
      array[current] = array[top];
      array[top] = tmp;
    }

  return array.join("");
}

function pick(theString: string, min: number, max: number) {
  var n,
    chars = "";

  if (typeof max === "undefined") {
    n = min;
  } else {
    n = min + Math.floor(Math.random() * (max - min + 1));
  }

  for (var i = 0; i < n; i++) {
    chars += theString.charAt(Math.floor(Math.random() * theString.length));
  }

  return chars;
}
