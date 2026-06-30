#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import nextEnv from '@next/env';
import { createJiti } from 'jiti';

const projectRoot = process.cwd();
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectRoot);

process.env.SMARTHOME_MQTT_WORKER = '1';

const jiti = createJiti(import.meta.url);
const subscriberPath = path.join(projectRoot, 'src', 'lib', 'mqttSubscriber.ts');

console.log('[MQTT Worker] Starting persistent MQTT subscriber worker...');
console.log(`[MQTT Worker] pid=${process.pid}`);

const { initMqttSubscriber, stopMqttSubscriber } = await jiti.import(subscriberPath);
const started = await initMqttSubscriber();

if (!started) {
  console.error('[MQTT Worker] Subscriber did not start. Check environment and startup logs.');
  process.exit(1);
}

console.log('[MQTT Worker] Subscriber initialized. Waiting for MQTT messages...');

const shutdown = (signal) => {
  console.log(`[MQTT Worker] ${signal} received. Closing MQTT subscriber...`);
  stopMqttSubscriber();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[MQTT Worker] Unhandled rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('[MQTT Worker] Uncaught exception:', error);
  process.exit(1);
});
