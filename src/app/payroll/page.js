'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { calculatePayrollDeductions } from '@/lib/taxCalculations';
import { formatCurrency, formatDate } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { FormField, Input, Select } from '@/components/ui/FormField';
import Explain from '@/components/ui/Explain';
import styles from './page.module.css';

// ─── Dynamic PDF import (react-pdf/renderer not SSR-safe) ────────────────────
async function generateT4PDF(settings, employeeName, year, py) {
  const { pdf } = await import('@react-pdf/renderer');
  const { default: T4Document } = await import('@/components/T4Document');
  const { createElement } = await import('react');
  const blob = await pdf(createElement(T4Document, { settings, employeeName, year, py })).toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `T4-${year}-${(employeeName || 'employee').replace(/\s+/g, '-')}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── Pay frequency helpers ────────────────────────────────────────────────────
const FREQUENCIES = [
  { value: '52',   label: 'Weekly (52/year)' },
  { value: '26',   label: 'Bi-weekly (26/year)' },
  { value: '24',   label: 'Semi-monthly (24/year)' },
  { value: '12',   label: 'Monthly (12/year)' },
];

async function generateT4APDF(settings, recipients, year) {
  const { pdf } = await import('@react-pdf/renderer');
  const { default: T4ADocument } = await import('@/components/T4ADocument');
  const { createElement } = await import('react');
  const blob = await pdf(createElement(T4ADocument, { settings, recipients, year })).toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `T4A-${year}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const BLANK_EMP = { name: '', sin: '', address: '', city: '', province: 'ON', postalCode: '', birthDate: '', startDate: '' };
const BLANK_RUN = { employeeId: '', periodStart: '', periodEnd: '', grossPay: '', cpp: '', ei: '', incomeTax: '', notes: '' };
// BLANK_T4A taxYear is set dynamically from activeFY at modal open time
const BLANK_T4A = { name: '', sin: '', address: '', city: '', province: 'ON', postalCode: '', taxYear: new Date().getFullYear() - 1, box048: '', box020: '', box028: '', box022: '', notes: '' };

export default function PayrollPage() {
  const { state, dispatch, activeFY } = useApp();
  const { toast } = useToast();
  const employees  = state.employees || [];
  const payrollRuns = activeFY.payrollRuns || [];
  const fyLabel     = activeFY.label || '';

  // Derive the tax year from the active FY's end date (e.g. FY ending Nov 2025 → tax year 2025)
  const activeTaxYear = activeFY?.endDate
    ? new Date(activeFY.endDate).getFullYear()
    : new Date().getFullYear() - 1;

  const allT4ARecipients  = state.t4aRecipients || [];
  // Only show recipients for the active fiscal year's tax year
  const t4aRecipients = allT4ARecipients.filter(r => Number(r.taxYear) === activeTaxYear);

  const [tab, setTab] = useState(0);
  const [frequency, setFrequency] = useState('26');

  // ── T4A modal state ──────────────────────────────────────────────────────
  const [showT4AModal,  setShowT4AModal]   = useState(false);
  const [t4aEditId,     setT4AEditId]      = useState(null);
  const [t4aForm,       setT4AForm]        = useState({ ...BLANK_T4A });
  const [confirmDelT4A, setConfirmDelT4A]  = useState(null);

  const openT4AModal = (rec = null) => {
    setT4AEditId(rec?.id ?? null);
    // Default taxYear to the active FY's tax year when adding new
    setT4AForm(rec ? { ...BLANK_T4A, ...rec } : { ...BLANK_T4A, taxYear: activeTaxYear });
    setShowT4AModal(true);
  };
  const saveT4A = e => {
    e.preventDefault();
    const payload = {
      ...t4aForm,
      box048: parseFloat(t4aForm.box048) || 0,
      box020: parseFloat(t4aForm.box020) || 0,
      box028: parseFloat(t4aForm.box028) || 0,
      box022: parseFloat(t4aForm.box022) || 0,
    };
    if (t4aEditId) {
      dispatch({ type: 'UPDATE_T4A_RECIPIENT', payload: { id: t4aEditId, ...payload } });
    } else {
      dispatch({ type: 'ADD_T4A_RECIPIENT', payload });
    }
    setShowT4AModal(false);
  };

  // ── Employees modal ──────────────────────────────────────────────────────
  const [showEmpModal, setShowEmpModal]   = useState(false);
  const [empEditId,    setEmpEditId]      = useState(null);
  const [empForm,      setEmpForm]        = useState({ ...BLANK_EMP });
  const [confirmDelEmp, setConfirmDelEmp] = useState(null);

  const openEmpModal = (emp = null) => {
    setEmpEditId(emp?.id ?? null);
    setEmpForm(emp ? { ...BLANK_EMP, ...emp } : { ...BLANK_EMP });
    setShowEmpModal(true);
  };
  const saveEmployee = e => {
    e.preventDefault();
    if (empEditId) {
      dispatch({ type: 'UPDATE_EMPLOYEE', payload: { id: empEditId, ...empForm } });
    } else {
      dispatch({ type: 'ADD_EMPLOYEE', payload: { ...empForm } });
    }
    setShowEmpModal(false);
  };

  // ── Payroll run modal ────────────────────────────────────────────────────
  const [showRunModal,  setShowRunModal]   = useState(false);
  const [runForm,       setRunForm]        = useState({ ...BLANK_RUN });
  const [confirmDelRun, setConfirmDelRun]  = useState(null);

  // When gross pay or employee changes, auto-compute CPP/EI
  const autoDeductions = useMemo(() => {
    const gross = parseFloat(runForm.grossPay) || 0;
    const empId = runForm.employeeId;
    if (!gross || !empId) return null;
    // YTD totals for this employee up to (but not including) the run being added
    const ytdRuns = payrollRuns.filter(r => r.employeeId === empId);
    const ytdGross = ytdRuns.reduce((s, r) => s + (r.grossPay || 0), 0);
    const ytdCPP   = ytdRuns.reduce((s, r) => s + (r.cpp || 0), 0);
    const ytdEI    = ytdRuns.reduce((s, r) => s + (r.ei || 0), 0);
    return calculatePayrollDeductions(gross, ytdGross, ytdCPP, ytdEI, parseInt(frequency));
  }, [runForm.grossPay, runForm.employeeId, frequency, payrollRuns]);

  const openRunModal = () => {
    setRunForm({ ...BLANK_RUN, employeeId: employees[0]?.id || '' });
    setShowRunModal(true);
  };
  const handleRunField = (field, value) => {
    setRunForm(f => ({ ...f, [field]: value }));
  };
  const applyAutoDeductions = () => {
    if (!autoDeductions) return;
    setRunForm(f => ({
      ...f,
      cpp: autoDeductions.cpp.toFixed(2),
      ei:  autoDeductions.ei.toFixed(2),
    }));
  };
  const saveRun = e => {
    e.preventDefault();
    dispatch({ type: 'ADD_PAYROLL_RUN', payload: {
      employeeId:  runForm.employeeId,
      periodStart: runForm.periodStart,
      periodEnd:   runForm.periodEnd,
      grossPay:    parseFloat(runForm.grossPay) || 0,
      cpp:         parseFloat(runForm.cpp)      || 0,
      ei:          parseFloat(runForm.ei)       || 0,
      incomeTax:   parseFloat(runForm.incomeTax)|| 0,
      notes:       runForm.notes,
    } });
    setShowRunModal(false);
  };

  // ── Per-employee T4 summaries ─────────────────────────────────────────────
  const empSummaries = useMemo(() => {
    return employees.map(emp => {
      const runs = payrollRuns.filter(r => r.employeeId === emp.id);
      return {
        ...emp,
        runs,
        totalGross:     runs.reduce((s, r) => s + (r.grossPay || 0), 0),
        totalCPP:       runs.reduce((s, r) => s + (r.cpp || 0), 0),
        totalEI:        runs.reduce((s, r) => s + (r.ei || 0), 0),
        totalIncomeTax: runs.reduce((s, r) => s + (r.incomeTax || 0), 0),
        netPay:         runs.reduce((s, r) => s + ((r.grossPay || 0) - (r.cpp || 0) - (r.ei || 0) - (r.incomeTax || 0)), 0),
      };
    });
  }, [employees, payrollRuns]);

  const getEmpName = id => employees.find(e => e.id === id)?.name || id;

  // Sorted runs by date desc
  const sortedRuns = useMemo(() =>
    [...payrollRuns].sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || '')),
  [payrollRuns]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Payroll &amp; T4 Issuing</h1>
          <p className={styles.pageSub}>Track employee payroll runs and generate T4 slips — {fyLabel}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['Employees', 'Payroll Runs', 'T4A Contractors'].map((t, i) => (
          <button key={t} className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ═══ TAB 0: Employees ═══ */}
      {tab === 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTop}>
            <div>
              <h2 className={styles.sectionTitle}>Employees</h2>
              <p className={styles.sectionSub}>Add employees to generate T4 slips. SINs are stored locally and never transmitted.</p>
            </div>
            <Button onClick={() => openEmpModal()}>+ Add Employee</Button>
          </div>

          {employees.length === 0 ? (
            <EmptyState icon="👤" title="No employees yet" description="Add employees to start tracking payroll and issuing T4s." action={<Button onClick={() => openEmpModal()}>+ Add Employee</Button>} />
          ) : (
            <div className={styles.empList}>
              {empSummaries.map(emp => (
                <div key={emp.id} className={styles.empCard}>
                  <div className={styles.empCardMain}>
                    <div className={styles.empName}>{emp.name || 'Unnamed'}</div>
                    <div className={styles.empMeta}>
                      {emp.sin && <span>SIN: {emp.sin.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</span>}
                      {emp.province && <span>{emp.province}</span>}
                      {emp.startDate && <span>Since {formatDate(emp.startDate)}</span>}
                    </div>
                    {emp.runs.length > 0 && (
                      <div className={styles.empTotals}>
                        <span>Gross: <strong>{formatCurrency(emp.totalGross)}</strong></span>
                        <span>CPP: <strong>{formatCurrency(emp.totalCPP)}</strong></span>
                        <span>EI: <strong>{formatCurrency(emp.totalEI)}</strong></span>
                        <span>Tax: <strong>{formatCurrency(emp.totalIncomeTax)}</strong></span>
                        <span>{emp.runs.length} pay run{emp.runs.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.empCardActions}>
                    {emp.runs.length > 0 && (
                      <Button size="sm" variant="secondary"
                        onClick={async () => {
                          try {
                            await generateT4PDF(state.settings, emp.name, new Date(activeFY.endDate || new Date()).getFullYear(), {
                              employmentIncome: emp.totalGross,
                              cppContributions: emp.totalCPP,
                              eiPremiums:       emp.totalEI,
                              taxWithheld:      emp.totalIncomeTax,
                            });
                          } catch (err) {
                            toast({ message: 'T4 PDF generation failed', detail: err.message, type: 'error' });
                          }
                        }}>
                        ⬇ T4 PDF
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => openEmpModal(emp)}>Edit</Button>
                    <button className={styles.deleteBtn} onClick={() => setConfirmDelEmp(emp.id)} aria-label="Delete employee">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {employees.length > 0 && (
            <div className={styles.t4Note}>
              <strong>T4 Reminder:</strong> T4 slips must be filed with CRA by the last day of February (Feb 28/29) of the year following the tax year. File T4 Summary (T4SUM) along with individual T4s.
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 1: Payroll Runs ═══ */}
      {tab === 1 && (
        <div className={styles.section}>
          <div className={styles.sectionTop}>
            <div>
              <h2 className={styles.sectionTitle}>Payroll Runs — {fyLabel}</h2>
              <p className={styles.sectionSub}>Record each pay period. CPP and EI are auto-calculated based on year-to-date totals.</p>
            </div>
            <div className={styles.sectionTopActions}>
              <FormField label="Pay frequency">
                <Select value={frequency} onChange={e => setFrequency(e.target.value)} className={styles.frequencySelect}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              </FormField>
              <Button onClick={openRunModal} disabled={employees.length === 0}>+ Record Pay Run</Button>
            </div>
          </div>

          {employees.length === 0 ? (
            <div className={styles.noEmpHint}>Add at least one employee on the Employees tab before recording pay runs.</div>
          ) : payrollRuns.length === 0 ? (
            <EmptyState icon="💵" title="No payroll runs yet" description="Record a pay run to start tracking payroll for this fiscal year." action={<Button onClick={openRunModal}>+ Record Pay Run</Button>} />
          ) : (
            <>
              <div className={styles.runTable}>
                <div className={styles.runTableHeader}>
                  <span>Period</span>
                  <span>Employee</span>
                  <span className={styles.right}>Gross</span>
                  <span className={styles.right}>CPP</span>
                  <span className={styles.right}>EI</span>
                  <span className={styles.right}>Income Tax</span>
                  <span className={styles.right}>Net Pay</span>
                  <span></span>
                </div>
                {sortedRuns.map(run => (
                  <div key={run.id} className={styles.runTableRow}>
                    <span className={styles.runPeriod}>{run.periodStart && run.periodEnd ? `${run.periodStart} → ${run.periodEnd}` : run.periodEnd || run.periodStart || '—'}</span>
                    <span>{getEmpName(run.employeeId)}</span>
                    <span className={styles.right}>{formatCurrency(run.grossPay)}</span>
                    <span className={`${styles.right} ${styles.muted}`}>{formatCurrency(run.cpp)}</span>
                    <span className={`${styles.right} ${styles.muted}`}>{formatCurrency(run.ei)}</span>
                    <span className={`${styles.right} ${styles.muted}`}>{formatCurrency(run.incomeTax)}</span>
                    <span className={`${styles.right} ${styles.bold}`}>{formatCurrency((run.grossPay || 0) - (run.cpp || 0) - (run.ei || 0) - (run.incomeTax || 0))}</span>
                    <button className={styles.deleteBtn} onClick={() => setConfirmDelRun(run.id)} aria-label="Delete run">🗑</button>
                  </div>
                ))}
              </div>

              {/* Per-employee totals */}
              <div className={styles.empTotalsTable}>
                <div className={styles.empTotalsTitle}>Year-to-Date Totals by Employee</div>
                {empSummaries.filter(e => e.runs.length > 0).map(emp => (
                  <div key={emp.id} className={styles.empTotalsRow}>
                    <span className={styles.bold}>{emp.name}</span>
                    <span>Gross: {formatCurrency(emp.totalGross)}</span>
                    <span>CPP: {formatCurrency(emp.totalCPP)}</span>
                    <span>EI: {formatCurrency(emp.totalEI)}</span>
                    <span>Tax: {formatCurrency(emp.totalIncomeTax)}</span>
                    <span>Net: <strong>{formatCurrency(emp.netPay)}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB 2: T4A Contractors ═══ */}
      {tab === 2 && (
        <div className={styles.section}>
          <div className={styles.sectionTop}>
            <div>
              <h2 className={styles.sectionTitle}>T4A Contractors</h2>
              <p className={styles.sectionSub}>Track contractors and service providers paid $500+ in a tax year. File T4A slips with CRA by Feb 28. Showing tax year <strong>{activeTaxYear}</strong> (active fiscal year).</p>
            </div>
            <div className={styles.sectionTopActions}>
              {t4aRecipients.length > 0 && (
                <Button variant="secondary" onClick={async () => {
                  try {
                    await generateT4APDF(state.settings, t4aRecipients, activeTaxYear);
                  } catch (err) {
                    toast({ message: 'T4A PDF failed', detail: err.message, type: 'error' });
                  }
                }}>⬇ All T4As PDF</Button>
              )}
              <Button onClick={() => openT4AModal()}>+ Add Contractor</Button>
            </div>
          </div>

          {t4aRecipients.length === 0 ? (
            <EmptyState icon="📋" title="No contractors yet" description="Add contractors you paid for services to generate T4A slips." action={<Button onClick={() => openT4AModal()}>+ Add Contractor</Button>} />
          ) : (
            <div className={styles.empList}>
              {t4aRecipients.map(rec => (
                <div key={rec.id} className={styles.empCard}>
                  <div className={styles.empCardMain}>
                    <div className={styles.empName}>{rec.name || 'Unnamed'}</div>
                    <div className={styles.empMeta}>
                      {rec.sin && <span>SIN: {rec.sin}</span>}
                      {rec.province && <span>{rec.province}</span>}
                      <span>Tax Year: {rec.taxYear}</span>
                    </div>
                    <div className={styles.empTotals}>
                      {rec.box048 > 0 && <span>Box 048 (Fees): <strong>{formatCurrency(rec.box048)}</strong></span>}
                      {rec.box020 > 0 && <span>Box 020 (Commission): <strong>{formatCurrency(rec.box020)}</strong></span>}
                      {rec.box028 > 0 && <span>Box 028 (Other): <strong>{formatCurrency(rec.box028)}</strong></span>}
                    </div>
                  </div>
                  <div className={styles.empCardActions}>
                    <Button size="sm" variant="secondary" onClick={async () => {
                      try {
                        await generateT4APDF(state.settings, [rec], rec.taxYear);
                      } catch (err) {
                        toast({ message: 'T4A PDF failed', detail: err.message, type: 'error' });
                      }
                    }}>⬇ T4A PDF</Button>
                    <Button size="sm" variant="secondary" onClick={() => openT4AModal(rec)}>Edit</Button>
                    <button className={styles.deleteBtn} onClick={() => setConfirmDelT4A(rec.id)} aria-label="Delete contractor">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.t4Note}>
            <strong>T4A Reminder:</strong> Issue T4A slips to contractors paid $500+ for services (Box 048). Filing deadline is Feb 28. You do not deduct CPP/EI for contractors — they handle their own CPP as a self-employed person.
          </div>
        </div>
      )}

      {/* ── T4A Modal ── */}
      <Modal isOpen={showT4AModal} onClose={() => setShowT4AModal(false)} title={t4aEditId ? 'Edit Contractor' : 'Add Contractor'} size="md"
        footer={<><Button variant="secondary" onClick={() => setShowT4AModal(false)}>Cancel</Button><Button type="submit" form="t4a-form">{t4aEditId ? 'Save' : 'Add'}</Button></>}
      >
        <form id="t4a-form" onSubmit={saveT4A}>
          <div className={styles.formGrid}>
            <FormField label="Full Name" className={styles.colSpan2} required>
              <Input type="text" value={t4aForm.name} onChange={e => setT4AForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required />
            </FormField>
            <FormField label="SIN" hint="Social Insurance Number">
              <Input type="text" value={t4aForm.sin} onChange={e => setT4AForm(f => ({ ...f, sin: e.target.value }))} placeholder="000 000 000" maxLength={11} />
            </FormField>
            <FormField label="Tax Year" required>
              <Input type="number" min="2020" max="2030" value={t4aForm.taxYear} onChange={e => setT4AForm(f => ({ ...f, taxYear: parseInt(e.target.value) }))} required />
            </FormField>
            <FormField label="Province">
              <Select value={t4aForm.province} onChange={e => setT4AForm(f => ({ ...f, province: e.target.value }))}>
                {['ON','BC','AB','QC','MB','SK','NS','NB','NL','PE'].map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </FormField>
            <FormField label="Postal Code">
              <Input type="text" value={t4aForm.postalCode} onChange={e => setT4AForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="A1A 1A1" maxLength={7} />
            </FormField>
            <FormField label="Address" className={styles.colSpan2}>
              <Input type="text" value={t4aForm.address} onChange={e => setT4AForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </FormField>
            <FormField label="City">
              <Input type="text" value={t4aForm.city} onChange={e => setT4AForm(f => ({ ...f, city: e.target.value }))} />
            </FormField>
            <FormField label="" />
            <FormField label={<>Box 048 — Fees for Services<Explain text="The most common T4A box for independent contractors. Report fees paid for services rendered — but NOT if you withheld CPP/EI (use a T4 instead). Required when total payments to one contractor exceed $500/year." /></>} hint="Most common for contractors">
              <Input type="number" min="0" step="0.01" prefix="$" value={t4aForm.box048} onChange={e => setT4AForm(f => ({ ...f, box048: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label={<>Box 020 — Self-employment Commissions<Explain text="Report commission income earned by self-employed agents or brokers. Do not use this box for salaried employees who also earn commissions — those go on a T4." /></>}>
              <Input type="number" min="0" step="0.01" prefix="$" value={t4aForm.box020} onChange={e => setT4AForm(f => ({ ...f, box020: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label={<>Box 028 — Other Income<Explain text="Miscellaneous income paid to the recipient that doesn't fit another T4A box — such as research grants, prizes, or payments to non-residents." /></>}>
              <Input type="number" min="0" step="0.01" prefix="$" value={t4aForm.box028} onChange={e => setT4AForm(f => ({ ...f, box028: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label={<>Box 022 — Income Tax Deducted<Explain text="Only fill this if you voluntarily withheld income tax from the contractor's payment. Most contractors manage their own taxes, so this is usually left blank." /></>}>
              <Input type="number" min="0" step="0.01" prefix="$" value={t4aForm.box022} onChange={e => setT4AForm(f => ({ ...f, box022: e.target.value }))} placeholder="0.00" />
            </FormField>
            <FormField label="Notes" className={styles.colSpan2}>
              <Input type="text" value={t4aForm.notes} onChange={e => setT4AForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete T4A ── */}
      <Modal isOpen={!!confirmDelT4A} onClose={() => setConfirmDelT4A(null)} title="Remove Contractor?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelT4A(null)}>Cancel</Button><Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_T4A_RECIPIENT', payload: confirmDelT4A }); setConfirmDelT4A(null); }}>Remove</Button></>}
      >
        <p>This contractor and their T4A data will be deleted.</p>
      </Modal>

      {/* ── Employee Modal ── */}
      <Modal isOpen={showEmpModal} onClose={() => setShowEmpModal(false)} title={empEditId ? 'Edit Employee' : 'Add Employee'} size="md"
        footer={<><Button variant="secondary" onClick={() => setShowEmpModal(false)}>Cancel</Button><Button type="submit" form="emp-form">{empEditId ? 'Save' : 'Add'}</Button></>}
      >
        <form id="emp-form" onSubmit={saveEmployee}>
          <div className={styles.formGrid}>
            <FormField label="Full Name" className={styles.colSpan2} required>
              <Input type="text" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required />
            </FormField>
            <FormField label="SIN" hint="Social Insurance Number — stored locally only">
              <Input type="text" value={empForm.sin} onChange={e => setEmpForm(f => ({ ...f, sin: e.target.value }))} placeholder="000 000 000" maxLength={11} />
            </FormField>
            <FormField label="Date of Birth">
              <Input type="date" value={empForm.birthDate} onChange={e => setEmpForm(f => ({ ...f, birthDate: e.target.value }))} />
            </FormField>
            <FormField label="Start Date">
              <Input type="date" value={empForm.startDate} onChange={e => setEmpForm(f => ({ ...f, startDate: e.target.value }))} />
            </FormField>
            <FormField label="Province">
              <Select value={empForm.province} onChange={e => setEmpForm(f => ({ ...f, province: e.target.value }))}>
                {['ON','BC','AB','QC','MB','SK','NS','NB','NL','PE'].map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </FormField>
            <FormField label="Address" className={styles.colSpan2}>
              <Input type="text" value={empForm.address} onChange={e => setEmpForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </FormField>
            <FormField label="City">
              <Input type="text" value={empForm.city} onChange={e => setEmpForm(f => ({ ...f, city: e.target.value }))} />
            </FormField>
            <FormField label="Postal Code">
              <Input type="text" value={empForm.postalCode} onChange={e => setEmpForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="A1A 1A1" maxLength={7} />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Payroll Run Modal ── */}
      <Modal isOpen={showRunModal} onClose={() => setShowRunModal(false)} title="Record Pay Run" size="md"
        footer={<><Button variant="secondary" onClick={() => setShowRunModal(false)}>Cancel</Button><Button type="submit" form="run-form">Save</Button></>}
      >
        <form id="run-form" onSubmit={saveRun}>
          <div className={styles.formGrid}>
            <FormField label="Employee" className={styles.colSpan2} required>
              <Select value={runForm.employeeId} onChange={e => handleRunField('employeeId', e.target.value)} required>
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Period Start">
              <Input type="date" value={runForm.periodStart} onChange={e => handleRunField('periodStart', e.target.value)} />
            </FormField>
            <FormField label="Period End">
              <Input type="date" value={runForm.periodEnd} onChange={e => handleRunField('periodEnd', e.target.value)} />
            </FormField>
            <FormField label="Gross Pay" required>
              <Input type="number" min="0" step="0.01" prefix="$" value={runForm.grossPay} onChange={e => handleRunField('grossPay', e.target.value)} placeholder="0.00" required />
            </FormField>
            <FormField label="">
              <span></span>
            </FormField>

            {autoDeductions && (
              <div className={styles.autoDeductCard}>
                <div className={styles.autoDeductTitle}>Suggested deductions (2025 rates)</div>
                <div className={styles.autoDeductRow}><span>CPP:</span><strong>{formatCurrency(autoDeductions.cpp)}</strong></div>
                <div className={styles.autoDeductRow}><span>EI:</span><strong>{formatCurrency(autoDeductions.ei)}</strong></div>
                <div className={styles.autoDeductRow}><span>Employer CPP:</span><span>{formatCurrency(autoDeductions.employerCPP)}</span></div>
                <div className={styles.autoDeductRow}><span>Employer EI:</span><span>{formatCurrency(autoDeductions.employerEI)}</span></div>
                <button type="button" className={styles.autoApplyBtn} onClick={applyAutoDeductions}>↓ Apply CPP &amp; EI</button>
              </div>
            )}

            <FormField label="CPP Deducted" required>
              <Input type="number" min="0" step="0.01" prefix="$" value={runForm.cpp} onChange={e => handleRunField('cpp', e.target.value)} placeholder="0.00" required />
            </FormField>
            <FormField label="EI Deducted" required>
              <Input type="number" min="0" step="0.01" prefix="$" value={runForm.ei} onChange={e => handleRunField('ei', e.target.value)} placeholder="0.00" required />
            </FormField>
            <FormField label="Income Tax Deducted">
              <Input type="number" min="0" step="0.01" prefix="$" value={runForm.incomeTax} onChange={e => handleRunField('incomeTax', e.target.value)} placeholder="0.00" />
            </FormField>
            <FormField label="Notes">
              <Input type="text" value={runForm.notes} onChange={e => handleRunField('notes', e.target.value)} placeholder="Optional" />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Confirm Delete Employee ── */}
      <Modal isOpen={!!confirmDelEmp} onClose={() => setConfirmDelEmp(null)} title="Remove Employee?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelEmp(null)}>Cancel</Button><Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_EMPLOYEE', payload: confirmDelEmp }); setConfirmDelEmp(null); }}>Remove</Button></>}
      >
        <p>This employee record will be deleted. Payroll runs for this employee will remain but show a missing employee name.</p>
      </Modal>

      {/* ── Confirm Delete Run ── */}
      <Modal isOpen={!!confirmDelRun} onClose={() => setConfirmDelRun(null)} title="Remove Payroll Run?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelRun(null)}>Cancel</Button><Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_PAYROLL_RUN', payload: confirmDelRun }); setConfirmDelRun(null); }}>Remove</Button></>}
      >
        <p>This payroll run will be deleted. YTD totals for T4 generation will update automatically.</p>
      </Modal>
    </div>
  );
}
