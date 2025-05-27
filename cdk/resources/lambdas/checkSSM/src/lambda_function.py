import json
import boto3
import datetime

def lambda_handler(event, context):
    print(event)
    ssm_job_status = event['Payload']['CommandId']
    if(ssm_job_status == "0"):
        print('SSM command already completed, exiting loop')
        ssm_payload = ('{"CommandId": "' + event['Payload']['CommandId'] + '"}')
        return json.loads(ssm_payload)
    else:
        ssmClient = boto3.client('ssm')
        result = json.loads(json.dumps(ssmClient.list_command_invocations(CommandId=event['Payload']['CommandId']), default=str))
        print(result)
        ssm_job_status = result['CommandInvocations'][0]['Status']
        ssm_job_id = event['Payload']['CommandId']
        # doc: https://docs.aws.amazon.com/systems-manager/latest/userguide/monitor-commands.html
        failing_statuses = ['Failed', 
                            'Cancelled', 
                            'TimedOut',
                            'DeliveryTimedOut',
                            'ExecutionTimedOut',
                            'Undeliverable',
                            'Terminated',
                            'InvalidPlatform',
                            'AccessDenied']
        
        in_progress_statuses = ['InProgress',
                                'Pending',
                                'Delayed']


        if(ssm_job_status in failing_statuses):
            test_status = "FAILED"
            print(f'SSM command failed with status {ssm_job_status}')
        elif (ssm_job_status in in_progress_statuses):
            test_status = "RUNNING"
            print(f'SSM command still running... with status {ssm_job_status}')
        elif (ssm_job_status == 'Success'):
            test_status = "SUCCEEDED"
            print(f'SSM command completed with status {ssm_job_status}')
        else:
            test_status = "FAILED"
            print(f'SSM command failed with status {ssm_job_status}')

        # if(ssm_job_status == 'InProgress'):
        #     test_status = "RUNNING"
        #     print('SSM command still running...')
        # elif (ssm_job_status == 'Success'):
        #     print('SSM command completed')
        #     ssm_job_id = "0"
        # elif (ssm_job_status == 'Failed'):
        #     print('SSM command FAILED')
        #     ssm_job_id = "0"
        # elif (ssm_job_status == 'Cancelled'):
        #     print('SSM command was cancelled')
        #     ssm_job_id = "0"
        # elif (ssm_job_status == 'TimedOut'):
        #     print('SSM command ended in timeout')
        #     ssm_job_id = "0"            

        ssm_payload = ('{"CommandId": "' + ssm_job_id + '","JobStatus": "' + test_status + '"}')
        return json.loads(ssm_payload)