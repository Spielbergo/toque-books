import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import styles from './layout.module.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['300', '400', '600', '700', '900'],
  style: ['normal', 'italic'],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata = {
  metadataBase: new URL('https://northbooks.ca'),
  title: {
    template: '%s | NorthBooks',
    default: 'NorthBooks — Canadian Bookkeeping Made Simple',
  },
  description:
    'NorthBooks is the bookkeeping and tax software built for Canadian solo incorporated businesses. Track invoices, HST, T2 corporate returns, and T1 personal tax — all in one place.',
  openGraph: {
    siteName: 'NorthBooks',
    images: [{ url: '/og-image.png' }],
  },
};

export default function MarketingLayout({ children }) {
  return (
    <div className={`${fraunces.variable} ${jakarta.variable} ${styles.root}`}>
      <Navbar />
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}
