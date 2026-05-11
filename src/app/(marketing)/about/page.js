import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'About',
  description:
    'NorthBooks was built by a Canadian developer who incorporated and was blindsided by the bookkeeping burden. Learn why we built Canada-first bookkeeping software for solo corporations.',
};

export default function AboutPage() {
  return (
    <>
      {/* ── Header ────────────────────────────── */}
      <section className={styles.header}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Our story</p>
          <h1 className={styles.title}>
            Built by someone who<br />
            <em>lived the problem.</em>
          </h1>
        </div>
      </section>

      {/* ── Founder Story ─────────────────────── */}
      <section className={styles.story}>
        <div className={styles.container}>
          <div className={styles.storyInner}>
            <div className={styles.storyText}>
              <p className={styles.storyLead}>
                I&apos;m a web developer. In 2022, I incorporated my consulting practice — something
                my accountant strongly recommended for liability and tax reasons. Great advice.
                What nobody warned me about was the paperwork.
              </p>
              <p>
                Within 90 days of incorporating, I was drowning in obligations I didn&apos;t fully
                understand: quarterly HST remittances, corporate bank account reconciliation,
                T2 corporate tax returns, payroll remittances for the salary I paid myself, and
                then — on top of all that — a personal T1 return that was suddenly far more
                complicated because of dividends.
              </p>
              <p>
                I hired a bookkeeper. They were great, but at $200/hour and needing 8 hours a
                year just to reconcile, I was spending $1,600 annually on something that felt
                like it should be automatable. I tried every bookkeeping tool I could find:
                QuickBooks, Wave, FreshBooks, Xero. They all had the same problem — they were
                built for American businesses. Canadian tax rules were bolted on as an afterthought.
                HST input tax credits, T2 GIFI schedules, T4 slips — none of it was native.
              </p>
              <p>
                So I built NorthBooks. I started it for myself, showed it to a few incorporated
                friends who had the same problem, and they immediately asked to use it.
              </p>
              <p>
                NorthBooks is still a small product. Every feature was built because it was needed
                — not because a product manager decided it would differentiate us. If you&apos;re
                an incorporated Canadian professional trying to stay on top of CRA obligations
                without spending your evenings on spreadsheets, NorthBooks is for you.
              </p>

              <div className={styles.founderCard}>
                <div className={styles.founderAvatar}>N</div>
                <div>
                  <div className={styles.founderName}>Founder, NorthBooks</div>
                  <div className={styles.founderRole}>Incorporated developer, Ontario</div>
                </div>
              </div>
            </div>

            <aside className={styles.storyAside}>
              <div className={styles.asideCard}>
                <h3 className={styles.asideTitle}>Why Canada-only?</h3>
                <p className={styles.asideBody}>
                  Canadian corporate tax has genuinely unique requirements: T2 returns, GIFI
                  schedules, HST/QST integration, T4 e-filing, CRA EFILE — none of these exist
                  in the American equivalent. Building a Canadian-first product means we can
                  go deep on the actual rules instead of building a generic tool and hoping it
                  translates.
                </p>
              </div>
              <div className={styles.asideCard}>
                <h3 className={styles.asideTitle}>Data stays in Canada</h3>
                <p className={styles.asideBody}>
                  Your financial data is hosted in Canadian data centres under PIPEDA. It never
                  crosses the border. That&apos;s a deliberate architectural decision, not a
                  marketing claim.
                </p>
              </div>
              <div className={styles.asideCard}>
                <h3 className={styles.asideTitle}>What&apos;s next?</h3>
                <p className={styles.asideBody}>
                  More export formats, better AI document parsing, and sharper T1 personal tax
                  integration. If there&apos;s a CRA obligation that&apos;s eating your time,{' '}
                  <Link href="/contact" className={styles.inlineLink}>tell us about it</Link>.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Values ────────────────────────────── */}
      <section className={styles.values}>
        <div className={styles.container}>
          <h2 className={styles.valuesTitle}>What we believe</h2>
          <div className={styles.valuesGrid}>
            {[
              {
                icon: '🎯',
                title: 'Purpose-built beats bolt-on',
                body: 'Generic tools with Canadian tax added on never quite work. We started from Canadian obligations and built outward.',
              },
              {
                icon: '🔒',
                title: 'Your data is yours',
                body: 'We don\'t sell your financial data. We don\'t use it for advertising. It sits in a Canadian data centre and you can export or delete it any time.',
              },
              {
                icon: '💰',
                title: 'Accountants are partners',
                body: 'NorthBooks reduces the tedious data-entry portion of accounting. Your accountant\'s expertise is still valuable — we just make their review faster.',
              },
              {
                icon: '🚫',
                title: 'No VC pressure',
                body: 'NorthBooks is bootstrapped. We grow by building something useful, not by hitting growth metrics for investors.',
              },
            ].map((v) => (
              <div key={v.title} className={styles.valueCard}>
                <div className={styles.valueIcon}>{v.icon}</div>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueBody}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────── */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>Give it a try — it&apos;s free to start.</h2>
            <p className={styles.ctaSub}>
              No sales call. No credit card. Just sign up and connect your first company.
            </p>
            <Link href="/auth/login?signup=1" className={styles.ctaBtn}>
              Create your free account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
