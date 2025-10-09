import json
import logging
import os
import boto3
import urllib3
import time
from typing import Dict, Any, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Dashboard deployment handler following the sample pattern
    """
    logger.info(f"Starting dashboard deployment from lambdas folder...")
    logger.info(f"Event: {json.dumps(event, default=str)}")
    
    # Get configuration from environment variables
    workspace_id = os.environ.get('WORKSPACE_ID')
    service_role_arn = os.environ.get('SERVICE_ROLE_ARN')
    region = os.environ.get('REGION')
    
    if not workspace_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'WORKSPACE_ID environment variable not set'})
        }
    
    try:
        # Get workspace URL
        grafana_client = boto3.client('grafana', region_name=region)
        workspace_info = grafana_client.describe_workspace(workspaceId=workspace_id)
        workspace_url = f"https://{workspace_info['workspace']['endpoint']}"
        workspace_status = workspace_info['workspace']['status']
        
        logger.info(f"Workspace URL: {workspace_url}")
        logger.info(f"Workspace Status: {workspace_status}")
        
        if workspace_status != 'ACTIVE':
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': f'Workspace is not active. Current status: {workspace_status}',
                    'workspace_id': workspace_id,
                    'workspace_url': workspace_url
                })
            }
        
        # Generate unique name for API key
        key_name = f"TempDashboardSetupKey_{get_uuid()}"
        
        # Create API Key
        grafana_api_key = create_grafana_api_key(
            workspace_id=workspace_id,
            key_name=key_name
        )
        
        if not grafana_api_key:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to create Grafana API key'})
            }
        
        try:
            # Try to get CloudWatch Data Source ID
            uid_data_source = get_grafana_data_source(
                workspace_url=workspace_url,
                client_key=grafana_api_key,
                datasource_name="CloudWatch"
            )
            
            # Create missing CloudWatch data source if it was not found
            if uid_data_source is None:
                uid_data_source = create_grafana_data_source(
                    workspace_url=workspace_url,
                    client_key=grafana_api_key,
                    region=region,
                    service_role_arn=service_role_arn,
                    datasource_name="CloudWatch"
                )
            
            if uid_data_source is None:
                raise Exception("Failed to create CloudWatch data source!")
            
            # Load dashboard JSON from the same directory
            dashboard_file_path = os.path.join(os.path.dirname(__file__), 'SAPLoadTestsDashboard.json')
            
            logger.info(f"Loading dashboard from: {dashboard_file_path}")
            
            with open(dashboard_file_path, 'r') as file:
                dashboard_data = json.load(file)
            
            # Replace Data Source ID in Dashboard JSON file with valid Data Source ID
            logger.info(f"Replacing data source ID references in dashboard...")
            dashboard_data = replace_datasource_id(
                json_data=dashboard_data,
                search_key="datasource",
                datasource_type="cloudwatch",
                datasource_id=uid_data_source
            )
            
            # Import Grafana Dashboard
            dashboard_uid = import_grafana_dashboard(
                workspace_url=workspace_url,
                client_key=grafana_api_key,
                dashboard_json=dashboard_data
            )
            
            # Delete API Key
            delete_grafana_api_key(
                workspace_id=workspace_id,
                key_name=key_name
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Dashboard deployed successfully',
                    'workspace_id': workspace_id,
                    'workspace_url': workspace_url,
                    'dashboard_uid': dashboard_uid,
                    'datasource_uid': uid_data_source,
                    'dashboard_url': f"{workspace_url}/d/{dashboard_uid}" if dashboard_uid else None
                })
            }
            
        except Exception as e:
            # Clean up API key on error
            try:
                delete_grafana_api_key(workspace_id=workspace_id, key_name=key_name)
            except:
                pass
            raise e
            
    except Exception as e:
        logger.error(f"Error deploying dashboard: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'workspace_id': workspace_id
            })
        }

def get_uuid():
    """Generate a simple UUID-like string"""
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def create_grafana_api_key(workspace_id: str, key_name: str) -> Optional[str]:
    """Create Grafana API key"""
    try:
        grafana_client = boto3.client('grafana')
        
        response = grafana_client.create_workspace_api_key(
            keyName=key_name,
            keyRole='ADMIN',
            secondsToLive=3600,  # 1 hour
            workspaceId=workspace_id
        )
        
        logger.info(f"Created API key: {key_name}")
        return response['key']
        
    except Exception as e:
        logger.error(f"Failed to create API key: {str(e)}")
        return None

def delete_grafana_api_key(workspace_id: str, key_name: str) -> None:
    """Delete Grafana API key"""
    try:
        grafana_client = boto3.client('grafana')
        
        grafana_client.delete_workspace_api_key(
            keyName=key_name,
            workspaceId=workspace_id
        )
        
        logger.info(f"Deleted API key: {key_name}")
        
    except Exception as e:
        logger.warning(f"Could not delete API key {key_name}: {str(e)}")

def get_grafana_data_source(workspace_url: str, client_key: str, datasource_name: str) -> Optional[str]:
    """Get existing data source UID by name"""
    try:
        http = urllib3.PoolManager()
        
        response = http.request(
            'GET',
            f"{workspace_url}/api/datasources",
            headers={
                'Authorization': f'Bearer {client_key}',
                'Content-Type': 'application/json'
            }
        )
        
        if response.status == 200:
            datasources = json.loads(response.data.decode('utf-8'))
            for ds in datasources:
                if ds.get('name') == datasource_name:
                    logger.info(f"Found existing data source '{datasource_name}' with UID: {ds.get('uid')}")
                    return ds.get('uid')
        
        logger.info(f"Data source '{datasource_name}' not found")
        return None
        
    except Exception as e:
        logger.error(f"Error getting data source: {str(e)}")
        return None

def create_grafana_data_source(workspace_url: str, client_key: str, region: str, service_role_arn: str, datasource_name: str) -> Optional[str]:
    """Create CloudWatch data source in Grafana"""
    
    datasource_config = {
        "name": datasource_name,
        "type": "cloudwatch",
        "access": "proxy",
        "isDefault": True,
        "jsonData": {
            "defaultRegion": region,
            "authType": "default",
            "assumeRoleArn": "",
            "externalId": ""
        }
    }
    
    try:
        http = urllib3.PoolManager()
        
        response = http.request(
            'POST',
            f"{workspace_url}/api/datasources",
            headers={
                'Authorization': f'Bearer {client_key}',
                'Content-Type': 'application/json'
            },
            body=json.dumps(datasource_config)
        )
        
        if response.status == 200:
            result = json.loads(response.data.decode('utf-8'))
            logger.info(f"Data source creation response: {result}")
            datasource_uid = result.get('uid') or result.get('datasource', {}).get('uid')
            logger.info(f"Created CloudWatch data source '{datasource_name}' with UID: {datasource_uid}")
            return datasource_uid
        else:
            logger.error(f"Failed to create data source. Status: {response.status}, Response: {response.data}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating CloudWatch data source: {str(e)}")
        return None

def replace_datasource_id(json_data, search_key: str, datasource_type: str, datasource_id: str):
    """Replace datasource references in JSON data"""
    if isinstance(json_data, dict):
        for key, value in json_data.items():
            if key == search_key and isinstance(value, dict):
                if value.get('type') == datasource_type:
                    value['uid'] = datasource_id
                    logger.info(f"Updated datasource reference to UID: {datasource_id}")
            elif isinstance(value, (dict, list)):
                replace_datasource_id(value, search_key, datasource_type, datasource_id)
    elif isinstance(json_data, list):
        for item in json_data:
            replace_datasource_id(item, search_key, datasource_type, datasource_id)
    
    return json_data

def import_grafana_dashboard(workspace_url: str, client_key: str, dashboard_json: Dict[str, Any]) -> Optional[str]:
    """Import dashboard to Grafana"""
    
    # Prepare dashboard for import
    dashboard_copy = dashboard_json.copy()
    dashboard_copy['id'] = None  # Let Grafana assign new ID
    dashboard_copy['uid'] = None  # Let Grafana assign new UID
    dashboard_copy['version'] = 1  # Reset version
    
    dashboard_payload = {
        "dashboard": dashboard_copy,
        "overwrite": True,
        "message": "Imported via Lambda automation"
    }
    
    try:
        http = urllib3.PoolManager()
        
        response = http.request(
            'POST',
            f"{workspace_url}/api/dashboards/db",
            headers={
                'Authorization': f'Bearer {client_key}',
                'Content-Type': 'application/json'
            },
            body=json.dumps(dashboard_payload)
        )
        
        if response.status == 200:
            result = json.loads(response.data.decode('utf-8'))
            logger.info(f"Dashboard import response: {result}")
            dashboard_uid = result.get('uid') or result.get('dashboard', {}).get('uid')
            logger.info(f"Imported dashboard with UID: {dashboard_uid}")
            return dashboard_uid
        else:
            logger.error(f"Failed to import dashboard. Status: {response.status}, Response: {response.data}")
            return None
            
    except Exception as e:
        logger.error(f"Error importing dashboard: {str(e)}")
        return None