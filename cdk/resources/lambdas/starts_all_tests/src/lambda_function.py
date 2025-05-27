import json
import boto3
import time

def validate_input_parameters(event):
    # First check if LoadTestType exists and is valid
    if 'LoadTestType' not in event:
        raise ValueError("Missing required parameter: LoadTestType")
    
    if 'sap_sm_secret' not in event:
        raise ValueError("Missing required parameter: sap_sm_secret")
        
    valid_test_types = ['infra', 'db', 'sap', 'network']
    lt_type = event.get('LoadTestType')
    if lt_type not in valid_test_types:
        raise ValueError(f"LoadTestType must be one of {valid_test_types}")

    # Define required parameters for each test type
    required_params = {
        'infra': {
            'duration': {'type': str, 'numeric': True, 'min': 0},
            'cpu_load': {'type': str, 'numeric': True, 'min': 0, 'max': 100},
            'mem_load': {'type': str, 'numeric': True, 'min': 0, 'max': 100},
            'jobs': {'type': str, 'numeric': True, 'min': 0, 'max': 100}
        },
        'db': {
            'sap_sm_secret': {'type': str, 'non_empty': True},
            'iterations' : {'type': str, 'non_empty': True}
        },
        'sap': {
            'k6loadcmd': {'type': str, 'non_empty': True},
            'sap_sm_secret': {'type': str, 'non_empty': True}
        },
        'network': {
            'delayms': {'type': str, 'numeric': True, 'min': 0},
            'action': {'type': str, 'non_empty': True}
        }
    }

    # Get the required parameters for the specified test type
    test_params = required_params[lt_type]
    
    missing_params = []
    invalid_params = []
    
    # Validate parameters based on test type
    for param, validations in test_params.items():
        # Check if parameter exists
        if param not in event:
            missing_params.append(param)
            continue
            
        param_value = event[param]
        
        # Check parameter type
        if not isinstance(param_value, validations['type']):
            invalid_params.append(f"{param} must be of type {validations['type'].__name__}")
            continue
            
        # Check for non-empty strings
        if validations.get('non_empty') and isinstance(param_value, str):
            if not param_value.strip():
                invalid_params.append(f"{param} cannot be empty")
                
        # Validate numeric values
        if validations.get('numeric'):
            if not param_value.isdigit():
                invalid_params.append(f"{param} must be a numeric value")
            else:
                num_value = int(param_value)
                if 'min' in validations and num_value < validations['min']:
                    invalid_params.append(f"{param} must be greater than or equal to {validations['min']}")
                if 'max' in validations and num_value > validations['max']:
                    invalid_params.append(f"{param} must be less than or equal to {validations['max']}")

    if missing_params or invalid_params:
        error_message = []
        if missing_params:
            error_message.append(f"Missing required parameters for {lt_type} test: {', '.join(missing_params)}")
        if invalid_params:
            error_message.append(f"Invalid parameters: {', '.join(invalid_params)}")
        raise ValueError('\n'.join(error_message))

def lambda_handler(event, context):
    print("-----------------------event-----------------------")
    print(event)
    print("-----------------------/event-----------------------")
    try:
        # Validate input parameters
        validate_input_parameters(event)
        
        # Get parameters from Secrets Manager
        smClient = boto3.client('secretsmanager')
        response = smClient.get_secret_value(
            SecretId = event["sap_sm_secret"]
        )
        sm_read = json.loads(response['SecretString'])

        # General parameters 
        lt_type = event['LoadTestType']

        if event['LoadTestType'] == 'infra':
            # Infrastructure parameters
            lt_duration = event['duration']
            lt_cpu_load = event['cpu_load']
            lt_mem_load = event['mem_load']
            lt_jobs = event['jobs']
            lt_db_instanceid = sm_read['dbInstanceId']
            lt_sap_instanceids = sm_read['sapInstanceIds']
            lt_sap_instanceids = lt_sap_instanceids.split(',')
            lt_sap_instanceids.extend([lt_db_instanceid])
        elif event['LoadTestType'] == 'db':
            # Database parameters
            lt_db_user = sm_read['dbUser']
            lt_db_password = sm_read['dbPassword']
            lt_iterations = event['iterations']
            lt_db_instanceid = sm_read['dbInstanceId']
        elif event['LoadTestType'] == 'sap':
            # SAP parameters
            lt_sap_user = sm_read['sapUser']
            lt_sap_pwd = sm_read['sapPassword']
            lt_k6_instanceid = sm_read['k6InstanceId']
            lt_k6url = sm_read['k6BaseUrl']
            lt_loadcmd = event['k6loadcmd']
            lt_k6_scenario = sm_read['k6Scenario']        
        else:
            # Network parameters
            lt_delayms = event['delayms']
            lt_sap_instanceids = sm_read['sapInstanceIds']
            lt_sap_instanceids = lt_sap_instanceids.split(',')

        match lt_type:
            case "infra":
                ssmClient = boto3.client('ssm')
                ssmCommand = ssmClient.send_command(
                InstanceIds = lt_sap_instanceids,
                DocumentName='AWS-RunShellScript',
                TimeoutSeconds=90,
                Comment='SAP Load Tests: CPU, Memory and I/O load',
                Parameters={
                    'commands': [
                        'stress-ng --cpu 0 --cpu-method matrixprod -t ' + lt_duration + 'm --cpu-load ' + lt_cpu_load + ' --vm 1 --vm-bytes ' + lt_mem_load + '% --vm-method all --verify --temp-path=/tmp & \n'
                        'if [ -d /hana ]; \n'
                        '   then \n'
                        '       echo "Detected HANA Database filesystem, running I/O tests"; \n'
                        '       sudo fio --name=fio-load --size=20GB --directory=/hana/data/ --direct=1 --rw=randrw --bs=4k --ioengine=libaio --iodepth=64 --runtime=' + lt_duration + ' --numjobs=' + lt_jobs + ' --output-format=json \n'
                        '       rm /hana/data/fio-load.* \n'
                        '   else \n'
                        '       echo "Detected SAP Application Server, skipping I/O tests"; \n'
                        'fi \n'
                        ],
                        "executionTimeout":["172800"]
                    }
                )
                
                ssmCommandID = ssmCommand['Command']['CommandId']
                ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
                return json.loads(ssm_payload)
            
            case "db":
                ssmClient = boto3.client('ssm')
                ssmCommand = ssmClient.send_command(
                InstanceIds = [lt_db_instanceid],
                DocumentName = 'AWS-RunShellScript',
                TimeoutSeconds = 90,
                Comment='SAP Load Tests: HANA load',
                Parameters={
                    'commands': [
                        'sudo su - hdbadm -c \'cd /usr/sap/HDB/home/hanadbdataload && node index.js --user ' + lt_db_user + ' --pw ' + lt_db_password + ' --it ' + lt_iterations + ' --host localhost --port 30015 --db HDB --tablePrefix GEN --schema SAPLOAD\''
                        ],
                        "executionTimeout":["172800"]
                    }
                )
                
                ssmCommandID = ssmCommand['Command']['CommandId']
                ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
                return json.loads(ssm_payload)
            
            case "sap":
                ssmClient = boto3.client('ssm')
                ssmCommand = ssmClient.send_command(
                InstanceIds = [lt_k6_instanceid],
                DocumentName = 'AWS-RunShellScript',
                TimeoutSeconds = 90,
                Comment='Start SAP Load Tests: SAP Application load',
                Parameters={
                    'commands': [
                        'sed "s,urlchange,' + lt_k6url + ',g" /opt/aws/k6/post-idocs-k6.k6 > /opt/aws/k6/post-idocs-k6.tmp\n'
                        'sed -i "s/usrchange/' + lt_sap_user + '/g" /opt/aws/k6/post-idocs-k6.tmp\n'
                        'sed -i "s/pwdchange/' + lt_sap_pwd + '/g" /opt/aws/k6/post-idocs-k6.tmp \n'
                        'sed -i "s/scenchange/' + lt_k6_scenario + '/g" /opt/aws/k6/post-idocs-k6.tmp \n'
                        'sudo K6_STATSD_ENABLE_TAGS=true /opt/aws/k6/k6 run  -u 0 ' + lt_loadcmd + ' --insecure-skip-tls-verify --no-vu-connection-reuse --out output-statsd /opt/aws/k6/post-idocs-k6.tmp\n'
                        'rm /opt/aws/k6/post-idocs-k6.tmp'
                        ],
                        "executionTimeout":["172800"]
                    }
                )
                
                ssmCommandID = ssmCommand['Command']['CommandId']
                ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
                return json.loads(ssm_payload)
            
            case "network":
                    # Determine if we are in called in client or server mode
                    if(event['action'] == "start"):
                        # Start network delay
                        ssmClient = boto3.client('ssm')
                        ssmCommand = ssmClient.send_command(
                        InstanceIds = lt_sap_instanceids,
                        DocumentName = 'AWS-RunShellScript',
                        TimeoutSeconds = 90,
                        Comment='SAP Load Tests: network delay simulation start',
                        Parameters={
                            'commands': [
                            'sudo tc qdisc add dev eth0 root netem delay ' + lt_delayms +'ms'
                                ]
                            }
                        )

                        ssmCommandID = ssmCommand['Command']['CommandId']
                        ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
                        return json.loads(ssm_payload)

                    elif(event['action'] == "stop"):
                        # Reset network back to normal
                        ssmClient = boto3.client('ssm')
                        ssmCommand = ssmClient.send_command(
                        InstanceIds = lt_sap_instanceids,
                        DocumentName = 'AWS-RunShellScript',
                        TimeoutSeconds = 90,
                        Comment='SAP Load Tests: network delay simulation stop',
                        Parameters={
                            'commands': [
                                'tc qdisc del dev eth0 root netem'
                                ]
                            }
                        )
                    
                        ssmCommandID = ssmCommand['Command']['CommandId']
                        ssm_payload = ('{"CommandId": "' + ssmCommandID + '"}')
                        return json.loads(ssm_payload)

    except ValueError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Validation Error',
                'message': str(e)
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal Error',
                'message': str(e)
            })
        }
   


