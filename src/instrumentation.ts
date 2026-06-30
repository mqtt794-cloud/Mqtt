/**
 * =============================================================================
 * instrumentation.ts — Next.js 15 Startup Hook
 * =============================================================================
 *
 * PURPOSE:
 *   Next.js runs the `register()` function defined in this file exactly once
 *   when the server boots up. This is the official entrypoint for starting
 *   background listeners, workers, or establishing persistent database pools.
 *
 * HOW IT WORKS:
 *   - Checks if the current execution environment is 'nodejs' (since Next.js
 *     can compile routes for both Node and Edge environments).
 *   - Dynamically imports `mqttSubscriber` and calls `initMqttSubscriber()`
 *     to start the background MQTT listening client.
 * =============================================================================
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[BOOT] Next.js Server startup hook register() entered. Initializing MQTT subscriber service...');

    try {
      const { initMqttSubscriber } = await import('./lib/mqttSubscriber');
      const started = await initMqttSubscriber();
      console.log(started
        ? '[REGISTER] MQTT subscriber initialized.'
        : '[REGISTER] MQTT subscriber did not start. Check earlier diagnostics.');
    } catch (error) {
      console.error('[REGISTER] WARNING: Failed to initialize MQTT subscriber:', error);
    }
  }
}
