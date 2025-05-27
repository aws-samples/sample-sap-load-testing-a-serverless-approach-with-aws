import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     headers: {
//       "Content-Security-Policy": `
//         default-src 'self';
//         script-src 'self' 'unsafe-inline' 'unsafe-eval';
//         style-src 'self' 'unsafe-inline';
//         connect-src 'self'
//         https://cognito-idp.us-east-1.amazonaws.com/us-east-1_WRxW7Rept
//         saploadtests-domain-060190671092
//         https://vq1p1zyn7e.execute-api.us-east-1.amazonaws.com/api/
//         https://*.execute-api.*.amazonaws.com/;
//         img-src 'self' data:;
//         font-src 'self' data:;
//         object-src 'none';
//         base-uri 'self';`
//         .replace(/\s+/g, " ")
//         .trim(),
//     },
//   },
// });
