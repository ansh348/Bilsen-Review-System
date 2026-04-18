import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (payload?.type === "url_verification" && payload?.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Slack events endpoint is configured as a stub. Wire Bolt.js handlers in production.",
  });
}
