# SAP Load Tests: A Serverless Approach

## Table of Contents

- [Overview](#overview)
  - [Architecture](#architecture)
  - [Cost](#cost)
- [Prerequisites](#prerequisites)
- [Deployment Steps](#deployment-steps)
  - [Infrastructure Deployment](#infrastructure-deployment)
  - [SAP System Definition Deployment](#sap-system-definition-deployment)
  - [Analytics Stack (Optional)](#analytics-stack-optional)
- [Load Test Scenarios](#load-test-scenarios)
  - [Infrastructure Load Tests](#infrastructure-load-tests)
  - [Database Load Tests](#database-load-tests)
  - [Application Load Tests](#application-load-tests)
    - [IDocs Scenario](#idocs-scenario)
    - [Fiori Scenario](#fiori-scenario)
- [Usage](#usage)
  - [Web Interface](#web-interface)
  - [Monitoring and Metrics](#monitoring-and-metrics)
- [Cleanup](#cleanup)
- [Disclaimer](#disclaimer)
- [Support](#support)
- [Next Steps](#next-steps)

## Overview

SAP Load Tests is a serverless solution for conducting performance testing on SAP systems running natively on AWS or within a RISE environment. This solution leverages AWS services to provide a scalable, cost-effective approach to load testing SAP environments without requiring dedicated testing infrastructure.

### Architecture

![Load Tests Architecture](assets/images/lt_native.jpg)

The solution consists of the following components:

1. **Infrastructure Stack**: Core AWS resources including:

   - AWS Lambda functions for orchestration
   - Step Functions for workflow management
   - AWS Batch for running containerized load tests
   - S3 buckets for storing artifacts and metrics
   - CloudWatch for monitoring and dashboards
   - API Gateway and Cognito for the web interface

2. **SAP System Definition Stack**: System-specific resources including:

   - CloudWatch dashboards tailored to the SAP system
   - Secrets Manager entries for system credentials
   - System-specific configuration

3. **Analytics Stack (Optional)**: Data analysis components including:
   - Glue database and tables
   - Athena workgroup for SQL queries
   - IAM roles for analytics accesshttps://github.com/aws-samples/sample-sap-load-testing-a-serverless-approach-with-aws/blob/main/README.md#prerequisites

### Cost

The solution is designed to be cost-effective by using serverless components that scale to zero when not in use. The primary cost drivers are:

- AWS Batch compute resources during test execution
- S3 storage for test artifacts and metrics
- CloudWatch dashboards and metrics storage

## Prerequisites

Before deploying this solution, you need:

1. AWS CLI and CDK installed and configured
2. Node.js and npm installed
3. Docker installed and started (eg: DockerDesktop)
4. An existing VPC with appropriate subnets
5. An SAP system running on EC2 instances
6. Administrator email address for notifications
7. Appropriate IAM permissions to deploy the resources
8. For infrastructure based load tests, the following tools need to be installed at Operating System level

- stress-ng --> https://github.com/ColinIanKing/stress-ng
- fio --> https://github.com/axboe/fio

## Deployment Steps

### Infrastructure Deployment

Move to the project folder and move to cdk directory. 
```bash
  cd sample-sap-load-testing-a-serverless-approach-with-aws/cdk
  npm install
```

Deploy the core infrastructure stack:

```bash
cdk deploy \
  --context vpcId=vpc-xxxxxxxxxxxxxxxxx \
  --context subnetIds=subnet-xxxxxxxxxxxxxxxxx,subnet-yyyyyyyyyyyyyyyyy \
  --context adminEmail=admin@example.com \
  --context deployAnalytics=yes \
  SAPLoadTests-InfrastructureStack
```

### SAP System Definition Deployment

Deploy the SAP system-specific stack:

```bash
cdk deploy \
  --context sapApplicationIntanceIds=i-xxxxxxxxxxxxxxxxx,i-yyyyyyyyyyyyyyyyy \
  --context dbInstanceId=i-zzzzzzzzzzzzzzzzz \
  --context sapBaseUrl=https://sap-system-url.example.com \
  --context dbPort=30015 \
  --context dbName=HDB \
  --context sapSID=SID \
  --context sapClient=XXX \
  SAPLoadTestsDataStack-SID
```

### Analytics Stack (Optional)

To deploy the analytics stack for advanced metrics analysis:

```bash
cdk deploy \
  --context vpcId=vpc-xxxxxxxxxxxxxxxxx \
  --context subnetIds=subnet-xxxxxxxxxxxxxxxxx,subnet-yyyyyyyyyyyyyyyyy \
  --context adminEmail=admin@example.com \
  --context deployAnalytics=true \
  SAPLoadTests-InfrastructureStack
```

## Load Test Scenarios

### Infrastructure Based Load Tests

These 2 tests (infra and network) are focused on the underlying AWS infrastructure performance, including:

- EC2 instance performance (CPU, Memory)
- Network latency (introducing additional network latency / delay)
- Storage performance (IOPS/Throughput)

### Database Load Tests

Test targeting the SAP HANA database, including:

- SQL query performance
- Table operations
- Database connection handling

The database tests use the k6 SQL extension written in go to connect directly to HANA db and execute queries.

### Application Load Tests

#### IDocs Scenario

Tests for SAP IDoc processing:

- Sends IDocs to the SAP system via HTTP
- Measures processing time and success rates
- Supports variable load patterns

Example IDoc test script:

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import encoding from "k6/encoding";
import secrets from "k6/secrets";

// Test configuration with parameterized values
export const options = {
  vus: 5,
  duration: "60s",
  insecureSkipTLSVerify: true,
};

export default function () {
  // Load test implementation
  // ...
}
```

#### Fiori Scenario

Tests for SAP Fiori applications:

- Simulates user interactions with Fiori apps
- Measures response times and UI performance
- Supports authentication flows

## Usage

### Web Interface

After deployment, access the web interface using the URL provided in the CloudFormation outputs. The interface allows you to:

1. Select the SAP system to test
2. Configure test scenario and parameters (duration, virtual users, etc.)
3. Start and monitor test executions
4. View test results and metrics

### Monitoring and Metrics

The solution provides several monitoring options:

1. **CloudWatch Dashboards**: System-specific dashboards showing:

   - SAP application server metrics
   - Database performance metrics
   - Test execution metrics
   - AWS infrastructure metrics

2. **Analytics (if deployed)**: Query test metrics using Athena:
   ```sql
   SELECT * FROM sap_load_tests.cw_metrics
   WHERE sid = 'SID' AND test_type = 'application'
   ORDER BY timestamp DESC
   LIMIT 100;
   ```

## Cleanup

To remove the deployed resources:

```bash
# Remove SAP system definition stack
cdk destroy SAPLoadTestsDataStack-SID

# Remove infrastructure stack
cdk destroy SAPLoadTests-InfrastructureStack
```

## Disclaimer

This solution is provided as-is without any warranties. Always test in non-production environments before using in production contexts.

## Support

For any support or technical questions please contact us at sap-load-tests@amazon.com.

## Next Steps

- Create Quicksight dashboards for reporting
- Add Amazon Managed Grafana stack for realtime monitoring
- Add support for additional SAP S/4HANA tests
