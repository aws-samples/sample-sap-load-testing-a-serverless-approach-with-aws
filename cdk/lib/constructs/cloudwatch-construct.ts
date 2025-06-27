import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

import { Construct } from "constructs";
import { MemorySingleValueWidget, MemoryWidget } from "./cw-widgets/memory";
import {
  SAPLoadTestGraphWidget,
  SAPLoadTestSingleValueWidget,
} from "./cw-widgets/sap-load-test-widget";
import { CloudWatchDashboardProps } from "../parameters";

export class CloudWatchDashboardConstruct extends Construct {
  constructor(scope: Construct, id: string, props: CloudWatchDashboardProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    const memoryMaxWidget = new MemoryWidget({
      title: "Memory (Max)",
      namespace: "AWS/EC2",
      metricNames: [""],
      region: region,
      sapSystem: props.sapSystem,
      period: cdk.Duration.seconds(60),
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const cpuMaxWidget = new SAPLoadTestGraphWidget({
      title: "CPU Utilization (Max)",
      namespace: "AWS/EC2",
      metricNames: ["CPUUtilization"],
      region: region,
      sapSystem: props.sapSystem,
      period: cdk.Duration.seconds(60),
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const cpuSingleAvgWidget = new SAPLoadTestSingleValueWidget({
      title: "CPU Utilization (single)",
      namespace: "AWS/EC2",
      metricNames: ["CPUUtilization"],
      region: region,
      sapSystem: props.sapSystem,
    }).create();

    const cpuMemoryAvgWidget = new MemorySingleValueWidget({
      title: "Memory",
      namespace: "AWS/EC2",
      region: region,
      sapSystem: props.sapSystem,
    }).create();

    const ebsBytesMaxWidget = new SAPLoadTestGraphWidget({
      title: "Instance Throughput",
      namespace: "AWS/EC2",
      metricNames: ["EBSReadBytes", "EBSWriteBytes"],
      region: region,
      sapSystem: props.sapSystem,
      period: cdk.Duration.seconds(60),
      width: 12,
      height: 6,
      aggregation: {
        enabled: true,
        label: "Instance Total Throughput",
      },
      statistic: "Maximum",
    });

    const ebsOpsMaxWidget = new SAPLoadTestGraphWidget({
      title: "Instance IOPS",
      namespace: "AWS/EC2",
      metricNames: ["EBSReadOps", "EBSWriteOps"],
      region: region,
      sapSystem: props.sapSystem,
      period: cdk.Duration.seconds(60),
      width: 12,
      height: 6,
      aggregation: {
        enabled: true,
        label: "Instance Total Throughput",
      },
      statistic: "Maximum",
      annotations: [
        {
          label: "Max DB IOPS",
          value: 0,
        },
        {
          label: "Max SAP AS IOPS",
          value: 45557,
          visible: false,
        },
      ],
    });

    const networkInWidget = new SAPLoadTestGraphWidget({
      title: "NetworkIn",
      namespace: "AWS/EC2",
      metricNames: ["NetworkIn"],
      region: region,
      sapSystem: props.sapSystem,
      period: cdk.Duration.seconds(60),
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const networkOutWidget = new SAPLoadTestGraphWidget({
      title: "NetworkOut",
      namespace: "AWS/EC2",
      metricNames: ["NetworkOut"],
      region: region,
      sapSystem: props.sapSystem,
      period: cdk.Duration.seconds(60),
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const sapDialogReponseTypeWidget = new cloudwatch.GraphWidget({
      title: "Dialog Response Time",
      stacked: false,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      liveData: true,
      region: region,
      left: [
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "ST03_DIA_AVG_SNAP",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
        }),
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "ST03_DIA_AVG_SNAP",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
        }),
      ],
      leftAnnotations: [
        {
          label: "Critical Response Time",
          value: 1500,
          color: cloudwatch.Color.RED,
        },
      ],
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const sapSystemDumpsWidget = new cloudwatch.SingleValueWidget({
      title: "System Dumps",
      region: region,
      period: cdk.Duration.seconds(300),
      metrics: [
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "ST22_DUMPS",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
          label: "Dumps",
        }),
      ],
      width: 4,
      height: 3,
    });

    const rfcResponseTypeWidget = new cloudwatch.GraphWidget({
      title: "RFC Response Time",
      region: region,
      period: cdk.Duration.seconds(300),
      left: [
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "ST03_RFC_AVG_SNAP",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
        }),
      ],
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const pingWidget = new cloudwatch.GraphWidget({
      title: "Ping",
      region: region,
      period: cdk.Duration.seconds(300),
      left: [
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "PING",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
        }),
      ],
      width: 8,
      height: 3,
      statistic: "Maximum",
    });

    const sapDialogReponseTypeSingleWidget = new cloudwatch.SingleValueWidget({
      title: "Dialog Response Time",
      region: region,
      period: cdk.Duration.seconds(300),
      metrics: [
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "ST03_DIA_AVG_SNAP",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
          label: "Response Time (ms)",
        }),
      ],
      width: 5,
      height: 3,
    });

    const sapIdocsSingleWidget = new cloudwatch.SingleValueWidget({
      title: "Inbound Idocs",
      region: region,
      period: cdk.Duration.seconds(300),
      metrics: [
        new cloudwatch.Metric({
          namespace: "sap-monitor",
          metricName: "WE02_INBOUND",
          dimensionsMap: {
            bySID: props.sapSystem.sid,
          },
          label: "Inbound Idocs",
        }),
      ],
      width: 3,
      height: 3,
    });

    const k6VirtualUserWidget = new cloudwatch.GraphWidget({
      title: "K6 Virtual Users",
      region: region,
      period: cdk.Duration.seconds(300),
      left: [
        new cloudwatch.MathExpression({
          expression:
            "SEARCH('NOT Namespace=AWS Namespace=\"K6\" MetricName=\"k6_vus\"', 'Maximum', 300)",
          label: "K6 k6_vus",
        }),
        new cloudwatch.MathExpression({
          expression:
            "SEARCH('NOT Namespace=AWS Namespace=\"K6\" MetricName=\"k6_vus_max\"', 'Maximum', 300)",
          label: "K6 k6_vus_max",
        }),
      ],
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const k6ResponseTimeWidget = new cloudwatch.GraphWidget({
      title: "K6 Response Time",
      region: region,
      period: cdk.Duration.seconds(300),
      left: [
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_tls_handshaking\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_tls_handshaking",
        }),
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_sending\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_sending",
        }),

        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_connecting\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_connecting",
        }),
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_receiving\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_receiving",
        }),
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_blocked\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_blocked",
        }),
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_failed\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_failed",
        }),
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_req_waiting\"', 'Maximum', 300)`,
          label: "K6 k6_http_req_waiting",
        }),
      ],
      width: 24,
      height: 6,
      statistic: "Maximum",
    });

    const k6RequestsPerSecondsWidget = new cloudwatch.GraphWidget({
      title: "K6 Http Requests Per Second",
      region: region,
      period: cdk.Duration.seconds(300),
      left: [
        new cloudwatch.MathExpression({
          expression: `SEARCH('NOT Namespace=AWS MetricName=\"k6_http_reqs\"', 'Maximum', 300)`,
          label: "K6 k6_http_reqs",
        }),
      ],
      width: 12,
      height: 6,
      statistic: "Maximum",
    });

    const dashboard = new cloudwatch.Dashboard(this, id + "Dashboard", {
      dashboardName: props.dashboardName,
      widgets: [
        [
          new cloudwatch.Row(
            cpuSingleAvgWidget,
            cpuMemoryAvgWidget,
            sapDialogReponseTypeSingleWidget,
            sapIdocsSingleWidget,
            sapSystemDumpsWidget
          ),
          new cloudwatch.Row(k6VirtualUserWidget, k6RequestsPerSecondsWidget),
          new cloudwatch.Row(k6ResponseTimeWidget),
          new cloudwatch.Row(sapDialogReponseTypeWidget, rfcResponseTypeWidget),
          new cloudwatch.Row(cpuMaxWidget, memoryMaxWidget),
          new cloudwatch.Row(ebsBytesMaxWidget, ebsOpsMaxWidget),
          new cloudwatch.Row(networkInWidget, networkOutWidget),
        ],
      ],
    });
  }
}
