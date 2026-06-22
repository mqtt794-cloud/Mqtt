import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log(
    "[ALEXA]",
    JSON.stringify(body, null, 2)
  );

  const namespace =
    body?.directive?.header?.namespace;

  const name =
    body?.directive?.header?.name;

  if (
    namespace === "Alexa.Discovery" &&
    name === "Discover"
  ) {
    return NextResponse.json({
      event: {
        header: {
          namespace: "Alexa.Discovery",
          name: "Discover.Response",
          payloadVersion: "3",
          messageId: crypto.randomUUID(),
        },
        payload: {
          endpoints: [
            {
              endpointId: "ESP001_1",
              manufacturerName: "SmartHome",
              friendlyName: "Bedroom Light",
              description: "Bedroom Light",
              displayCategories: ["LIGHT"],
              cookie: {},
              capabilities: [
                {
                  type: "AlexaInterface",
                  interface: "Alexa",
                  version: "3",
                },
                {
                  type: "AlexaInterface",
                  interface: "Alexa.PowerController",
                  version: "3",
                  properties: {
                    supported: [
                      {
                        name: "powerState",
                      },
                    ],
                    proactivelyReported: false,
                    retrievable: true,
                  },
                },
              ],
            },
          ],
        },
      },
    });
  }

  return NextResponse.json({
    event: {
      header: {
        namespace: "Alexa",
        name: "ErrorResponse",
        payloadVersion: "3",
        messageId: crypto.randomUUID(),
      },
      payload: {},
    },
  });
}