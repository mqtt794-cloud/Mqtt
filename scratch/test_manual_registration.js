const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// 1. Load env vars
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

const supabaseAdmin = createClient(url, key);

// Constant-time secure comparison helper
const compareSecure = (a, b) => {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

async function cleanDevice(deviceId) {
  console.log(`[CLEANUP] Cleaning up device ${deviceId}...`);
  await supabaseAdmin.from('relays').delete().eq('device_id', deviceId);
  await supabaseAdmin.from('devices').delete().eq('device_id', deviceId);
  await supabaseAdmin.from('device_registry').delete().eq('device_id', deviceId);
}

async function testClaimDevice(homeId, deviceId, secret, deviceName) {
  const normDeviceId = deviceId.trim().toUpperCase();
  const normSecret = secret.trim();

  // 1. Fetch registry
  console.log(`[TEST][LOOKUP] Looking up ${normDeviceId}`);
  const { data: registryItem, error: registryError } = await supabaseAdmin
    .from('device_registry')
    .select('*')
    .eq('device_id', normDeviceId)
    .maybeSingle();

  let targetRegistryItem = registryItem;

  if (registryError) {
    return { error: 'Database error occurred.' };
  }

  // 2. Fallback Register
  if (!targetRegistryItem) {
    console.log(`[TEST][INSERT] Registering new device ${normDeviceId}`);
    const inputHash = crypto.createHash('sha256').update(normSecret).digest('hex');
    const { data: insertedItem, error: insertError } = await supabaseAdmin
      .from('device_registry')
      .insert({
        device_id: normDeviceId,
        device_secret_hash: inputHash,
        model: '2CH_RELAY',
        claimed: false
      })
      .select('*')
      .single();

    if (insertError) {
      return { error: 'Failed to register the new device.' };
    }
    targetRegistryItem = insertedItem;
  }

  if (targetRegistryItem.claimed) {
    return { error: 'This device has already been claimed.' };
  }

  // 3. Verify Secret
  const inputHash = crypto.createHash('sha256').update(normSecret).digest('hex');
  const isMatch = compareSecure(inputHash, targetRegistryItem.device_secret_hash) ||
                  compareSecure(normSecret, targetRegistryItem.device_secret_hash);

  if (!isMatch) {
    return { error: 'Invalid Device ID or Device Secret' };
  }

  console.log(`[TEST][CLAIM] Claiming device ${normDeviceId}`);
  const { error: updateRegistryError } = await supabaseAdmin
    .from('device_registry')
    .update({ claimed: true })
    .eq('device_id', normDeviceId);

  if (updateRegistryError) {
    return { error: 'Database update failed.' };
  }

  // Insert device record
  const { error: insertDeviceError } = await supabaseAdmin
    .from('devices')
    .insert({
      home_id: homeId,
      device_id: normDeviceId,
      device_name: deviceName.trim(),
      model: targetRegistryItem.model
    });

  if (insertDeviceError) {
    await supabaseAdmin.from('device_registry').update({ claimed: false }).eq('device_id', normDeviceId);
    return { error: insertDeviceError.message };
  }

  // Seed relays
  const numRelaysToSeed = targetRegistryItem.model === '2CH_RELAY' ? 2 : 4;
  const relayRows = [];
  for (let i = 1; i <= numRelaysToSeed; i++) {
    relayRows.push({
      device_id: normDeviceId,
      relay_number: i,
      relay_name: `Relay ${i}`,
      current_state: false
    });
  }

  await supabaseAdmin.from('relays').insert(relayRows);
  return { success: true };
}

async function runTests() {
  const TEST_DEVICE_ID = 'TEST_FALLBACK_001';
  const TEST_SECRET = 'SECRET_TEST_123';
  const TEST_WRONG_SECRET = 'WRONG_SECRET';
  
  // Fetch a valid homeId
  const { data: homes } = await supabaseAdmin.from('homes').select('id').limit(1);
  if (!homes || homes.length === 0) {
    console.error("Please create a home on the dashboard first to run this test.");
    process.exit(1);
  }
  const homeId = homes[0].id;

  console.log("Starting database fallback verification tests...");
  await cleanDevice(TEST_DEVICE_ID);

  // --- CASE 2: Device does not exist in registry ---
  console.log("\n--- Case 2: Missing device manual registration ---");
  const res1 = await testClaimDevice(homeId, TEST_DEVICE_ID, TEST_SECRET, 'Test Device Fallback');
  console.log("Result (Expected: Success):", res1);

  // --- CASE 4: Already claimed ---
  console.log("\n--- Case 4: Already claimed device registration ---");
  const res2 = await testClaimDevice(homeId, TEST_DEVICE_ID, TEST_SECRET, 'Test Device Fallback');
  console.log("Result (Expected: Already claimed error):", res2);

  // Clean device to test existed-but-unclaimed scenarios
  await cleanDevice(TEST_DEVICE_ID);

  // Seed device in registry as unclaimed
  const seedHash = crypto.createHash('sha256').update(TEST_SECRET).digest('hex');
  await supabaseAdmin.from('device_registry').insert({
    device_id: TEST_DEVICE_ID,
    device_secret_hash: seedHash,
    model: '2CH_RELAY',
    claimed: false
  });

  // --- CASE 3: Wrong secret ---
  console.log("\n--- Case 3: Wrong secret rejection ---");
  const res3 = await testClaimDevice(homeId, TEST_DEVICE_ID, TEST_WRONG_SECRET, 'Test Device Fallback');
  console.log("Result (Expected: Invalid Device ID or Device Secret):", res3);

  // --- CASE 1: Device exists unclaimed -> claim succeeds ---
  console.log("\n--- Case 1: Existing unclaimed device registration ---");
  const res4 = await testClaimDevice(homeId, TEST_DEVICE_ID, TEST_SECRET, 'Test Device Fallback');
  console.log("Result (Expected: Success):", res4);

  // Cleanup test data
  await cleanDevice(TEST_DEVICE_ID);
  console.log("\nTests complete.");
}

runTests();
