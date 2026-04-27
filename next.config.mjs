/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Prevent clickjacking by disallowing this app in iframes
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Only send referrer on same origin
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features not used by this app
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Force HTTPS for 1 year (enable after you have HTTPS confirmed)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Basic CSP: block mixed content; allow Firebase, Google, Resend CDN origins
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
      // Allow blob: URLs in iframes (used by the PDF invoice preview)
      "frame-src blob: 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
