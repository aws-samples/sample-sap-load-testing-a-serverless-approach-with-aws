import json
import boto3
import datetime

def lambda_handler(event, context):
    batch_job_id = event['JobId']

    batchClient = boto3.client('batch')
    # result = json.loads(json.dumps(ssmClient.list_command_invocations(CommandId=event['CommandId']), default=str))
    response = batchClient.describe_jobs(
    jobs=[
        batch_job_id,
    ])
    
    print(response)
    # exit(0)
    batch_job_status = response['jobs'][0]['status']
    batch_status_payload = ('{"JobStatus": "' + batch_job_status + '"}')
    return json.loads(batch_status_payload)