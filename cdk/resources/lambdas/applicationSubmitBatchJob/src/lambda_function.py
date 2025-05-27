import boto3
import json
import os
from datetime import *
import time
from botocore.exceptions import ClientError
from typing import List, Dict, Any
from collections import defaultdict

def lambda_handler(event, context):
    JOB_DEFINITION_ARN = event.get("JOB_DEFINITION_ARN")
    JOB_QUEUE_ARN = event.get("JOB_QUEUE_ARN")
    CONTAINER_NAME = os.environ.get("CONTAINER_NAME")

    if 'K6_SCRIPT_S3_URI' not in event:
        raise ValueError("Missing required parameter: K6_SCRIPT_S3_URI")

    # get the k6 script and parameters in S3
    K6_SCRIPT_S3_URI = event.get('K6_SCRIPT_S3_URI')

    # get k6 parameters from event or initialize empty string if empty
    K6_PARAMETERS = ""
    if 'K6_PARAMETERS' in event:
        K6_PARAMETERS = event.get('K6_PARAMETERS')

    # get secret name of the SAP system
    SECRET_NAME = event.get('SECRET_NAME') 
    

    batch = boto3.client(
    service_name='batch')
    try:
        response = batch.submit_job(
            jobName='sap-load-tests-k6-job',
            jobQueue=JOB_QUEUE_ARN,
            jobDefinition=JOB_DEFINITION_ARN,
            ecsPropertiesOverride={
                "taskProperties":[
                    {
                        "containers":[
                            {
                                "name": CONTAINER_NAME,
                                "environment": [
                                    {
                                        "name": "K6_SCRIPT_S3_URI",
                                        "value": K6_SCRIPT_S3_URI
                                    },
                                    {
                                        "name": "SECRET_NAME",
                                        "value": SECRET_NAME
                                    },
                                    {
                                        "name": "K6_PARAMETERS",
                                        "value": K6_PARAMETERS
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        )
        return {
        "batchJob": {
            "jobId": response["jobId"],
            "jobName": response["jobName"],
            "jobArn": response["jobArn"],
        }
    }
    except ClientError as e:
        print(e.response['Error']['Message'])
    # submit batch job and override ecsProperties to add a new environment variable
