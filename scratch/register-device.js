/**
 * =============================================================================
 * register-device.js — Scratch script to generate SQL inserts with hashed secrets
 * =============================================================================
 *
 * PATH:
 *   scratch/register-device.js
 *
 * PURPOSE:
 *   Device secrets should never be stored in plain text. This script takes a
 *   Device ID and plain text secret, generates the SHA-256 hash, and outputs
 *   the SQL insert query you can run directly inside Supabase SQL Editor.
 *
 * USAGE:
 *   node register-device.js <device_id> <plain_text_secret>
 *
 * EXAMPLE:
 *   node register-device.js ESP001 X7K29A
 * =============================================================================
 */

const crypto = require('crypto');

// Read command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('\n❌ Error: Missing parameters.');
  console.log('Usage:   node register-device.js <device_id> <plain_text_secret>');
  console.log('Example: node register-device.js ESP001 X7K29A\n');
  process.exit(1);
}

const deviceId = args[0];
const plainSecret = args[1];

// Hash the secret using SHA-256 (matches the backend hashing during claims)
const hash = crypto.createHash('sha256').update(plainSecret).digest('hex');

console.log('\n======================================================================');
console.log('                    SmartHome Device Pre-Registration');
console.log('======================================================================');
console.log(`Device ID:      ${deviceId}`);
console.log(`Plain Secret:   ${plainSecret}`);
console.log(`SHA-256 Hash:   ${hash}`);
console.log('----------------------------------------------------------------------');
console.log('COPY AND RUN THIS SQL STATEMENT IN SUPABASE SQL EDITOR:');
console.log('----------------------------------------------------------------------');
console.log(`
INSERT INTO device_registry (device_id, device_secret_hash, model, claimed)
VALUES ('${deviceId}', '${hash}', '4CH_RELAY', false)
ON CONFLICT (device_id) DO UPDATE 
SET device_secret_hash = EXCLUDED.device_secret_hash, claimed = false;
`);
console.log('======================================================================\n');
