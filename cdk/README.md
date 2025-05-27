# SAP Load Test Injector

To deploy follow these instructions:

Identify the SAP System that will be used as target. Note down the following information:

- SAP System ID (SID) This is used to unique identify the SAP system (sapSID)
- EC2 Instance ID of the SAP HANA primary instance (hanaInstanceId)
- EC2 Instance IDs of the SAP Application Servers used in load tests (sapApplicationIntanceIds)
- SAP Application endpoint to use as load test target (eg: SAP Idoc HTTP/XML adapter) (k6BaseUrl)
- VPC where the target SAP system is deployed. This is needed to deploy the K6 instance for the load injector (vpcIdForK6Instance)
- A private subnet in the VPC where the K6 load injector (EC2ß) will be deployed (subnetIdForK6Instance)

The deploymend consists of two main phases.

The infrastructure phase will deploy all the required infrastructure to launch, run and monitor the load tests. The infrastructure stack will be launced only once. To deploy the infrastructure stack:

`cdk deploy \
--context vpcId=vpc-00c3e6886a9049ec1 \
--context subnetIds=subnet-0f31734a83718d2a4,subnet-0e2688641ffec3035,subnet-00030c9b9812c9c06 \
--context deployAnalytics=false \
--context adminEmail=bersanf@amazon.com \
SAPLoadTests-InfrastructureStack`

The system phase will deploy the required configuration to launch a load test for a specific SAP System.
The system stack needs to be deployed for every SAP system you want to use as target for the load test
To deploy the system stack for the DEV (sapSID) SAP system"

`cdk deploy \
  --context sapApplicationIntanceIds=i-0f8ff91696af94894,i-07210f1a0e59f5a89 \
  --context dbInstanceId=i-0ea74bc4ac62a1c22 \
  --context dbPort=30015 \
  --context dbName=HDB \
  --context sapSID=ID1 SAPLoadTestsDataStack-ID1`
