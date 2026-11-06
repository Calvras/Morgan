const https = require('https');
const fs = require('fs');

// Read wrangler oauth token
const tomlContent = fs.readFileSync('C:/Users/darka/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
console.log('Config preview:', tomlContent.substring(0, 300));

const tokenMatch = tomlContent.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!tokenMatch) {
  console.log('No oauth_token found');
  // Try access_token
  const accessMatch = tomlContent.match(/api_token\s*=\s*"([^"]+)"/);
  if (accessMatch) console.log('Found api_token:', accessMatch[1].substring(0, 20) + '...');
  process.exit(1);
}

const token = tokenMatch[1];
console.log('Token found:', token.substring(0, 20) + '...');

const options = {
  hostname: 'api.cloudflare.com',
  path: '/client/v4/zones?name=morganappliance.online',
  headers: { 'Authorization': 'Bearer ' + token }
};

https.get(options, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    if (j.result && j.result.length > 0) {
      const zone = j.result[0];
      console.log('Zone ID:', zone.id);
      console.log('Status:', zone.status);
      console.log('Paused:', zone.paused);
      console.log('Activated:', zone.activated_on);
      console.log('Plan:', zone.plan?.name);
    } else {
      console.log(JSON.stringify(j));
    }
  });
}).on('error', e => console.error(e));
