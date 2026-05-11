import "./globals.css";
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ConditionalShell from '@/components/ConditionalShell';

export const metadata = {
  title: {
    default: 'CanBooks — Canadian Tax & Bookkeeping',
    template: '%s — CanBooks',
  },
  description: 'Track invoices, expenses, and calculate Canadian corporate and personal taxes for Ontario CCPCs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="highlight" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <ConditionalShell>{children}</ConditionalShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
