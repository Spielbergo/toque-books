'use client';

import { useState } from 'react';
import styles from './page.module.css';

const SUBJECTS = [
  'General question',
  'Bug report',
  'Feature request',
  'Billing question',
  'Accountant / partner inquiry',
];

export default function ContactContent() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' });
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('success');
      setForm({ name: '', email: '', subject: SUBJECTS[0], message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.inner}>
          <div className={styles.info}>
            <p className={styles.eyebrow}>Contact</p>
            <h1 className={styles.title}>Get in touch</h1>
            <p className={styles.sub}>
              Have a question, bug report, or feature request? We read every message.
              Typical response time is under 24 hours on weekdays.
            </p>
            <div className={styles.contactDetails}>
              <div className={styles.detail}>
                <span className={styles.detailIcon}>📧</span>
                <span className={styles.detailText}>hello@northbooks.ca</span>
              </div>
              <div className={styles.detail}>
                <span className={styles.detailIcon}>🍁</span>
                <span className={styles.detailText}>Ontario, Canada</span>
              </div>
            </div>
          </div>

          <div className={styles.formWrap}>
            {status === 'success' ? (
              <div className={styles.successMsg}>
                <div className={styles.successIcon}>✓</div>
                <h2 className={styles.successTitle}>Message sent!</h2>
                <p className={styles.successBody}>
                  Thanks for reaching out. We&apos;ll reply within one business day.
                </p>
                <button className={styles.resetBtn} onClick={() => setStatus('idle')}>
                  Send another message
                </button>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="name">Name</label>
                    <input
                      className={styles.input}
                      id="name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your name"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email">Email</label>
                    <input
                      className={styles.input}
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="subject">Subject</label>
                  <select
                    className={styles.select}
                    id="subject"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                  >
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="message">Message</label>
                  <textarea
                    className={styles.textarea}
                    id="message"
                    name="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your question or feedback..."
                  />
                </div>

                {status === 'error' && (
                  <p className={styles.errorMsg}>
                    Something went wrong — please try again or email hello@northbooks.ca directly.
                  </p>
                )}

                <button
                  className={styles.submitBtn}
                  type="submit"
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
