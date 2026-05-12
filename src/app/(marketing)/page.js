'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import PlanCards from '@/components/marketing/PlanCards';
import styles from './page.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const PAIN_POINTS = [
  {
    icon: '📅',
    title: 'Quarterly HST remittances',
    body: 'You\'re required to collect, track, and remit GST/HST every quarter. Miss a deadline and face CRA penalties — plus interest on top.',
  },
  {
    icon: '📋',
    title: 'Year-end corporate tax (T2)',
    body: 'Your corporation must file a T2 return within 6 months of fiscal year-end. Getting it right is expensive with an accountant.',
  },
  {
    icon: '💸',
    title: 'Dividend-to-personal T1 complexity',
    body: 'When you pay yourself dividends, it integrates with your personal T1 return. The gross-up math is complex and easy to get wrong.',
  },
];

const FEATURES = [
  {
    icon: '📄',
    title: 'Invoices & Accounts Receivable',
    body: 'Create professional invoices, attach PDFs, track payment status, and set up recurring templates. Import AI-parsed client invoices too.',
  },
  {
    icon: '🍁',
    title: 'CRA-Ready Tax Summary',
    body: 'Live T2 corporate + T1 personal calculations that update as you work. AI review flags issues before you file.',
  },
  {
    icon: '📊',
    title: 'HST / GST / QST Tracking',
    body: 'Automatic ITC tracking, remittance history, Quick Method comparison, and instalment scheduling. Every province covered.',
  },
  {
    icon: '🏦',
    title: 'Bank Statement Import',
    body: 'Upload PDF bank statements and let AI extract and categorize transactions. Match to existing expenses in one click.',
  },
];

const CANADA_FEATURES = [
  { title: 'All provincial tax rates', body: 'HST, GST, QST, PST — every province and territory, updated for the current year.' },
  { title: 'CRA filing deadlines', body: 'T2, T4/T4A/T5, HST quarterly, personal instalments — built into the Deadline Calendar.' },
  { title: 'T4, T5, T2 compliance', body: 'Generate slips and GIFI schedules your accountant or CRA will accept.' },
  { title: 'Canadian data residency', body: 'Your financial data stays in Canadian data centres, covered under PIPEDA.' },
];

const TESTIMONIALS = [
  {
    quote: 'I used to dread HST season. NorthBooks auto-calculates my ITCs and tells me exactly what I owe. It\'s removed a constant source of anxiety.',
    name: 'Sarah K.',
    role: 'Freelance UX Designer, Toronto',
  },
  {
    quote: 'As a solo dev running through a corporation, I was paying $2,400/year for a bookkeeper just to reconcile my accounts. NorthBooks pays for itself in the first week.',
    name: 'Marcus T.',
    role: 'Software Consultant, Vancouver',
  },
  {
    quote: 'The T2 summary alone is worth it. My accountant reviews the XML export, makes a few tweaks, and we\'re done. Their fee dropped by half.',
    name: 'Priya M.',
    role: 'Management Consultant, Calgary',
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <motion.div
            className={styles.heroContent}
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div className={styles.heroBadge} variants={fadeUp}>
              🍁 Built for Canadian solo incorporations
            </motion.div>
            <motion.h1 className={styles.heroHeading} variants={fadeUp}>
              Books done.<br />
              Taxes handled.<br />
              <em>Back to work.</em>
            </motion.h1>
            <motion.p className={styles.heroSub} variants={fadeUp}>
              NorthBooks is the all-in-one bookkeeping and tax app for Canadian corporations.
              Track invoices, HST remittances, T2 corporate returns, and T1 personal tax —
              all updated in real time.
            </motion.p>
            <motion.div className={styles.heroCtas} variants={fadeUp}>
              <Link href="/auth/login?signup=1" className={styles.ctaPrimary}>
                Start for Free
              </Link>
              <Link href="/features" className={styles.ctaSecondary}>
                See all features →
              </Link>
            </motion.div>
            <motion.p className={styles.heroNote} variants={fadeUp}>
              Free plan includes invoicing, HST tracking, and bank import. No credit card required.
            </motion.p>
          </motion.div>

          <motion.div
            className={styles.heroMockup}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          >
            <div className={styles.mockup}>
              <div className={styles.mockupBar}>
                <span className={styles.mockupDot} />
                <span className={styles.mockupDot} />
                <span className={styles.mockupDot} />
                <span className={styles.mockupTitle}>NorthBooks — Dashboard</span>
              </div>
              <div className={styles.mockupBody}>
                <div className={styles.mockupStats}>
                  {[
                    { label: 'Revenue', value: '$62,400', sub: '+12% this quarter' },
                    { label: 'HST Owing', value: '$4,320', sub: 'Due Dec 31' },
                    { label: 'Net Income', value: '$48,200', sub: 'Before corp tax' },
                    { label: 'Invoices Out', value: '8', sub: '3 overdue' },
                  ].map((s) => (
                    <div key={s.label} className={styles.mockupStat}>
                      <div className={styles.mockupStatLabel}>{s.label}</div>
                      <div className={styles.mockupStatValue}>{s.value}</div>
                      <div className={styles.mockupStatSub}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.mockupChart}>
                  {[45, 60, 80, 55, 90, 70, 85].map((h, i) => (
                    <div key={i} className={styles.mockupBar2} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className={styles.mockupInvoices}>
                  {[
                    { id: '#INV-041', client: 'Acme Corp', amount: '$4,800', status: 'paid' },
                    { id: '#INV-042', client: 'Maple Studio', amount: '$2,250', status: 'sent' },
                    { id: '#INV-043', client: 'Peak Digital', amount: '$8,500', status: 'draft' },
                  ].map((inv) => (
                    <div key={inv.id} className={styles.mockupRow}>
                      <span className={styles.mockupRowId}>{inv.id}</span>
                      <span className={styles.mockupRowClient}>{inv.client}</span>
                      <span className={styles.mockupRowAmount}>{inv.amount}</span>
                      <span className={`${styles.mockupBadge} ${styles[`badge_${inv.status}`]}`}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pain Points ───────────────────────────────────── */}
      <section className={styles.pain}>
        <div className={styles.container}>
          <motion.div
            className={styles.sectionHeader}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p className={styles.eyebrow} variants={fadeUp}>The problem</motion.p>
            <motion.h2 className={styles.sectionTitle} variants={fadeUp}>
              You started a business.<br />Not a bookkeeping degree.
            </motion.h2>
            <motion.p className={styles.sectionSub} variants={fadeUp}>
              Running a corporation in Canada means juggling obligations that most freelancers never
              face. The paperwork compounds — and the accountant bills follow.
            </motion.p>
          </motion.div>

          <motion.div
            className={styles.painGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {PAIN_POINTS.map((p) => (
              <motion.div key={p.title} className={styles.painCard} variants={fadeUp}>
                <div className={styles.painIcon}>{p.icon}</div>
                <h3 className={styles.painTitle}>{p.title}</h3>
                <p className={styles.painBody}>{p.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className={styles.features}>
        <div className={styles.container}>
          <motion.div
            className={styles.sectionHeader}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p className={styles.eyebrowLight} variants={fadeUp}>What&apos;s included</motion.p>
            <motion.h2 className={styles.sectionTitleLight} variants={fadeUp}>
              Everything your corporation needs,<br />nothing you don&apos;t.
            </motion.h2>
          </motion.div>

          <motion.div
            className={styles.featuresGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {FEATURES.map((f) => (
              <motion.div key={f.title} className={styles.featureCard} variants={fadeUp}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureBody}>{f.body}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className={styles.featuresMore}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/features" className={styles.featuresMoreLink}>
              View all features — payroll, mileage log, 20+ export formats, and more →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Built for Canada ──────────────────────────────── */}
      <section className={styles.canada}>
        <div className={styles.container}>
          <div className={styles.canadaInner}>
            <motion.div
              className={styles.canadaText}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.p className={styles.eyebrow} variants={fadeUp}>Built for Canada</motion.p>
              <motion.h2 className={styles.sectionTitle} variants={fadeUp}>
                No generic software.<br />Purpose-built for<br />Canadian corporations.
              </motion.h2>
              <motion.p className={styles.sectionSub} variants={fadeUp}>
                NorthBooks was built by a solo Canadian founder who was blindsided by the
                bookkeeping burden of incorporation. Every feature exists because it was needed
                — not as a checkbox.
              </motion.p>
            </motion.div>

            <motion.div
              className={styles.canadaFeatures}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
            >
              {CANADA_FEATURES.map((f) => (
                <motion.div key={f.title} className={styles.canadaFeature} variants={fadeUp}>
                  <div className={styles.canadaCheck}>✓</div>
                  <div>
                    <h3 className={styles.canadaFeatureTitle}>{f.title}</h3>
                    <p className={styles.canadaFeatureBody}>{f.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────── */}
      <section className={styles.testimonials}>
        <div className={styles.container}>
          <motion.div
            className={styles.sectionHeader}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p className={styles.eyebrow} variants={fadeUp}>Early users</motion.p>
            <motion.h2 className={styles.sectionTitle} variants={fadeUp}>
              Incorporated professionals getting their evenings back
            </motion.h2>
          </motion.div>

          <motion.div
            className={styles.testimonialGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {TESTIMONIALS.map((t) => (
              <motion.div key={t.name} className={styles.testimonialCard} variants={fadeUp}>
                <div className={styles.testimonialStars}>★★★★★</div>
                <p className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</p>
                <div className={styles.testimonialAuthor}>
                  <div className={styles.testimonialAvatar}>{t.name[0]}</div>
                  <div>
                    <div className={styles.testimonialName}>{t.name}</div>
                    <div className={styles.testimonialRole}>{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing Teaser ────────────────────────────────── */}
      <section className={styles.pricingTeaser}>
        <div className={styles.container}>
          <motion.div
            className={styles.sectionHeader}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p className={styles.eyebrow} variants={fadeUp}>Simple pricing</motion.p>
            <motion.h2 className={styles.sectionTitle} variants={fadeUp}>
              Start free. Upgrade when you&apos;re ready.
            </motion.h2>
          </motion.div>

          <motion.div
            className={styles.pricingCards}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <PlanCards compact showToggle={false} animate="scroll" />
          </motion.div>

          <motion.p
            className={styles.pricingNote}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link href="/pricing" className={styles.pricingFullLink}>
              See full pricing and feature comparison →
            </Link>
          </motion.p>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────── */}
      <section className={styles.ctaBanner}>
        <div className={styles.container}>
          <motion.div
            className={styles.ctaBannerInner}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            <h2 className={styles.ctaBannerTitle}>
              Stop letting bookkeeping eat your evenings.
            </h2>
            <p className={styles.ctaBannerSub}>
              Join Canadian incorporated professionals who use NorthBooks to stay on top of
              HST, T2, and invoicing — without an accounting degree.
            </p>
            <Link href="/auth/login?signup=1" className={styles.ctaBannerBtn}>
              Start for Free — no credit card required
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
