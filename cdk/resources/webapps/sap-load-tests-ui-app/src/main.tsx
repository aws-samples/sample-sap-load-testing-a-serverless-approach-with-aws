import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";

import App from "./App.tsx";
import { AuthProvider } from "react-oidc-context";
import config from "./confg.ts";
import React from "react";

const cognitoAuthConfig = {
  authority: config.cognitoAuthority,
  client_id: config.clientId,
  redirect_uri: config.cognitoRedirectUri,
  response_type: "code",
  scope: "openid profile saploadtests/full",
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  },
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
