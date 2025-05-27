import * as cdk from 'aws-cdk-lib';

export interface AnalyticsStackProps extends cdk.StackProps {
    s3BucketForMetrics: string;
}