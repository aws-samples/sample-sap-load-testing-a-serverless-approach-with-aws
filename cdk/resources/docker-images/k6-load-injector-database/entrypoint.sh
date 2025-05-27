#!/usr/bin/env bash


### Define environment variables
## represents the location int the s3 bucket (bucket+prefix) where the k6 script is located.
## the script must be in a zip file together with the required data files (csv)
# eg: my-bucket-for-k6-scripts/scripts/my-k6-script.zip
# K6_SCRIPT_S3_URI=$K6_SCRIPT_S3_URI
# ## represents the k6 parameters (duration, concurrent users, etc..) to launch the k6 scripts 
# K6_PARAMETERS=$K6_PARAMETERS

# echo "K6_SCRIPT_S3_URI: $K6_SCRIPT_S3_URI"
echo "K6_PARAMETERS: $K6_PARAMETERS"
echo "current region: $AWS_REGION"

if [ -z "${K6_SCRIPT_S3_URI}" ]; then
  echo "No k6 script location in S3 provided. Please pass the environment variable K6_SCRIPT_S3_URI"
  exit 1
fi

if [ -z "${K6_PARAMETERS}" ]; then
  echo "No k6 parameters provided. Relying on the options defined in the k6 script: https://grafana.com/docs/k6/latest/get-started/running-k6/#ramp-vus-up-and-down-in-stages"
fi

script_name=$(basename $K6_SCRIPT_S3_URI)

aws s3 cp $K6_SCRIPT_S3_URI $script_name


# unzip the script in 
unzip $script_name -d load_script/
cd load_script
# rm -rf __MACOSX

k6_script_file=$(find . -name "*.js")
echo "This is the k6 script file is found: $k6_script_file"

if [ -z "${k6_script_file}" ]; then
  echo "No k6 script found in the provided zip file"
  exit 1
fi

## get only one javascript file
k6_script_file=$(echo $k6_script_file | cut -d ' ' -f1)
echo "This is the k6 script file that will be used: $k6_script_file"

## Handle SAP credentials
touch sapK6.secret
if [ -n "$SECRET_NAME" ]; then
  echo "Retriving SAP credentials from secret: $SECRET_NAME". Creating k6 secret file
  username=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text --region $AWS_REGION | jq -r '.dbUser')
  password=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text --region $AWS_REGION | jq -r '.dbPassword')
  instanceId=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text --region $AWS_REGION | jq -r '.dbInstanceId')
  #get private ip address from ec2 instanceid
  hanaHostIpAddr=$(aws ec2 describe-instances --instance-ids $instanceId --query 'Reservations[*].Instances[*].PrivateIpAddress' --output text --region $AWS_REGION)
  hanaPort=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text --region $AWS_REGION | jq -r '.dbPort')
  hanaDB=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --query SecretString --output text --region $AWS_REGION | jq -r '.dbName')

  echo "username=$username" > sapK6.secret
  echo "password=$password" >> sapK6.secret
  echo "hanaHost=$hanaHostIpAddr" >> sapK6.secret
  echo "hanaPort=$hanaPort" >> sapK6.secret
  echo "hanaDB=$hanaDB" >> sapK6.secret
  echo "credentials file created successfully!"
fi

## run k6 script
echo "starting k6 script: $k6_script_file with parameters: $K6_PARAMETERS"
K6_STATSD_ENABLE_TAGS=true k6 run --out output-statsd --secret-source=file=sapK6.secret $k6_script_file $K6_PARAMETERS
if [ $? -ne 0 ]; then
    echo "Error during K6 script execution"
    exit 1
fi

echo "k6 script executed succesfully!"

## delete secret file
rm -rf sapK6.secret