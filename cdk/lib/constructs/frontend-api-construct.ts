// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { CognitoConstruct } from "./apigw-components/cognito-construct";
import { APIGatewayConstruct } from "./apigw-components/apigw-construct";
import { LambdaAPIConstruct } from "./apigw-components/api-lambda-construct";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import * as mustache from "mustache";
import * as fs from "fs";

export class FrontendAPIConstruct extends Construct {
  readonly restAPIEndpoint: string;
  readonly cognitoAuthority: string;
  readonly cognitoDomain: string;
  readonly cognitoClientId: string;
  readonly cognitoRedirectUri: string;
  readonly cognitoLogoutUri: string;
  readonly cognitoUserPool: UserPool;
  readonly cognitoUserPoolClient: UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    props: {
      stateMachine: StateMachine;
      s3BucketForArtefacts: cdk.aws_s3.Bucket;
      administratorEmail: string;
    }
  ) {
    super(scope, id);

    const cognito = new CognitoConstruct(this, "CognitoConstruct", {
      administratorEmail: props.administratorEmail,
    });
    this.cognitoAuthority = cognito.cognitoUserPool.userPoolProviderUrl;
    this.cognitoDomain = cognito.cognitoDomain;
    this.cognitoClientId = cognito.cognitoClient.userPoolClientId;
    this.cognitoUserPoolClient = cognito.cognitoClient;
    this.cognitoUserPool = cognito.cognitoUserPool;

    const lambda = new LambdaAPIConstruct(this, "LambdaAPIConstruct", {
      stateMachine: props.stateMachine,
      s3BucketForArtefacts: props.s3BucketForArtefacts,
    });

    const apiGateway = new APIGatewayConstruct(this, "APIGatewayConstruct", {
      cognitoUserPool: cognito.cognitoUserPool,
      cognitoClient: cognito.cognitoClient,
      listStateMachineFunction: lambda.listStateMachineFunction,
      listSAPSystemsFunction: lambda.listSAPSystemsFunction,
      getExecutionDetailsFunction: lambda.getExecutionDetailsFunction,
      getPresignedS3UrlFunction: lambda.getPresignedS3UrlFunction,
      launchNewTestFunction: lambda.launchNewTestFunction,
      s3BucketForArtefacts: props.s3BucketForArtefacts,
      oauthScope: cognito.oauthScope,
    });

    this.restAPIEndpoint = apiGateway.restApiEndpoint;
  }
}
