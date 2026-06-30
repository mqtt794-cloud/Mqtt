const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(url, key);

async function run() {
  console.log("Querying pg_policies for device_registry...");
  const { data, error } = await supabase.rpc('inspect_table_policies', { table_name: 'device_registry' });
  if (error) {
    // If RPC doesn't exist, we run a direct query via SQL RPC or just select from pg_policies using an ad-hoc query
    console.log("RPC inspect_table_policies failed, checking policies by direct query...");
    const { data: policies, error: polErr } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'device_registry');
      
    if (polErr) {
      console.error("Failed to query policies:", polErr.message);
    } else {
      console.log("Policies:", policies);
    }
  } else {
    console.log("Policies:", data);
  }
  
  // Let's also check if RLS is enabled
  const { data: rlsStatus, error: rlsErr } = await supabase
    .rpc('check_rls_status', { target_table: 'device_registry' });
  if (!rlsErr) {
    console.log("RLS Status:", rlsStatus);
  }
}

run();
