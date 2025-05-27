// src/types/LoadTest.ts

interface LoadTest {
  executionId: string;
  name: string;
  sapSID: string;
  testType: string;
  testName: string;
  storeMetricsInS3: boolean;
  stateMachineExecutionArn: string;
  stateMachineArn: string;
  status: "SUCCEEDED" | "FAILED" | "RUNNING" | "UNKNOWN";
  startDate: Date;
  stopDate: Date;
  duration: number;
  dashboardLink: string;

  // metrics?: {
  //   virtualUsers: number;
  //   responseTime: number;
  //   errorRate: number;
  // };
}

export default LoadTest;
