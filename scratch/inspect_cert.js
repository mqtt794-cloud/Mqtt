const tls = require('tls');

const domain = 'zetgguaecsboqciuxwjc.supabase.co';
console.log(`Connecting to ${domain}:443 to inspect certificate...`);

const socket = tls.connect(443, domain, { servername: domain }, () => {
  const cert = socket.getPeerCertificate();
  console.log('Certificate Issuer:');
  console.log(cert.issuer);
  console.log('\nDetailed peer certificate:');
  console.log(`Subject: ${cert.subject.CN}`);
  console.log(`Issuer: ${cert.issuer.CN}`);
  console.log(`Valid From: ${cert.valid_from}`);
  console.log(`Valid To: ${cert.valid_to}`);
  socket.destroy();
});

socket.on('error', (err) => {
  console.error('Socket error:', err);
});
