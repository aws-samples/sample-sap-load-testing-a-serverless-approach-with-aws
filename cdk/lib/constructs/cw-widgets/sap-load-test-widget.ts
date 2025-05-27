import * as cdk from 'aws-cdk-lib';

import { CommonGraphWidget, CommonGraphWidgetProps, CommonSingleValueWidgetProps } from "./common";
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';


export class SAPMetric extends cloudwatch.Metric {
    constructor(props: cloudwatch.MetricProps) {
        super(props);
    }

    public setIdAndVisible(id: string, visible: boolean): cloudwatch.Metric {
        // The following code is to tweak the missing support to set id and visibility.
        // Reference solution: https://github.com/aws/aws-cdk/issues/19876#issuecomment-2491553431        
        const config = this.toMetricConfig()
        if (config.renderingProperties) {
            config.renderingProperties.id = id
            config.renderingProperties.visible = visible
        }

        this.toMetricConfig = () => config
        return this;
    }

}

export class SAPLoadTestGraphWidget extends CommonGraphWidget {
    constructor(props: CommonGraphWidgetProps) {
        super(props);

        var sapAggExpression = "(";
        var hanaAggExpression = "(";

        //var metrics: cloudwatch.Metric[] = [];
        var metrics: cdk.aws_cloudwatch.IMetric[] = [];

        //add SAP Application Server Metrics
        props.sapSystem.appNodes.forEach((appNode, index) => {
            props.metricNames.forEach((metricName, index2) => {
                this.addLeftMetric(new SAPMetric({
                    namespace: props.namespace,
                    metricName: metricName || "",
                    dimensionsMap: {
                        InstanceId: appNode.instanceId,
                    },
                }).setIdAndVisible(`sap${metricName}${index}`, !props.aggregation?.enabled || false));
                sapAggExpression += `sap${metricName}${index}+`;
            });
        });

        //add Hana Server Metrics
        props.metricNames.forEach((metricName, index) => {
            this.addLeftMetric(new SAPMetric({
                namespace: props.namespace,
                metricName: metricName || "",
                dimensionsMap: {
                    InstanceId: props.sapSystem.dbNode.instanceId,
                },
            }).setIdAndVisible(`hana${metricName}${index}`, !props.aggregation?.enabled || false));
            hanaAggExpression += `hana${metricName}${index}+`;

        });
        sapAggExpression = sapAggExpression.substring(0, sapAggExpression.length - 1) + ")";
        hanaAggExpression = hanaAggExpression.substring(0, hanaAggExpression.length - 1) + ")";


        if (props.aggregation?.enabled) {
            this.addLeftMetric(new cloudwatch.MathExpression({
                expression: hanaAggExpression,
                label: `DB ${props.aggregation.label}`,
                usingMetrics: {},
                // period: cdk.Duration.seconds(60),
            }));
            this.addLeftMetric(new cloudwatch.MathExpression({
                expression: sapAggExpression,
                label: `SAP AS ${props.aggregation.label}`,
                usingMetrics: {},
                // period: cdk.Duration.seconds(60),
            }));
        }

    }

}


export class SAPLoadTestSingleValueWidget {

    public widget: cloudwatch.SingleValueWidget;

    constructor(props: CommonSingleValueWidgetProps) {

        var metrics: cdk.aws_cloudwatch.IMetric[] = [];
        //add SAP Application Server Metrics
        props.sapSystem.appNodes.forEach((appNode, index) => {
            props.metricNames?.forEach((metricName) => {
                metrics.push(new SAPMetric({
                    namespace: props.namespace,
                    metricName: metricName || "",
                    dimensionsMap: {
                        InstanceId: appNode.instanceId,
                    }
                }));                
            })
        });

        //add Hana Server Metrics
        props.metricNames?.forEach((metricName, index) => {
            metrics.push(new SAPMetric({
                namespace: props.namespace,
                metricName: metricName || "",
                dimensionsMap: {
                    InstanceId: props.sapSystem.dbNode.instanceId,
                },
            }))
        });


        this.widget = new cloudwatch.SingleValueWidget({
            metrics: metrics,
            // height: props.height,
            // width: props.width,
            region: props.region,
            title: props.title,

            // period: cdk.Duration.seconds(60),
        })
    }

    public create(): cloudwatch.SingleValueWidget{
        return this.widget;
    }

}