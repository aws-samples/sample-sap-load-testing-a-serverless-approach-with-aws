import json
import boto3

def lambda_handler(event, context):
    INSTANCEIDS = event['instanceid']
    INSTANCEIDS = INSTANCEIDS.split(',')
    loadType = event['LoadTestType']
    task = event['task']
    
    ssmClient = boto3.client('ssm')
    ssmCommand = ssmClient.send_command(
    InstanceIds = INSTANCEIDS,
    DocumentName = 'AWS-RunShellScript',
    TimeoutSeconds = 90,
    Comment='Store Load Test Type',
    Parameters={
        'commands': [
            'echo  \"$(date +%s),' + loadType + ',' + task + '\" >> /tmp/load/loadType.log && aws s3 cp /tmp/load/loadType.log s3://metricstreams-sap-load-tests-sf/ '
            ]
        }
    )