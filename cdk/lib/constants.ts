export const PROJECT_PREFIX = "sap-load-tests";

// Prefixes are used in particular in SAPLoadTestsDataStack-XXX stack
export const CLOUDWATCH_DASHBOARD_NAME_PREFIX = `${PROJECT_PREFIX}-dashboard-`;
export const SECRET_MANAGER_NAME_PREFIX = `${PROJECT_PREFIX}-secret`;
export const ARTEFACTS_S3_BUCKET_NAME_PREFIX = `${PROJECT_PREFIX}-artefacts`;
export const METRICS_S3_BUCKET_NAME_PREFIX = `${PROJECT_PREFIX}-cwmetrics`;
export const LAMBDA_PREFIX = `${PROJECT_PREFIX}-fn-`;
export const WEBAPP_S3_BUCKET_NAME_PREFIX = `${PROJECT_PREFIX}-webapp`;

// Final names of resources
export const STEP_FUNCTION_NAME = `${PROJECT_PREFIX}-orchestrator`;
export const SNS_TOPIC_NAME = `${PROJECT_PREFIX}-topic`;
export const LAMBDA_LAYER_NAME = `${PROJECT_PREFIX}-main-libs`;
export const LAMBDA_START_ALL_TEST_FUNCTION_NAME = `${LAMBDA_PREFIX}-start-all-tests`;
export const LAMBDA_CHECK_SSM_FUNCTION_NAME = `${LAMBDA_PREFIX}-check-ssm`;
export const LAMBDA_CHECK_BATCH_STATUS_FUNCTION_NAME = `${LAMBDA_PREFIX}-check-batch-job-status`;
export const LAMBDA_CW_PUSH_METRICS_FUNCTION_NAME = `${LAMBDA_PREFIX}-cw-push-metrics`;
export const LAMBDA_GET_PRESIGNED_S3_URL_FUNCTION_NAME = `${LAMBDA_PREFIX}-get-presigned-s3-url`;
export const K6_EC2_INSTANCE_NAME = `${PROJECT_PREFIX}-k6-load-injector`;
export const UI_API_GATEWAY_NAME = `${PROJECT_PREFIX}-ui-api`;

export const EXECUTIONS_ASSETS_S3_PREFIX = "TestExecutions";

export const APPLICATION_PREFIX = "APPLICATION_K6";
export const BATCH_JOB_DEFINITION_NAME_PREFIX = `${PROJECT_PREFIX}-jobdef`;
export const BATCH_JOB_QUEUE_NAME = `${PROJECT_PREFIX}-queue`;
export const DATABASE_PREFIX = "DATABASE_K6";

//analytics
export const GLUE_DATABASE_NAME = "sap_load_tests";
export const GLUE_TABLE_NAME = "cw_metrics";
