# Import SAP Load Tests Dashboard

This guide helps you import the pre-configured SAP Load Tests dashboard into your Grafana workspace.

## Prerequisites

1. Grafana workspace deployed and accessible
2. User assigned to the workspace with Admin permissions
3. CloudWatch data source configured
4. AWS CLI configured with appropriate permissions

## API Key Management

For API-based operations, you'll need to generate Grafana API keys:

### Generate API Key
```bash
# Get workspace ID from CDK outputs or AWS console
WORKSPACE_ID=$(aws grafana list-workspaces --query 'workspaces[?name==`sap-load-tests-grafana-workspace`].id' --output text)

# Create API key (adjust duration as needed)
API_KEY=$(aws grafana create-workspace-api-key \
  --key-name "dashboard-operations-$(date +%s)" \
  --key-role ADMIN \
  --seconds-to-live 3600 \
  --workspace-id $WORKSPACE_ID \
  --query 'key' \
  --output text)

echo "API Key: $API_KEY"
echo "Workspace ID: $WORKSPACE_ID"
```

### List Existing API Keys
```bash
aws grafana list-workspace-api-keys --workspace-id $WORKSPACE_ID
```

### Delete API Key
```bash
aws grafana delete-workspace-api-key \
  --key-name "your-key-name" \
  --workspace-id $WORKSPACE_ID
```

## Import Steps

### Method 1: Automated Data Source Update (Recommended)

1. **Get CloudWatch Data Source UID**
   - Access your Grafana workspace
   - Go to Configuration → Data Sources
   - Click on your CloudWatch data source
   - Copy the UID from the browser URL (e.g., `cloudwatch-abc123`)

2. **Update Dashboard JSON**
   ```bash
   # From the project root directory
   python3 scripts/deploy-dashboard.py \
     cdk/resources/grafana-dashboards/SAPLoadTestsDashboard.json \
     YOUR_CLOUDWATCH_DATASOURCE_UID
   ```

3. **Import Updated Dashboard**
   - Go to Dashboards → Import in Grafana
   - Upload the generated `-updated.json` file
   - Click "Import"

### Method 2: Manual Import

1. **Access Grafana Workspace**
   - Open the Grafana workspace URL from your deployment outputs
   - Sign in with AWS SSO

2. **Navigate to Import**
   - Click the "+" icon in the left sidebar
   - Select "Import"

3. **Upload Dashboard**
   - Click "Upload JSON file"
   - Select `cdk/resources/grafana-dashboards/SAPLoadTestsDashboard.json`
   - Or copy and paste the JSON content

4. **Configure Data Sources**
   - In the import dialog, map the data source:
     - **CloudWatch**: Select your configured CloudWatch data source
   - Set a unique dashboard name if desired
   - Choose the folder (optional)

5. **Complete Import**
   - Click "Import"
   - The dashboard will be created and opened

### Method 3: API Import (Advanced)

If you prefer to use the Grafana API:

#### Generate API Key

First, create an API key for your Grafana workspace:

```bash
# Replace with your workspace ID from CDK outputs
WORKSPACE_ID="g-your-workspace-id"

# Create a temporary API key (expires in 5 minutes)
aws grafana create-workspace-api-key \
  --key-name "dashboard-import-$(date +%s)" \
  --key-role ADMIN \
  --seconds-to-live 300 \
  --workspace-id $WORKSPACE_ID \
  --query 'key' \
  --output text
```

#### Import Dashboard via API

```bash
# Set variables (replace with your values)
GRAFANA_URL="https://your-workspace-id.grafana-workspace.region.amazonaws.com"
API_KEY="your-generated-api-key"

# Import the dashboard
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": '$(cat cdk/resources/grafana-dashboards/SAPLoadTestsDashboard.json)',
    "overwrite": true,
    "message": "Imported via API"
  }' \
  "$GRAFANA_URL/api/dashboards/db"
```

#### Verify Dashboard Import

```bash
# List dashboards to verify import
curl -H "Authorization: Bearer $API_KEY" \
  "$GRAFANA_URL/api/search?query=SAP" | jq '.'

# Get specific dashboard details
curl -H "Authorization: Bearer $API_KEY" \
  "$GRAFANA_URL/api/dashboards/uid/DASHBOARD_UID" | jq '.dashboard.title'
```

#### Clean Up API Key

```bash
# Delete the API key when done (optional - it will auto-expire)
aws grafana delete-workspace-api-key \
  --key-name "dashboard-import-TIMESTAMP" \
  --workspace-id $WORKSPACE_ID
```

## Dashboard Features

The imported dashboard includes:

### Infrastructure Overview
- **CPU Utilization**: Real-time CPU usage for app and database servers
- **Memory Utilization**: Memory consumption monitoring
- **Storage IOPS**: Disk read/write operations
- **Storage Throughput**: Disk read/write bandwidth

### SAP Metrics
- **Total App Servers**: Number of active application servers
- **Active Work Processes**: Current dialog work processes
- **Total Users**: Connected SAP users
- **Sessions**: Active SAP sessions
- **System Dumps**: ST22 system dump count
- **Cancelled Jobs**: SM37 cancelled job count
- **Enqueue**: Lock management metrics
- **IDocs**: Inbound/outbound IDoc processing

### Load Testing Metrics
- **K6 HTTP Requests**: Requests per second during load tests
- **Virtual Users**: Number of simulated users
- **Response Times**: SAP dialog and database response times

### Time Series Charts
- **SAP Users Over Time**: User activity trends
- **SAP Sessions Over Time**: Session count trends
- **Response Time Trends**: Performance monitoring over time

## Customization

### Add Variables
The dashboard includes template variables for:
- **Test Name**: Filter by K6 test name
- **Instance ID**: Filter by EC2 instance

You can add more variables by:
1. Going to Dashboard Settings → Variables
2. Adding new query-based variables
3. Using them in panel queries

### Modify Thresholds
Adjust alert thresholds based on your environment:
1. Edit each panel
2. Go to the "Thresholds" section
3. Modify the warning/critical values
4. Update colors as needed

## Troubleshooting

### Dashboard Import Fails
- Verify the JSON file is valid
- Check that you have Admin permissions
- Ensure CloudWatch data source is configured

### No Data Showing
- Verify CloudWatch data source connection
- Check that metrics are being published to CloudWatch
- Update instance IDs in queries
- Verify time range selection

### Permission Errors
- Ensure Grafana service role has CloudWatch permissions
- Check that AWS SSO user has proper access
- Verify data source authentication settings

## Next Steps

After importing the dashboard:
1. **Customize for your environment** - Update instance IDs and thresholds
2. **Create alerts** - Set up notifications for critical metrics
3. **Add more panels** - Extend with additional SAP or infrastructure metrics
4. **Share with team** - Configure dashboard permissions for other users