/**
 * =============================================================================
 * src/app/api/alexa/route.ts — Alexa Smart Home Directive Webhook Endpoint
 * =============================================================================
 *
 * PURPOSE:
 *   Acts as the central webhook endpoint that receives JSON requests from the
 *   AWS Lambda function representing your Alexa Smart Home Skill.
 *
 * HOW DIRECTIVE ROUTING WORKS:
 *   Alexa speaks to your skill using "Directives". Each directive contains:
 *     - A namespace (e.g. "Alexa.Discovery", "Alexa.PowerController")
 *     - A name (e.g. "Discover", "TurnOn", "TurnOff", "ReportState")
 *
 *   This endpoint inspects the namespace/name and routes the request:
 *     1. Alexa.Discovery::Discover -> Retrieves dynamic relays from Supabase and
 *        returns them as Alexa endpoints.
 *     2. Alexa.PowerController::TurnOn/TurnOff -> Power controls (relay command).
 *     3. Alexa::ReportState -> Requests status values (ON/OFF, Online/Offline).
 * =============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { getAlexaEndpoints } from "@/lib/alexa/discovery";
import { handleAlexaPowerControl } from "@/lib/alexa/powerController";
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

    // ─────────────────────────────────────────────────────────────────────────
    //  1. DEVICE DISCOVERY DIRECTIVE (Alexa.Discovery::Discover)
    // ─────────────────────────────────────────────────────────────────────────
    if (namespace === "Alexa.Discovery" && name === "Discover") {
      const userId = "admin"; // Defaulting to our static owner for now

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
      const userId = "admin"; // Defaulting to static user

      // Dispatch command through our power controller service
      const result = await handleAlexaPowerControl(userId, deviceId, relayNumber, turnOn);

      if (!result.success) {
        // Return standard Alexa error payload if the command failed to send or check out
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
            // 1. Report the new powerState
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

      /**
       * FUTURE EXPANSION (Read state from DB):
       *   You will query the database to find the current_state of the relay
       *   and the online status of the device, then report them back dynamically.
       *
       *   For now, we return default states as placeholders.
       */
      const response: AlexaResponse = {
        context: {
          properties: [
            {
              namespace: "Alexa.PowerController",
              name: "powerState",
              value: "OFF", // Placeholder state
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 0
            },
            {
              namespace: "Alexa.EndpointHealth",
              name: "connectivity",
              value: {
                value: "OK" // Mapped from device.online
              },
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 0
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