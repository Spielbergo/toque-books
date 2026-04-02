import { NextResponse } from 'next/server';

// Route protection is handled client-side via AppShell + AuthContext.
export function middleware() {
  return NextResponse.next();
}

export const config = { matcher: [] };

