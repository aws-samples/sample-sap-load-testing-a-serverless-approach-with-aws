import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as customResources from "aws-cdk-lib/custom-resources";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { NagSuppressions } from "cdk-nag";

export class APIGatewayConstruct extends Construct {
  readonly restApiEndpoint: string;
  private readonly apiGatewayRole: iam.Role;

  constructor(
    scope: Construct,
    id: string,
    props: {
      cognitoUserPool: UserPool;
      cognitoClient: UserPoolClient;
      oauthScope: string;
      listStateMachineFunction: lambda.Function;
      listSAPSystemsFunction: lambda.Function;
      launchNewTestFunction: lambda.Function;
      getExecutionDetailsFunction: lambda.Function;
      getPresignedS3UrlFunction: lambda.Function;
      s3BucketForArtefacts: cdk.aws_s3.Bucket;
    }
  ) {
    super(scope, id);

    // Create IAM Role for API Gateway to allow S3 upload
    const apiGatewayRole = new iam.Role(this, "api-gateway-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    apiGatewayRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [
          props.s3BucketForArtefacts.bucketArn,
          `${props.s3BucketForArtefacts.bucketArn}/*`,
        ],
        actions: ["s3:PutObject"],
      })
    );

    const allowPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ["execute-api:Invoke"],
      resources: [
        `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/*`,
      ],
    });

    const policy = new iam.PolicyDocument({
      statements: [allowPolicy],
    });

    const accessLogs = new cdk.aws_logs.LogGroup(this, `ApigwAccessLogs${id}`, {
      retention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    const api = new apigateway.RestApi(this, "SAPLoadTestAPI", {
      restApiName: "SAP Load Test UI rest service",
      description:
        "Handles the frontend services for the UI of the SAP Load Test tool",
      policy: policy,
      deployOptions: {
        stageName: "api",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogs),
      },

      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        // allowOrigins: ["https://d2m9fikaqmq1lr.cloudfront.net"],

        allowMethods: apigateway.Cors.ALL_METHODS,
        // allowHeaders: apigateway.Cors.DEFAULT_HEADERS
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
          "Content-Disposition", // Important for file uploads
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.seconds(600), // Cache preflight results for 10 minutes
      },
      cloudWatchRole: true,
      binaryMediaTypes: ["application/octet-stream"],
    });

    const requestValidator = new cdk.aws_apigateway.RequestValidator(
      scope,
      "ReqValidator",
      {
        restApi: api,
        requestValidatorName: "req-validator",
        validateRequestBody: true,
        validateRequestParameters: true,
      }
    );

    // Create a Cognito Authorizer for the sample API
    const authorizer = new cdk.aws_apigateway.CognitoUserPoolsAuthorizer(
      this,
      "sap-Load-TestAuthorizer",
      {
        cognitoUserPools: [props.cognitoUserPool],
      }
    );

    //List State Machines API
    api.root
      .addResource("state-machines", {})
      .addMethod(
        "GET",
        new apigateway.LambdaIntegration(props.listStateMachineFunction),
        {
          authorizer: authorizer,
          authorizationScopes: [props.oauthScope],
          authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
          requestValidator: requestValidator,
        }
      );

    //List SAP Systems API
    api.root
      .addResource("sap-systems", {})
      .addMethod(
        "GET",
        new apigateway.LambdaIntegration(props.listSAPSystemsFunction),
        {
          authorizer: authorizer,
          authorizationScopes: [props.oauthScope],
          authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
          requestValidator: requestValidator,
        }
      );

    //Launch New TestAPI
    api.root
      .addResource("launch-test", {})
      .addMethod(
        "POST",
        new apigateway.LambdaIntegration(props.launchNewTestFunction),
        {
          authorizer: authorizer,
          authorizationScopes: [props.oauthScope],
          authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
          requestValidator: requestValidator,
        }
      );

    //List SAP Systems API
    api.root
      .addResource("get-execution-details", {})
      .addMethod(
        "GET",
        new apigateway.LambdaIntegration(props.getExecutionDetailsFunction),
        {
          authorizer: authorizer,
          authorizationScopes: [props.oauthScope],
          authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
          requestValidator: requestValidator,
        }
      );

    //Get Presigned URL
    api.root
      .addResource("get-presigned-url", {})
      .addMethod(
        "GET",
        new apigateway.LambdaIntegration(props.getPresignedS3UrlFunction),
        {
          authorizer: authorizer,
          authorizationScopes: [props.oauthScope],
          authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
          requestParameters: {
            "method.request.querystring.k6_script_file_key": true,
          },
          requestValidatorOptions: {
            validateRequestParameters: true,
          },
        }
      );

    this.restApiEndpoint = api.url;

    const cognitoIdentityProviderProperty: cdk.aws_cognito.CfnIdentityPool.CognitoIdentityProviderProperty =
      {
        clientId: props.cognitoClient.userPoolClientId,
        providerName: props.cognitoUserPool.userPoolProviderName,
      };

    // Create the Identity Pool
    const identityPool = new cdk.aws_cognito.CfnIdentityPool(
      this,
      "IdentityPool",
      {
        identityPoolName: "AnyCompanyIdentityPool",
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [cognitoIdentityProviderProperty],
      }
    );

    // Create ABAC policy to allow access to S3 resources by matching prefix to department in Principal Tag (which come from the user token)
    const s3AccessStatement = new iam.PolicyStatement({
      resources: [props.s3BucketForArtefacts.bucketArn],
      actions: ["s3:*"],
      conditions: {
        StringEquals: {
          "s3:prefix": "${aws:PrincipalTag/department}",
        },
      },
      effect: iam.Effect.ALLOW,
    });
    const authPolicyDocument = new iam.PolicyDocument({
      statements: [s3AccessStatement],
    });

    const authPolicyProperty: iam.CfnRole.PolicyProperty = {
      policyDocument: authPolicyDocument,
      policyName: "AuthRoleAccessPolicy",
    };

    // Create an IAM role for authenticated users, attach ABAC policy to role
    const authRole = new iam.CfnRole(this, "CognitoAuthRole", {
      roleName: "CognitoIdentityPoolRole-AuthorizedSAPLoadTest",
      assumeRolePolicyDocument: {
        Statement: [
          {
            Effect: iam.Effect.ALLOW,
            Action: ["sts:AssumeRoleWithWebIdentity", "sts:TagSession"],
            Condition: {
              StringEquals: {
                "cognito-identity.amazonaws.com:aud": identityPool.ref,
              },
              "ForAnyValue:StringLike": {
                "cognito-identity.amazonaws.com:amr": "authenticated",
              },
            },
            Principal: {
              Federated: "cognito-identity.amazonaws.com",
            },
          },
        ],
      },
      policies: [authPolicyProperty],
    });

    NagSuppressions.addResourceSuppressions(
      authRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "The API Gateway requires these permissions",
        },
      ],
      true
    );

    new cdk.aws_cognito.CfnIdentityPoolRoleAttachment(this, "defaultRoles", {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authRole.attrArn,
      },
    });

    const createParameters = {
      IdentityPoolId: identityPool.ref,
      IdentityProviderName: props.cognitoUserPool.userPoolProviderName,
      PrincipalTags: {
        department: "department",
      },
      UseDefaults: false,
    };

    const setPrincipalTagAction = {
      action: "setPrincipalTagAttributeMap",
      service: "CognitoIdentity",
      parameters: createParameters,
      physicalResourceId: customResources.PhysicalResourceId.of(
        identityPool.ref
      ),
    };

    const { region, account } = cdk.Stack.of(this);
    const identityPoolArn = `arn:aws:cognito-identity:${region}:${account}:identitypool/${identityPool.ref}`;

    // Creates a Custom resource (https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources-readme.html)
    // This is necessary to attach Principal Tag mappings to the Identity Pool after it has been created.
    // This uses the SDK, rather than CDK code, as attaching Principal Tags through CDK is currently not supported yet
    new customResources.AwsCustomResource(this, "CustomResourcePrincipalTags", {
      onCreate: setPrincipalTagAction,
      onUpdate: setPrincipalTagAction,
      policy: customResources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [identityPoolArn],
      }),
    });
  }
}
