export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/features', '/pricing', '/about', '/contact', '/blog', '/privacy', '/terms'],
        disallow: [
          '/dashboard',
          '/invoices',
          '/transactions',
          '/expenses',
          '/tax',
          '/hst',
          '/payroll',
          '/mileage',
          '/export',
          '/settings',
          '/companies',
          '/onboarding',
          '/accountant',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://northbooks.ca/sitemap.xml',
  };
}
