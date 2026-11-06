const https = require('https');
const fs = require('fs');

const tomlContent = fs.readFileSync('C:/Users/darka/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const token = tomlContent.match(/oauth_token\s*=\s*"([^"]+)"/)[1];
const ZONE_ID = '4274a17edd6fb3ba169d40036704338f';
const ACCOUNT_ID = '6731a2cf3ac3e76d3f399f505a7e5c11';

function apiRequest(method, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.cloudflare.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(extraHeaders || {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // List all DNS records to see what's there
  console.log('=== DNS Records ===');
  const dns = await apiRequest('GET', `/client/v4/zones/${ZONE_ID}/dns_records?per_page=100`, null);
  console.log('Status:', dns.status);
  if (dns.body.result) {
    dns.body.result.forEach(r => {
      console.log(`  ID:${r.id} ${r.type} ${r.name} -> ${r.content} (proxied:${r.proxied})`);
    });
  } else {
    console.log(JSON.stringify(dns.body).substring(0, 500));
  }
  
  // Try zone read with different scope
  console.log('\n=== Zone details ===');
  const zone = await apiRequest('GET', `/client/v4/zones/${ZONE_ID}`, null);
  console.log('Zone status:', zone.body.result?.status);
  console.log('Zone activated:', zone.body.result?.activated_on);
}

main().catch(console.error);
