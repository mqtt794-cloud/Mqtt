const tls = require('tls');

const domain = 'zetgguaecsboqciuxwjc.supabase.co';
console.log(`Connecting to ${domain}:443 to inspect entire cert chain...`);

const socket = tls.connect(443, domain, { servername: domain }, () => {
  let cert = socket.getPeerCertificate(true); // get detailed chain
  console.log('=== Certificate Chain ===');
  while (cert) {
    console.log(`Subject: ${cert.subject.CN || cert.subject.O}`);
    console.log(`Issuer:  ${cert.issuer.CN || cert.issuer.O}`);
    if (cert.issuerCertificate && cert.issuerCertificate !== cert) {
      cert = cert.issuerCertificate;
    } else {
      break;
    }
  }
  socket.destroy();
});

socket.on('error', (err) => {
  console.error('Socket error:', err);
});
