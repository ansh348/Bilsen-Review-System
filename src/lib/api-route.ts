import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("Invalid input", 400, error.issues);
  }

  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }

  return jsonError("Unexpected error", 500);
}
