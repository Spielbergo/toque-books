import "./globals.css";
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ConditionalShell from '@/components/ConditionalShell';

export const metadata = {
  title: 'Toque Books — Canadian Tax & Bookkeeping',
  description: 'Track invoices, expenses, and calculate Canadian corporate and personal taxes for Ontario CCPCs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ConditionalShell>{children}</ConditionalShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
