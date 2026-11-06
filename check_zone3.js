const https = require('https');
const fs = require('fs');

const tomlContent = fs.readFileSync('C:/Users/darka/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const token = tomlContent.match(/oauth_token\s*=\s*"([^"]+)"/)[1];

// Use the CORRECT zone ID from the third account
const ZONE_ID = '259a9017cd904c5b97c22303478ba7fb';
const ACCOUNT_ID = '93b260554f62de4f85218ef490a9d03a';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: path,
      headers: { 'Authorization': 'Bearer ' + token }
    };
    https.get(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Checking zone status...');
  const zone = await apiGet(`/client/v4/zones/${ZONE_ID}`);
  console.log('Zone status:', zone.body.result?.status);
  console.log('Zone activated:', zone.body.result?.activated_on);
  console.log('HTTP status:', zone.status);
  
  if (zone.status === 200) {
    console.log('\nChecking security level...');
    const sec = await apiGet(`/client/v4/zones/${ZONE_ID}/settings/security_level`);
    console.log('Security level:', sec.body.result?.value);
    
    console.log('\nChecking bot fight mode...');
    const bot = await apiGet(`/client/v4/zones/${ZONE_ID}/bot_management`);
    console.log('Bot management:', JSON.stringify(bot.body.result).substring(0, 300));
    
    console.log('\nChecking DNS records...');
    const dns = await apiGet(`/client/v4/zones/${ZONE_ID}/dns_records`);
    if (dns.body.result) {
      dns.body.result.forEach(r => {
        console.log(`  ${r.type} ${r.name} -> ${r.content} (proxied:${r.proxied})`);
      });
    }
  }
}

main().catch(console.error);
