import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    response_type: "ephemeral",
    text: "Slack command handling is scaffolded. Connect this endpoint to Bolt.js slash command parsing.",
  });
}
