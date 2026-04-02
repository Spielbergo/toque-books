import { NextResponse } from 'next/server';

// Firebase uses popup-based OAuth — no server-side callback needed.
// This route exists as a safe fallback in case it is ever hit.
export function GET(request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`);
}
