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

const BLANK_EMP = { name: '', sin: '', address: '', city: '', province: 'ON', postalCode: '', birthDate: '', startDate: '' };
const BLANK_RUN = { employeeId: '', periodStart: '', periodEnd: '', grossPay: '', cpp: '', ei: '', incomeTax: '', notes: '' };

export default function PayrollPage() {
  const { state, dispatch, activeFY } = useApp();
  const { toast } = useToast();
  const employees  = state.employees || [];
  const payrollRuns = activeFY.payrollRuns || [];
  const fyLabel     = activeFY.label || '';

  const [tab, setTab] = useState(0);
  const [frequency, setFrequency] = useState('26');

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
        {['Employees', 'Payroll Runs'].map((t, i) => (
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
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <FormField label="Pay frequency">
                <Select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ minWidth: '180px' }}>
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
