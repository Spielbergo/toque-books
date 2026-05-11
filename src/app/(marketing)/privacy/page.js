import styles from './legal.module.css';

export const metadata = {
  title: 'Privacy Policy',
  description: 'NorthBooks Privacy Policy — how we collect, use, and protect your data under PIPEDA and Canadian privacy law.',
};

const LAST_UPDATED = 'July 1, 2025';

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Legal</p>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h2>1. Introduction</h2>
            <p>
              NorthBooks Inc. (&ldquo;NorthBooks&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
              &ldquo;our&rdquo;) is committed to protecting the privacy of our users. This Privacy
              Policy describes how we collect, use, disclose, and safeguard your personal information
              when you use the NorthBooks web application and website (collectively, the
              &ldquo;Service&rdquo;), in compliance with the <em>Personal Information Protection
              and Electronic Documents Act</em> (PIPEDA) and applicable Canadian privacy law.
            </p>
            <p>
              By using the Service, you consent to the collection and use of information as
              described in this policy.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Information We Collect</h2>
            <h3>2.1 Account Information</h3>
            <p>
              When you create an account, we collect your name, email address, and password
              (stored as a hashed value — we never store plaintext passwords). You may optionally
              provide your business name, province, and HST registration number.
            </p>
            <h3>2.2 Financial Data You Enter</h3>
            <p>
              NorthBooks stores the financial and tax data you input: invoices, expenses,
              transactions, payroll information, mileage logs, and tax calculations. This data
              belongs to you. We process it solely to provide the Service.
            </p>
            <h3>2.3 Uploaded Documents</h3>
            <p>
              If you use the bank statement import or AI receipt parsing features, you may upload
              PDF documents. These documents are processed to extract structured data and are
              stored securely. Uploaded documents may be deleted from our systems after processing
              is complete — see Section 7 for retention details.
            </p>
            <h3>2.4 Usage Data</h3>
            <p>
              We collect anonymized usage data (pages visited, features used, errors encountered)
              to improve the Service. This data is not linked to your identity in any reports
              we review.
            </p>
            <h3>2.5 Payment Information</h3>
            <p>
              NorthBooks uses Helcim, a Canadian payment processor, to handle subscription
              billing. We do not store your credit card number. Payment data is governed by
              Helcim&apos;s privacy policy and PCI-DSS compliance program.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. How We Use Your Information</h2>
            <ul>
              <li>To provide, operate, and improve the Service</li>
              <li>To process subscription payments through Helcim</li>
              <li>To send transactional emails (account confirmation, password reset, billing receipts)</li>
              <li>To send CRA deadline reminders you have opted into</li>
              <li>To respond to support requests</li>
              <li>To detect and prevent fraud or abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p>We do not sell, rent, or trade your personal information to third parties.</p>
            <p>We do not use your financial data to train AI models for purposes outside your own use of the Service.</p>
          </section>

          <section className={styles.section}>
            <h2>4. Data Residency</h2>
            <p>
              Your data is stored in Canadian data centres operated by Supabase (hosted on AWS
              Canada Central — ca-central-1 region). Your financial data does not leave Canada
              as part of normal Service operations.
            </p>
            <p>
              AI document parsing uses Google Gemini API. When you use AI features, document
              content is transmitted to Google&apos;s servers for processing under Google&apos;s
              data processing terms. If this is a concern, AI features can be avoided without
              affecting core bookkeeping functionality.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Sharing Your Information</h2>
            <p>We share personal information only in these limited circumstances:</p>
            <ul>
              <li><strong>Service providers:</strong> Supabase (database hosting), Helcim (payments), Google (AI parsing), and email delivery providers — each bound by confidentiality and data processing agreements.</li>
              <li><strong>Accountant access:</strong> If you share a read-only access token with your accountant through the Service, they can view your financial data in NorthBooks.</li>
              <li><strong>Legal requirements:</strong> When required by law, court order, or regulatory authority.</li>
              <li><strong>Business transfer:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred with advance notice.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Security</h2>
            <p>
              We implement industry-standard security measures: TLS encryption in transit,
              AES-256 encryption at rest, row-level security on all database tables, and
              regular security reviews. However, no system is 100% secure — we encourage you
              to use a strong password and enable multi-factor authentication when available.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Data Retention and Deletion</h2>
            <p>
              We retain your account and financial data for as long as your account is active,
              plus 7 years (the CRA document retention requirement for Canadian businesses).
            </p>
            <p>
              You can request deletion of your account and associated data by emailing
              privacy@northbooks.ca. Upon verified request, we will delete your data within
              30 days, subject to legal retention obligations.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Your Rights Under PIPEDA</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Know what personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Withdraw consent for non-essential processing (with the understanding that some features may become unavailable)</li>
              <li>Request deletion of your personal information (subject to legal retention requirements)</li>
              <li>File a complaint with the Office of the Privacy Commissioner of Canada</li>
            </ul>
            <p>To exercise these rights, contact us at privacy@northbooks.ca.</p>
          </section>

          <section className={styles.section}>
            <h2>9. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed at individuals under 18 years of age. We do not knowingly
              collect personal information from minors. If you believe we have inadvertently
              collected such information, please contact us immediately.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users
              of material changes by email and by posting a notice in the app. Continued use of
              the Service after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Contact</h2>
            <p>
              For privacy-related questions or to exercise your rights:<br />
              <strong>Email:</strong> privacy@northbooks.ca<br />
              <strong>NorthBooks Inc.</strong>, Ontario, Canada
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
