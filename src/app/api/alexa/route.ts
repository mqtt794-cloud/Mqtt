/**
 * =============================================================================
 * src/app/api/alexa/route.ts — Alexa Smart Home Directive Webhook Endpoint
 * =============================================================================
 *
 * PATH:
 *   POST /api/alexa
 *
 * PURPOSE:
 *   Acts as the central webhook endpoint that receives JSON requests from the
 *   AWS Lambda function representing your Alexa Smart Home Skill.
 *
 * SECURITY ENFORCEMENT (Improvement 5):
 *   1. Extracts the bearer access token directly from the JSON body (Alexa does
 *      not pass it in the HTTP headers).
 *   2. Validates it via `validateAccessToken(token)` (checking DB record and expiry).
 *   3. If invalid/expired, returns a compliant Alexa `INVALID_AUTHORIZATION_CREDENTIAL`
 *      error payload instead of an HTTP 401. This tells Alexa to prompt the user
 *      to re-authenticate.
 *   4. scopes all queries and control commands to the resolved database `user_id`,
 *      making it multi-user compatible.
 * =============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { getAlexaEndpoints } from "@/lib/alexa/discovery";
import { handleAlexaPowerControl } from "@/lib/alexa/powerController";
import { validateAccessToken } from "@/lib/alexa/tokenValidation";
import { AlexaDirective, AlexaResponse } from "@/lib/alexa/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AlexaDirective;

    // Log the incoming directive so you can debug what Alexa is sending
    console.log("[Alexa Route] Received Directive:", JSON.stringify(body, null, 2));

    const header = body?.directive?.header;
    if (!header) {
      return NextResponse.json(createErrorResponse("Alexa", "InvalidDirective", "Directive header is missing"));
    }

    const { namespace, name } = header;

    // ── Extract Token from Directive Payload ─────────────────────────────────
    // Alexa places the OAuth access token inside the JSON body, depending on action:
    //   - Discovery: body.directive.payload.scope.token
    //   - Control / State Report: body.directive.endpoint.scope.token
    const token = body?.directive?.payload?.scope?.token || body?.directive?.endpoint?.scope?.token;
    
    // Validate token against DB
    const userId = await validateAccessToken(token);

    if (!userId) {
      console.warn(`[Alexa Route] Rejecting request: Invalid or expired OAuth token.`);
      
      // Return Alexa Smart Home compatible Authorization error payload (Improvement 5)
      return NextResponse.json({
        event: {
          header: {
            namespace: "Alexa",
            name: "ErrorResponse",
            payloadVersion: "3",
            messageId: crypto.randomUUID(),
          },
          payload: {
            type: "INVALID_AUTHORIZATION_CREDENTIAL",
            message: "Access token is invalid, expired, or missing. Please re-link your account in the Alexa app."
          }
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  1. DEVICE DISCOVERY DIRECTIVE (Alexa.Discovery::Discover)
    // ─────────────────────────────────────────────────────────────────────────
    if (namespace === "Alexa.Discovery" && name === "Discover") {
      // Scoped dynamically to the validated user
      const endpoints = await getAlexaEndpoints(userId);

      const response: AlexaResponse = {
        event: {
          header: {
            namespace: "Alexa.Discovery",
            name: "Discover.Response",
            payloadVersion: "3",
            messageId: crypto.randomUUID(),
          },
          payload: {
            endpoints: endpoints,
          },
        },
      };

      return NextResponse.json(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  2. POWER CONTROL DIRECTIVE (Alexa.PowerController::TurnOn / TurnOff)
    // ─────────────────────────────────────────────────────────────────────────
    if (namespace === "Alexa.PowerController") {
      const endpointId = body?.directive?.endpoint?.endpointId;
      const cookie = body?.directive?.endpoint?.cookie; // Echoed back from discovery!

      console.log(`[Alexa Route] Power control request for endpoint: ${endpointId}`, { name, cookie });

      // We extract deviceId and relayNumber directly from the cookie we saved during discovery!
      const deviceId = cookie?.deviceId;
      const relayNumber = cookie?.relayNumber ? parseInt(cookie.relayNumber, 10) : null;

      if (!deviceId || !relayNumber) {
        return NextResponse.json(createErrorResponse("Alexa", "NoSuchEndpoint", "Endpoint configuration cookie not found"));
      }

      const turnOn = name === "TurnOn";

      // Dispatch command through our power controller service scoped to this user
      const result = await handleAlexaPowerControl(userId, deviceId, relayNumber, turnOn);

      if (!result.success) {
        // Return standard Alexa error payload if the command failed to send
        return NextResponse.json(createErrorResponse("Alexa", "InternalError", "Failed to dispatch control command to the smart-home device"));
      }

      // Map dynamic device online status to Alexa connectivity:
      // "OK" if online is true, "UNREACHABLE" if online is false.
      const connectivityValue = result.online ? "OK" : "UNREACHABLE";
      const powerStateValue = turnOn ? "ON" : "OFF";

      // Return standard response confirming successful control with active properties
      const response: AlexaResponse = {
        context: {
          properties: [
            // 1. Report the new powerState (Immediate Alexa State Update)
            {
              namespace: "Alexa.PowerController",
              name: "powerState",
              value: powerStateValue,
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 500
            },
            // 2. Report EndpointHealth connectivity status
            {
              namespace: "Alexa.EndpointHealth",
              name: "connectivity",
              value: {
                value: connectivityValue
              },
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 500
            }
          ]
        },
        event: {
          header: {
            namespace: "Alexa",
            name: "Response",
            payloadVersion: "3",
            messageId: crypto.randomUUID(),
            correlationToken: header.correlationToken
          },
          endpoint: {
            endpointId: endpointId!
          },
          payload: {}
        }
      };

      return NextResponse.json(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  3. STATE REPORT DIRECTIVE (Alexa::ReportState)
    // ─────────────────────────────────────────────────────────────────────────
    if (namespace === "Alexa" && name === "ReportState") {
      const endpointId = body?.directive?.endpoint?.endpointId;
      const cookie = body?.directive?.endpoint?.cookie;

      console.log(`[Alexa Route] ReportState request for endpoint: ${endpointId}`, cookie);

      const deviceId = cookie?.deviceId;
      const relayNumber = cookie?.relayNumber ? parseInt(cookie.relayNumber, 10) : null;

      if (!deviceId || !relayNumber) {
        return NextResponse.json(createErrorResponse("Alexa", "NoSuchEndpoint", "Endpoint configuration cookie not found"));
      }

      // Query database for current relay state and device online status
      const { supabaseAdmin } = await import("@/lib/supabase");
      const { data: relayRecord, error: dbError } = await supabaseAdmin
        .from('relays')
        .select('current_state, devices(online, homes(user_id))')
        .eq('device_id', deviceId)
        .eq('relay_number', relayNumber)
        .single();

      if (dbError || !relayRecord) {
        console.error(`[Alexa Route] Failed to fetch state for device ${deviceId} relay ${relayNumber}:`, dbError?.message);
        return NextResponse.json(createErrorResponse("Alexa", "NoSuchEndpoint", "Device or relay not found"));
      }

      const device = relayRecord.devices as any;
      const homes = device?.homes as any;
      if (homes?.user_id !== userId) {
        console.warn(`[Alexa Route] Security warning: User ${userId} unauthorized for device ${deviceId}`);
        return NextResponse.json(createErrorResponse("Alexa", "NoSuchEndpoint", "Access denied"));
      }

      const powerStateValue = relayRecord.current_state ? "ON" : "OFF";
      const connectivityValue = device?.online ? "OK" : "UNREACHABLE";

      const response: AlexaResponse = {
        context: {
          properties: [
            {
              namespace: "Alexa.PowerController",
              name: "powerState",
              value: powerStateValue,
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 500
            },
            {
              namespace: "Alexa.EndpointHealth",
              name: "connectivity",
              value: {
                value: connectivityValue
              },
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 500
            }
          ]
        },
        event: {
          header: {
            namespace: "Alexa",
            name: "StateReport",
            payloadVersion: "3",
            messageId: crypto.randomUUID(),
            correlationToken: header.correlationToken
          },
          endpoint: {
            endpointId: endpointId!
          },
          payload: {}
        }
      };

      return NextResponse.json(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  4. FALLBACK ERROR RESPONSE for unhandled namespaces
    // ─────────────────────────────────────────────────────────────────────────
    console.warn(`[Alexa Route] Unhandled directive namespace/name: ${namespace}/${name}`);
    return NextResponse.json(createErrorResponse("Alexa", "UnsupportedDirective", `Directive ${namespace}::${name} is not supported`));

  } catch (err: any) {
    console.error("[Alexa Route] Directives handler error:", err.message || err);
    return NextResponse.json(createErrorResponse("Alexa", "InternalError", "An internal system error occurred"));
  }
}

/**
 * createErrorResponse()
 * ---------------------
 * Helper to build standard Alexa Smart Home Error Response payloads.
 */
function createErrorResponse(namespace: string, type: string, message: string) {
  return {
    event: {
      header: {
        namespace: namespace,
        name: "ErrorResponse",
        payloadVersion: "3",
        messageId: crypto.randomUUID(),
      },
      payload: {
        type: type,
        message: message,
      },
    },
  };
}