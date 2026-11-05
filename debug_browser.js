const puppeteer = require('puppeteer-core');

async function test() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log('HTTP ERROR RESP:', resp.status(), resp.url());
    } else {
      console.log('RESP:', resp.status(), resp.url());
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE ERROR STACK:', err.stack || err.toString());
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 5000 });
  } catch (e) {
    console.log('Goto error:', e.message);
  }

  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
}

test().catch(console.error);
