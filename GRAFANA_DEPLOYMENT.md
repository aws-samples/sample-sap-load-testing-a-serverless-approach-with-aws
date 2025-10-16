# Amazon Managed Grafana Integration

This document describes how to deploy and configure Amazon Managed Grafana as a standalone stack to visualize SAP Load Tests metrics from Athena.

## Prerequisites

1. **AWS SSO Setup**: Amazon Managed Grafana requires AWS SSO (Single Sign-On) to be configured in your AWS account.
2. **Analytics Stack**: The analytics stack should be deployed first to create the Athena workgroup and Glue database that Grafana will query.

## Architecture

The Grafana stack is **completely isolated** and can be deployed independently of the infrastructure and analytics stacks. It references existing AWS resources by name/ARN:

- **Athena Workgroup**: `AthenaWorkgroupSAPLoadTests`
- **Glue Database**: `sap_load_tests`
- **S3 Bucket**: `sap-load-tests-cwmetrics-{account}-{region}`

## Deployment

### Option 1: Deploy Grafana Stack Only

If you already have the analytics infrastructure deployed, you can deploy just the Grafana stack:

```bash
cd cdk
cdk deploy SAPLoadTests-GrafanaStack --context deployGrafana=true
```

### Option 2: Deploy Analytics and Grafana Together

```bash
cd cdk
# Deploy infrastructure and analytics first
cdk deploy --context vpcId=<your-vpc-id> --context subnetIds=<subnet1,subnet2> --context adminEmail=<your-email> --context deployAnalytics=true

# Then deploy Grafana separately
cdk deploy SAPLoadTests-GrafanaStack --context deployGrafana=true
```

### Option 3: Deploy Everything at Once

```bash
cd cdk
cdk deploy --all --context vpcId=<your-vpc-id> --context subnetIds=<subnet1,subnet2> --context adminEmail=<your-email> --context deployAnalytics=true --context deployGrafana=true
```

## Post-Deployment Configuration

After deployment, you'll receive outputs including:
- **GrafanaWorkspaceUrl**: The URL to access your Grafana workspace
- **GrafanaWorkspaceId**: The workspace ID for reference
- **CloudWatchDataSourceInfo**: JSON object with CloudWatch configuration
- **AthenaDataSourceInfo**: JSON object with database, workgroup, region, and S3 bucket information
- **SAPLoadTestsDashboardLocation**: Path to the SAP Load Tests dashboard JSON file
- **DashboardDeploymentStatus**: Status of the automated dashboard deployment
- **UserAssignmentInstructions**: Instructions to assign users to the workspace

The deployment outputs will indicate whether the dashboard was automatically deployed (`AutoDeployed: true`) or if manual import is required (`AutoDeployed: false`).

### Step 1: Assign Users to Grafana Workspace

**Important**: Before you can access the Grafana workspace, you need to assign users through AWS SSO. This is a manual step that must be completed after deployment.

#### Option A: Using AWS Console (Recommended)

1. **Open AWS SSO Console**: Navigate to AWS SSO in the AWS Console
2. **Go to Applications**: Click on "Applications" in the left sidebar
3. **Find Grafana**: Look for your Grafana workspace application
4. **Assign Users**: 
   - Click on the Grafana application
   - Go to "Assigned users" tab
   - Click "Assign users"
   - Select the users/groups you want to grant access
   - Choose permission level (Admin or Editor)

#### Option B: Using AWS CLI

```bash
# Get your SSO instance ARN
SSO_INSTANCE_ARN=$(aws sso-admin list-instances --query 'Instances[0].InstanceArn' --output text)

# Get your Grafana workspace ID from stack outputs
WORKSPACE_ID=$(aws cloudformation describe-stacks --stack-name SAPLoadTests-GrafanaStack --query 'Stacks[0].Outputs[?OutputKey==`GrafanaWorkspaceId`].OutputValue' --output text)

# Get user ID (replace with your actual user email)
USER_ID=$(aws identitystore list-users --identity-store-id $(aws sso-admin list-instances --query 'Instances[0].IdentityStoreId' --output text) --filters AttributePath=UserName,AttributeValue=your-email@example.com --query 'Users[0].UserId' --output text)

# Create permission set for Grafana (if not exists)
PERMISSION_SET_ARN=$(aws sso-admin create-permission-set --instance-arn $SSO_INSTANCE_ARN --name GrafanaAccess --description "Access to Grafana workspace" --query 'PermissionSet.PermissionSetArn' --output text)

# Assign user to account with permission set
aws sso-admin create-account-assignment \
  --instance-arn $SSO_INSTANCE_ARN \
  --target-id $(aws sts get-caller-identity --query Account --output text) \
  --target-type AWS_ACCOUNT \
  --permission-set-arn $PERMISSION_SET_ARN \
  --principal-id $USER_ID \
  --principal-type USER
```

### Step 2: Configure Data Sources in Grafana

1. **Access Grafana**: Navigate to the GrafanaWorkspaceUrl from the deployment outputs
2. **Sign in**: Use your AWS SSO credentials

#### Configure CloudWatch Data Source (Primary)

3. **Add CloudWatch Data Source**:
   - Go to Configuration → Data Sources
   - Click "Add data source"
   - Select "CloudWatch"
   - Configure with the following settings from the deployment outputs:
     - **Default Region**: Your AWS region
     - **Authentication Provider**: "AWS SDK Default"
     - **Assume Role ARN**: Use the service role ARN from outputs
     - **External ID**: Leave empty
   - Click "Save & Test"

#### Configure Athena Data Source (Optional)

4. **Add Athena Data Source** (for advanced analytics):
   - Go to Configuration → Data Sources
   - Click "Add data source"
   - Select "Amazon Athena"
   - Configure with the following settings from the deployment outputs:
     - **Database**: `sap_load_tests`
     - **Workgroup**: `AthenaWorkgroupSAPLoadTests`
     - **Region**: Your AWS region
     - **Authentication**: Use the service role (automatically configured)

### Step 3: Dashboard Deployment (Automated)

The dashboard and CloudWatch data source are **automatically deployed** during CDK deployment:

5. **Automatic Deployment**:
   - CloudWatch data source is created automatically
   - Dashboard is deployed with correct data source mapping
   - No manual import required!

6. **Verify Deployment**:
   - Access your Grafana workspace URL
   - Navigate to Dashboards
   - Look for "SAP Load and Performance Tests Dashboard"
   - The dashboard should be ready to use with live data

#### Fallback: Manual Import (if automated deployment fails)

If the automated deployment fails, you can still import manually:

7. **Check Deployment Status**:
   - Look at the `DashboardDeploymentStatus` output from CDK
   - If `AutoDeployed` is `false`, proceed with manual import

8. **Manual Import Process**:
   - Go to Configuration → Data Sources
   - Verify CloudWatch data source exists
   - Go to Dashboards → Import
   - Upload `cdk/resources/grafana-dashboards/SAPLoadTestsDashboard.json`
   - Map to your CloudWatch data source

The sample dashboard includes:
- **Infrastructure Metrics**: CPU, Memory, Storage IOPS, and Throughput
- **SAP Metrics**: Active work processes, users, sessions, system dumps
- **Load Test Metrics**: K6 HTTP requests, virtual users, response times
- **Custom SAP Monitoring**: Dialog response times, database metrics, IDocs

### Sample Queries

#### CloudWatch Queries (Primary Dashboard)

The dashboard uses CloudWatch metrics from these namespaces:
- `AWS/EC2` - EC2 instance metrics (CPU, memory, disk)
- `CWAgent` - CloudWatch Agent custom metrics
- `sap-monitor` - Custom SAP application metrics
- `K6` - Load testing metrics from K6

#### Athena Queries (Advanced Analytics)

For advanced analytics, you can create additional dashboards with Athena queries like:

```sql
-- Average response times by test type
SELECT 
    test_type,
    AVG(CAST(dia AS DOUBLE)) as avg_response_time,
    timestamp
FROM sap_load_tests.cw_metrics 
WHERE year = 2025 AND month = 1
GROUP BY test_type, timestamp
ORDER BY timestamp;

-- CPU utilization over time
SELECT 
    timestamp,
    CAST(cpu AS DOUBLE) as cpu_usage,
    instance_id
FROM sap_load_tests.cw_metrics 
WHERE year = 2025 AND month = 1
ORDER BY timestamp;

-- Memory utilization trends
SELECT 
    timestamp,
    CAST(free_mem_perc AS DOUBLE) as memory_free_percent,
    instance_id
FROM sap_load_tests.cw_metrics 
WHERE year = 2025 AND month = 1
ORDER BY timestamp;

-- K6 Virtual Users over time
SELECT 
    timestamp,
    CAST(k6_vus AS DOUBLE) as virtual_users,
    test_run_id
FROM sap_load_tests.cw_metrics 
WHERE year = 2025 AND month = 1
ORDER BY timestamp;
```

## Stack Independence

### Key Benefits

1. **Isolated Deployment**: Grafana can be deployed/destroyed without affecting other stacks
2. **Optional Component**: Easy to skip Grafana deployment if not needed
3. **Resource Discovery**: Automatically discovers existing Athena and S3 resources by name
4. **Flexible Configuration**: Override default resource names if needed

### Customization

You can override default resource names by modifying the stack props in `cdk/bin/cdk.ts`:

```typescript
const grafanaStack = new GrafanaStack(app, "SAPLoadTests-GrafanaStack", {
  env: { /* ... */ },
  // Optional overrides
  athenaWorkgroupName: "CustomWorkgroupName",
  glueDatabaseName: "custom_database_name",
  s3BucketNamePrefix: "custom-bucket-prefix",
});
```

## Security

- **Authentication**: AWS SSO integration for secure access
- **Authorization**: IAM service role with least-privilege permissions
- **Resource Scope**: Access limited to specific Athena workgroups, Glue databases, and S3 buckets
- **Network**: No VPC dependencies - uses AWS managed services

## Troubleshooting

### Common Issues

1. **sso.auth.access-denied Error**: 
   - **Cause**: User not assigned to Grafana workspace
   - **Solution**: Follow the user assignment steps above
   - **Verification**: Check AWS SSO console for user assignments

2. **AWS SSO Not Configured**: 
   - **Cause**: AWS SSO not enabled in your account
   - **Solution**: Enable AWS SSO in the AWS Console first

3. **Resource Not Found**: 
   - **Cause**: Analytics stack not deployed or resources don't exist
   - **Solution**: Verify the analytics stack has been deployed and resources exist

4. **Permission Errors**: 
   - **Cause**: Grafana service role lacks necessary permissions
   - **Solution**: Check that the Grafana service role has necessary permissions

5. **Data Source Connection**: 
   - **Cause**: Athena workgroup or Glue database not accessible
   - **Solution**: Ensure Athena workgroup and Glue database are accessible

### Useful Commands

```bash
# List all stacks
cdk list

# Check Grafana stack status
cdk deploy SAPLoadTests-GrafanaStack --dry-run

# View Grafana stack outputs
aws cloudformation describe-stacks --stack-name SAPLoadTests-GrafanaStack --query 'Stacks[0].Outputs'

# Test Athena connectivity
aws athena start-query-execution \
  --query-string "SELECT COUNT(*) FROM sap_load_tests.cw_metrics" \
  --work-group AthenaWorkgroupSAPLoadTests

# Verify S3 bucket exists
aws s3 ls s3://sap-load-tests-cwmetrics-$(aws sts get-caller-identity --query Account --output text)-$(aws configure get region)

# Check user assignments in Grafana workspace
aws grafana list-workspace-service-accounts --workspace-id $(aws cloudformation describe-stacks --stack-name SAPLoadTests-GrafanaStack --query 'Stacks[0].Outputs[?OutputKey==`GrafanaWorkspaceId`].OutputValue' --output text)

# List SSO applications to find Grafana
aws sso-admin list-applications --instance-arn $(aws sso-admin list-instances --query 'Instances[0].InstanceArn' --output text)
```

## Cost Considerations

- **Amazon Managed Grafana**: Charges per active user per month
- **Athena Queries**: Charges per query and data scanned
- **S3 Storage**: Standard S3 storage costs for query results
- **Optimization**: Use partitioning and data compression to reduce costs

## Cleanup

To remove only the Grafana stack:

```bash
cd cdk
cdk destroy SAPLoadTests-GrafanaStack
```

This will not affect your other infrastructure or analytics stacks.

## Dashboard Import Guide

For detailed instructions on importing and customizing the sample dashboard, see:
- **[Dashboard Import Guide](scripts/import-dashboard.md)** - Step-by-step dashboard import and customization

## Quick Fix for sso.auth.access-denied Error

If you're getting the `sso.auth.access-denied` error, follow these steps:

### 1. Immediate Solution (AWS Console)

1. **Go to AWS SSO Console** → Applications
2. **Find your Grafana workspace** (it will be listed as an application)
3. **Click on the Grafana application**
4. **Go to "Assigned users" tab**
5. **Click "Assign users"**
6. **Select your user account**
7. **Choose "Admin" permission level**
8. **Click "Assign users"**

### 2. Wait for Propagation

After assigning users, wait 2-3 minutes for the changes to propagate.

### 3. Access Grafana

1. **Get the workspace URL** from the CloudFormation outputs:
   ```bash
   aws cloudformation describe-stacks --stack-name SAPLoadTests-GrafanaStack --query 'Stacks[0].Outputs[?OutputKey==`GrafanaWorkspaceUrl`].OutputValue' --output text
   ```

2. **Open the URL** in your browser
3. **Sign in with AWS SSO** using your credentials

### 4. Verify Access

Once logged in, you should see the Grafana dashboard. If you still get access denied:
- Check that AWS SSO is properly configured
- Verify your user has the correct permissions
- Try logging out and back in
- Clear your browser cache