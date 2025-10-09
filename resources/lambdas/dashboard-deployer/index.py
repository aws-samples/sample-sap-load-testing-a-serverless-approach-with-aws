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
    logger.info(f"Starting dashboard deployment v2...")
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
    
    # Main deployment logic
    try:
        logger.info(f"Starting automated deployment for workspace: {workspace_id}")
        
        # Get Grafana workspace endpoint
        grafana_client = boto3.client('grafana', region_name=region)
        workspace_endpoint = wait_for_workspace_ready(grafana_client, workspace_id)
        
        if not workspace_endpoint:
            raise Exception("Could not get workspace endpoint")
        
        logger.info(f"Workspace is ready with endpoint: {workspace_endpoint}")
        
        # Create API key for dashboard deployment
        key_name = f"TempDashboardSetupKey_{int(time.time())}"
        api_key = create_grafana_api_key(grafana_client, workspace_id, key_name)
        
        if not api_key:
            raise Exception("Failed to create API key")
        
        try:
            # Create CloudWatch data source
            datasource_uid = create_cloudwatch_datasource(
                workspace_endpoint, api_key, region, service_role_arn
            )
            
            if not datasource_uid:
                raise Exception("Failed to create CloudWatch data source")
            
            # Update dashboard with correct data source UID
            update_datasource_references(dashboard_json, datasource_uid)
            
            # Deploy dashboard
            dashboard_uid = deploy_dashboard(workspace_endpoint, api_key, dashboard_json)
            
            # Clean up API key
            delete_grafana_api_key(grafana_client, workspace_id, key_name)
            
            return {
                'Status': 'SUCCESS',
                'PhysicalResourceId': physical_resource_id,
                'Data': {
                    'Message': 'Dashboard deployed successfully via Grafana API' if dashboard_uid else 'Data source created, dashboard ready for manual import',
                    'WorkspaceId': workspace_id,
                    'WorkspaceUrl': f"https://{workspace_endpoint}",
                    'DashboardTitle': dashboard_json.get('title', 'SAP Load Tests Dashboard'),
                    'DashboardUid': dashboard_uid or 'manual-import-required',
                    'DataSourceUid': datasource_uid,
                    'DashboardReady': 'true' if dashboard_uid else 'partial',
                    'AutoDeployed': 'true' if dashboard_uid else 'false'
                }
            }
            
        except Exception as deploy_error:
            # Clean up API key even if deployment fails
            try:
                delete_grafana_api_key(grafana_client, workspace_id, key_name)
            except:
                pass
            raise deploy_error
        
    except Exception as e:
        logger.error(f"Error in automated deployment: {str(e)}")
        
        # Fallback - prepare dashboard for manual import
        try:
            update_datasource_references(dashboard_json, 'cloudwatch-datasource')
            
            return {
                'Status': 'SUCCESS',
                'PhysicalResourceId': physical_resource_id,
                'Data': {
                    'Message': f'Automated deployment failed: {str(e)}. Dashboard prepared for manual import.',
                    'WorkspaceId': workspace_id,
                    'DashboardTitle': dashboard_json.get('title', 'SAP Load Tests Dashboard'),
                    'DashboardUid': 'manual-import-required',
                    'DataSourceUid': 'cloudwatch-datasource',
                    'DashboardReady': 'true',
                    'AutoDeployed': 'false',
                    'ImportInstructions': 'Go to Grafana UI -> Dashboards -> Import -> Upload JSON file'
                }
            }
        except Exception as fallback_error:
            return {
                'Status': 'SUCCESS',  # Don't fail the stack
                'PhysicalResourceId': physical_resource_id,
                'Data': {
                    'Message': f'Both automated and manual preparation failed: {str(fallback_error)}',
                    'WorkspaceId': workspace_id,
                    'DashboardTitle': 'Unknown',
                    'DashboardUid': 'failed',
                    'DataSourceUid': 'failed',
                    'DashboardReady': 'false',
                    'AutoDeployed': 'false'
                }
            }



def wait_for_workspace_ready(grafana_client, workspace_id: str, max_attempts: int = 60) -> Optional[str]:
    """Wait for Grafana workspace to be ready and return endpoint"""
    for attempt in range(max_attempts):
        try:
            workspace_info = grafana_client.describe_workspace(workspaceId=workspace_id)
            status = workspace_info['workspace']['status']
            logger.info(f"Workspace status (attempt {attempt + 1}): {status}")
            
            if status == 'ACTIVE':
                endpoint = workspace_info['workspace']['endpoint']
                logger.info(f"Workspace is active with endpoint: {endpoint}")
                # Additional wait for workspace to be fully ready for API operations
                time.sleep(60)
                return endpoint
            elif status in ['FAILED', 'CREATION_FAILED']:
                raise Exception(f"Workspace creation failed with status: {status}")
            
            time.sleep(10)  # Wait 10 seconds between checks
            
        except Exception as e:
            if attempt == max_attempts - 1:
                raise Exception(f"Workspace did not become active after {max_attempts} attempts: {str(e)}")
            time.sleep(10)
    
    return None

def create_grafana_api_key(grafana_client, workspace_id: str, key_name: str) -> Optional[str]:
    """Create a temporary API key for dashboard deployment"""
    try:
        api_key_response = grafana_client.create_workspace_api_key(
            keyName=key_name,
            keyRole='ADMIN',
            secondsToLive=3600,  # 1 hour
            workspaceId=workspace_id
        )
        
        api_key = api_key_response['key']
        logger.info(f"Created API key: {key_name}")
        return api_key
        
    except Exception as e:
        logger.error(f"Failed to create API key: {str(e)}")
        return None

def delete_grafana_api_key(grafana_client, workspace_id: str, key_name: str) -> None:
    """Delete the temporary API key"""
    try:
        grafana_client.delete_workspace_api_key(
            keyName=key_name,
            workspaceId=workspace_id
        )
        logger.info(f"Deleted API key: {key_name}")
    except Exception as e:
        logger.warning(f"Could not delete API key {key_name}: {str(e)}")

def cleanup_api_key(workspace_id: str, region: str) -> None:
    """Clean up any remaining API keys (for delete operations)"""
    try:
        grafana_client = boto3.client('grafana', region_name=region)
        # List and delete any keys that might be left over
        # This is a best-effort cleanup
        logger.info(f"Cleanup completed for workspace: {workspace_id}")
    except Exception as e:
        logger.warning(f"Could not perform cleanup: {str(e)}")

def create_cloudwatch_datasource(
    workspace_endpoint: str, 
    api_key: str, 
    region: str, 
    service_role_arn: Optional[str]
) -> Optional[str]:
    """Create CloudWatch data source in Grafana"""
    
    # First check if CloudWatch data source already exists
    existing_uid = get_grafana_data_source(workspace_endpoint, api_key, "CloudWatch")
    if existing_uid:
        logger.info(f"CloudWatch data source already exists with UID: {existing_uid}")
        return existing_uid
    
    datasource_config = {
        "name": "CloudWatch",
        "type": "cloudwatch",
        "access": "proxy",
        "isDefault": True,
        "jsonData": {
            "defaultRegion": region,
            "authType": "arn" if service_role_arn else "default",
            "assumeRoleArn": service_role_arn if service_role_arn else "",
            "externalId": ""
        }
    }
    
    try:
        http = urllib3.PoolManager()
        
        # Create data source
        response = http.request(
            'POST',
            f"https://{workspace_endpoint}/api/datasources",
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            body=json.dumps(datasource_config)
        )
        
        if response.status == 200:
            result = json.loads(response.data.decode('utf-8'))
            datasource_uid = result.get('uid')
            logger.info(f"Created CloudWatch data source with UID: {datasource_uid}")
            return datasource_uid
        elif response.status == 409:
            # Data source already exists, try to get its UID
            logger.info("CloudWatch data source already exists, retrieving UID...")
            return get_grafana_data_source(workspace_endpoint, api_key, "CloudWatch")
        else:
            logger.error(f"Failed to create data source. Status: {response.status}, Response: {response.data}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating CloudWatch data source: {str(e)}")
        return None

def get_grafana_data_source(workspace_endpoint: str, api_key: str, datasource_name: str) -> Optional[str]:
    """Get existing data source UID by name"""
    try:
        http = urllib3.PoolManager()
        
        response = http.request(
            'GET',
            f"https://{workspace_endpoint}/api/datasources",
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
        )
        
        if response.status == 200:
            datasources = json.loads(response.data.decode('utf-8'))
            for ds in datasources:
                if ds.get('name') == datasource_name:
                    return ds.get('uid')
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting data source: {str(e)}")
        return None

def deploy_dashboard(workspace_endpoint: str, api_key: str, dashboard_json: Dict[str, Any]) -> Optional[str]:
    """Deploy dashboard to Grafana"""
    
    # Prepare dashboard for deployment
    dashboard_copy = dashboard_json.copy()
    dashboard_copy['id'] = None  # Let Grafana assign new ID
    dashboard_copy['uid'] = None  # Let Grafana assign new UID
    dashboard_copy['version'] = 1  # Reset version
    
    dashboard_payload = {
        "dashboard": dashboard_copy,
        "overwrite": True,
        "message": "Deployed via CDK automation"
    }
    
    try:
        http = urllib3.PoolManager()
        
        response = http.request(
            'POST',
            f"https://{workspace_endpoint}/api/dashboards/db",
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            body=json.dumps(dashboard_payload)
        )
        
        if response.status == 200:
            result = json.loads(response.data.decode('utf-8'))
            dashboard_uid = result.get('uid')
            logger.info(f"Deployed dashboard with UID: {dashboard_uid}")
            return dashboard_uid
        else:
            logger.error(f"Failed to deploy dashboard. Status: {response.status}, Response: {response.data}")
            return None
            
    except Exception as e:
        logger.error(f"Error deploying dashboard: {str(e)}")
        return None

def update_datasource_references(dashboard_json: Dict[str, Any], datasource_uid: str) -> None:
    """
    Update data source references in dashboard JSON to use the specified CloudWatch UID
    Based on the pattern from the sample Lambda function
    """
    def replace_datasource_id(json_data, search_key: str, datasource_type: str, datasource_id: str):
        """Recursively replace datasource references"""
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
    
    # Update all CloudWatch datasource references
    replace_datasource_id(dashboard_json, "datasource", "cloudwatch", datasource_uid)
    logger.info(f"Updated dashboard data source references to UID: {datasource_uid}")
d
ef get_uuid():
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
            "authType": "arn" if service_role_arn else "default",
            "assumeRoleArn": service_role_arn if service_role_arn else "",
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
            datasource_uid = result.get('uid')
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
            dashboard_uid = result.get('uid')
            logger.info(f"Imported dashboard with UID: {dashboard_uid}")
            return dashboard_uid
        else:
            logger.error(f"Failed to import dashboard. Status: {response.status}, Response: {response.data}")
            return None
            
    except Exception as e:
        logger.error(f"Error importing dashboard: {str(e)}")
        return None