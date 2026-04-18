import { NextResponse } from "next/server";
import { isMockMode, setMockMode } from "@/lib/data-store";

export async function GET() {
  return NextResponse.json({ mockMode: isMockMode() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const enabled = Boolean(body.mockMode);
  setMockMode(enabled);
  return NextResponse.json({ mockMode: enabled });
}
