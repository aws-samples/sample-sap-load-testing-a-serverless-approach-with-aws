import http from 'k6/http';
import { check } from 'k6';
import encoding from 'k6/encoding';
import secrets from 'k6/secrets';

//get information from secret

const username = await secrets.get('username');
const password = await secrets.get('password');
// const sapBaseURL = await secrets.get('sapBaseUrl');
const sapBaseUrl = __ENV.SAP_BASE_URL

// Test configuration
export const options = {
  vus: 30,
  duration: '100s',
};

export default function () {
    // Encode credentials properly
    const credentials = encoding.b64encode(`${username}:${password}`)
    
    const url = `${sapBaseUrl}/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrderItem?$format=json&$top=1000&?sap-client=800`;
    
    const params = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${credentials}`,
            'x-csrf-token': 'fetch'  // SAP specific header for CSRF token
        }
    };

    const response = http.get(url, params);
    

    console.log(`Status: ${response.status}`);
    console.log(`Response Headers: ${JSON.stringify(response.headers)}`);
     // Body logging
    //console.log('Response Body:');
    //console.log('----------------------------------------');
    //console.log(response.body);
    //console.log('----------------------------------------'); 
    console.log(`Body length: ${response.body.length} bytes`)
    
    
}