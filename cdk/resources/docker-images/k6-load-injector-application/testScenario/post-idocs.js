import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import encoding from 'k6/encoding';
import secrets from 'k6/secrets';


//get information from secret
const username = await secrets.get('username');
const password = await secrets.get('password');
const sapClient = await secrets.get('sapClient');
//get baseUrl from environment variable
const sapBaseUrl = __ENV.SAP_BASE_URL
//set the sap client in url parameter
let sapClientStringParameter=""
if (sapClient.match(/^[0-9]{3}$/)) {
    sapClientStringParameter=`?sap-client=${sapClient}`
}

// define your url path
const urlPath="/sap/bc/idoc_xml"
//build the final url
const url = `${sapBaseUrl}${urlPath}${sapClientStringParameter}`;


//start your load test logic

const xmlfile = open('./sample_idoc_ID1.xml');
const todayDate = new Date().toISOString().slice(0, 10);
const newDate = todayDate.replace("-","")


export const successRate = new Rate('success');

export const options = {
  vus: 5,
  duration: '60s',
  insecureSkipTLSVerify: true,
};

export default function () {
    const data = getAndConvertIdocXml();
    const credentials = `${username}:${password}`;
    const encodedCredentials = encoding.b64encode(credentials);

    const httpOptions = {
        headers: {
          Authorization: `Basic ${encodedCredentials}`,
          "Content-Type": 'text/xml'
        },
      };

  check(http.post(url, data, httpOptions), {
    'status is 200': (r) => r.status == 200,
  }) || successRate.add(1);

  sleep(5);
}


function getAndConvertIdocXml() {
    let result = xmlfile.replace("{{GENERATED_IDOC_NUMBER}}", Math.floor(Math.random() * 100000000000000))
    result  = result.replace("{{GENERATED_MESSAGE_ID}}", Math.floor(Math.random() * 100000000000000))
    result  = result.replace("{{GENERATED_DATE}}", newDate)
    result  = result.replace("{{GENERATED_PRICE_DATE}}", newDate)
    return result
  }
