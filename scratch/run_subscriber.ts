import { initMqttSubscriber } from '../src/lib/mqttSubscriber';
import fs from 'fs';
import path from 'path';

// Load environment variables manually from .env.local
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

async function main() {
  console.log("Starting subscriber...");
  await initMqttSubscriber();
}
main();
