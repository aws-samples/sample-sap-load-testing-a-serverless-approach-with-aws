import config from "../confg";
import LoadTest from "../types/LoadTest";
import { PresignedUrlResponse } from "../types/NewTest";

export async function getPresignedUrl(
  restApiEndpoint: string,
  accessToken: string,
  k6FileS3Key: string
): Promise<PresignedUrlResponse> {
  try {
    // get URL
    const urlResponse = await fetch(
      `${restApiEndpoint}get-presigned-url?k6_script_file_key=${k6FileS3Key}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${accessToken}`,
        },
      }
    );

    const presignedUrlResponse: PresignedUrlResponse = await urlResponse.json();

    return presignedUrlResponse;
  } catch (error) {
    console.error("Error fetching presigned URL:", error);
    throw error;
  }
}

export async function uploadFileToS3(presignedUrl: string, file: File) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/zip",
        // Authorization: `${accessToken}`,
      },
      body: formData,
    });
  } catch (error) {
    console.error("Error fetching presigned URL:", error);
    throw error;
  }
}

export async function submitNewTest(
  restApiEndpoint: string,
  accessToken: string,
  testConfiguration: any
) {
  try {
    const response = await fetch(`${restApiEndpoint}launch-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add any additional headers like authentication if needed
        Authorization: `${accessToken}`,
      },
      body: JSON.stringify(testConfiguration),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error while posting the form! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating new test:", error);
    throw error;
  }
}

export async function createNewTest(
  executionId: string,
  accessToken: string,
  formData: any
) {
  // //The sumbmitData represent the form to be sent to the launchTest REST API
  let testDataToSubmit: any = {};
  //add data to testDataToSubmit
  testDataToSubmit["executionId"] = executionId;
  testDataToSubmit["testName"] = formData.testName;
  testDataToSubmit["testType"] = formData.testType;
  testDataToSubmit["sapSID"] = formData.sapSID;
  testDataToSubmit["enableAnalytics"] = formData.enableAnalytics.toString();

  ///prepare the submit form based on the test Type
  switch (formData.testType) {
    case "application":
      if (formData.k6Options != undefined && formData.k6Options != "") {
        testDataToSubmit["k6Options"] = formData.k6Options;
      }

      if (formData.k6File instanceof File) {
        const file = formData.k6File;
        const filename = formData.k6File.name;
        const k6FileS3Key = `${executionId}/${filename}`;
        try {
          const presignedUrlResponse = await getPresignedUrl(
            config.restApiBaseEndpoint,
            accessToken,
            k6FileS3Key
          );

          // Upload file to S3
          await uploadFileToS3(presignedUrlResponse.presigned_url, file);

          // testDataToSubmit["k6FileS3Key"] = k6FileS3Key;
          testDataToSubmit["k6FileS3Url"] = presignedUrlResponse.s3_uri;
        } catch (err) {
          console.log("Error:", err);
        }
      }

      break;
    case "database":
      if (formData.k6Options != undefined && formData.k6Options != "") {
        testDataToSubmit["k6Options"] = formData.k6Options;
      }

      if (formData.k6File instanceof File) {
        const file = formData.k6File;
        const filename = formData.k6File.name;
        const k6FileS3Key = `${executionId}/${filename}`;
        try {
          const presignedUrlResponse = await getPresignedUrl(
            config.restApiBaseEndpoint,
            accessToken,
            k6FileS3Key
          );

          // Upload file to S3
          await uploadFileToS3(presignedUrlResponse.presigned_url, file);

          // testDataToSubmit["k6FileS3Key"] = k6FileS3Key;
          testDataToSubmit["k6FileS3Url"] = presignedUrlResponse.s3_uri;
        } catch (err) {
          console.log("Error:", err);
        }
      }
      break;
    case "network":
      testDataToSubmit["delayms"] = formData.delayms;
      testDataToSubmit["duration"] = formData.duration;

      break;
    case "infrastructure":
      //handle here the additional parameters
      break;
    default:
      break;
  }

  //submit the form to rest api
  await submitNewTest(
    config.restApiBaseEndpoint,
    accessToken,
    testDataToSubmit
  );
}

export async function runExistingTest(
  previousExecutionId: string,
  accessToken: string
) {
  try {
    //new execution id
    const executionId = Math.floor(Date.now() / 1000).toString();

    const executionDetails = await fetch(
      `${config.restApiBaseEndpoint}get-execution-details?executionId=${previousExecutionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${accessToken}`,
        },
      }
    );

    const jsonData = await executionDetails.json();
    let testDataToSubmit: any = {};

    //add data to testDataToSubmit
    testDataToSubmit["executionId"] = executionId; //use the new execution id
    testDataToSubmit["testName"] = jsonData.execution.testName;
    testDataToSubmit["testType"] = jsonData.execution.testType;
    testDataToSubmit["sapSID"] = jsonData.execution.sapSID;
    let enableAnalytics = "false";
    if (jsonData.execution.StoreResultsInS3 === "y") {
      enableAnalytics = "true";
    }
    testDataToSubmit["enableAnalytics"] = enableAnalytics;

    switch (jsonData.execution.testType) {
      case "application":
        if (
          jsonData.execution.k6Options != undefined &&
          jsonData.execution.k6Options != ""
        ) {
          testDataToSubmit["k6Options"] = jsonData.execution.k6Options;
        }
        testDataToSubmit["k6FileS3Url"] = jsonData.execution.K6ScriptS3Uri;
        break;
      case "database":
        //handle here the additional parameters
        break;
      case "network":
        testDataToSubmit["delayms"] = jsonData.execution.delayms;
        testDataToSubmit["duration"] = jsonData.execution.duration;

        break;
      case "infrastructure":
        //handle here the additional parameters
        break;
      default:
        break;
    }
    //submit the form to rest api
    await submitNewTest(
      config.restApiBaseEndpoint,
      accessToken,
      testDataToSubmit
    );
  } catch (error) {
    console.error("Error fetching execution details:", error);
    throw error;
  }
}

export async function fetchTests(
  accessToken: string,
  pageSize: string
): Promise<LoadTest[]> {
  if (pageSize == undefined || pageSize == "") {
    pageSize = "20";
  }

  const fetchTestUrl = `${config.restApiBaseEndpoint}state-machines?pageSize=${pageSize}`;
  try {
    const response = await fetch(fetchTestUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${accessToken}`,
      },
    });
    const data = await response.json();
    console.log("data", data);
    const parsedTests: LoadTest[] = data["executions"];

    return parsedTests;
    // const parsedTests: LoadTest[] = data;
    // setTests(parsedTests);
  } catch (error) {
    console.error("Error fetching tests:", error);
    return [];
  }
}
