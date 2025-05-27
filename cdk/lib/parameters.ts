export interface SAPApplicationNodeProps {
  instanceId: string;
  hostname?: string;
  systemNumber?: string;
}
export interface SAPDatabaseNodeProps {
  instanceId: string;
  port: string;
  dbName: string;
}

export interface SAPSystemProps {
  sid: string;
  client: string;
  appNodes: SAPApplicationNodeProps[];
  baseUrl: string;
  dbNode: SAPDatabaseNodeProps;
}

export interface CloudWatchDashboardProps {
  dashboardName: string;
  sapSystem: SAPSystemProps;
}
