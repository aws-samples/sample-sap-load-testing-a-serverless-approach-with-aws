import boto3
import json
import os
from datetime import *
import time
from botocore.exceptions import ClientError
from typing import List, Dict, Any
from collections import defaultdict

class MetricCollector:
    def __init__(self, test_run_id: str, test_type: str, SID: str,  instance_ids: List[str] = None ):
        """
        Initialize with optional fixed values and instance IDs
        """
        self.cloudwatch = boto3.client('cloudwatch')
        self.ec2 = boto3.client('ec2')
        self.test_run_id = test_run_id
        self.test_type = test_type
        self.SID = SID
        self.instance_ids = instance_ids or []
        self.instance_types = self._get_instance_types(instance_ids) if instance_ids else {}
        
    def _get_instance_types(self, instance_ids: List[str]) -> Dict[str, str]:
        """
        Get instance types for the provided instance IDs
        """
        try:
            response = self.ec2.describe_instances(
                InstanceIds=instance_ids
            )
            
            instance_types = {}
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    instance_types[instance['InstanceId']] = instance['InstanceType']
                    
            print(f"Retrieved instance types: {instance_types}")
            return instance_types
            
        except ClientError as e:
            print(f"Error fetching instance types: {str(e)}")
            return {}

    def get_metric_data(self, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
        """
        Collect metrics for the specified time range
        """
        try:
            records = []
            
            for instance_id in self.instance_ids:
                # Get metrics for this instance
                metric_queries = self._build_metric_queries(instance_id)
                
                response = self.cloudwatch.get_metric_data(
                    MetricDataQueries=metric_queries,
                    StartTime=start_time,
                    EndTime=end_time
                )
                
                # Process metrics for this instance
                instance_records = self._process_instance_metrics(instance_id, response)
                records.extend(instance_records)
            
            return {
                'records': records,
                'metric_names': ['dia', 'db', 'rfc', 'ping', 'dumps', 'cpu', 'free_mem_perc', 'k6_vus'],
                'fixed_columns':  ['test_run_id', 'test_type', 'SID', 'instance_id', 'instance_type']
            }
            
        except ClientError as e:
            print(f"Error fetching metrics: {str(e)}")
            raise

    def _build_metric_queries(self, instance_id: str) -> List[Dict[str, Any]]:
        """
        Build metric queries for a specific instance
        """
        return [
            {
                'Id': 'dia',
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'sap-monitor',
                        'MetricName': 'ST03_DIA_AVG_SNAP',
                        'Dimensions': [
                            {
                                'Name': 'bySID',
                                'Value': self.SID,
                            }
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Maximum'
                }
            },
            {
                'Id': 'db',
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'sap-monitor',
                        'MetricName': 'ST03_DIA_AVGDB_SNAP',
                        'Dimensions': [
                            {
                                'Name': 'bySID',
                                'Value': self.SID,
                            }
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Maximum'
                }
            },
            {
                'Id': 'rfc',
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'sap-monitor',
                        'MetricName': 'ST03_RFC_AVG_SNAP',
                        'Dimensions': [
                            {
                                'Name': 'bySID',
                                'Value': self.SID,
                            }
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Maximum'
                }
            },
            {
                'Id': 'ping',
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'sap-monitor',
                        'MetricName': 'PING',
                        'Dimensions': [
                            {
                                'Name': 'bySID',
                                'Value': self.SID,
                            }
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Maximum'
                }
            },
            {
                'Id': 'dumps',
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'sap-monitor',
                        'MetricName': 'ST22_DUMPS',
                        'Dimensions': [
                            {
                                'Name': 'bySID',
                                'Value': self.SID,
                            }
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Maximum'
                }
            },
            {
                'Id': 'cpu',
                'MetricStat': {
                    'Metric': {
                        'Namespace': 'AWS/EC2',
                        'MetricName': 'CPUUtilization',
                        'Dimensions': [
                            {
                                'Name': 'InstanceId',
                                'Value': instance_id
                            }
                        ]
                    },
                    'Period': 300,
                    'Stat': 'Maximum'
                }
            },
            {
                'Id': 'free_mem_perc',
                'Expression': "SEARCH('{CWAgent,ImageId,InstanceId,InstanceType} MetricName=\"mem_used_percent\" AND (InstanceId=\"" + instance_id + "\") ', 'Maximum', 300)"
            },
            {
                'Id': 'k6_vus',
                'Expression': "SEARCH('Namespace=\"K6\" MetricName=\"k6_vus_max\"', 'Maximum', 300)"
            },
        ]

    def _process_instance_metrics(self, instance_id: str, response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Process metrics for a single instance, creating one record per timestamp
        """
        records = []
        metric_values = defaultdict(dict)
        timestamps = set()
        
        # Collect all timestamps and values
        for result in response['MetricDataResults']:
            metric_id = result['Id']  
            for timestamp, value in zip(result['Timestamps'], result['Values']):
                ts_key = timestamp.isoformat()
                ts_key = ts_key.split('+')[0]
                timestamps.add(ts_key)
                metric_values[ts_key][metric_id] = value
        
        # Create a record for each timestamp
        for ts in sorted(timestamps):
            record = {
                'timestamp': ts,
                'test_run_id': self.test_run_id,
                'test_type': self.test_type,
                'SID': self.SID,
                'instance_id': instance_id,
                'instance_type': self.instance_types.get(instance_id),
                'dia': metric_values[ts].get('dia'),
                'db': metric_values[ts].get('db'),
                'rfc': metric_values[ts].get('rfc'),
                'ping': metric_values[ts].get('ping'),
                'dumps': metric_values[ts].get('dumps'),
                'cpu': metric_values[ts].get('cpu'),
                'free_mem_perc': metric_values[ts].get('free_mem_perc'),
                'k6_vus': metric_values[ts].get('k6_vus')
            }
            records.append(record)
            
        return records
        

def lambda_handler(event, context):
    try:
        # Parse start and end times from the event
        start_time = datetime.fromisoformat(event['start_time'])
        end_time = datetime.fromisoformat(event['end_time'])
        
        # Extract fixed values and instance IDs from event
        
        sm = boto3.client('secretsmanager')
        response = sm.get_secret_value(
        SecretId = event["sap_sm_secret"]
        )
        sm_read = json.loads(response['SecretString'])

        test_run_id = event['test_run_id']
        test_type = event['LoadTestType']
        SID = sm_read.get('sapSID')
        instance_ids = sm_read.get('sapInstanceIds', [])
        if isinstance(instance_ids, str):
            instance_ids = [id.strip() for id in instance_ids.split(',')]

        
        # Initialize collector and gather metrics
        collector = MetricCollector(
            test_run_id=test_run_id,
            test_type=test_type,
            SID=SID,
            instance_ids=instance_ids
        )
        metrics_data = collector.get_metric_data(start_time, end_time)
        
        # Prepare response
        response = {
            'metadata': {
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'metric_names': metrics_data['metric_names'],
                'fixed_columns': metrics_data['fixed_columns'],
                'instance_ids': instance_ids,
                'SID': SID,
                'test_run_id': test_run_id
            },
            'records': metrics_data['records']
        }
        
        # Store results in S3
        if os.environ.get('METRICS_BUCKET_NAME'):
            s3 = boto3.client('s3')
            
            # Store consolidated JSON
            # json_key = f"metrics/json/{datetime.now().strftime('%Y/%m/%d')}/{context.aws_request_id}.json"
            # s3.put_object(
            #     Bucket=os.environ['METRICS_BUCKET_NAME'],
            #     Key=json_key,
            #     Body=json.dumps(response, indent=2),
            #     ContentType='application/json'
            # )
            
            # Store as CSV for easy analysis
            csv_data = _convert_to_csv(
                metrics_data['records'], 
                metrics_data['metric_names'],
                metrics_data['fixed_columns']
            )
            csv_key = f"metrics/csv/{datetime.now().strftime('%Y/%m/%d')}/{context.aws_request_id}.csv"
            s3.put_object(
                Bucket=os.environ['METRICS_BUCKET_NAME'],
                Key=csv_key,
                Body=csv_data,
                ContentType='text/csv'
            )
            
            # Add Athena partition
            add_athena_partitions(
                database_name=os.environ['DB'],
                table_name=os.environ['TABLE'],
                s3_bucket=os.environ['METRICS_BUCKET_NAME']
            )
            
            response['storage_location'] = {
                #'json': f"s3://{os.environ['METRICS_BUCKET_NAME']}/{json_key}",
                'csv': f"s3://{os.environ['METRICS_BUCKET_NAME']}/{csv_key}"
            }
        
        return {
            'statusCode': 200,
            'body': response
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': {
                'error': str(e)
            }
        }

def _convert_to_csv(records: List[Dict], metric_names: List[str], fixed_columns: List[str]) -> str:
    """
    Convert metrics records to CSV format
    """
    # Create CSV header
    header = ['timestamp'] + fixed_columns + metric_names
    csv_lines = [','.join(header)]
    
    # Add data rows
    for record in records:
        row = [
            str(record.get(col, '')) for col in header
        ]
        csv_lines.append(','.join(row))
    
    return '\n'.join(csv_lines)

def add_athena_partitions(database_name: str, table_name: str, s3_bucket: str):
    """
    Add partitions to Athena table for the metrics data
    """
    try:
        athena_client = boto3.client('athena')
        
        # Get the current date for reference
        current_date = datetime.now()
        
        # Create partition query
        partition_query = f"""
        ALTER TABLE {database_name}.{table_name} ADD IF NOT EXISTS
        PARTITION (
            year = '{current_date.strftime('%Y')}',
            month = '{current_date.strftime('%m')}',
            day = '{current_date.strftime('%d')}'
        )
        LOCATION 's3://{s3_bucket}/metrics/csv/{current_date.strftime('%Y/%m/%d')}'
        """
        
        # Execute the query
        response = athena_client.start_query_execution(
            QueryString=partition_query,
            QueryExecutionContext={
                'Database': database_name
            },
            ResultConfiguration={
                'OutputLocation': f's3://{s3_bucket}/metrics/athena_results/'
            }
        )
        
        # Wait for query to complete
        query_execution_id = response['QueryExecutionId']
        while True:
            query_status = athena_client.get_query_execution(
                QueryExecutionId=query_execution_id
            )['QueryExecution']['Status']['State']
            
            if query_status in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
                break
                
            time.sleep(1)
            
        if query_status == 'SUCCEEDED':
            print(f"Successfully added partition for {current_date.strftime('%Y-%m-%d')}")
        else:
            print(f"Failed to add partition. Status: {query_status}")
            
    except Exception as e:
        print(f"Error adding Athena partition: {str(e)}")

