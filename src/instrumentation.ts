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
    console.log('[Instrumentation] Bootstrap detected. Starting MQTT subscriber service...');

    try {
      const { initMqttSubscriber } = await import('./lib/mqttSubscriber');
      await initMqttSubscriber();
      console.log('[Instrumentation] MQTT subscriber background thread initialized.');
    } catch (error) {
      console.error('[Instrumentation] WARNING: Failed to initialize MQTT subscriber:', error);
    }
  }
}
