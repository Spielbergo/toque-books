'use client';

import { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { exportDataAsJSON, importDataFromJSON, clearData } from '@/lib/storage';
import { formatDate, today } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
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

const TABS = ['Company', 'Business Profile', 'Fiscal Years', 'Data'];

export default function SettingsPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState(0);

  // Company form
  const [form, setForm] = useState({ ...state.settings });
  const [saved, setSaved] = useState(false);

  // Logo upload
  const logoInputRef = useRef(null);

  const handleLogoUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600 * 1024) {
      alert('Logo file is too large. Please use an image under 600 KB.');
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
      alert(`${key} already exists.`);
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
            {Object.entries(state.fiscalYears).map(([key, fy]) => (
              <div key={key} className={`${styles.fyRow} ${key === state.activeFiscalYear ? styles.fyRowActive : ''}`}>
                <div className={styles.fyInfo}>
                  <strong className={styles.fyKey}>{fy.label || key}</strong>
                  <span className={styles.fyDates}>{formatDate(fy.startDate)} – {formatDate(fy.endDate)}</span>
                  <span className={styles.fyStats}>
                    {(fy.invoices?.length || 0)} invoices · {(fy.expenses?.length || 0)} expenses · {(fy.dividendsPaid?.length || 0)} dividends
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
    </div>
  );
}
