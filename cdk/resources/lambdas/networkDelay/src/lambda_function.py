import json
import os
import time
import boto3 

def lambda_handler(event, context):
   
    # Get secrets and parameters from Secrets Manager
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(
        SecretId = os.environ['SM_SECRET_ND']
    )

    sm_read = json.loads(response['SecretString'])
    INSTANCEIDS = sm_read['instanceids']
    INSTANCEIDS = INSTANCEIDS.split(',')
    
    # Determine if we are in called in client or server mode
    if(event['role'] == "start"):
        # Start network delay
        ssmClient = boto3.client('ssm')
        ssmCommand = ssmClient.send_command(
        InstanceIds = INSTANCEIDS,
        DocumentName = 'AWS-RunShellScript',
        TimeoutSeconds = 90,
        Comment='Start network delay on primary interface',
        Parameters={
            'commands': [
               'sudo tc qdisc add dev eth0 root netem delay 200ms'
                ]
            }
        )

        ssmCommandID = ssmCommand['Command']['CommandId']
        ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
        return json.loads(ssm_payload)

    elif(event['role'] == "stop"):
        # Reset network back to normal
        ssmClient = boto3.client('ssm')
        ssmCommand = ssmClient.send_command(
        InstanceIds = INSTANCEIDS,
        DocumentName = 'AWS-RunShellScript',
        TimeoutSeconds = 90,
        Comment='Stop and reset network delay',
        Parameters={
            'commands': [
                'tc qdisc del dev eth0 root netem'
                ]
            }
        )
    
        ssmCommandID = ssmCommand['Command']['CommandId']
        ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
        return json.loads(ssm_payload)
   


