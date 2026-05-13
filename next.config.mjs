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
  // Basic CSP: block mixed content; allow Supabase and Google OAuth origins
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://helcimcdn.net https://js.helcim.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://suprdoldpnlifdzithzj.supabase.co wss://suprdoldpnlifdzithzj.supabase.co https://*.googleapis.com https://api.helcim.com",
      // Allow blob: for PDF preview and Google accounts OAuth iframe; Helcim for payment modal
      "frame-src blob: 'self' https://accounts.google.com https://*.helcim.com https://helcimcdn.net",
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
