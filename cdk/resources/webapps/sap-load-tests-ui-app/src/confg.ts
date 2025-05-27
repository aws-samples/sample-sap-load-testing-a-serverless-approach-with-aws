// config.ts
interface Config {
  restApiBaseEndpoint: string;
  cognitoDomain: string;
  cognitoAuthority: string;
  cognitoRedirectUri: string;
  cognitoLogoutUri: string;
  clientId: string;
  region: string;
}

const config: Config = {
  restApiBaseEndpoint: import.meta.env.VITE_REST_API_BASE_ENDPOINT || "",
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN || "",
  cognitoAuthority: import.meta.env.VITE_COGNITO_AUTHORITY || "",
  cognitoRedirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || "",
  cognitoLogoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI || "",
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  region: import.meta.env.VITE_REGION || "",
};

export default config;
