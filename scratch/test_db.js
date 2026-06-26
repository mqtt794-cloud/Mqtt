const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

async function run() {
  console.log("=== Checking Triggers on device_registry ===");
  const { data: triggers, error: triggerError } = await supabase.rpc('inspect_triggers', {});
  if (triggerError) {
    // If inspect_triggers RPC doesn't exist, we can use a direct SQL via REST if possible, or just query pg_trigger if we can.
    // Let's try querying pg_catalog via REST using fetch.
    console.log("RPC inspect_triggers failed, trying raw REST query...");
    
    // We can fetch from pg_catalog via REST if exposed, but usually it's not.
    // Let's try querying using a custom sql function or check if we can query it directly.
  } else {
    console.log("Triggers:", triggers);
  }

  // Let's query policies using REST API (by querying pg_policies if exposed)
  console.log("=== Fetching pg_policies (if exposed) ===");
  fetch(`${url}/rest/v1/pg_policies`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log("Policies:", data);
  })
  .catch(err => {
    console.log("Policies fetch failed (expected if not exposed):", err.message);
  });
}

run();
