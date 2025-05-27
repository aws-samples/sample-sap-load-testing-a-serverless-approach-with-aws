import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { CognitoUserConstruct } from "./cognito-users";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { PROJECT_PREFIX } from "../../constants";
import { NagSuppressions } from "cdk-nag";

export class CognitoConstruct extends Construct {
  readonly cognitoUserPool: UserPool;
  readonly cognitoClient: UserPoolClient;
  readonly cognitoDomain: string;
  readonly oauthScope: string;

  constructor(
    scope: Construct,
    id: string,
    props: {
      administratorEmail: string;
    }
  ) {
    super(scope, id);

    // Create a Cognito UserPool for authentication, attach the lambdaTrigger created above
    const cognitoUserPool = new cdk.aws_cognito.UserPool(
      this,
      "CognitoUserPool",
      {
        userPoolName: `${PROJECT_PREFIX}-userpool`,
        selfSignUpEnabled: false,
        signInCaseSensitive: true,
        autoVerify: {
          email: true,
        },
        standardAttributes: {
          email: {
            required: true,
            mutable: false,
          },
        },
        passwordPolicy: {
          minLength: 12,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: true,
        },
        accountRecovery: cdk.aws_cognito.AccountRecovery.EMAIL_ONLY,

        mfa: cdk.aws_cognito.Mfa.OFF,
      }
    );

    this.cognitoUserPool = cognitoUserPool;

    NagSuppressions.addResourceSuppressions(
      cognitoUserPool,
      [
        {
          id: "AwsSolutions-COG3",
          reason: "MFA is not required for this prototype",
        },
      ],
      true
    );

    cognitoUserPool.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const scopeName = "full";
    const resourceName = "saploadtests";
    // Define a Resource Server for the User Pool
    const resourceServerScope = new cdk.aws_cognito.ResourceServerScope({
      scopeDescription: "Handle SAP Load Tests",
      scopeName: scopeName,
    });
    const resourceServer = new cdk.aws_cognito.UserPoolResourceServer(
      this,
      "ResourceServer",
      {
        userPool: cognitoUserPool,
        userPoolResourceServerName: resourceName,
        identifier: resourceName,
        scopes: [resourceServerScope],
      }
    );
    this.oauthScope = `${resourceName}/${scopeName}`;

    const userPoolClientProps = {
      userPool: cognitoUserPool,
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cdk.aws_cognito.OAuthScope.OPENID,
          cdk.aws_cognito.OAuthScope.PROFILE,
          cdk.aws_cognito.OAuthScope.resourceServer(
            resourceServer,
            resourceServerScope
          ),
        ],
        // callbackUrls: ["http://localhost:3000"],
        // logoutUrls: ["http://localhost:3000"]
      },
    };

    // Create an App client for the User Pool
    // Using localhost for callback + logout for testing purposes
    const cognitoUserPoolClient = new cdk.aws_cognito.UserPoolClient(
      this,
      "UserPoolClient",
      {
        userPool: cognitoUserPool,
        generateSecret: false,
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
            implicitCodeGrant: true,
          },
          scopes: [
            cdk.aws_cognito.OAuthScope.OPENID,
            cdk.aws_cognito.OAuthScope.PROFILE,
            cdk.aws_cognito.OAuthScope.resourceServer(
              resourceServer,
              resourceServerScope
            ),
          ],
        },
      }
    );

    this.cognitoClient = cognitoUserPoolClient;

    // // Get the UNIX timestamp in ms to ensure uniqueness in names
    // const timestamp: string = String(new Date().getTime())

    // Create a domain for OAuth2 communication from the application <-> Cognito
    const domain = cognitoUserPool.addDomain("CognitoDomain", {
      cognitoDomain: {
        domainPrefix: `saploadtests-domain-${cdk.Stack.of(this).account}`,
      },
    });
    this.cognitoDomain = domain.domainName;

    new CognitoUserConstruct(this, "CognitoUserConstruct", {
      cognitoUserPool: cognitoUserPool,
      administratorEmail: props.administratorEmail,
    });
  }
}
