import "./globals.css";
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import ConditionalShell from '@/components/ConditionalShell';

export const metadata = {
  title: {
    default: 'NorthBooks — Canadian Tax & Bookkeeping',
    template: '%s — NorthBooks',
  },
  description: 'Track invoices, expenses, and calculate Canadian corporate and personal taxes for Canadian CCPCs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="highlight" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <ConditionalShell>{children}</ConditionalShell>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
