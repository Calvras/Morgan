const https = require('https');
const fs = require('fs');

const tomlContent = fs.readFileSync('C:/Users/darka/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const token = tomlContent.match(/oauth_token\s*=\s*"([^"]+)"/)[1];

// Check the zone in the THIRD account using the zone ID we know
// The third account zone ID - let's find it first
function apiRequest(path) {
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
  // The zenithzone18 zone ID we know
  const ZONE_ID = '4274a17edd6fb3ba169d40036704338f';
  
  // Check security settings
  console.log('=== Security Level ===');
  const sec = await apiRequest(`/client/v4/zones/${ZONE_ID}/settings/security_level`);
  console.log('Security level:', JSON.stringify(sec.body));
  
  // Check bot fight mode
  console.log('\n=== Bot Fight Mode ===');
  const bot = await apiRequest(`/client/v4/zones/${ZONE_ID}/bot_management`);
  console.log('Bot management:', JSON.stringify(bot.body).substring(0, 300));
  
  // Check firewall rules
  console.log('\n=== Firewall Rules ===');
  const fw = await apiRequest(`/client/v4/zones/${ZONE_ID}/firewall/rules`);
  console.log('Firewall:', JSON.stringify(fw.body).substring(0, 500));
}

main().catch(console.error);
