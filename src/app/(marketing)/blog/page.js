import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Blog',
  description:
    'NorthBooks blog — guides on HST remittance, T2 corporate tax filing, small business deductions in Canada, and bookkeeping tips for incorporated professionals.',
};

/*
 * SEO keyword strategy for future posts:
 *
 * High-intent commercial:
 *   - "bookkeeping software for Canadian corporations"
 *   - "T2 corporate tax software Canada"
 *   - "HST remittance software small business Canada"
 *
 * High-traffic informational:
 *   - "how to file HST remittance Canada" (~4,400/mo)
 *   - "T2 corporate tax return Canada guide" (~2,900/mo)
 *   - "small business tax deductions Canada" (~8,100/mo)
 *   - "CRA corporation tax deadlines Canada"
 *   - "T4 slip how to create yourself"
 *   - "incorporated vs sole proprietor Canada tax"
 *   - "dividend vs salary Canada CCPC"
 *   - "CRA mileage rate 2025"
 *   - "T2 short return vs long return"
 *
 * Content pillars:
 *   1. HST/GST compliance — quarterly/annual remittance, ITCs, Quick Method
 *   2. T2 corporate tax — filing deadlines, GIFI schedules, common deductions
 *   3. Owner compensation — salary vs dividends, T4 vs T5
 *   4. Year-end checklist for CCPCs
 *   5. CRA deadlines & penalties
 */

const PLACEHOLDER_POSTS = [
  {
    slug: 'hst-remittance-guide',
    category: 'HST & Sales Tax',
    title: 'How to Calculate and File Your HST Remittance in Canada',
    excerpt:
      'A step-by-step guide for incorporated small businesses: how GST/HST works, how to calculate net tax owing, when deadlines fall, and how to avoid penalties.',
    date: '2025-07-01',
    readTime: '8 min',
  },
  {
    slug: 'salary-vs-dividends',
    category: 'Owner Compensation',
    title: 'Salary vs. Dividends from Your Corporation: The 2025 Tax Trade-off',
    excerpt:
      'The classic question for Canadian CCPC owners. We break down CPP implications, personal tax rates, corporate refundable tax, and when each approach makes sense.',
    date: '2025-06-20',
    readTime: '10 min',
  },
  {
    slug: 't2-corporate-return-guide',
    category: 'Corporate Tax',
    title: 'T2 Corporate Tax Return: What Every Small Corporation Needs to Know',
    excerpt:
      'Filing deadlines, key schedules (GIFI 100/125), common deductions, and how to prepare your books so your T2 goes smoothly — with or without an accountant.',
    date: '2025-06-10',
    readTime: '12 min',
  },
  {
    slug: 'small-business-deductions',
    category: 'Deductions',
    title: '30 Small Business Tax Deductions for Canadian Incorporated Professionals',
    excerpt:
      'Home office, vehicle expenses, phone, software subscriptions, professional development — a comprehensive list of what CRA-compliant deductions are available to CCPCs.',
    date: '2025-05-28',
    readTime: '9 min',
  },
  {
    slug: 'cra-corporation-deadlines',
    category: 'Compliance',
    title: 'Every CRA Deadline Your Corporation Faces — and What Happens If You Miss One',
    excerpt:
      'T2, T4/T4A/T5, HST quarterly remittances, payroll remittances, personal instalments — the full calendar with penalty rates for late filing.',
    date: '2025-05-15',
    readTime: '7 min',
  },
  {
    slug: 'mileage-log-cra-2025',
    category: 'Deductions',
    title: 'CRA Mileage Log Requirements 2025: What to Record and How',
    excerpt:
      'The CRA requires a logbook to claim vehicle expenses. Here\'s exactly what records to keep, the 2025 per-km rate, and what triggers an audit.',
    date: '2025-05-03',
    readTime: '5 min',
  },
];

export default function BlogPage() {
  return (
    <>
      <section className={styles.header}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Blog</p>
          <h1 className={styles.title}>
            Guides for Canadian<br />
            <em>incorporated professionals.</em>
          </h1>
          <p className={styles.sub}>
            Practical articles on HST remittance, T2 corporate tax, owner compensation,
            CRA deadlines, and bookkeeping — written by people who actually run a corporation.
          </p>
        </div>
      </section>

      <section className={styles.posts}>
        <div className={styles.container}>
          <div className={styles.grid}>
            {PLACEHOLDER_POSTS.map((post) => (
              <article key={post.slug} className={styles.card}>
                <div className={styles.cardMeta}>
                  <span className={styles.category}>{post.category}</span>
                  <span className={styles.readTime}>{post.readTime} read</span>
                </div>
                <h2 className={styles.cardTitle}>
                  <Link href={`/blog/${post.slug}`} className={styles.cardLink}>
                    {post.title}
                  </Link>
                </h2>
                <p className={styles.cardExcerpt}>{post.excerpt}</p>
                <div className={styles.cardFooter}>
                  <time className={styles.date} dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </time>
                  <Link href={`/blog/${post.slug}`} className={styles.readMore}>
                    Read article →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.newsletter}>
        <div className={styles.container}>
          <div className={styles.newsletterInner}>
            <div>
              <h2 className={styles.newsletterTitle}>CRA deadline reminders, delivered.</h2>
              <p className={styles.newsletterSub}>
                New posts and tax deadline alerts for Canadian corporations — no spam, unsubscribe any time.
              </p>
            </div>
            <Link href="/auth/login?signup=1" className={styles.newsletterBtn}>
              Sign up free
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
