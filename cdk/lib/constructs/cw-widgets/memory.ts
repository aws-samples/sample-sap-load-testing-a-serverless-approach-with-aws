import * as cdk from "aws-cdk-lib";

import {
  CommonGraphWidget,
  CommonGraphWidgetProps,
  CommonSingleValueWidgetProps,
} from "./common";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

export class MemoryWidget extends CommonGraphWidget {
  constructor(props: CommonGraphWidgetProps) {
    super(props);

    var expression = `SEARCH('{CWAgent,ImageId,InstanceId,InstanceType} MetricName=\"mem_used_percent\" AND (InstanceId=\"${props.sapSystem.dbNode.instanceId}\"`;

    props.sapSystem.appNodes.forEach((appNode, index) => {
      expression += ` OR InstanceId=\"${appNode.instanceId}\"`;
    });

    expression += ")', 'Maximum', 300)";
    this.addLeftMetric(
      new cloudwatch.MathExpression({
        expression: expression,
        label: "Memory Usage (MiB)",
        usingMetrics: {},
        period: props.period,
      })
    );
  }
}
export class MemorySingleValueWidget {
  public widget: cloudwatch.SingleValueWidget;

  constructor(props: CommonSingleValueWidgetProps) {
    var metrics: cdk.aws_cloudwatch.IMetric[] = [];

    var expression = `SEARCH('{CWAgent,ImageId,InstanceId,InstanceType} MetricName=\"mem_used_percent\" AND (InstanceId=\"${props.sapSystem.dbNode.instanceId}\"`;

    props.sapSystem.appNodes.forEach((appNode, index) => {
      expression += ` OR InstanceId=\"${appNode.instanceId}\"`;
    });

    expression += ")', 'Maximum', 300)";
    metrics.push(
      new cloudwatch.MathExpression({
        expression: expression,
        label: "Memory Usage %",
        usingMetrics: {},
      })
    );

    this.widget = new cloudwatch.SingleValueWidget({
      metrics: metrics,
      // height: props.height,
      // width: props.width,
      region: props.region,
      title: props.title,

      // period: cdk.Duration.seconds(60),
    });
  }

  public create(): cloudwatch.SingleValueWidget {
    return this.widget;
  }
}
