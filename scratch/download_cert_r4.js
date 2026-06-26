const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://pki.goog/repo/certs/gtsr4.pem';
const dest = path.join(__dirname, 'cert_output_r4.txt');

https.get(url, (res) => {
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download complete, size:', fs.statSync(dest).size);
  });
}).on('error', (err) => {
  console.error(err);
});
