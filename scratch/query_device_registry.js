const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Could not load .env.local file', e);
  process.exit(1);
}

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE URL or SERVICE ROLE KEY!");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Querying device_registry...");
  const { data: registry, error: regError } = await supabase
    .from('device_registry')
    .select('*');
    
  if (regError) {
    console.error("Error querying device_registry:", regError.message);
  } else {
    console.log("device_registry rows count:", registry.length);
    console.log("device_registry rows:", registry);
  }

  console.log("\nQuerying devices...");
  const { data: devices, error: devError } = await supabase
    .from('devices')
    .select('*');
    
  if (devError) {
    console.error("Error querying devices:", devError.message);
  } else {
    console.log("devices rows count:", devices.length);
    console.log("devices rows:", devices);
  }
}

run();
