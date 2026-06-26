const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://raw.githubusercontent.com/mobizt/Firebase-ESP32/master/examples/BasicCert/data/gtsr1.pem';
const dest = path.join(__dirname, 'cert_output.txt');

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
