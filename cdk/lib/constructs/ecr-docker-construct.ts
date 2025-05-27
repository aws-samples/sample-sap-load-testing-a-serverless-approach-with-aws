import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import { DockerImageName, ECRDeployment } from "cdk-ecr-deployment";
import { URL } from "url";
import { PROJECT_PREFIX, SECRET_MANAGER_NAME_PREFIX } from "../constants";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Code, Function } from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";

const ecrImageRepositoryName = `${PROJECT_PREFIX}`;

export class ECRDockerConstruct extends Construct {
  readonly applicationK6DockerImage: string;
  readonly applicationK6DockerImageDeploy: ECRDeployment;
  readonly databaseK6DockerImage: string;
  readonly databaseK6DockerImageDeploy: ECRDeployment;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // =====================================================================================
    // Building the K6 tool image and pushing to ECR
    // =====================================================================================
    //// docker tag with current timestamp
    const docker_tag = Math.floor(new Date().getTime() / 1000);

    const batchImageRepo = new cdk.aws_ecr.Repository(
      this,
      `${PROJECT_PREFIX}-${ecrImageRepositoryName}`,
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY, // <==FOR DEMO ONLY ===
        repositoryName: `${ecrImageRepositoryName}`,
      }
    );

    //k6 load injector
    const applicationK6Image = new DockerImageAsset(
      this,
      `${PROJECT_PREFIX}-K6Application-DockerImage`,
      {
        directory: path.join(
          __dirname,
          "../../resources/docker-images/k6-load-injector-application"
        ),
      }
    );

    const applicationK6ImageUri = `${batchImageRepo.repositoryUri}:k6_application_${docker_tag}`;
    const applicationK6DockerImageDeploy = new ECRDeployment(
      this,
      `${PROJECT_PREFIX}-K6Application-DockerImageDeploy`,
      {
        src: new DockerImageName(applicationK6Image.imageUri),
        dest: new DockerImageName(applicationK6ImageUri),
      }
    );
    this.applicationK6DockerImage = applicationK6ImageUri;
    this.applicationK6DockerImageDeploy = applicationK6DockerImageDeploy;

    var customDeployment = scope.node.children
      .filter((node) => node.node.id.startsWith("ECRDocker"))[0]
      .node.children.filter((subnode) =>
        subnode.node.id.startsWith(
          `${PROJECT_PREFIX}-K6Application-DockerImageDeploy`
        )
      );

    NagSuppressions.addResourceSuppressions(
      customDeployment,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources",
        },
      ],
      true // Even with applyToChildren=true
    );

    //hana load injector
    const databaseK6Image = new DockerImageAsset(
      this,
      `${PROJECT_PREFIX}-K6Database-DockerImage`,
      {
        directory: path.join(
          __dirname,
          "../../resources/docker-images/k6-load-injector-database"
        ),
      }
    );

    const databaseK6ImageUri = `${batchImageRepo.repositoryUri}:k6_database_${docker_tag}`;
    const databaseK6DockerImageDeploy = new ECRDeployment(
      this,
      `${PROJECT_PREFIX}-K6Database-DockerImageDeploy`,
      {
        src: new DockerImageName(databaseK6Image.imageUri),
        dest: new DockerImageName(databaseK6ImageUri),
      }
    );
    this.databaseK6DockerImage = databaseK6ImageUri;
    this.databaseK6DockerImageDeploy = databaseK6DockerImageDeploy;

    customDeployment = scope.node.children
      .filter((node) => node.node.id.startsWith("ECRDocker"))[0]
      .node.children.filter((subnode) =>
        subnode.node.id.startsWith(
          `${PROJECT_PREFIX}-K6Database-DockerImageDeploy`
        )
      );

    NagSuppressions.addResourceSuppressions(
      customDeployment,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Can't control managed policie resources",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Can't control managed policie resources",
        },
      ],
      true // Even with applyToChildren=true
    );
  }
}
