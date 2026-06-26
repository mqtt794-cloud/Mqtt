const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
let envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    process.env[key] = value.trim();
  }
});

const brokerUrl = process.env.MQTT_BROKER_URL;
const username  = process.env.MQTT_USERNAME;
const password  = process.env.MQTT_PASSWORD;

if (!brokerUrl) {
  console.error("Missing MQTT_BROKER_URL");
  process.exit(1);
}

const client = mqtt.connect(brokerUrl, {
  username,
  password,
  rejectUnauthorized: true,
});

client.on('connect', () => {
  console.log("Connected to MQTT broker!");
  const payload = {
    deviceId: "ESP001",
    deviceSecret: "X7K29A",
    register: true,
    model: "2CH_RELAY",
    firmware: "1.0.0",
    online: true
  };
  
  const topic = "home/ESP001/status";
  console.log(`Publishing to ${topic}:`, payload);
  client.publish(topic, JSON.stringify(payload), { qos: 1, retain: true }, (err) => {
    if (err) {
      console.error("Publish failed:", err);
    } else {
      console.log("Publish success!");
    }
    client.end();
  });
});

client.on('error', (err) => {
  console.error("MQTT Error:", err);
});
