'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useToast } from '@/contexts/ToastContext';
import { exportDataAsJSON, importDataFromJSON, clearData } from '@/lib/storage';
import { formatDate, today } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import Link from 'next/link';
import styles from './page.module.css';

const PROVINCES = [
  { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'QC', label: 'Quebec' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'NL', label: 'Newfoundland & Labrador' },
];

const TABS = ['Company', 'Business Profile', 'Fiscal Years', 'Data', 'Personal Profile', 'Access'];

const MARITAL_STATUSES = [
  { value: '', label: 'Select…' },
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'common_law', label: 'Common-law' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

const SPOUSE_INCOME_TYPES = [
  { value: '', label: 'Select…' },
  { value: 'employed', label: 'T4 employed' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'none', label: 'No income' },
];

const DEPENDANT_RELATIONSHIPS = [
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
];

export default function SettingsPage() {
  const { state, dispatch, companies, activeCompanyId } = useApp();
  const { user } = useAuth();
  const { userProfile, userDispatch } = useUserProfile();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (searchParams.get('tab') === 'personal') setTab(4);
    if (searchParams.get('tab') === 'access') setTab(5);
  }, [searchParams]);

  // Access tab state
  const [accountantEmails, setAccountantEmails] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const companyId = activeCompanyId;

  useEffect(() => {
    if (tab !== 5 || !companyId) return;
    // Read accountant emails directly from Firestore (client SDK — no service account needed)
    import('@/lib/firebase/client').then(({ db }) =>
      import('firebase/firestore').then(({ doc, getDoc }) =>
        getDoc(doc(db, 'companies', companyId))
      )
    ).then(snap => {
      setAccountantEmails(snap.data()?.accountantEmails || []);
    }).catch(() => {});
  }, [tab, companyId]);

  const addAccountant = async () => {
    if (!newEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      toast({ message: 'Invalid email address', type: 'error' }); return;
    }
    const email = newEmail.trim().toLowerCase();
    setAccessLoading(true);
    try {
      const { db } = await import('@/lib/firebase/client');
      const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
      await updateDoc(doc(db, 'companies', companyId), {
        accountantEmails: arrayUnion(email),
        updatedAt: new Date().toISOString(),
      });
      setAccountantEmails(prev => [...new Set([...prev, email])]);
      setNewEmail('');
      toast({ message: 'Accountant access granted', type: 'success' });
    } catch (e) {
      toast({ message: 'Failed to add accountant', detail: e.message, type: 'error' });
    } finally {
      setAccessLoading(false);
    }
  };

  const removeAccountant = async (email) => {
    setAccessLoading(true);
    try {
      const { db } = await import('@/lib/firebase/client');
      const { doc, updateDoc, arrayRemove } = await import('firebase/firestore');
      await updateDoc(doc(db, 'companies', companyId), {
        accountantEmails: arrayRemove(email),
        updatedAt: new Date().toISOString(),
      });
      setAccountantEmails(prev => prev.filter(e => e !== email));
      toast({ message: 'Access removed', type: 'success' });
    } catch (e) {
      toast({ message: 'Failed to remove access', detail: e.message, type: 'error' });
    } finally {
      setAccessLoading(false);
    }
  };

  const sendInvite = async (email) => {
    setAccessLoading(true);
    try {
      const { auth } = await import('@/lib/firebase/client');
      const { sendSignInLinkToEmail } = await import('firebase/auth');
      const actionCodeSettings = {
        url: `${window.location.origin}/accountant/login`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      toast({ message: `Invite sent to ${email}`, type: 'success' });
    } catch (e) {
      toast({ message: 'Failed to send invite', detail: e.message, type: 'error' });
    } finally {
      setAccessLoading(false);
    }
  };

  // Personal profile form
  const [ppForm, setPpForm] = useState(() => ({
    ...(userProfile?.personalProfile ?? {}),
  }));
  const [ppSaved, setPpSaved] = useState(false);
  const [deps, setDeps] = useState(() => userProfile?.dependants ?? []);

  useEffect(() => {
    setPpForm({ ...(userProfile?.personalProfile ?? {}) });
    setDeps(userProfile?.dependants ?? []);
  }, [userProfile]);

  const savePP = e => {
    e.preventDefault();
    userDispatch({ type: 'UPDATE_PERSONAL_PROFILE', payload: ppForm });
    userDispatch({ type: 'SET_DEPENDANTS', payload: deps });
    setPpSaved(true);
    setTimeout(() => setPpSaved(false), 2500);
  };

  const addDep = () => setDeps(d => [
    ...d,
    { id: Math.random().toString(36).slice(2), name: '', birthYear: '', relationship: 'child', disability: false },
  ]);

  const updateDep = (id, field, value) =>
    setDeps(d => d.map(dep => dep.id === id ? { ...dep, [field]: value } : dep));

  const removeDep = id => setDeps(d => d.filter(dep => dep.id !== id));

  const hasSpouse = ppForm.maritalStatus === 'married' || ppForm.maritalStatus === 'common_law';

  // Company form
  const [form, setForm] = useState({ ...state.settings });
  const [saved, setSaved] = useState(false);

  // Logo uploads
  const logoInputRef = useRef(null);
  const badgeLogoInputRef = useRef(null);

  const handleBadgeLogoUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      toast({ message: 'Badge logo is too large. Please use an image under 300 KB.', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, badgeLogo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600 * 1024) {
      toast({ message: 'Logo file is too large. Please use an image under 600 KB.', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, logo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // New fiscal year form
  const [showFYModal, setShowFYModal] = useState(false);
  const [fyForm, setFYForm] = useState({ startYear: new Date().getFullYear() - 1, endYear: new Date().getFullYear() });

  // Confirm danger
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const importRef = useRef(null);

  const saveSettings = e => {
    e.preventDefault();
    dispatch({ type: 'UPDATE_SETTINGS', payload: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const createFiscalYear = e => {
    e.preventDefault();
    const startYear = parseInt(fyForm.startYear);
    const endYear = parseInt(fyForm.endYear);
    const key = `FY${startYear}-${String(endYear).slice(-2)}`;
    if (state.fiscalYears[key]) {
      toast({ message: `${key} already exists.`, type: 'error' });
      return;
    }
    dispatch({
      type: 'ADD_FISCAL_YEAR',
      payload: {
        key,
        label: key,
        startDate: `${startYear}-12-01`,
        endDate: `${endYear}-11-30`,
      },
    });
    setShowFYModal(false);
  };

  const setActiveFY = key => dispatch({ type: 'SET_ACTIVE_FISCAL_YEAR', payload: key });

  // Sorted FY entries with cross-bucket date-based stats
  const fyEntries = useMemo(() => {
    const allInvoices = Object.values(state.fiscalYears).flatMap(fy => fy.invoices || []);
    const allExpenses = Object.values(state.fiscalYears).flatMap(fy => fy.expenses || []);
    const allDivs    = Object.values(state.fiscalYears).flatMap(fy => fy.dividendsPaid || []);
    return Object.entries(state.fiscalYears)
      .sort(([, a], [, b]) => (b.startDate || '').localeCompare(a.startDate || ''))
      .map(([key, fy]) => {
        const { startDate: s, endDate: e } = fy;
        const inRange = date => date && (!s || date >= s) && (!e || date <= e);
        return {
          key,
          fy,
          invCount: allInvoices.filter(i => inRange(i.issueDate)).length,
          expCount: allExpenses.filter(ex => inRange(ex.date)).length,
          divCount: allDivs.filter(d => inRange(d.date)).length,
        };
      });
  }, [state.fiscalYears]);

  const handleExport = () => exportDataAsJSON(state);

  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const data = await importDataFromJSON(file);
      dispatch({ type: 'RESTORE', payload: data });
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError(err.message || 'Failed to import file');
    }
    e.target.value = '';
  };

  const doClearData = () => {
    clearData();
    window.location.reload();
  };

  // ── Firebase cloud backup ─────────────────────────
  const [cloudStatus, setCloudStatus] = useState('idle'); // 'idle' | 'saving' | 'restoring' | 'done' | 'error'
  const [cloudMsg, setCloudMsg] = useState('');

  const handleCloudSave = async () => {
    if (!user) return;
    setCloudStatus('saving');
    setCloudMsg('');
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/client');
      await setDoc(doc(db, 'users', user.uid, 'data', 'backup'), {
        state: JSON.stringify(state),
        savedAt: new Date().toISOString(),
      });
      setCloudStatus('done');
      setCloudMsg('Backup saved to cloud.');
    } catch (err) {
      setCloudStatus('error');
      setCloudMsg(err.message || 'Cloud save failed.');
    }
  };

  const handleCloudRestore = async () => {
    if (!user) return;
    setConfirmRestore(true);
  };

  const doCloudRestore = async () => {
    setConfirmRestore(false);
    setCloudStatus('restoring');
    setCloudMsg('');
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/client');
      const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'backup'));
      if (!snap.exists()) {
        setCloudStatus('error');
        setCloudMsg('No cloud backup found.');
        return;
      }
      const data = JSON.parse(snap.data().state);
      dispatch({ type: 'RESTORE', payload: data });
      setCloudStatus('done');
      setCloudMsg(`Restored from ${snap.data().savedAt ? new Date(snap.data().savedAt).toLocaleString('en-CA') : 'cloud'}.`);
    } catch (err) {
      setCloudStatus('error');
      setCloudMsg(err.message || 'Cloud restore failed.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        {TABS.map((t, i) => (
          <button key={t} className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {/* ══ Company ══ */}
      {tab === 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Company Information</h3>
            <p>Used on invoices and tax reports.</p>
          </div>
          <form onSubmit={saveSettings}>
            <div className={styles.formGrid}>
              <FormField label="Company Name" hint="Your corporation's legal name">
                <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Acme Web Dev Inc." />
              </FormField>

              <FormField label="Owner / Principal Name">
                <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} placeholder="Jane Smith" />
              </FormField>

              <FormField label="Business Number (BN)" hint="9-digit CRA number, e.g. 123456789">
                <Input value={form.businessNumber || ''} onChange={e => setForm(f => ({ ...f, businessNumber: e.target.value }))} placeholder="123456789" maxLength={9} />
              </FormField>

              <FormField label="HST Registration Number" hint="Format: 123456789 RT0001">
                <Input value={form.hstNumber} onChange={e => setForm(f => ({ ...f, hstNumber: e.target.value }))} placeholder="123456789 RT0001" />
              </FormField>

              <FormField label="Province">
                <Select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}>
                  {PROVINCES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Year of Incorporation">
                <Input type="number" min="1900" max={new Date().getFullYear()} value={form.incorporationYear} onChange={e => setForm(f => ({ ...f, incorporationYear: parseInt(e.target.value) || f.incorporationYear }))} />
              </FormField>

              <FormField label="Default Payment Terms (days)" hint="Shown on new invoices as due date offset">
                <Input type="number" min="0" max="365" value={form.defaultPaymentTerms} onChange={e => setForm(f => ({ ...f, defaultPaymentTerms: parseInt(e.target.value) || 30 }))} />
              </FormField>
            </div>

            <div className={styles.subsectionHeader}>
              <h4>App Badge Logo</h4>
              <p>Shown in the sidebar next to your company name. Square image works best (PNG with transparency recommended).</p>
            </div>
            <div className={styles.badgeLogoSection}>
              <div className={styles.badgeLogoPreviewWrap}>
                {form.badgeLogo ? (
                  <img src={form.badgeLogo} alt="Badge logo" className={styles.badgeLogoPreview} />
                ) : (
                  <div className={styles.badgeLogoPlaceholder}>No badge</div>
                )}
              </div>
              <div className={styles.logoActions}>
                <Button type="button" variant="secondary" size="sm" onClick={() => badgeLogoInputRef.current?.click()}>Upload Badge Logo</Button>
                {form.badgeLogo && <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, badgeLogo: null }))}>Remove</Button>}
                <input type="file" accept="image/*" ref={badgeLogoInputRef} className={styles.fileInput} onChange={handleBadgeLogoUpload} />
                <p className={styles.logoHint}>Square PNG or SVG, max 300 KB. Stored in your browser.</p>
              </div>
            </div>

            <div className={styles.subsectionHeader}>
              <h4>Personal Account Matching</h4>
              <p>Bank statement transfers to your personal account will be suggested as dividend payments. Enter any names or keywords that appear in your statement descriptions when you pay yourself.</p>
            </div>
            <div className={styles.formGrid}>
              <FormField
                label="Personal Account Nicknames / Keywords"
                hint="Comma-separated. Case-insensitive. e.g. spielbergo, personal chq, e-transfer self"
                className={styles.colSpan2}
              >
                <Input
                  value={form.personalAccountKeywords || ''}
                  onChange={e => setForm(f => ({ ...f, personalAccountKeywords: e.target.value }))}
                  placeholder="spielbergo, personal, etransfer self"
                />
              </FormField>
            </div>

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.hstRegistered}
                  className={`${styles.toggle} ${form.hstRegistered ? styles.toggleOn : ''}`}
                  onClick={() => setForm(f => ({ ...f, hstRegistered: !f.hstRegistered }))}
                />
                <span>HST Registered</span>
              </label>
              <p className={styles.toggleHint}>Mandatory when annual revenue exceeds $30,000.</p>
            </div>

            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.recurringPromptEnabled !== false}
                  className={`${styles.toggle} ${form.recurringPromptEnabled !== false ? styles.toggleOn : ''}`}
                  onClick={() => setForm(f => ({ ...f, recurringPromptEnabled: f.recurringPromptEnabled === false }))}
                />
                <span>Recurring Invoice Reminders</span>
              </label>
              <p className={styles.toggleHint}>Show a prompt on the Invoices page when a recurring template is due.</p>
            </div>

            <div className={styles.actions}>
              <Button type="submit">Save Company Info</Button>
              {saved && <span className={styles.savedMsg}>✅ Saved!</span>}
            </div>
          </form>
        </div>
      )}

      {/* ══ Business Profile ══ */}
      {tab === 1 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Business Profile</h3>
            <p>Contact details, logo, and footer text added to every generated PDF invoice.</p>
          </div>
          <form onSubmit={saveSettings}>
            {/* Logo */}
            <div className={styles.logoSection}>
              <div className={styles.logoPreviewWrap}>
                {form.logo ? (
                  <img src={form.logo} alt="Company logo" className={styles.logoPreview} />
                ) : (
                  <div className={styles.logoPlaceholder}>No logo</div>
                )}
              </div>
              <div className={styles.logoActions}>
                <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>Upload Logo</Button>
                {form.logo && <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, logo: null }))}>Remove</Button>}
                <input type="file" accept="image/*" ref={logoInputRef} className={styles.fileInput} onChange={handleLogoUpload} />
                <p className={styles.logoHint}>JPEG or PNG, max 600 KB. Stored in your browser.</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Street Address" className={styles.colSpan2}>
                <Input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main Street" />
              </FormField>
              <FormField label="City">
                <Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Toronto" />
              </FormField>
              <FormField label="Province">
                <Select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}>
                  {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Postal Code">
                <Input value={form.postalCode || ''} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="M5V 3A8" />
              </FormField>
              <FormField label="Phone">
                <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(416) 555-0123" />
              </FormField>
              <FormField label="Email">
                <Input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="billing@example.com" />
              </FormField>
              <FormField label="Website" className={styles.colSpan2}>
                <Input value={form.website || ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
              </FormField>
            </div>

            <FormField label="Invoice Footer Notes" hint="Appears at the bottom of every PDF invoice (payment instructions, legal text, etc.)">
              <Textarea
                rows={4}
                value={form.invoiceFooterNotes || ''}
                onChange={e => setForm(f => ({ ...f, invoiceFooterNotes: e.target.value }))}
                placeholder={`e.g. Payment due within 30 days. E-transfer to payment@yourco.ca — include invoice number in the message.\n\nThanks for your business!`}
              />
            </FormField>

            <div className={styles.actions}>
              <Button type="submit">Save Business Profile</Button>
              {saved && <span className={styles.savedMsg}>✅ Saved!</span>}
            </div>
          </form>
        </div>
      )}

      {/* ══ Fiscal Years ══ */}
      {tab === 2 && (
        <div className={styles.section}>
          <div className={styles.fyHeader}>
            <div>
              <h3>Fiscal Year Management</h3>
              <p>Fiscal year runs December 1 – November 30. Current active year: <strong>{state.activeFiscalYear}</strong></p>
            </div>
            <Button size="sm" onClick={() => setShowFYModal(true)}>+ Add Fiscal Year</Button>
          </div>

          <div className={styles.fyList}>
            {fyEntries.map(({ key, fy, invCount, expCount, divCount }) => (
              <div key={key} className={`${styles.fyRow} ${key === state.activeFiscalYear ? styles.fyRowActive : ''}`}>
                <div className={styles.fyInfo}>
                  <strong className={styles.fyKey}>{fy.label || key}</strong>
                  <span className={styles.fyDates}>{formatDate(fy.startDate)} – {formatDate(fy.endDate)}</span>
                  <span className={styles.fyStats}>
                    {invCount} invoices · {expCount} expenses · {divCount} dividends
                  </span>
                </div>
                <div className={styles.fyActions}>
                  {key === state.activeFiscalYear
                    ? <span className={styles.activeBadge}>Active</span>
                    : <Button size="xs" variant="secondary" onClick={() => setActiveFY(key)}>Set Active</Button>
                  }
                </div>
              </div>
            ))}
          </div>

          <div className={styles.fyNote}>
            <strong>Note:</strong> Fiscal years cannot be deleted once created to preserve data integrity. To start fresh, use the Data tab to export a backup and then clear all data.
          </div>
        </div>
      )}

      {/* ══ Data ══ */}
      {tab === 3 && (
        <div className={styles.section}>
          <h3 className={styles.dataTitle}>Data Management</h3>

          <div className={`${styles.dataCard} ${styles.dataCardPrivacy}`}>
            <div className={styles.dataCardInfo}>
              <h4>🔒 Data Storage &amp; Privacy</h4>
              <p>
                Your financial data (invoices, expenses, dividends) is saved as <strong>unencrypted JSON in your browser&rsquo;s localStorage</strong>.
                It never leaves your device except when you explicitly use <em>Save to Cloud</em>, which stores it in your private Firestore account.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                Your personal profile (legal name, date of birth, SIN) is stored in <strong>Firestore under your account</strong> — encrypted in transit, access-controlled to your login only.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Recommendation:</strong> Lock your screen when stepping away from this device. Anyone with OS-level access to your browser profile can read the data in localStorage through the browser&rsquo;s developer tools.
              </p>
            </div>
          </div>

          <div className={styles.dataCard}>
            <div className={styles.dataCardInfo}>
              <h4>Export Backup</h4>
              <p>Download all your data as a JSON file. Use this to back up your data or transfer it to another device.</p>
            </div>
            <Button variant="secondary" onClick={handleExport}>⬇ Export JSON</Button>
          </div>

          <div className={styles.dataCard}>
            <div className={styles.dataCardInfo}>
              <h4>Import Backup</h4>
              <p>Restore data from a previously exported JSON backup. <strong>This will overwrite all current data.</strong></p>
              {importError && <p className={styles.importError}>{importError}</p>}
              {importSuccess && <p className={styles.importSuccess}>✅ Data restored successfully!</p>}
            </div>
            <div>
              <input type="file" accept=".json" ref={importRef} className={styles.fileInput} onChange={handleImport} />
              <Button variant="secondary" onClick={() => importRef.current?.click()}>⬆ Import JSON</Button>
            </div>
          </div>

          <div className={`${styles.dataCard} ${styles.dataCardDanger}`}>
            <div className={styles.dataCardInfo}>
              <h4>Clear All Data</h4>
              <p>Permanently delete all data including invoices, expenses, dividends, and settings. This cannot be undone.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmClear(true)}>🗑 Clear All Data</Button>
          </div>

          <div className={styles.dataCard}>
            <div className={styles.dataCardInfo}>
              <h4>☁ Firebase Cloud Backup</h4>
              <p>Save your data to Firestore under your account, or restore from a previous cloud backup. Data is stored privately under your user ID.</p>
              {cloudMsg && (
                <p className={cloudStatus === 'error' ? styles.importError : styles.importSuccess}>{cloudMsg}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                onClick={handleCloudSave}
                loading={cloudStatus === 'saving'}
                disabled={!user || cloudStatus === 'saving' || cloudStatus === 'restoring'}
              >
                ⬆ Save to Cloud
              </Button>
              <Button
                variant="secondary"
                onClick={handleCloudRestore}
                loading={cloudStatus === 'restoring'}
                disabled={!user || cloudStatus === 'saving' || cloudStatus === 'restoring'}
              >
                ⬇ Restore from Cloud
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Personal Profile ══ */}
      {tab === 4 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Personal Profile</h3>
            <p>Marital status, spouse details, and dependants used for spousal credits and T1 tax estimates.</p>
          </div>
          <form onSubmit={savePP}>
            <div className={styles.subsectionHeader}>
              <h4>Your Personal Details</h4>
            </div>
            <div className={styles.formGrid}>
              <FormField label="Legal Name" hint="Your name as it appears on your T1 return">
                <Input value={ppForm.ownerLegalName || ''} onChange={e => setPpForm(f => ({ ...f, ownerLegalName: e.target.value }))} placeholder="Jane Smith" />
              </FormField>
              <FormField label="Date of Birth" hint="Used for age-related credits">
                <Input type="date" value={ppForm.ownerDOB || ''} onChange={e => setPpForm(f => ({ ...f, ownerDOB: e.target.value }))} />
              </FormField>
              <FormField label="Social Insurance Number (SIN)" hint="Optional — stored privately. Never transmitted.">
                <Input value={ppForm.ownerSIN || ''} onChange={e => setPpForm(f => ({ ...f, ownerSIN: e.target.value }))} placeholder="000 000 000" maxLength={11} />
              </FormField>
            </div>

            <div className={styles.subsectionHeader}>
              <h4>Marital Status</h4>
            </div>
            <div className={styles.formGrid}>
              <FormField label="Marital Status">
                <Select value={ppForm.maritalStatus || ''} onChange={e => setPpForm(f => ({ ...f, maritalStatus: e.target.value }))}>
                  {MARITAL_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </FormField>
            </div>

            {hasSpouse && (
              <>
                <div className={styles.subsectionHeader}>
                  <h4>Spouse / Partner</h4>
                </div>
                <div className={styles.formGrid}>
                  <FormField label="Spouse / Partner Name">
                    <Input value={ppForm.spouseName || ''} onChange={e => setPpForm(f => ({ ...f, spouseName: e.target.value }))} placeholder="Jane Smith" />
                  </FormField>
                  <FormField label="Employment Status">
                    <Select value={ppForm.spouseIncomeType || ''} onChange={e => setPpForm(f => ({ ...f, spouseIncomeType: e.target.value }))}>
                      {SPOUSE_INCOME_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </FormField>
                  {ppForm.spouseIncomeType && ppForm.spouseIncomeType !== 'none' && (
                    <FormField label="Estimated Annual Income">
                      <Input type="number" min="0" value={ppForm.spouseEstIncome || ''} onChange={e => setPpForm(f => ({ ...f, spouseEstIncome: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                    </FormField>
                  )}
                </div>
              </>
            )}

            <div className={styles.subsectionHeader}>
              <h4>Dependants</h4>
              <Button type="button" size="sm" variant="secondary" onClick={addDep}>+ Add Dependant</Button>
            </div>

            {deps.length === 0 && (
              <p className={styles.fyNote}>No dependants added. Click "+ Add Dependant" to add a child, parent, or other eligible dependant.</p>
            )}

            {deps.map(dep => (
              <div key={dep.id} className={styles.depRow}>
                <div className={styles.formGrid}>
                  <FormField label="Name (optional)">
                    <Input value={dep.name || ''} onChange={e => updateDep(dep.id, 'name', e.target.value)} placeholder="e.g. Alex Smith" />
                  </FormField>
                  <FormField label="Birth Year">
                    <Input type="number" min="1900" max={new Date().getFullYear()} value={dep.birthYear || ''} onChange={e => updateDep(dep.id, 'birthYear', e.target.value)} placeholder={String(new Date().getFullYear() - 10)} />
                  </FormField>
                  <FormField label="Relationship">
                    <Select value={dep.relationship || 'child'} onChange={e => updateDep(dep.id, 'relationship', e.target.value)}>
                      {DEPENDANT_RELATIONSHIPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Eligible for DTC?">
                    <Select value={dep.disability ? 'yes' : 'no'} onChange={e => updateDep(dep.id, 'disability', e.target.value === 'yes')}>
                      <option value="no">No</option>
                      <option value="yes">Yes — eligible for DTC</option>
                    </Select>
                  </FormField>
                </div>
                <button type="button" className={styles.depRemove} onClick={() => removeDep(dep.id)} aria-label="Remove dependant">✕</button>
              </div>
            ))}

            <div className={styles.actions}>
              <Button type="submit">Save Personal Profile</Button>
              {ppSaved && <span className={styles.savedMsg}>✅ Saved!</span>}
            </div>
          </form>
        </div>
      )}

      {/* ══ Access (Accountant Portal) ══ */}
      {tab === 5 && (
        <div className={styles.section}>
          <h3>Accountant Access</h3>
          <p className={styles.sectionDesc}>Grant your accountant read-only access to this company’s financial data. When they sign in with their email they can view it at <Link href="/accountant" style={{color:'var(--accent)'}}>the Accountant View page</Link>.</p>
          <p className={styles.sectionDesc}>Share this link with your accountant: <strong>localhost:3000/accountant/login</strong></p>

          {companyId ? (
            <>
              <div className={styles.accessRow}>
                <input
                  className={styles.accessInput}
                  type="email"
                  placeholder="accountant@firm.ca"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAccountant())}
                />
                <Button onClick={addAccountant} disabled={accessLoading || !newEmail.trim()}>Grant Access</Button>
              </div>

              {accountantEmails.length === 0 ? (
                <p className={styles.accessEmpty}>No accountants have been granted access yet.</p>
              ) : (
                <div className={styles.accessList}>
                  {accountantEmails.map(email => (
                    <div key={email} className={styles.accessItem}>
                      <span className={styles.accessEmail}>{email}</span>
                      <button
                        className={styles.accessInvite}
                        onClick={() => sendInvite(email)}
                        disabled={accessLoading}
                        title="Send magic link invite"
                      >Send Invite</button>
                      <button
                        className={styles.accessRemove}
                        onClick={() => removeAccountant(email)}
                        disabled={accessLoading}
                        aria-label={`Remove ${email}`}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <p className={styles.accessNote}>
                Accountants can only <strong>view</strong> your data — they cannot edit, delete, or export. Remove access at any time.
              </p>
            </>
          ) : (
            <p className={styles.accessEmpty}>Select a company first to manage accountant access.</p>
          )}
        </div>
      )}

      {/* ── Add Fiscal Year Modal ── */}
      <Modal isOpen={showFYModal} onClose={() => setShowFYModal(false)} title="Add Fiscal Year" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFYModal(false)}>Cancel</Button>
            <Button type="submit" form="fy-form">Create</Button>
          </>
        }
      >
        <form id="fy-form" onSubmit={createFiscalYear}>
          <p className={styles.fyModalHint}>Fiscal year: December 1, [start year] to November 30, [end year]</p>
          <div className={styles.fyModalGrid}>
            <FormField label="Start Year">
              <Input type="number" min="2000" max="2099" value={fyForm.startYear} onChange={e => setFYForm(f => ({ ...f, startYear: e.target.value, endYear: parseInt(e.target.value) + 1 }))} required />
            </FormField>
            <FormField label="End Year">
              <Input type="number" min="2001" max="2100" value={fyForm.endYear} readOnly style={{ opacity: 0.7 }} />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Clear ── */}
      <Modal isOpen={confirmClear} onClose={() => setConfirmClear(false)} title="Clear All Data?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button variant="danger" onClick={doClearData}>Yes, Delete Everything</Button>
          </>
        }
      >
        <p>This will permanently delete all invoices, expenses, settings, dividends, and personal tax data. Export a backup first if you want to keep anything.</p>
      </Modal>

      {/* ── Confirm Cloud Restore ── */}
      <Modal isOpen={confirmRestore} onClose={() => setConfirmRestore(false)} title="Restore from Cloud?" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestore(false)}>Cancel</Button>
            <Button variant="danger" onClick={doCloudRestore}>Yes, Restore</Button>
          </>
        }
      >
        <p>This will overwrite all current data with your cloud backup. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
