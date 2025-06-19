import json
import os
import boto3
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
import mimetypes

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, TestExecutionDetails):
            return obj.to_dict()
        return super().default(obj)

global state_machine_executions
global sapSystems
SAP_SYSTEM_ID="sapSID"
TEST_NAME="testName"
TEST_TYPE="testType"
STORE_RESULTS_IN_S3="StoreResultsInS3"

def get_state_machine_executions(event, context):
    STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]

    client = boto3.client("stepfunctions")
    #get environment variable
    executions = []
    try:
        page_size = event.get("queryStringParameters").get("pageSize")
    # Base parameters for the API call
        params = {
            'stateMachineArn': STATE_MACHINE_ARN,
        }

        # Add maxResults only if page_size is not "ALL"
        if page_size != "ALL":
            params['maxResults'] = int(page_size)

        response = client.list_executions(**params)

        state_machine_executions = response["executions"]
        for executionHeader in state_machine_executions:
            print(f'executionHeader: {executionHeader}')
            executionBody = json.loads(client.describe_execution(executionArn=executionHeader["executionArn"])["input"])
            print(f'executionBody: {executionBody}')
            print(f'executionHeader.get("stopDate"): {executionHeader.get("stopDate")}')
            endDate = ""
            if executionHeader.get("stopDate") != None: 
                endDate=executionHeader.get("stopDate")
            
            execution_detail = {
                "executionId": executionBody.get("executionId"), # type: ignore
                "stateMachineExecutionArn": executionHeader.get("executionArn"), # type: ignore
                "sapSID": executionBody.get("sapSID"), # type: ignore
                "testType": executionBody.get(TEST_TYPE), # type: ignore
                "testName": executionBody.get(TEST_NAME), # type: ignore
                "storeMetricsInS3": executionBody.get(STORE_RESULTS_IN_S3), # type: ignore
                "stateMachineArn": STATE_MACHINE_ARN, # type: ignore
                "status": executionHeader.get("status"), # type: ignore
                "startDate": executionHeader.get("startDate"), # type: ignore
                "stopDate": endDate # type: ignore
            }
            executions.append(execution_detail)

            # print(executions)

    except Exception as e:
        return {
            'statusCode': 400,
            'body': f'Error listing state machines: {e}',
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        }            
        }
    # return the list of state machines
    return {
        'statusCode': 200,
        'body': json.dumps({'executions': executions}, cls=DateTimeEncoder),
        'isBase64Encoded': False,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers':
            'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
            'Access-Control-Allow-Credentials': 'true', 
            'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        }
    }

def get_sap_systems(event, context):
    secretsmanager = boto3.client('secretsmanager')
    try:
        results = []
        SAP_LOAD_TEST_TAG_PROJECT_PREFIX=os.environ["SAP_LOAD_TEST_TAG_PROJECT_PREFIX"]
        response = secretsmanager.list_secrets(
            IncludePlannedDeletion=False,
            # MaxResults=123,
            # NextToken='string',
            Filters=[
                {
                    'Key': 'tag-key',
                    'Values': [
                        'Project',
                    ]
                },
                {
                    'Key': 'tag-value',
                    'Values': [
                        SAP_LOAD_TEST_TAG_PROJECT_PREFIX,
                        # 'sap-load-tests'
                    ]
                },            
            ],
            SortOrder='asc')

        ## iterate secrets 
        for secret in response["SecretList"]:   
            # print(secret.get("Tags"))
            for tag in secret.get("Tags"):
                if(tag.get('Key') == 'sapSID'):
                    results.append(tag.get('Value'))
    except Exception as e:
        return {
            'statusCode': 400,
            'body': f'Error listing sap systems: {e}',
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            }            
        }
    finally:
        return {
            'statusCode': 200,
            'body': json.dumps(results),
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        }
    }     


def get_sap_systems_from_s3(event, context):
    s3 = boto3.client('s3')
    S3_ASSETS_BUCKET_NAME = os.environ["S3_ASSETS_BUCKET_NAME"]
    SAP_SYSTEM_PREFIX = os.environ["SAP_SYSTEM_PREFIX"]
    # Ensure the prefix ends with '/' if not empty
    if SAP_SYSTEM_PREFIX and not SAP_SYSTEM_PREFIX.endswith('/'):
        SAP_SYSTEM_PREFIX += '/'
    
    try:
        # Use delimiter '/' to get only one level
        response = s3.list_objects_v2(
            Bucket=S3_ASSETS_BUCKET_NAME,
            Prefix=SAP_SYSTEM_PREFIX,
            Delimiter='/'
        )
        
        results = []
        
        # Get objects at this level
        if 'Contents' in response:
            results.extend([obj['Key'] for obj in response['Contents']])
            
        # Get common prefixes (folders) at this level
        if 'CommonPrefixes' in response:
            results.extend([prefix['Prefix'] for prefix in response['CommonPrefixes']])
        
        # transform and filter
        # return list(map(lambda x: x.split("/")[1], list(filter(lambda x: len(x.split("/")[1])==3, results))))
        parsedResults = list(map(lambda x: x.split("/")[1], list(filter(lambda x: len(x.split("/")[1])==3, results))))
    except Exception as e:
        return {
            'statusCode': 400,
            'body': f'Error listing sap systems: {e}',
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            }            
        }
    finally:
        print(f"Execution successful. Results: {parsedResults}")
        return {
            'statusCode': 200,
            'body': json.dumps(parsedResults),
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        }
    }        

def launch_new_test(event, context):
    
    file_content = {}
    try:
        print(f'event: {event}')
        body = json.loads(event["body"])
        print(f'Form parameters: {body}')

        STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]
        client = boto3.client("stepfunctions")
        s3Client = boto3.client("s3")

        SECRET_MANAGER_NAME_PREFIX = os.environ["SECRET_MANAGER_NAME_PREFIX"]
        S3_ASSETS_BUCKET_NAME = os.environ["S3_ASSETS_BUCKET_NAME"]
        # EXECUTIONS_ASSETS_S3_PREFIX = os.environ["EXECUTIONS_ASSETS_S3_PREFIX"]



        test_type = body["testType"]
        execution_id = body["executionId"]
        test_name = body[TEST_NAME]
        sap_system = body[SAP_SYSTEM_ID]    
        enable_analytics = "n"
        if body["enableAnalytics"]=="true":
            enable_analytics = "y"            
        step_function_parameters = {}

        LoadTestType="sap"
        if(test_type=="database"):
            LoadTestType="db"

        ## test type based on k6 scripts
        if test_type == "application" or test_type == "database":
            k6_options = ""

            if "K6Options" in body:
                k6_options = body["K6Options"]
            else:
                print("K6Options is not present")

            k6_file_s3_url = body["K6FileS3Url"]
            
            step_function_parameters = {
                "executionId": execution_id,
                "sapSID": sap_system,
                "testType": test_type,
                "testName": test_name,
                "smsecret": f'{SECRET_MANAGER_NAME_PREFIX}-{sap_system.upper()}',
                "LoadTestType": LoadTestType,
                "StoreResultsInS3": enable_analytics,
                "K6ScriptS3Uri": k6_file_s3_url,
                "K6Options": k6_options
            } 
        if test_type == "network":

            delayms = body["delayms"]
            duration = body["duration"]

            step_function_parameters = {
                "executionId": execution_id,
                "sapSID": sap_system,
                "testType": test_type,
                "testName": test_name,
                "smsecret": f'{SECRET_MANAGER_NAME_PREFIX}-{sap_system.upper()}',
                "LoadTestType": "network",
                "StoreResultsInS3": enable_analytics,
                "delayms": delayms,
                "duration": duration
            }   

        # if test_type == "database":
        #     step_function_parameters = {
        #         "executionId": execution_id,
        #         "sapSID": sap_system,
        #         "testType": test_type,
        #         "testName": test_name,
        #         "smsecret": f'{SECRET_MANAGER_NAME_PREFIX}-{sap_system.upper()}',
        #         "LoadTestType": "db",
        #         "StoreResultsInS3": enable_analytics,
        #     }       

        if test_type == "infrastructure":
            step_function_parameters = {
                "executionId": execution_id,
                "sapSID": sap_system,
                "testType": test_type,
                "testName": test_name,
                "smsecret": f'{SECRET_MANAGER_NAME_PREFIX}-{sap_system.upper()}',
                "LoadTestType": "infra",
                "StoreResultsInS3": enable_analytics,
            }                                      

        response = client.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            input=json.dumps(step_function_parameters)
        )

        file_content = step_function_parameters
        #add new items to file_content
        step_function_result = {
                "executionArn": response["executionArn"],
                "InputParameters": json.dumps(step_function_parameters)            
        }

        file_content["StepFunction"] = step_function_result

        print(f"Execution successful. Response: {file_content}")

        ## write execution details to S3
        writeToS3(file_content)

    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 400,
            'body': f'Error listing sap systems: {e}',
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            }            
        }
    finally:
        print(f"Execution successful. Results: {file_content}")
        return {
            'statusCode': 200,
            'body': json.dumps(file_content),
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
        }
    } 


def writeToS3(file_content):
    S3_ASSETS_BUCKET_NAME = os.environ["S3_ASSETS_BUCKET_NAME"]
    EXECUTIONS_ASSETS_S3_PREFIX = os.environ["EXECUTIONS_ASSETS_S3_PREFIX"]
    s3Client = boto3.client("s3")
    try:
        s3Client.put_object(
            Bucket=S3_ASSETS_BUCKET_NAME,
            Key=f'{EXECUTIONS_ASSETS_S3_PREFIX}/{file_content["executionId"]}',
            Body=json.dumps(file_content, cls=DateTimeEncoder)
        )
    except Exception as e:
        print(f"Error writing to S3: {e}")
        raise


def create_presigned_url(event, context):
    """Generate a presigned URL to share an S3 object
    reference: https://medium.com/@muyoungko/s3-putobject-with-presigned-url-returns-forbidden-403-response-ee32f8986f99

    :param bucket_name: string
    :param object_name: string
    :param expiration: Time in seconds for the presigned URL to remain valid
    :return: Presigned URL as string. If error, returns None.
    """
    print(f'event: {event}')
    S3_ASSETS_BUCKET_NAME = os.environ["S3_ASSETS_BUCKET_NAME"]
    TEST_K6_SCRIPTS_ASSETS_S3_PREFIX = os.environ["TEST_K6_SCRIPTS_ASSETS_S3_PREFIX"]
    k6_script_file_key = event.get("queryStringParameters").get("k6_script_file_key")
    # content_type = event.get("queryStringParameters").get("content_type")

    content_type = mimetypes.guess_type(k6_script_file_key)[0]
    print(f'content_type: {content_type}')
    s3_key = f'{TEST_K6_SCRIPTS_ASSETS_S3_PREFIX}/{k6_script_file_key}'
    expiration=120
    # Generate a presigned URL for the S3 object
    s3_client = boto3.client('s3')
    try:
        response = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_ASSETS_BUCKET_NAME, 
                'Key': s3_key, 
                'ContentType':content_type
            },
            ExpiresIn=expiration,
        )

        result={
            "s3_uri": f's3://{S3_ASSETS_BUCKET_NAME}/{TEST_K6_SCRIPTS_ASSETS_S3_PREFIX}/{k6_script_file_key}',
            "presigned_url": response
        }

        print(f'Presigned Results: {result}')
    except Exception as e:
        return {
            'statusCode': 500,
            'body': f'Error launching new test: {e}',
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            }                
        }
    finally:
        return {
            'statusCode': 201,
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', 
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
            },
            'body': json.dumps(result),

            }    

def get_execution_details(event, context):
    print(f'event: {event}')
    S3_ASSETS_BUCKET_NAME = os.environ["S3_ASSETS_BUCKET_NAME"]
    EXECUTIONS_ASSETS_S3_PREFIX = os.environ["EXECUTIONS_ASSETS_S3_PREFIX"]
    s3Client = boto3.client("s3")
    try:
        execution_id = event.get("queryStringParameters").get("executionId")

        s3_key = f'{EXECUTIONS_ASSETS_S3_PREFIX}/{execution_id}'
        response = s3Client.get_object(
            Bucket=S3_ASSETS_BUCKET_NAME,
            Key=s3_key
        )
        # get the file content as json string
        json_string = response['Body'].read().decode('utf-8')    
        result={
            "execution": json.loads(json_string)
        }
        print(f'Execution Results: {json.dumps(result)}')

    except Exception as e:
        return {
            'statusCode': 500,
            'body': f'Error launching new test: {e}',
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
            }
        }
    finally:
        return {
            'statusCode': 200,
            'isBase64Encoded': False,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
                'Access-Control-Allow-Headers':
                'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
            },
            'body': json.dumps(result),
        }


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)
    

