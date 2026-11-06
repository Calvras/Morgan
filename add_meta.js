const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const metaTags = `    <!-- Google Search Console Verification -->
    <meta name="google-site-verification" content="googlec3eb02de72e21254" />
    <meta name="google-site-verification" content="c3eb02de72e21254" />
`;

html = html.replace('<!-- Primary SEO -->', metaTags + '    <!-- Primary SEO -->');
html = html.replace('https://morgangoods.com/', 'https://morganappliance.online/');

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Successfully added Google verification meta tags to public/index.html');
