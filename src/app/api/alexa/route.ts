import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log(
    "[ALEXA]",
    JSON.stringify(body, null, 2)
  );

  return NextResponse.json({
    event: {
      header: {
        namespace: "Alexa",
        name: "Response",
        payloadVersion: "3",
        messageId: crypto.randomUUID(),
      },
      payload: {},
    },
  });
}