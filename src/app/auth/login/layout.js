import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata = { title: 'Sign In | NorthBooks' };

export default function AuthLayout({ children }) {
  return (
    <div className={`${fraunces.variable} ${jakarta.variable}`}>
      {children}
    </div>
  );
}
