/**
 * =============================================================================
 * src/lib/alexa/types.ts — Shared Alexa Smart Home TypeScript Interfaces
 * =============================================================================
 *
 * PURPOSE:
 *   Defines standard structures for Alexa Smart Home Skill (V3) requests
 *   (Directives) and responses (Events).
 *
 *   Having these in a shared file ensures full compile-time validation for
 *   - Discovery responses
 *   - Power control execution (TurnOn / TurnOff)
 *   - State reports (ReportState)
 * =============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
//  1. Directive (Incoming Alexa Skill Request)
// ─────────────────────────────────────────────────────────────────────────────

export interface AlexaDirectiveHeader {
  namespace: string;
  name: string;
  payloadVersion: string;
  messageId: string;
  correlationToken?: string;
}

export interface AlexaDirectivePayload {
  scope?: {
    type: 'BearerToken';
    token: string;
  };
}

export interface AlexaDirectiveEndpoint {
  endpointId: string;
  scope?: {
    type: 'BearerToken';
    token: string;
  };
  cookie?: {
    deviceId?: string;
    relayNumber?: string;
    [key: string]: string | undefined;
  };
}

export interface AlexaDirective {
  directive: {
    header: AlexaDirectiveHeader;
    payload: AlexaDirectivePayload;
    endpoint?: AlexaDirectiveEndpoint;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. Discovery Interfaces (Used by getAlexaEndpoints)
// ─────────────────────────────────────────────────────────────────────────────

export interface AlexaCapabilityProperty {
  name: string;
}

export interface AlexaCapability {
  type: 'AlexaInterface';
  interface: string;
  version: string;
  properties?: {
    supported: AlexaCapabilityProperty[];
    proactivelyReported: boolean;
    retrievable: boolean;
  };
}

export interface AlexaEndpoint {
  endpointId: string;
  manufacturerName: string;
  friendlyName: string;
  description: string;
  displayCategories: string[];
  cookie: {
    deviceId: string;
    relayNumber: string;
  };
  capabilities: AlexaCapability[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. Response Interfaces (Outgoing Alexa Skill Event)
// ─────────────────────────────────────────────────────────────────────────────

export interface AlexaResponseProperty {
  namespace: string;
  name: string;
  value: any;
  timeOfSample: string;
  uncertaintyInMilliseconds: number;
}

export interface AlexaResponseContext {
  properties: AlexaResponseProperty[];
}

export interface AlexaResponseHeader {
  namespace: string;
  name: string;
  payloadVersion: string;
  messageId: string;
  correlationToken?: string;
}

export interface AlexaResponse {
  context?: AlexaResponseContext;
  event: {
    header: AlexaResponseHeader;
    endpoint?: {
      endpointId: string;
    };
    payload: Record<string, any>;
  };
}
