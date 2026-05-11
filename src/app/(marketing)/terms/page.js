import styles from '../privacy/legal.module.css';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service',
  description: 'NorthBooks Terms of Service — the agreement governing use of the NorthBooks bookkeeping and tax application.',
};

const LAST_UPDATED = 'July 1, 2025';

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Legal</p>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h2>1. Agreement to Terms</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement
              between you and NorthBooks Inc. (&ldquo;NorthBooks&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo;) governing your access to and use of the NorthBooks web application
              and website (the &ldquo;Service&rdquo;). By creating an account or using the Service,
              you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Eligibility</h2>
            <p>
              The Service is intended for use by Canadian businesses and their authorized
              representatives. You must be at least 18 years old and have the legal authority to
              enter into agreements on behalf of any business entity whose data you manage in
              NorthBooks.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Account Registration</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You agree to notify us
              immediately at hello@northbooks.ca of any unauthorized use of your account.
            </p>
            <p>
              You may not create accounts for the purpose of abuse, harassment, or circumventing
              usage limits.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Subscription and Billing</h2>
            <p>
              NorthBooks offers a free tier and a Pro subscription tier. Pro subscription fees
              are billed monthly or annually as selected at checkout. Payments are processed by
              Helcim, a PCI-DSS-compliant Canadian payment processor.
            </p>
            <p>
              Subscriptions automatically renew unless cancelled. You may cancel at any time from
              Settings → Billing. Upon cancellation, you retain Pro access until the end of the
              current billing period. Fees paid are non-refundable except where required by
              applicable Canadian consumer protection law.
            </p>
            <p>
              We reserve the right to modify pricing with 30 days&apos; advance notice to active
              subscribers. Continued use after the effective date constitutes acceptance of the
              new pricing.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose or in violation of any applicable Canadian law</li>
              <li>Upload false, fraudulent, or misleading financial information</li>
              <li>Attempt to gain unauthorized access to NorthBooks systems or other users&apos; data</li>
              <li>Use automated tools to scrape or extract data from the Service</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Resell or sublicense access to the Service without our written consent</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Your Data</h2>
            <p>
              You retain all ownership of the financial data, documents, and information you
              input into NorthBooks. You grant NorthBooks a limited, non-exclusive licence to
              store, process, and display your data solely to provide the Service to you.
            </p>
            <p>
              You are responsible for the accuracy of financial data you enter. NorthBooks
              provides tax calculation tools, not licensed tax advice. See Section 8.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Intellectual Property</h2>
            <p>
              The NorthBooks application, interface, and all content created by NorthBooks
              (excluding your data) are owned by NorthBooks Inc. and protected by Canadian
              copyright law. No licence to our intellectual property is granted beyond what
              is necessary to use the Service as described herein.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Not Professional Tax or Legal Advice</h2>
            <p>
              NorthBooks provides bookkeeping and tax calculation tools for informational purposes.
              The Service is not a substitute for professional accounting, tax, or legal advice.
              Tax laws change and individual circumstances vary. We recommend consulting a
              licensed CPA or tax professional before filing any CRA return.
            </p>
            <p>
              NorthBooks is not affiliated with, endorsed by, or a representative of the Canada
              Revenue Agency.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Service Availability and Modifications</h2>
            <p>
              We strive for high availability but do not guarantee uninterrupted access to the
              Service. We may modify, suspend, or discontinue features of the Service with
              reasonable notice. In the event of discontinuation, we will provide at least 60
              days&apos; notice and a data export mechanism.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable Canadian law, NorthBooks shall not be
              liable for any indirect, incidental, special, or consequential damages arising from
              your use of the Service, including but not limited to CRA penalties, errors in tax
              calculations, or data loss.
            </p>
            <p>
              Our total liability to you for direct damages shall not exceed the amount you paid
              to NorthBooks in the 12 months preceding the claim.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Province of Ontario and the federal
              laws of Canada applicable therein. Any disputes shall be subject to the exclusive
              jurisdiction of the courts of Ontario.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify active users of
              material changes by email at least 14 days before the effective date. Continued
              use of the Service after the effective date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>13. Contact</h2>
            <p>
              Questions about these Terms:<br />
              <strong>Email:</strong> hello@northbooks.ca<br />
              <strong>NorthBooks Inc.</strong>, Ontario, Canada
            </p>
            <p>
              See also: <Link href="/privacy" className={styles.inlineLink}>Privacy Policy</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
