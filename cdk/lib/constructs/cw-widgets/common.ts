import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { SAPSystemProps } from '../../parameters';



export interface CommonGraphWidgetProps extends cloudwatch.GraphWidgetProps {
    title: string,
    namespace: string,
    // sapInstanceIds: string[],
    // hanaInstanceId: string,
    sapSystem: SAPSystemProps,
    metricNames: string[],
    annotations?: cloudwatch.HorizontalAnnotation[]
    aggregation?: {
        enabled: boolean,
        label: string    
    }
}

export interface CommonSingleValueWidgetProps  {
    title: string,
    namespace: string,
    // sapInstanceIds: string[],
    // hanaInstanceId: string,
    sapSystem: SAPSystemProps,
    metricNames?: string[],
    region: string,
    // height: number,
    // width: number
}
export class CommonGraphWidget extends cloudwatch.GraphWidget {
    constructor(props: CommonGraphWidgetProps) {
        super(props)
    }
} 
