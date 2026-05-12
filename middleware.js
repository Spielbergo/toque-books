import { NextResponse } from 'next/server';

// Auth entry points — always public
const PUBLIC_PATHS = ['/auth/login', '/auth/callback', '/accountant/login'];

// App routes that require authentication.
// Everything else (/, /about, /pricing, etc.) is treated as a public website page.
const PROTECTED_APP_PATHS = [
  '/dashboard', '/invoices', '/clients', '/products',
  '/expenses', '/subscriptions', '/bank', '/hst',
  '/mileage', '/payroll', '/personal', '/taxes',
  '/export', '/settings', '/companies', '/onboarding',
  '/accountant', '/time-tracking', '/projects', '/proposals',
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow static assets and API routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Always allow explicit public paths (auth pages)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Only guard known app routes — public website pages pass through freely
  const isAppRoute = PROTECTED_APP_PATHS.some(p => pathname.startsWith(p));
  if (!isAppRoute) return NextResponse.next();

  // Public sub-paths: proposal acceptance links are always accessible without login
  if (/^\/proposals\/[^/]+\/accept/.test(pathname)) return NextResponse.next();

  // Redirect to login if no session cookie
  const session = request.cookies.get('app_session');
  if (!session?.value) {
    const isAccountantRoute = pathname.startsWith('/accountant');
    const loginUrl = new URL(isAccountantRoute ? '/accountant/login' : '/auth/login', request.url);
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

