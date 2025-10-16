// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { Construct, IConstruct } from "constructs";
// import { NagSuppressions } from "cdk-nag";
import { join } from "path";
import { PROJECT_PREFIX, WEBAPP_S3_BUCKET_NAME_PREFIX } from "../constants";
import { HeadersFrameOption } from "aws-cdk-lib/aws-cloudfront";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
} from "aws-cdk-lib/custom-resources";
import { v4 as uuidv4 } from "uuid";
import { NagSuppressions } from "cdk-nag";

export class WebApp extends Construct {
  readonly webappBucket: cdk.aws_s3.Bucket;
  readonly webappDistribution: cdk.aws_cloudfront.Distribution;

  constructor(
    scope: Construct,
    id: string,
    props: {
      restApiBaseEndpoint: string;
      cognitoAuthority: string;
      cognitoDomain: string;
      cognitoClientId: string;
      cognitoUserPoolClient: UserPoolClient;
      cognitoUserPool: UserPool;
      s3BucketForArtefacts: cdk.aws_s3.Bucket;
    }
  ) {
    super(scope, id);
    const uniqueId = cdk.Names.uniqueResourceName(this, {});

    const bucket = new cdk.aws_s3.Bucket(
      scope,
      `SAPLoadTestApplicationBucket`,
      {
        bucketName: `${WEBAPP_S3_BUCKET_NAME_PREFIX}-${
          cdk.Stack.of(this).account
        }-${cdk.Stack.of(this).region}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        versioned: false,
        enforceSSL: true,
      }
    );
    this.webappBucket = bucket;
    NagSuppressions.addResourceSuppressions(
      [bucket],
      [
        {
          id: "AwsSolutions-S1",
          reason:
            "The S3 Bucket has server access logs disabled––we use CloudFront access logs instead",
        },
      ]
    );

    const cognitoAuthorityOrigin = `https://cognito-idp.${
      cdk.Stack.of(this).region
    }.amazonaws.com/`;
    const cognitoDomainOrigin = `https://${props.cognitoDomain}.auth.${
      cdk.Stack.of(this).region
    }.amazoncognito.com/`;

    const accessLogsBucket = new cdk.aws_s3.Bucket(
      scope,
      `${uniqueId}AccessLogsBucket`,
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        objectOwnership: cdk.aws_s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      }
    );
    NagSuppressions.addResourceSuppressions(
      [accessLogsBucket],
      [
        {
          id: "AwsSolutions-S1",
          reason: "This S3 Bucket is itself an access logs bucket",
        },
      ]
    );

    // create Cloudfront Distribution
    const distribution = new cdk.aws_cloudfront.Distribution(
      scope,
      `SAPLoadTestDistribution`,
      {
        defaultBehavior: {
          origin:
            cdk.aws_cloudfront_origins.S3BucketOrigin.withOriginAccessControl(
              bucket
            ),
          viewerProtocolPolicy:
            cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: new cdk.aws_cloudfront.ResponseHeadersPolicy(
            scope,
            `Headers${uniqueId}`,
            {
              responseHeadersPolicyName: `${cdk.Aws.STACK_NAME}${id}${cdk.Aws.REGION}ResponseHeadersPolicy`,
              securityHeadersBehavior: {
                contentSecurityPolicy: {
                  contentSecurityPolicy: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${cognitoAuthorityOrigin} ${cognitoDomainOrigin} ${props.restApiBaseEndpoint} https://${props.s3BucketForArtefacts.bucketDomainName}; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self';`,
                  override: true,
                },
                contentTypeOptions: {
                  override: true,
                },
                referrerPolicy: {
                  referrerPolicy:
                    cdk.aws_cloudfront.HeadersReferrerPolicy.SAME_ORIGIN,
                  override: true,
                },
                strictTransportSecurity: {
                  includeSubdomains: true,
                  override: true,
                  preload: true,
                  accessControlMaxAge: cdk.Duration.days(365),
                },
                xssProtection: {
                  override: true,
                  protection: true,
                  modeBlock: true,
                },
              },
            }
          ),
        },
        defaultRootObject: "index.html",
        errorResponses: [{ httpStatus: 403, responsePagePath: "/index.html" }],
        logBucket: accessLogsBucket,
      }
    );
    cdk.Aspects.of(distribution).add(
      new OriginOriginAccessControlNameFix(
        `${cdk.Aws.STACK_NAME}${id}${cdk.Aws.REGION}OAC`
      )
    );

    NagSuppressions.addResourceSuppressions(
      [distribution],
      [
        {
          id: "AwsSolutions-CFR1",
          reason:
            "The CloudFront distribution may require Geo restrictions.––No concern for prototype",
        },
        {
          id: "AwsSolutions-CFR2",
          reason:
            "The CloudFront distribution may require integration with AWS WAF.––No concern for prototype",
        },
        {
          id: "AwsSolutions-CFR4",
          reason:
            "The CloudFront distribution allows for SSLv3 or TLSv1 for HTTPS viewer connections.––No concern for prototype",
        },
      ]
    );

    new cdk.CfnOutput(this, "CloudfrontDistributionURL", {
      value: distribution.domainName,
      exportName: "cloudfrontDistributionURL",
    });

    const describeUserPoolClientAction = {
      service: "CognitoIdentityServiceProvider",
      action: "describeUserPoolClient",
      parameters: {
        ClientId: props.cognitoClientId,
        UserPoolId: props.cognitoUserPool.userPoolId,
      },
      physicalResourceId: {
        id: "DescribeCognitoUserPoolClient",
      },
      region: cdk.Stack.of(this).region,
    };
    const describeUserPoolClient = new AwsCustomResource(
      this,
      "DescribeCognitoUserPoolClient",
      {
        onCreate: describeUserPoolClientAction,
        onUpdate: describeUserPoolClientAction,
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: [
            `arn:aws:cognito-idp:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:userpool/${props.cognitoUserPool.userPoolId}`,
          ],
        }),
      }
    );

    ////////////////////////////// IMPORTANT ///////////////////////////////////////////////////////////////
    // now we need to update the Cognito User Pool Client with the call back urls,
    // Please ensure you get all the required information to be updated from the existing user pool client
    ////////////////////////////// IMPORTANT ///////////////////////////////////////////////////////////////

    const updateUserPoolClientParameters = {
      ClientId: props.cognitoClientId,
      UserPoolId: props.cognitoUserPool.userPoolId,
      ClientName: describeUserPoolClient.getResponseField(
        "UserPoolClient.ClientName"
      ),
      RefreshTokenValidity: describeUserPoolClient.getResponseField(
        "UserPoolClient.RefreshTokenValidity"
      ),
      SupportedIdentityProviders: ["COGNITO"],
      AllowedOAuthFlows: ["code", "implicit"],
      AllowedOAuthScopes: ["openid", "profile", "saploadtests/full"],
      AllowedOAuthFlowsUserPoolClient: describeUserPoolClient.getResponseField(
        "UserPoolClient.AllowedOAuthFlowsUserPoolClient"
      ),
      EnableTokenRevocation: describeUserPoolClient.getResponseField(
        "UserPoolClient.EnableTokenRevocation"
      ),
      EnablePropagateAdditionalUserContextData:
        describeUserPoolClient.getResponseField(
          "UserPoolClient.EnablePropagateAdditionalUserContextData"
        ),
      AuthSessionValidity: describeUserPoolClient.getResponseField(
        "UserPoolClient.AuthSessionValidity"
      ),
      CallbackURLs: [`https://${distribution.domainName}`],
      LogoutURLs: [`https://${distribution.domainName}/logout`],
    };

    const updateUserPoolClient = new AwsCustomResource(
      this,
      "UpdateCognitoUserPoolClient",
      {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "updateUserPoolClient",
          parameters: updateUserPoolClientParameters,
          physicalResourceId: {
            id: "UpdateCognitoUserPoolClient",
          },
          region: cdk.Stack.of(this).region,
        },
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "updateUserPoolClient",
          parameters: updateUserPoolClientParameters,
          physicalResourceId: {
            id: "UpdateCognitoUserPoolClient",
          },
          region: cdk.Stack.of(this).region,
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: [
            `arn:aws:cognito-idp:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:userpool/${props.cognitoUserPool.userPoolId}`,
          ],
        }),
      }
    );

    updateUserPoolClient.node.addDependency(describeUserPoolClient);

    this.webappDistribution = distribution;

    const crHandlerFn = new cdk.aws_lambda_nodejs.NodejsFunction(
      scope,
      `WebAppHandler${id}`,
      {
        functionName: `${PROJECT_PREFIX}-webapp-handler`,
        description: "Web App Handler",
        entry: join(__dirname, "../../resources/webapps/index.ts"),
        runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
        timeout: cdk.Duration.seconds(300),
        memorySize: 3008,
        bundling: {
          commandHooks: {
            afterBundling(inputDir, outputDir) {
              return [
                `rm -rf ${inputDir}/resources/webapps/sap-load-tests-ui-app/node_modules`,
                `cp -R ${inputDir}/resources/webapps/sap-load-tests-ui-app/ ${outputDir}`,
              ];
            },
            beforeBundling: () => [],
            beforeInstall: () => [],
          },
        },
        ephemeralStorageSize: cdk.Size.mebibytes(2048),
      }
    );
    bucket.grantReadWrite(crHandlerFn);
    NagSuppressions.addResourceSuppressions(
      crHandlerFn,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Needs to read and write to the S3 bucket",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Needs to read and write to the S3 bucket",
        },
      ],
      true
    );

    // get current timestamp - updated for modernized webapp deployment
    const timestamp = new Date().getTime().toString();

    new cdk.CfnResource(scope, `WebApp-${id}`, {
      type: "Custom::WebApp",

      properties: {
        ServiceToken: crHandlerFn.functionArn,
        bucketName: bucket.bucketName,
        restApiBaseEndpoint: props.restApiBaseEndpoint,
        cognitoAuthority: props.cognitoAuthority,
        cognitoDomain: props.cognitoDomain,
        cognitoClientId: props.cognitoClientId,
        cognitoRedirectUri: `https://${distribution.domainName}`,
        cognitoLogoutUri: `https://${distribution.domainName}`,
        // cognitoRedirectUri: "http://localhost:5173",
        region: cdk.Stack.of(this).region,
        version: timestamp,
      },
    });
  }
}

class OriginOriginAccessControlNameFix implements cdk.IAspect {
  constructor(private name: string) {}
  public visit(node: IConstruct): void {
    if (node instanceof cdk.aws_cloudfront.CfnOriginAccessControl) {
      node.addPropertyOverride("OriginAccessControlConfig.Name", this.name);
    }
  }
}
