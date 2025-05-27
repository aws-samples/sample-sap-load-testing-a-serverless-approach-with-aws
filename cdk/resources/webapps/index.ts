// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { execSync } from "child_process";
import {
  CloudFormationCustomResourceHandler,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
} from "aws-lambda";
import s3SpaUpload from "s3-spa-upload";
// import { existsSync, mkdirSync } from "fs";
import { ncp } from "ncp";
import { sendCfnResponse, Status } from "./cfn-response";
import * as fs from "fs";

interface Configuration {
  bucketName: string;
  restApiBaseEndpoint: string;
  cognitoAuthority: string;
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoRedirectUri: string;
  cognitoLogoutUri: string;
  region: string;
}

async function buildSpa(config: Configuration) {
  const temp_dir = "/tmp/sap-load-tests-ui-app";
  const home_dir = "/tmp/home";

  if (!fs.existsSync(home_dir)) {
    fs.mkdirSync(home_dir);
  }

  console.log(
    `Copying SPA sources to ${temp_dir} and making dependencies available there ...`
  );

  await new Promise<void>((resolve, reject) => {
    ncp(`${__dirname}/sap-load-tests-ui-app`, temp_dir, (err) =>
      err ? reject(err) : resolve()
    );
  });

  createEnvironmentFile(config, home_dir, temp_dir);
  configureContentSecurityPolicy(config, home_dir, temp_dir);

  fs.readFile(`${temp_dir}/index.html`, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`index.html: ${data}`);
  });

  console.log("NPM version:");
  execSync("npm -v", {
    cwd: temp_dir,
    stdio: "inherit",
    env: { ...process.env, HOME: home_dir },
  });
  console.log(`Installing dependencies to build React app in ${temp_dir} ...`);
  execSync("npm ci", {
    cwd: temp_dir,
    stdio: "inherit",
    env: { ...process.env, HOME: home_dir },
  });
  console.log(`Running build of React app in ${temp_dir} ...`);
  execSync("npm run build", {
    cwd: temp_dir,
    stdio: "inherit",
    env: { ...process.env, HOME: home_dir },
  });
  console.log("Build succeeded");

  return `${temp_dir}/dist`;
}

async function createEnvironmentFile(
  config: Configuration,
  home_dir: string,
  temp_dir: string
) {
  execSync(
    `cat > .env << EOF
VITE_REST_API_BASE_ENDPOINT=${config.restApiBaseEndpoint}
VITE_COGNITO_DOMAIN=https://${config.cognitoDomain}.auth.${config.region}.amazoncognito.com
VITE_COGNITO_AUTHORITY=${config.cognitoAuthority}
VITE_COGNITO_CLIENT_ID=${config.cognitoClientId}
VITE_COGNITO_REDIRECT_URI=${config.cognitoRedirectUri}
VITE_COGNITO_LOGOUT_URI=${config.cognitoLogoutUri}
VITE_REGION=${config.region}
EOF`,
    {
      cwd: temp_dir,
      stdio: "inherit",
      env: { ...process.env, HOME: home_dir },
    }
  );

  fs.readFile(`${temp_dir}/.env`, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(data);
  });
}

async function configureContentSecurityPolicy(
  config: Configuration,
  home_dir: string,
  temp_dir: string
) {
  const csp = `default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' 
    ${config.cognitoAuthority}
    ${config.cognitoDomain}
    ${config.restApiBaseEndpoint}
    https://*.execute-api.*.amazonaws.com/;
  img-src 'self' data:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';`;

  console.log(csp);
  replaceInFile(`${temp_dir}/index.html`, "CONTENT_SECURITY_POLICY", csp);
  replaceInFile(`${temp_dir}/vite.config.ts`, "CONTENT_SECURITY_POLICY", csp);
}

function replaceInFile(file: string, str: string, replacement: string) {
  try {
    fs.readFile(file, "utf8", (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      const newContent = data.replace(str, replacement);
      fs.writeFile(file, newContent, "utf8", (err) => {
        if (err) {
          console.error(err);
          return;
        }
      });
    });
  } catch (error) {
    console.error(error);
  }
}

async function buildUploadSpa(
  action: "Create" | "Update" | "Delete",
  config: Configuration,
  physicalResourceId?: string
) {
  try {
    if (action === "Create" || action === "Update") {
      const buildDir = await buildSpa(config);
      await s3SpaUpload(buildDir, config.bucketName);
    } else {
      // "Trick" to empty the bucket is to upload an empty dir
      fs.mkdirSync("/tmp/empty_directory", { recursive: true });
      await s3SpaUpload("/tmp/empty_directory", config.bucketName, {
        delete: true,
      });
    }
  } catch (error) {
    console.error(error);
  }
  return physicalResourceId || "ReactApp";
}

export const handler: CloudFormationCustomResourceHandler = async (
  event,
  context
) => {
  console.log(JSON.stringify(event, undefined, 4));

  const { ResourceProperties, RequestType } = event;

  const { ServiceToken, ...config } = ResourceProperties;

  const { PhysicalResourceId } = event as
    | CloudFormationCustomResourceDeleteEvent
    | CloudFormationCustomResourceUpdateEvent;

  let status = Status.SUCCESS;
  let physicalResourceId: string | undefined;
  let data: { [key: string]: any } | undefined;
  let reason: string | undefined;
  try {
    physicalResourceId = await Promise.race([
      buildUploadSpa(RequestType, config as Configuration, PhysicalResourceId),
      new Promise<undefined>((_, reject) =>
        setTimeout(
          () => reject(new Error("Task timeout")),
          context.getRemainingTimeInMillis() - 500
        )
      ),
    ]);
  } catch (err) {
    console.error(err);
    status = Status.FAILED;
    reason = `${err}`;
  }
  await sendCfnResponse({
    event,
    status,
    data,
    physicalResourceId,
    reason,
  });
};
