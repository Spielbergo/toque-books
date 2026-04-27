import { NextResponse } from 'next/server';

// Protected app routes. The `app_session` cookie is set by AuthContext when
// Firebase Auth confirms a signed-in user, and cleared on sign-out.
//
// NOTE: This check is NOT cryptographically verified — it prevents casual
// unauthenticated access and crawler indexing of app pages. Actual data
// security is enforced by Firestore rules and per-route Bearer token checks
// in the API layer.
const PUBLIC_PATHS = ['/auth/login', '/auth/callback'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths and all API routes (API routes enforce auth themselves)
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Redirect to login if no session cookie
  const session = request.cookies.get('app_session');
  if (!session?.value) {
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};

