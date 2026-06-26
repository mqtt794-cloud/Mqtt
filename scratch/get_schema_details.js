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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

fetch(`${url}/rest/v1/`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => res.json())
.then(data => {
  console.log("=== Tables / Definitions ===");
  if (data.definitions) {
    for (const tableName of ['device_registry', 'devices', 'device_events']) {
      console.log(`\nTable: ${tableName}`);
      const def = data.definitions[tableName];
      if (def) {
        console.log("Properties:", Object.keys(def.properties));
        console.log("Required fields:", def.required);
        console.log("Details:", JSON.stringify(def.properties, null, 2));
      } else {
        console.log("Not found in definitions!");
      }
    }
  } else {
    console.log("No definitions found in OpenAPI spec.");
  }
})
.catch(err => {
  console.error("Fetch failed:", err);
});
