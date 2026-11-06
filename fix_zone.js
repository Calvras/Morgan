const https = require('https');
const fs = require('fs');

const tomlContent = fs.readFileSync('C:/Users/darka/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const token = tomlContent.match(/oauth_token\s*=\s*"([^"]+)"/)[1];
const ZONE_ID = '4274a17edd6fb3ba169d40036704338f';
const ACCOUNT_ID = '6731a2cf3ac3e76d3f399f505a7e5c11';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.cloudflare.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Try to activate the zone via check nameservers
  console.log('=== 1. Checking nameservers / triggering activation ===');
  const nsCheck = await apiRequest('PUT', `/client/v4/zones/${ZONE_ID}/activation_check`, {});
  console.log('NS Check status:', nsCheck.status);
  console.log('NS Check result:', JSON.stringify(nsCheck.body));

  // 2. Try to connect worker custom domain
  console.log('\n=== 2. Connecting Worker custom domain ===');
  const domainConnect = await apiRequest('PUT', `/client/v4/accounts/${ACCOUNT_ID}/workers/domains`, {
    hostname: 'morganappliance.online',
    service: 'morgan',
    environment: 'production',
    zone_id: ZONE_ID
  });
  console.log('Domain connect status:', domainConnect.status);
  console.log('Domain connect result:', JSON.stringify(domainConnect.body).substring(0, 500));

  // 3. Check if DNS record exists for the custom domain
  console.log('\n=== 3. Listing DNS records ===');
  const dnsRecords = await apiRequest('GET', `/client/v4/zones/${ZONE_ID}/dns_records`, null);
  console.log('DNS records status:', dnsRecords.status);
  if (dnsRecords.body.result) {
    dnsRecords.body.result.forEach(r => {
      console.log(`  ${r.type} ${r.name} -> ${r.content}`);
    });
  }
}

main().catch(console.error);
