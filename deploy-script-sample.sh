### To deploy the required infrastructure
cdk deploy \
--context vpcIdForK6Instance=vpc-0a1448d185fd827f9 \
--context subnetIdForK6Instance=subnet-0910d17794b861fb2 \
--context instanceTypeForK6Instance=m6a.4xlarge \
SAPLoadTests-InfrastructureStack



### To deploy the system specific stack (DEV)
cdk deploy \
--context sapApplicationIntanceIds=i-0f8ff91696af94894,i-07210f1a0e59f5a89 \
--context hanaInstanceId=i-0ea74bc4ac62a1c22 \
--context sapSID=ID1 \
SAPLoadTestsDataStack-ID1