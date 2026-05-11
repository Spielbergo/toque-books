'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import CanBooksLogo from '@/components/CanBooksLogo';
import Button from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

// ─── Constants ───────────────────────────────────────────────────────────────

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

const MONTHS = [
  { value: 1,  label: 'January' },
  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const BUSINESS_TYPES = [
  {
    value: 'ccpc',
    icon: '🏢',
    label: 'Canadian Corporation (CCPC)',
    desc: 'Incorporated company. Eligible for the small business deduction.',
  },
  {
    value: 'sole_prop',
    icon: '👤',
    label: 'Sole Proprietor',
    desc: 'You run the business personally. Income reported on your T1.',
  },
  {
    value: 'partnership',
    icon: '🤝',
    label: 'Partnership',
    desc: 'Two or more people sharing ownership. Unincorporated.',
  },
  {
    value: 'pc',
    icon: '⚕️',
    label: 'Professional Corporation',
    desc: 'e.g., Medical PC, Law Corp, Dental PC. CCPC rules generally apply.',
  },
  {
    value: 'holding',
    icon: '🏦',
    label: 'Holding Company',
    desc: 'Holds investments or assets from an operating company.',
  },
  {
    value: 'other',
    icon: '📋',
    label: 'Other / Not Sure',
    desc: "We'll set up a general profile. You can update later in Settings.",
  },
];

const MARITAL_STATUSES = [
  { value: 'single',       label: 'Single' },
  { value: 'married',      label: 'Married' },
  { value: 'common_law',   label: 'Common-law' },
  { value: 'separated',    label: 'Separated' },
  { value: 'divorced',     label: 'Divorced' },
  { value: 'widowed',      label: 'Widowed' },
];

const SPOUSE_INCOME_TYPES = [
  { value: 'employed',      label: 'Employed (T4)' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'none',          label: 'Not Working / Retired' },
];

const DEPENDANT_RELATIONSHIPS = [
  { value: 'child',     label: 'Child' },
  { value: 'parent',    label: 'Parent' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling',   label: 'Sibling' },
  { value: 'other',     label: 'Other' },
];

const PAYS_SELF_OPTIONS = [
  { value: 'dividends', label: 'Dividends',   desc: 'Pay yourself through corporate dividends' },
  { value: 'salary',    label: 'Salary / T4', desc: 'Pay yourself a T4 employment income' },
  { value: 'mix',       label: 'Mix of Both', desc: 'Combination of salary and dividends' },
  { value: 'none',      label: 'Not Yet',     desc: "Haven't started paying myself yet" },
];

const TOTAL_STEPS = 10; // steps 0–9, then "done" at step 10

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysInMonth(month) {
  // month is 1-indexed
  const days28 = [2];
  const days30 = [4, 6, 9, 11];
  if (days28.includes(month)) return 28;
  if (days30.includes(month)) return 30;
  return 31;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { dispatch, state } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const logoInputRef      = useRef(null);
  const badgeLogoInputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [wiz, setWiz] = useState({
    // Step 1 — Business Type
    businessType: 'ccpc',

    // Step 2 — Company Info
    companyName: state?.settings?.companyName || '',
    legalName: '',
    province: 'ON',
    hstRegistered: true,
    hstNumber: '',
    businessNumber: '',
    incorporationYear: String(new Date().getFullYear()),

    // Step 3 — Fiscal Year
    fiscalEndMonth: 11,
    fiscalEndDay: 30,

    // Step 4 — Contact & Branding
    ownerName: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: '',
    website: '',
    logo: null,
    badgeLogo: null,
    logoSameForBoth: false,

    // Step 5 — Personal Tax Situation
    maritalStatus: '',
    spouseName: '',
    spouseIncomeType: '',
    spouseEstIncome: '',

    // Step 6 — Dependants
    hasDependants: false,
    dependants: [],     // [{ id, name, birthYear, relationship, disability }]
    hasOtherDependants: false,

    // Step 7 — Other Income
    hasEmployment: false,
    employmentAmount: '',
    hasRental: false,
    rentalAmount: '',
    hasForeign: false,
    foreignAmount: '',
    rrspRoom: '',
    usesTFSA: false,

    // Step 8 — Business Operations
    homeOffice: false,
    officeSqFt: '',
    totalHomeSqFt: '',
    vehicleBusiness: false,
    vehicleBusinessPct: '',
    hasEmployees: false,
    numEmployees: '',
    paysSelf: 'dividends',
    otherShareholders: false,

    // Step 9 — Invoice Defaults
    defaultPaymentTerms: 30,
    invoiceFooterNotes: '',
  });

  const set = (field, value) => setWiz(w => ({ ...w, [field]: value }));
  const toggle = (field) => setWiz(w => ({ ...w, [field]: !w[field] }));

  // Sync company name from state once it becomes available (handles async load timing)
  const syncedCompanyName = useRef(false);
  useEffect(() => {
    if (!syncedCompanyName.current && state?.settings?.companyName) {
      syncedCompanyName.current = true;
      setWiz(w => w.companyName ? w : { ...w, companyName: state.settings.companyName });
    }
  }, [state?.settings?.companyName]);

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateStep(s) {
    const errs = {};
    if (s === 2) {
      if (!wiz.companyName.trim()) errs.companyName = 'Business name is required.';
    }
    if (s === 4) {
      if (!wiz.ownerName.trim()) errs.ownerName = 'Owner name is required.';
    }
    return errs;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    // Auto-set sole prop fiscal year
    if (step === 1 && wiz.businessType === 'sole_prop') {
      setWiz(w => ({ ...w, fiscalEndMonth: 12, fiscalEndDay: 31 }));
    }

    if (step === TOTAL_STEPS - 1) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const skipStep = () => {
    setErrors({});
    setStep(s => s + 1);
  };

  // ── Finish ─────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const payload = {
        settings: {
          companyName:          wiz.companyName.trim(),
          legalName:            wiz.legalName.trim(),
          businessNumber:       wiz.businessNumber.trim(),
          ownerName:            wiz.ownerName.trim(),
          province:             wiz.province,
          hstRegistered:        wiz.hstRegistered,
          hstNumber:            wiz.hstNumber.trim(),
          incorporationYear:    parseInt(wiz.incorporationYear) || new Date().getFullYear(),
          fiscalEndMonth:       wiz.fiscalEndMonth,
          fiscalEndDay:         wiz.fiscalEndDay,
          address:              wiz.address.trim(),
          city:                 wiz.city.trim(),
          postalCode:           wiz.postalCode.trim(),
          phone:                wiz.phone.trim(),
          email:                wiz.email.trim(),
          website:              wiz.website.trim(),
          logo:                 wiz.logo,
          badgeLogo:            wiz.logoSameForBoth ? wiz.logo : wiz.badgeLogo,
          defaultPaymentTerms:  wiz.defaultPaymentTerms,
          invoiceFooterNotes:   wiz.invoiceFooterNotes.trim(),
        },
        businessType: wiz.businessType,
        personalProfile: {
          maritalStatus:    wiz.maritalStatus,
          spouseName:       wiz.spouseName.trim(),
          spouseIncomeType: wiz.spouseIncomeType,
          spouseEstIncome:  parseFloat(wiz.spouseEstIncome) || 0,
        },
        dependants: wiz.hasDependants ? wiz.dependants : [],
        businessOps: {
          homeOffice:          wiz.homeOffice,
          vehicleBusiness:     wiz.vehicleBusiness,
          vehicleBusinessPct:  parseFloat(wiz.vehicleBusinessPct) || 0,
          hasEmployees:        wiz.hasEmployees,
          numEmployees:        parseInt(wiz.numEmployees) || 0,
          paysSelf:            wiz.paysSelf,
          otherShareholders:   wiz.otherShareholders,
        },
        otherIncomeSources: {
          hasEmployment:    wiz.hasEmployment,
          employmentAmount: parseFloat(wiz.employmentAmount) || 0,
          hasRental:        wiz.hasRental,
          rentalAmount:     parseFloat(wiz.rentalAmount) || 0,
          hasForeign:       wiz.hasForeign,
          foreignAmount:    parseFloat(wiz.foreignAmount) || 0,
          rrspRoom:         parseFloat(wiz.rrspRoom) || 0,
          usesTFSA:         wiz.usesTFSA,
        },
        fiscalYearPatch: wiz.homeOffice ? {
          homeOffice: {
            officeSqFt:    parseFloat(wiz.officeSqFt)    || 0,
            totalHomeSqFt: parseFloat(wiz.totalHomeSqFt) || 0,
            months: 12,
            monthlyExpenses: { rent: 0, mortgageInterest: 0, utilities: 0, heat: 0, internet: 0, propertyTax: 0, maintenance: 0, condoFees: 0 },
          },
        } : null,
      };

      dispatch({ type: 'COMPLETE_ONBOARDING', payload });
      setStep(TOTAL_STEPS); // Show done screen
    } finally {
      setSubmitting(false);
    }
  };

  const goToDashboard = () => router.replace('/');

  // ── Logo uploads ────────────────────────────────────────────────────────────
  const handleLogoUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600 * 1024) { toast({ message: 'Logo too large — max 600 KB.', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target.result;
      setWiz(w => ({
        ...w,
        logo: data,
        // If "use same for both" is on, keep badge in sync
        badgeLogo: w.logoSameForBoth ? data : w.badgeLogo,
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBadgeLogoUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) { toast({ message: 'Badge logo too large — max 300 KB.', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = ev => set('badgeLogo', ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Dependants helpers ──────────────────────────────────────────────────────
  const addDependant = () => {
    setWiz(w => ({
      ...w,
      dependants: [...w.dependants, { id: uuidv4(), name: '', birthYear: '', relationship: 'child', disability: false }],
    }));
  };

  const updateDependant = (id, field, value) => {
    setWiz(w => ({
      ...w,
      dependants: w.dependants.map(d => d.id === id ? { ...d, [field]: value } : d),
    }));
  };

  const removeDependant = id => {
    setWiz(w => ({ ...w, dependants: w.dependants.filter(d => d.id !== id) }));
  };

  // ── Progress ────────────────────────────────────────────────────────────────
  // Steps 1-9 count as "real" steps (0 is welcome, 10 is done)
  const progressPct = step === 0 ? 0 : step >= TOTAL_STEPS ? 100 : Math.round((step / (TOTAL_STEPS - 1)) * 100);
  const stepLabel   = step === 0 ? '' : step >= TOTAL_STEPS ? 'Complete' : `Step ${step} of ${TOTAL_STEPS - 1}`;

  // ── Render step content ─────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {

      // ── Step 0: Welcome ──────────────────────────────────────────────────
      case 0:
        return (
          <div className={styles.welcomeCard}>
            <CanBooksLogo size={72} />
            <h1 className={styles.welcomeTitle}>Welcome to NorthBooks</h1>
            <p className={styles.welcomeSubtitle}>
              Let&apos;s set up your profile in a few quick steps. This helps us
              tailor your tax calculations, invoices, and reports to your exact situation.
            </p>
            <p className={styles.welcomeMeta}>
              Takes about 3–5 minutes &middot; You can update everything later in Settings
            </p>
            <Button onClick={() => setStep(1)} size="lg">Get Started →</Button>
          </div>
        );

      // ── Step 1: Business Type ─────────────────────────────────────────────
      case 1:
        return (
          <>
            <h2 className={styles.stepTitle}>Business Structure</h2>
            <p className={styles.stepSubtitle}>What type of business are you setting up?</p>
            <div className={styles.radioGrid}>
              {BUSINESS_TYPES.map(bt => (
                <button
                  key={bt.value}
                  type="button"
                  className={`${styles.radioCard} ${wiz.businessType === bt.value ? styles.radioCardSelected : ''}`}
                  onClick={() => set('businessType', bt.value)}
                >
                  <span className={styles.radioCardIcon}>{bt.icon}</span>
                  <div className={styles.radioCardLabel}>{bt.label}</div>
                  <div className={styles.radioCardDesc}>{bt.desc}</div>
                </button>
              ))}
            </div>
          </>
        );

      // ── Step 2: Company Info ──────────────────────────────────────────────
      case 2: {
        const isSoleProp = wiz.businessType === 'sole_prop';
        return (
          <>
            <h2 className={styles.stepTitle}>{isSoleProp ? 'Business Info' : 'Company Information'}</h2>
            <p className={styles.stepSubtitle}>This appears on your invoices and tax reports.</p>
            <div className={styles.fieldGroup}>
              <FormField label={isSoleProp ? 'Business / Trading Name' : 'Company Name'} error={errors.companyName} required>
                <Input
                  value={wiz.companyName}
                  onChange={e => set('companyName', e.target.value)}
                  placeholder={isSoleProp ? 'Jane Smith Web Design' : 'Acme Web Dev Inc.'}
                />
              </FormField>

              {!isSoleProp && (
                <FormField label="Legal Name" hint="If different from trading/operating name — leave blank if the same">
                  <Input
                    value={wiz.legalName}
                    onChange={e => set('legalName', e.target.value)}
                    placeholder="1234567 Ontario Inc."
                  />
                </FormField>
              )}

              <div className={styles.twoCol}>
                <FormField label="Province / Territory">
                  <Select value={wiz.province} onChange={e => set('province', e.target.value)}>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </FormField>

                <FormField
                  label={isSoleProp ? 'Year Business Started' : 'Year Incorporated'}
                >
                  <Input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={wiz.incorporationYear}
                    onChange={e => set('incorporationYear', e.target.value)}
                  />
                </FormField>
              </div>

              <div className={`${styles.toggleRow}`}>
                <div>
                  <div className={styles.toggleLabel}>
                    {wiz.province === 'QC' ? 'GST/QST Registered' : 'HST/GST Registered'}
                  </div>
                  <div className={styles.toggleDesc}>
                    Required once you earn $30,000+ in revenue
                  </div>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={wiz.hstRegistered} onChange={() => toggle('hstRegistered')} />
                  <span className={styles.toggleThumb} />
                </label>
              </div>

              {wiz.hstRegistered && (
                <div className={styles.twoCol}>
                  <FormField label="HST / GST Number" hint="Format: 123456789 RT0001">
                    <Input
                      value={wiz.hstNumber}
                      onChange={e => set('hstNumber', e.target.value)}
                      placeholder="123456789 RT0001"
                    />
                  </FormField>
                  <FormField label="Business Number (BN9)" hint="First 9 digits of your CRA BN">
                    <Input
                      value={wiz.businessNumber}
                      onChange={e => set('businessNumber', e.target.value)}
                      placeholder="123456789"
                      maxLength={9}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </>
        );
      }

      // ── Step 3: Fiscal Year ───────────────────────────────────────────────
      case 3: {
        const isSoleProp = wiz.businessType === 'sole_prop';
        const maxDay = daysInMonth(wiz.fiscalEndMonth);

        const days = Array.from({ length: maxDay }, (_, i) => i + 1);

        return (
          <>
            <h2 className={styles.stepTitle}>Fiscal Year End</h2>
            <p className={styles.stepSubtitle}>
              The last day of your business&apos;s accounting year.
            </p>

            {isSoleProp ? (
              <div className={styles.callout}>
                ℹ️ The CRA generally requires sole proprietors to use <strong>December 31</strong> as
                their fiscal year end. Your fiscal year has been set accordingly.
              </div>
            ) : (
              <div className={styles.callout}>
                ℹ️ CCPCs can choose any fiscal year end. A popular choice is <strong>November 30</strong>,
                which gives time to plan salary/dividends before calendar year end. You can change this in
                Settings later.
              </div>
            )}

            <div className={styles.twoCol}>
              <FormField label="End Month">
                <Select
                  value={wiz.fiscalEndMonth}
                  onChange={e => {
                    const m = parseInt(e.target.value);
                    const maxD = daysInMonth(m);
                    set('fiscalEndMonth', m);
                    if (wiz.fiscalEndDay > maxD) set('fiscalEndDay', maxD);
                  }}
                  disabled={isSoleProp}
                >
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </FormField>

              <FormField label="End Day">
                <Select
                  value={wiz.fiscalEndDay}
                  onChange={e => set('fiscalEndDay', parseInt(e.target.value))}
                  disabled={isSoleProp}
                >
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </FormField>
            </div>

            <p className={styles.fieldNote}>
              Your fiscal year will run from{' '}
              <strong>
                {MONTHS.find(m => m.value === (wiz.fiscalEndMonth % 12) + 1)?.label} 1
              </strong>{' '}
              to{' '}
              <strong>
                {MONTHS.find(m => m.value === wiz.fiscalEndMonth)?.label} {wiz.fiscalEndDay}
              </strong>
              .
            </p>
          </>
        );
      }

      // ── Step 4: Contact & Branding ────────────────────────────────────────
      case 4:
        return (
          <>
            <h2 className={styles.stepTitle}>Contact & Branding</h2>
            <p className={styles.stepSubtitle}>
              Shown on your invoices and correspondence. All fields except your name are optional.
            </p>
            <div className={styles.fieldGroup}>
              <FormField label="Owner / Principal Name" error={errors.ownerName} required hint="Appears on invoices as the sender">
                <Input
                  value={wiz.ownerName}
                  onChange={e => set('ownerName', e.target.value)}
                  placeholder="Jane Smith"
                />
              </FormField>

              <FormField label="Business Address">
                <Input
                  value={wiz.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="123 Main Street, Suite 100"
                />
              </FormField>

              <div className={styles.threeCol}>
                <FormField label="City">
                  <Input
                    value={wiz.city}
                    onChange={e => set('city', e.target.value)}
                    placeholder="Ottawa"
                  />
                </FormField>
                <FormField label="Province">
                  <Select value={wiz.province} onChange={e => set('province', e.target.value)}>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                  </Select>
                </FormField>
                <FormField label="Postal Code">
                  <Input
                    value={wiz.postalCode}
                    onChange={e => set('postalCode', e.target.value.toUpperCase())}
                    placeholder="K2P 0A1"
                    maxLength={7}
                  />
                </FormField>
              </div>

              <div className={styles.twoCol}>
                <FormField label="Phone">
                  <Input
                    type="tel"
                    value={wiz.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="613-555-0100"
                  />
                </FormField>
                <FormField label="Email">
                  <Input
                    type="email"
                    value={wiz.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="billing@yourco.ca"
                  />
                </FormField>
              </div>

              <FormField label="Website">
                <Input
                  type="url"
                  value={wiz.website}
                  onChange={e => set('website', e.target.value)}
                  placeholder="https://yourco.ca"
                />
              </FormField>

              {/* Logo upload — Invoice logo (wide / horizontal) */}
              <FormField label="Invoice Logo" hint="Appears at the top of PDF invoices. Wide or horizontal format works best. Max 600 KB.">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                />
                {wiz.logo ? (
                  <div className={styles.logoPreviewWrap}>
                    <img src={wiz.logo} alt="Logo preview" className={styles.logoPreview} />
                    <div className={styles.logoPreviewActions}>
                      <button type="button" className={styles.logoClear} onClick={() => set('logo', null)}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.logoBox}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <span className={styles.logoBoxIcon}>🖼️</span>
                    <span className={styles.logoBoxLabel}>Click to upload invoice logo</span>
                    <span className={styles.logoBoxNote}>PNG, JPG, or SVG · Max 600 KB</span>
                  </button>
                )}
              </FormField>

              {/* Same-image toggle */}
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Use the same logo as the sidebar badge</div>
                  <div className={styles.toggleDesc}>The badge appears in the app sidebar next to your company name (square format works best)</div>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={wiz.logoSameForBoth}
                    onChange={() => {
                      const next = !wiz.logoSameForBoth;
                      setWiz(w => ({
                        ...w,
                        logoSameForBoth: next,
                        badgeLogo: next ? w.logo : w.badgeLogo,
                      }));
                    }}
                  />
                  <span className={styles.toggleThumb} />
                </label>
              </div>

              {/* Badge logo — only shown when not using same image */}
              {!wiz.logoSameForBoth && (
                <FormField label="Sidebar Badge Logo" hint="Small square logo shown in the sidebar and app header. PNG with transparent background, max 300 KB.">
                  <input
                    ref={badgeLogoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleBadgeLogoUpload}
                  />
                  {wiz.badgeLogo ? (
                    <div className={styles.logoPreviewWrap}>
                      <img src={wiz.badgeLogo} alt="Badge logo preview" className={styles.badgeLogoPreview} />
                      <div className={styles.logoPreviewActions}>
                        <button type="button" className={styles.logoClear} onClick={() => set('badgeLogo', null)}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.logoBox}
                      onClick={() => badgeLogoInputRef.current?.click()}
                    >
                      <span className={styles.logoBoxIcon}>🔲</span>
                      <span className={styles.logoBoxLabel}>Click to upload badge logo</span>
                      <span className={styles.logoBoxNote}>Square PNG recommended · Max 300 KB</span>
                    </button>
                  )}
                </FormField>
              )}
            </div>
          </>
        );

      // ── Step 5: Personal Tax Situation ────────────────────────────────────
      case 5: {
        const hasSpouse = wiz.maritalStatus === 'married' || wiz.maritalStatus === 'common_law';
        return (
          <>
            <h2 className={styles.stepTitle}>Personal Tax Situation</h2>
            <p className={styles.stepSubtitle}>
              Used to tailor your T1 estimates, income-splitting, and spousal RRSP calculations.
            </p>

            <FormField label="Marital Status">
              <div className={styles.statusGrid}>
                {MARITAL_STATUSES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    className={`${styles.statusCard} ${wiz.maritalStatus === s.value ? styles.statusCardSelected : ''}`}
                    onClick={() => set('maritalStatus', s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </FormField>

            {hasSpouse && (
              <div className={styles.fieldGroup} style={{ marginTop: '1.25rem' }}>
                <div className={styles.spouseSection}>
                  <h4 className={styles.subSectionTitle}>Spouse / Partner Information</h4>
                </div>

                <FormField label="Spouse / Partner Name">
                  <Input
                    value={wiz.spouseName}
                    onChange={e => set('spouseName', e.target.value)}
                    placeholder="Alex Smith"
                  />
                </FormField>

                <FormField label="Employment Status">
                  <div className={styles.statusGrid}>
                    {SPOUSE_INCOME_TYPES.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        className={`${styles.statusCard} ${wiz.spouseIncomeType === s.value ? styles.statusCardSelected : ''}`}
                        onClick={() => set('spouseIncomeType', s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </FormField>

                {wiz.spouseIncomeType && wiz.spouseIncomeType !== 'none' && (
                  <FormField label="Estimated Annual Income" hint="Used for income-splitting calculations">
                    <Input
                      type="number"
                      min="0"
                      prefix="$"
                      value={wiz.spouseEstIncome}
                      onChange={e => set('spouseEstIncome', e.target.value)}
                      placeholder="75000"
                    />
                  </FormField>
                )}
              </div>
            )}

            {!wiz.maritalStatus && (
              <p className={styles.fieldNote} style={{ marginTop: '0.75rem' }}>
                Select a marital status above, or skip this step to fill it in later.
              </p>
            )}
          </>
        );
      }

      // ── Step 6: Dependants ────────────────────────────────────────────────
      case 6:
        return (
          <>
            <h2 className={styles.stepTitle}>Dependants</h2>
            <p className={styles.stepSubtitle}>
              Children and other dependants may qualify for credits like the Canada Child Benefit,
              Disability Amount transfer, and Caregiver Amount.
            </p>

            <div className={styles.toggleRow} style={{ marginBottom: '1.25rem' }}>
              <div>
                <div className={styles.toggleLabel}>I have children or other dependants</div>
                <div className={styles.toggleDesc}>Enables credit and benefit tracking</div>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={wiz.hasDependants}
                  onChange={() => {
                    toggle('hasDependants');
                    if (!wiz.hasDependants && wiz.dependants.length === 0) addDependant();
                  }}
                />
                <span className={styles.toggleThumb} />
              </label>
            </div>

            {wiz.hasDependants && (
              <>
                <div className={styles.dependantListHeader}>
                  <span className={styles.dependantListTitle}>Dependant List</span>
                  <button type="button" className={styles.addDependantBtn} onClick={addDependant}>
                    + Add
                  </button>
                </div>

                {wiz.dependants.length === 0 && (
                  <p className={styles.fieldNote}>Click &quot;+ Add&quot; to add a dependant.</p>
                )}

                <div className={styles.dependantList}>
                  {wiz.dependants.map((dep, idx) => (
                    <div key={dep.id} className={styles.dependantRow}>
                      <div className={styles.dependantIndex}>{idx + 1}</div>
                      <div className={styles.dependantFields}>
                        <div className={styles.dependantRow2Col}>
                          <FormField label="Name (optional)">
                            <Input
                              value={dep.name}
                              onChange={e => updateDependant(dep.id, 'name', e.target.value)}
                              placeholder="First name"
                            />
                          </FormField>
                          <FormField label="Birth Year">
                            <Input
                              type="number"
                              min="1900"
                              max={new Date().getFullYear()}
                              value={dep.birthYear}
                              onChange={e => updateDependant(dep.id, 'birthYear', e.target.value)}
                              placeholder={String(new Date().getFullYear() - 5)}
                            />
                          </FormField>
                        </div>
                        <div className={styles.dependantRow2Col}>
                          <FormField label="Relationship">
                            <Select
                              value={dep.relationship}
                              onChange={e => updateDependant(dep.id, 'relationship', e.target.value)}
                            >
                              {DEPENDANT_RELATIONSHIPS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </Select>
                          </FormField>
                          <FormField label="Disability Credit?">
                            <Select
                              value={dep.disability ? 'yes' : 'no'}
                              onChange={e => updateDependant(dep.id, 'disability', e.target.value === 'yes')}
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes — eligible for DTC</option>
                            </Select>
                          </FormField>
                        </div>
                      </div>
                      <button type="button" className={styles.dependantRemove} onClick={() => removeDependant(dep.id)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <p className={styles.fieldNote}>
                  Birth years help calculate age-related benefits. The Disability Tax Credit (DTC) amount
                  can be transferred if the dependant doesn&apos;t need it.
                </p>
              </>
            )}
          </>
        );

      // ── Step 7: Other Income ──────────────────────────────────────────────
      case 7:
        return (
          <>
            <h2 className={styles.stepTitle}>Other Income Sources</h2>
            <p className={styles.stepSubtitle}>
              Select any income sources beyond your business. Amounts are optional estimates used only for planning.
            </p>

            <div className={styles.checkList}>
              {[
                {
                  field: 'hasEmployment',
                  amountField: 'employmentAmount',
                  label: 'Employment Income (T4)',
                  desc: 'Wages or salary from an employer other than your own company',
                },
                {
                  field: 'hasRental',
                  amountField: 'rentalAmount',
                  label: 'Rental Income',
                  desc: 'Net rental income from real estate properties',
                },
                {
                  field: 'hasForeign',
                  amountField: 'foreignAmount',
                  label: 'Foreign Income',
                  desc: 'Income from non-Canadian sources (may require T1135)',
                },
              ].map(item => (
                <div key={item.field} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    id={item.field}
                    checked={wiz[item.field]}
                    onChange={() => toggle(item.field)}
                  />
                  <label htmlFor={item.field} className={styles.checkItemContent}>
                    <div className={styles.checkItemLabel}>{item.label}</div>
                    <div className={styles.checkItemDesc}>{item.desc}</div>
                    {wiz[item.field] && (
                      <div className={styles.checkItemAmount}>
                        <Input
                          type="number"
                          min="0"
                          prefix="$"
                          value={wiz[item.amountField]}
                          onChange={e => set(item.amountField, e.target.value)}
                          placeholder="Est. annual amount"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </label>
                </div>
              ))}
            </div>

            <div className={styles.fieldGroup} style={{ marginTop: '1.25rem' }}>
              <div className={styles.twoCol}>
                <FormField label="Available RRSP Room" hint="From your last CRA Notice of Assessment">
                  <Input
                    type="number"
                    min="0"
                    prefix="$"
                    value={wiz.rrspRoom}
                    onChange={e => set('rrspRoom', e.target.value)}
                    placeholder="0"
                  />
                </FormField>

                <FormField label="TFSA">
                  <div
                    className={`${styles.statusCard} ${wiz.usesTFSA ? styles.statusCardSelected : ''}`}
                    style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                    onClick={() => toggle('usesTFSA')}
                  >
                    {wiz.usesTFSA ? '✓ I use a TFSA' : 'I use a TFSA'}
                  </div>
                </FormField>
              </div>
            </div>
          </>
        );

      // ── Step 8: Business Operations ───────────────────────────────────────
      case 8:
        return (
          <>
            <h2 className={styles.stepTitle}>Business Operations</h2>
            <p className={styles.stepSubtitle}>
              Helps calculate home office deductions, vehicle expenses, and payroll obligations.
            </p>

            <div className={styles.fieldGroup}>
              {/* Home Office */}
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Home Office</div>
                  <div className={styles.toggleDesc}>You use part of your home exclusively for work</div>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={wiz.homeOffice} onChange={() => toggle('homeOffice')} />
                  <span className={styles.toggleThumb} />
                </label>
              </div>

              {wiz.homeOffice && (
                <div className={styles.twoCol}>
                  <FormField label="Office Area (sq ft)">
                    <Input
                      type="number"
                      min="0"
                      value={wiz.officeSqFt}
                      onChange={e => set('officeSqFt', e.target.value)}
                      placeholder="150"
                    />
                  </FormField>
                  <FormField label="Total Home Area (sq ft)">
                    <Input
                      type="number"
                      min="0"
                      value={wiz.totalHomeSqFt}
                      onChange={e => set('totalHomeSqFt', e.target.value)}
                      placeholder="1200"
                    />
                  </FormField>
                </div>
              )}

              {/* Vehicle */}
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Vehicle Used for Business</div>
                  <div className={styles.toggleDesc}>Claim vehicle expenses on a per-kilometre or cost basis</div>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={wiz.vehicleBusiness} onChange={() => toggle('vehicleBusiness')} />
                  <span className={styles.toggleThumb} />
                </label>
              </div>

              {wiz.vehicleBusiness && (
                <FormField label="Estimated Business Use %" hint="e.g. 70 means 70% of driving is for business">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    suffix="%"
                    value={wiz.vehicleBusinessPct}
                    onChange={e => set('vehicleBusinessPct', e.target.value)}
                    placeholder="70"
                  />
                </FormField>
              )}

              {/* Employees */}
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Employees</div>
                  <div className={styles.toggleDesc}>You have one or more people on payroll (T4 slips required)</div>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={wiz.hasEmployees} onChange={() => toggle('hasEmployees')} />
                  <span className={styles.toggleThumb} />
                </label>
              </div>

              {wiz.hasEmployees && (
                <FormField label="Number of Employees">
                  <Input
                    type="number"
                    min="1"
                    value={wiz.numEmployees}
                    onChange={e => set('numEmployees', e.target.value)}
                    placeholder="2"
                  />
                </FormField>
              )}

              {/* Other Shareholders */}
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Other Shareholders</div>
                  <div className={styles.toggleDesc}>Other people own shares in this company</div>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={wiz.otherShareholders} onChange={() => toggle('otherShareholders')} />
                  <span className={styles.toggleThumb} />
                </label>
              </div>

              {/* How do you pay yourself */}
              <div>
                <div className={styles.subSectionTitle} style={{ marginBottom: '0.625rem' }}>How do you pay yourself?</div>
                <div className={styles.radioGridSm}>
                  {PAYS_SELF_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.radioCardSm} ${wiz.paysSelf === opt.value ? styles.radioCardSmSelected : ''}`}
                      onClick={() => set('paysSelf', opt.value)}
                    >
                      <div className={styles.radioCardSmLabel}>{opt.label}</div>
                      <div className={styles.radioCardSmDesc}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      // ── Step 9: Invoice Defaults ──────────────────────────────────────────
      case 9:
        return (
          <>
            <h2 className={styles.stepTitle}>Invoice Preferences</h2>
            <p className={styles.stepSubtitle}>
              Default settings applied to every new invoice. You can override these per invoice at any time.
            </p>

            <div className={styles.fieldGroup}>
              <FormField label="Default Payment Terms">
                <div className={styles.termsGrid}>
                  {[15, 30, 45, 60].map(days => (
                    <button
                      key={days}
                      type="button"
                      className={`${styles.termsCard} ${wiz.defaultPaymentTerms === days ? styles.termsCardSelected : ''}`}
                      onClick={() => set('defaultPaymentTerms', days)}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min="0"
                  max="365"
                  value={wiz.defaultPaymentTerms}
                  onChange={e => set('defaultPaymentTerms', parseInt(e.target.value) || 30)}
                  placeholder="Custom number of days"
                  suffix="days"
                />
              </FormField>

              <FormField
                label="Invoice Footer / Notes"
                hint="Appears at the bottom of every invoice. e.g., payment instructions, late fee policy"
              >
                <Textarea
                  rows={3}
                  value={wiz.invoiceFooterNotes}
                  onChange={e => set('invoiceFooterNotes', e.target.value)}
                  placeholder="E.g. Please make cheques payable to Acme Inc. A 1.5% monthly interest charge applies to overdue balances."
                />
              </FormField>
            </div>
          </>
        );

      // ── Step 10: Done ─────────────────────────────────────────────────────
      case TOTAL_STEPS:
        return (
          <div className={styles.doneCard}>
            <span className={styles.doneIcon}>🎉</span>
            <h2 className={styles.doneTitle}>You&apos;re all set!</h2>
            <p className={styles.doneSubtitle}>
              Your profile has been saved. Here&apos;s a quick summary of what we set up:
            </p>

            <div className={styles.doneSummary}>
              {[
                { key: 'Business',   val: wiz.companyName || '(not set)' },
                { key: 'Structure',  val: BUSINESS_TYPES.find(b => b.value === wiz.businessType)?.label || wiz.businessType },
                { key: 'Province',   val: PROVINCES.find(p => p.value === wiz.province)?.label || wiz.province },
                { key: 'Fiscal Year End', val: `${MONTHS.find(m => m.value === wiz.fiscalEndMonth)?.label} ${wiz.fiscalEndDay}` },
                { key: 'HST/GST',    val: wiz.hstRegistered ? (wiz.hstNumber || 'Registered (no number entered)') : 'Not registered' },
                wiz.maritalStatus && { key: 'Marital Status', val: MARITAL_STATUSES.find(s => s.value === wiz.maritalStatus)?.label },
                wiz.hasDependants  && { key: 'Dependants',    val: `${wiz.dependants.length} on file` },
                wiz.homeOffice     && { key: 'Home Office',   val: `${wiz.officeSqFt || '?'} of ${wiz.totalHomeSqFt || '?'} sq ft` },
                wiz.vehicleBusiness && { key: 'Vehicle Use',  val: `${wiz.vehicleBusinessPct || '?'}% business` },
              ].filter(Boolean).map(row => (
                <div key={row.key} className={styles.doneSummaryRow}>
                  <span className={styles.doneSummaryKey}>{row.key}</span>
                  <span className={styles.doneSummaryVal}>{row.val}</span>
                </div>
              ))}
            </div>

            <p className={styles.doneNote}>
              You can update any of this in <strong>Settings</strong> at any time.
            </p>

            <Button size="lg" onClick={goToDashboard}>Go to Dashboard →</Button>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showProgress = step > 0 && step < TOTAL_STEPS;
  const showBack     = step > 1 && step < TOTAL_STEPS;
  const showNext     = step > 0 && step < TOTAL_STEPS;
  const isLastStep   = step === TOTAL_STEPS - 1;
  const isSkippable  = step >= 5 && step <= 9;

  return (
    <div className={styles.page}>
      <div className={styles.wizard}>
        {/* Brand */}
        {step < TOTAL_STEPS && (
          <div className={styles.brand}>
            <CanBooksLogo size={28} />
            <span className={styles.brandName}>NorthBooks</span>
            <button
              type="button"
              className={styles.exitLink}
              onClick={() => router.replace('/companies')}
              title="Discard and switch company"
            >
              ← Switch Company
            </button>
          </div>
        )}

        {/* Progress bar */}
        {showProgress && (
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <div className={styles.progressLabel}>{stepLabel}</div>
          </div>
        )}

        {/* Card */}
        <div className={`${styles.card} ${step === 0 ? styles.welcomeCardOuter : ''}`}>
          {renderStep()}

          {/* Navigation */}
          {showNext && (
            <div className={styles.actions}>
              {showBack ? (
                <Button variant="secondary" onClick={goBack}>← Back</Button>
              ) : <span />}

              <div className={styles.actionsRight}>
                {isSkippable && (
                  <button type="button" className={styles.skipLink} onClick={skipStep}>
                    Skip this step
                  </button>
                )}
                <Button onClick={goNext} loading={submitting}>
                  {isLastStep ? 'Finish Setup' : 'Next →'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
