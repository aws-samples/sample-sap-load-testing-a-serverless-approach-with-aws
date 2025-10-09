# Automated CloudWatch Data Source and Dashboard Deployment

## 🚀 **Fully Automated Deployment Implemented**

The Grafana stack now includes **complete automation** for CloudWatch data source creation and dashboard deployment during CDK deployment.

## ✅ **What Happens Automatically**

### **1. Grafana Workspace Creation**
- Amazon Managed Grafana workspace deployed with CloudWatch and Athena data sources
- Comprehensive IAM permissions for CloudWatch, Logs, EC2, and Athena access
- Service role configured for secure AWS service access

### **2. Workspace Readiness Check**
- Automatic monitoring of workspace status until ACTIVE
- Built-in retry logic with timeout protection
- Proper error handling for failed workspace creation

### **3. API Key Management**
- Temporary admin API key created via AWS Grafana API
- Secure storage in AWS Secrets Manager
- Automatic cleanup during stack deletion
- 1-hour expiration for security

### **4. CloudWatch Data Source Creation**
- Automatic CloudWatch data source creation via Grafana API
- Proper configuration with service role ARN
- Set as default data source
- Regional configuration matching deployment region

### **5. Dashboard Deployment**
- Dashboard JSON automatically updated with correct CloudWatch data source UID
- Deployed via Grafana API with overwrite capability
- Metadata reset (ID, UID, version) for clean deployment
- Deployment status tracking and reporting

### **6. Fallback Mechanism**
- If automated deployment fails, falls back to manual preparation
- Dashboard still prepared with generic data source references
- Clear status reporting for troubleshooting
- Stack deployment never fails due to dashboard issues

## 🔧 **Enhanced Lambda Function**

### **New Capabilities**
- **Grafana API Integration**: Direct API calls to create data sources and deploy dashboards
- **Workspace Status Monitoring**: Waits for workspace to be fully ready
- **Secure Authentication**: API key creation and management
- **Error Handling**: Comprehensive error handling with fallback options
- **Status Reporting**: Detailed deployment status in CloudFormation outputs

### **Security Features**
- **Temporary API Keys**: Short-lived keys with automatic cleanup
- **Secrets Manager**: Secure storage of sensitive credentials
- **Least Privilege**: Minimal required permissions for deployment
- **Audit Trail**: Full logging of deployment activities

## 📋 **Deployment Process**

### **Single Command Deployment**
```bash
cd cdk
cdk deploy SAPLoadTests-GrafanaStack --context deployGrafana=true
```

### **What Happens Behind the Scenes**
1. **Grafana Workspace**: Created with proper permissions and data source types
2. **Delay Period**: 60-second wait for workspace initialization
3. **API Key Creation**: Admin API key generated and stored securely
4. **Data Source Setup**: CloudWatch data source created with service role
5. **Dashboard Deployment**: Dashboard deployed with correct data source mapping
6. **Status Reporting**: Deployment results available in CloudFormation outputs

## 📊 **Deployment Outputs**

### **Success Indicators**
- **AutoDeployed**: `true` indicates successful automated deployment
- **DashboardUid**: UID of the deployed dashboard
- **DataSourceUid**: UID of the created CloudWatch data source
- **WorkspaceUrl**: Direct link to Grafana workspace

### **Fallback Indicators**
- **AutoDeployed**: `false` indicates manual import required
- **ImportInstructions**: Steps for manual dashboard import
- **DashboardReady**: `true` means dashboard JSON is prepared for import

## 🎯 **User Experience**

### **Successful Automated Deployment**
1. Deploy CDK stack
2. Assign users via AWS SSO
3. Access Grafana workspace
4. Dashboard is ready to use immediately!

### **Fallback Manual Process**
1. Deploy CDK stack (automated deployment failed)
2. Assign users via AWS SSO
3. Access Grafana workspace
4. Import dashboard manually using prepared JSON

## 🛡️ **Security and Reliability**

### **Security Measures**
- **IAM Roles**: Least-privilege access for all components
- **API Key Rotation**: Short-lived keys with automatic cleanup
- **Encrypted Storage**: Secrets Manager for credential storage
- **Audit Logging**: CloudWatch logs for all deployment activities

### **Reliability Features**
- **Retry Logic**: Automatic retries for transient failures
- **Timeout Protection**: Prevents infinite waiting
- **Graceful Degradation**: Falls back to manual process if needed
- **Stack Protection**: Never fails CDK deployment due to dashboard issues

## 🔄 **Maintenance and Updates**

### **Dashboard Updates**
- Modify `cdk/resources/grafana-dashboards/SAPLoadTestsDashboard.json`
- Redeploy stack to update dashboard automatically
- Existing dashboard will be overwritten with new version

### **Data Source Updates**
- Service role changes automatically applied
- Regional configuration updated on redeployment
- No manual data source reconfiguration needed

### **Manual API Operations**

For manual dashboard operations or troubleshooting:

#### **Generate API Key**
```bash
# Get workspace ID from deployment outputs
WORKSPACE_ID="g-your-workspace-id"

# Create API key for manual operations
aws grafana create-workspace-api-key \
  --key-name "manual-ops-$(date +%s)" \
  --key-role ADMIN \
  --seconds-to-live 3600 \
  --workspace-id $WORKSPACE_ID \
  --query 'key' \
  --output text
```

#### **Verify Dashboard Status**
```bash
# List all dashboards
curl -H "Authorization: Bearer $API_KEY" \
  "https://$WORKSPACE_ID.grafana-workspace.us-east-1.amazonaws.com/api/search" | jq '.'

# Get specific dashboard
curl -H "Authorization: Bearer $API_KEY" \
  "https://$WORKSPACE_ID.grafana-workspace.us-east-1.amazonaws.com/api/dashboards/uid/DASHBOARD_UID" | jq '.dashboard.title'
```

#### **Manual Dashboard Deployment**
```bash
# Deploy dashboard manually if needed
aws lambda invoke \
  --function-name SAPLoadTests-GrafanaStack-DashboardDeployer-XXXXX \
  --payload '{}' \
  response.json && cat response.json
```

## 📈 **Benefits**

### **For Developers**
- **Zero Manual Configuration**: Complete automation from deployment to dashboard
- **Consistent Deployments**: Same configuration across all environments
- **Rapid Iteration**: Easy dashboard updates through code changes

### **For Operations**
- **Immediate Monitoring**: Dashboard available immediately after deployment
- **Standardized Setup**: Consistent Grafana configuration
- **Reduced Errors**: No manual configuration steps to miss

### **For Security**
- **Automated Compliance**: Consistent security configuration
- **Credential Management**: Secure handling of API keys
- **Audit Trail**: Complete deployment logging

## 🚀 **Next Steps**

### **Immediate Use**
1. Deploy the stack with `deployGrafana=true`
2. Assign users via AWS SSO Console
3. Access the dashboard and start monitoring!

### **Customization**
1. Update instance IDs in dashboard queries
2. Modify thresholds for your environment
3. Add additional panels or dashboards
4. Configure alerting rules

This implementation provides a **production-ready, fully automated** Grafana deployment that requires zero manual configuration for data sources and dashboards!