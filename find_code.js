const fs = require('fs');
const js = fs.readFileSync('public/assets/index-B7yQPykp.js', 'utf8');

const needle = 'initialize-payment';
const pos = js.indexOf(needle);
console.log('Found needle at:', pos);
if (pos !== -1) {
  const start = js.lastIndexOf('onSuccess:', pos);
  const end = js.indexOf('catch(et)', pos);
  console.log('--- START TO END ---');
  console.log(js.substring(start, end + 85));
}
