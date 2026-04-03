'use client';

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import FileDropzone from '@/components/ui/FileDropzone';
import styles from './page.module.css';

export default function BankStatementsPage() {
  const { state, activeFY, dispatch } = useApp();
  const isAllTime = state.activeFiscalYear === 'all';
  const allStatements = Object.values(state.fiscalYears || {}).flatMap(fy => fy.bankStatements || []);
  const { startDate, endDate } = activeFY || {};
  const baseStatements = isAllTime
    ? allStatements
    : allStatements.filter(stmt => {
        const d = stmt.periodStart || (stmt.uploadedAt ? stmt.uploadedAt.split('T')[0] : '');
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });

  const [uploading, setUploading]       = useState(false);
  const [uploadResults, setUpload]      = useState([]);
  const [viewStmt, setViewStmt]         = useState(null);
  const [confirmDelete, setConfirm]     = useState(null);   // single id or 'bulk'
  const [addExpModal, setAddExpModal]   = useState(null);
  const [selected, setSelected]         = useState(new Set());
  const [sortCol, setSortCol]           = useState('period');
  const [sortDir, setSortDir]           = useState('desc');
  const [search, setSearch]             = useState('');

  // ── Sort + Search ────────────────────────────────
  const statements = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q
      ? baseStatements.filter(s =>
          (s.period || '').toLowerCase().includes(q) ||
          (s.bank   || '').toLowerCase().includes(q) ||
          (s.filename|| '').toLowerCase().includes(q)
        )
      : [...baseStatements];

    list.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'period':  va = a.periodStart || a.uploadedAt || ''; vb = b.periodStart || b.uploadedAt || ''; break;
        case 'txns':    va = a.transactions?.length || 0;         vb = b.transactions?.length || 0;          break;
        case 'opening': va = a.openingBalance ?? -Infinity;       vb = b.openingBalance ?? -Infinity;        break;
        case 'net':     va = (a.closingBalance ?? 0) - (a.openingBalance ?? 0); vb = (b.closingBalance ?? 0) - (b.openingBalance ?? 0); break;
        case 'closing': va = a.closingBalance ?? -Infinity;       vb = b.closingBalance ?? -Infinity;        break;
        default:        va = ''; vb = '';
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [baseStatements, search, sortCol, sortDir]);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortIcon = col => sortCol !== col ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

  // ── Selection ────────────────────────────────────
  const allSelected = statements.length > 0 && statements.every(s => selected.has(s.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(statements.map(s => s.id)));
  };
  const toggleOne = id => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Upload ───────────────────────────────────────
  const handleFiles = useCallback(async files => {
    setUploading(true);
    setUpload([]);
    const fd = new FormData();
    for (const f of files) fd.append('file', f);
    fd.append('mode', 'bank_statement');
    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUpload(data.results || []);
    } catch (err) {
      setUpload([{ error: err.message }]);
    } finally {
      setUploading(false);
    }
  }, []);

  const saveStatement = result => {
    if (!result || result.error) return;
    dispatch({
      type: 'ADD_BANK_STATEMENT', payload: {
        id: uuidv4(),
        filename: result.filename,
        uploadedAt: new Date().toISOString(),
        bank: result.parsed?.bank || 'Unknown Bank',
        period: result.parsed?.period || '',
        periodStart: result.parsed?.periodStart || null,
        periodEnd: result.parsed?.periodEnd || null,
        openingBalance: result.parsed?.openingBalance ?? null,
        closingBalance: result.parsed?.closingBalance ?? null,
        transactions: result.transactions || [],
        rawText: result.text || '',
      },
    });
    setUpload(prev => prev.filter(r => r !== result));
  };

  const saveAll = () => uploadResults.filter(r => !r.error).forEach(saveStatement);

  // ── Delete ───────────────────────────────────────
  const deleteStatement = id => {
    dispatch({ type: 'DELETE_BANK_STATEMENT', payload: id });
    setConfirm(null);
    if (viewStmt?.id === id) setViewStmt(null);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleBulkDelete = () => {
    selected.forEach(id => dispatch({ type: 'DELETE_BANK_STATEMENT', payload: id }));
    if (viewStmt && selected.has(viewStmt.id)) setViewStmt(null);
    setSelected(new Set());
    setConfirm(null);
  };

  // ── Export CSV ───────────────────────────────────
  const exportCSV = () => {
    const rows = [['Period', 'Bank', 'Date', 'Description', 'Type', 'Amount']];
    statements
      .filter(s => selected.has(s.id))
      .forEach(stmt => {
        (stmt.transactions || []).forEach(tx => {
          rows.push([
            `"${stmt.period || stmt.filename}"`,
            `"${stmt.bank}"`,
            tx.date || '',
            `"${(tx.description || '').replace(/"/g, '""')}"`,
            tx.type || '',
            tx.amount != null ? tx.amount.toFixed(2) : '',
          ]);
        });
      });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Add expense from transaction ─────────────────
  const addAsExpense = tx => {
    const amount = Math.abs(tx.amount);
    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        id: uuidv4(), date: tx.date || '', vendor: tx.description || '',
        category: 'other', subtotal: amount, hst: 0, total: amount,
        paymentMethod: 'bank', notes: 'Imported from bank statement',
        receiptPath: '', homeOffice: false,
      },
    });
    setAddExpModal(null);
  };

  const txTypeColor = type => type === 'credit' ? 'success' : type === 'debit' ? 'danger' : 'muted';

  // ── Summary totals ────────────────────────────────
  const totalDeposits = statements.reduce((s, stmt) =>
    s + (stmt.transactions || []).filter(t => t.type === 'credit').reduce((a, t) => a + Math.abs(t.amount), 0), 0);
  const totalWithdrawals = statements.reduce((s, stmt) =>
    s + (stmt.transactions || []).filter(t => t.type === 'debit').reduce((a, t) => a + Math.abs(t.amount), 0), 0);
  const netCashFlow = totalDeposits - totalWithdrawals;
  const stmtsSortedDefault = [...baseStatements].sort((a, b) => (b.periodStart || '').localeCompare(a.periodStart || ''));
  const latestStmt    = stmtsSortedDefault[0] || null;
  const latestBalance = latestStmt?.closingBalance ?? null;

  return (
    <div className={styles.page}>
      {/* Upload panel */}
      <div className={styles.uploadPanel}>
        <FileDropzone
          onFiles={handleFiles}
          label={uploading ? 'Parsing PDFs…' : 'Drop bank statement PDFs here, or click to select'}
          hint="Supports TD, RBC, BMO, Scotiabank, CIBC and similar Canadian bank formats. Multiple files at once."
          accept=".pdf"
        />
      </div>

      {/* Upload results */}
      {uploadResults.length > 0 && (
        <div className={styles.resultsPanel}>
          <div className={styles.resultsPanelHeader}>
            <h3>Parsed Statements ({uploadResults.length})</h3>
            {uploadResults.filter(r => !r.error).length > 1 && (
              <Button size="sm" onClick={saveAll}>Save All</Button>
            )}
          </div>
          {uploadResults.map((r, i) => (
            <div key={i} className={`${styles.resultCard} ${r.error ? styles.resultCardError : ''}`}>
              {r.error ? (
                <p className={styles.resultError}>❌ {r.filename}: {r.error}</p>
              ) : (
                <>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultFilename}>{r.filename}</span>
                    {r.parsed?.bank && <span className={styles.resultBank}>{r.parsed.bank}</span>}
                    {r.parsed?.period && <span className={styles.resultPeriod}>{r.parsed.period}</span>}
                    {r.transactions?.length > 0 && (
                      <span className={styles.resultTxCount}>{r.transactions.length} transactions found</span>
                    )}
                  </div>
                  <Button size="xs" onClick={() => saveStatement(r)}>Save</Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary bar */}
      {statements.length > 0 && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Deposits</span>
            <span className={`${styles.summaryValue} ${styles.summaryCredit}`}>{formatCurrency(totalDeposits)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Withdrawals</span>
            <span className={`${styles.summaryValue} ${styles.summaryDebit}`}>{formatCurrency(totalWithdrawals)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Net Cash Flow</span>
            <span className={`${styles.summaryValue} ${netCashFlow >= 0 ? styles.summaryCredit : styles.summaryDebit}`}>
              {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Latest Balance</span>
            <span className={styles.summaryValue}>
              {latestBalance != null ? formatCurrency(latestBalance) : '—'}
            </span>
            {latestStmt?.period && <span className={styles.summaryHint}>{latestStmt.period}</span>}
          </div>
        </div>
      )}

      {/* Saved statements list */}
      {statements.length === 0 && !search ? (
        uploadResults.length === 0 && (
          <EmptyState
            icon="🏦"
            title="No bank statements"
            description="Upload PDF bank statements above to extract transactions."
          />
        )
      ) : (
        <div className={styles.stmtTable}>
          {/* Toolbar */}
          <div className={styles.tableToolbar}>
            <input
              className={styles.tableSearch}
              type="search"
              placeholder="Search statements…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className={styles.tableCount}>
              {statements.length} statement{statements.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bulk actions bar */}
          {someSelected && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={exportCSV}>
                ↓ Export CSV
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm('bulk')}>
                🗑 Delete Selected
              </Button>
              <button className={styles.bulkClear} onClick={() => setSelected(new Set())}>✕ Clear</button>
            </div>
          )}

          <table className={styles.stmtTbl}>
            <thead>
              <tr>
                <th className={styles.checkCell}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className={styles.sortable} onClick={() => handleSort('period')}>
                  Period{sortIcon('period')}
                </th>
                <th className={`${styles.center} ${styles.sortable}`} onClick={() => handleSort('txns')}>
                  Transactions{sortIcon('txns')}
                </th>
                <th className={`${styles.right} ${styles.sortable}`} onClick={() => handleSort('opening')}>
                  Opening{sortIcon('opening')}
                </th>
                <th className={`${styles.right} ${styles.sortable}`} onClick={() => handleSort('net')}>
                  Net Change{sortIcon('net')}
                </th>
                <th className={`${styles.right} ${styles.sortable}`} onClick={() => handleSort('closing')}>
                  Closing{sortIcon('closing')}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statements.length === 0 ? (
                <tr><td colSpan={7} className={styles.noResults}>No statements match your search.</td></tr>
              ) : statements.map(stmt => {
                const net = (stmt.closingBalance != null && stmt.openingBalance != null)
                  ? stmt.closingBalance - stmt.openingBalance
                  : null;
                return (
                  <tr key={stmt.id} className={`${styles.stmtRow} ${selected.has(stmt.id) ? styles.stmtRowSelected : ''}`}>
                    <td className={styles.checkCell}>
                      <input type="checkbox" checked={selected.has(stmt.id)} onChange={() => toggleOne(stmt.id)} />
                    </td>
                    <td>
                      <div className={styles.stmtPeriodCell}>
                        <span className={styles.stmtPeriodText}>{stmt.period || stmt.filename}</span>
                        <span className={styles.stmtBankPill}>{stmt.bank}</span>
                      </div>
                    </td>
                    <td className={styles.center}>
                      <button className={styles.txCountBtn} onClick={() => setViewStmt(stmt)} title="View transactions">
                        {stmt.transactions?.length || 0}
                      </button>
                    </td>
                    <td className={styles.right}>
                      {stmt.openingBalance != null ? formatCurrency(stmt.openingBalance) : '—'}
                    </td>
                    <td className={`${styles.right} ${net == null ? '' : net >= 0 ? styles.netPositive : styles.netNegative}`}>
                      {net != null ? `${net >= 0 ? '+' : ''}${formatCurrency(net)}` : '—'}
                    </td>
                    <td className={styles.right}>
                      {stmt.closingBalance != null ? formatCurrency(stmt.closingBalance) : '—'}
                    </td>
                    <td className={styles.stmtRowActions}>
                      <Button variant="secondary" size="xs" onClick={() => setViewStmt(stmt)}>View</Button>
                      <Button variant="ghost" size="xs" onClick={() => setConfirm(stmt.id)}>🗑</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── View Statement Modal ── */}
      <Modal
        isOpen={!!viewStmt}
        onClose={() => setViewStmt(null)}
        title={viewStmt ? `${viewStmt.bank} — ${viewStmt.period || viewStmt.filename}` : ''}
        size="xl"
        footer={<Button onClick={() => setViewStmt(null)}>Close</Button>}
      >
        {viewStmt && (
          <div className={styles.txModal}>
            {!viewStmt.transactions?.length ? (
              <div className={styles.txEmpty}>
                <p>No transactions were extracted from this statement.</p>
                {viewStmt.rawText && (
                  <details>
                    <summary className={styles.rawSummary}>View raw extracted text</summary>
                    <pre className={styles.rawPre}>{viewStmt.rawText.slice(0, 2000)}</pre>
                  </details>
                )}
              </div>
            ) : (
              <div className={styles.txTableWrap}>
                <table className={styles.txTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th className={styles.right}>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewStmt.transactions.map((tx, i) => (
                      <tr key={tx.id || i} className={styles.txRow}>
                        <td className={styles.txDate}>{tx.date || '—'}</td>
                        <td className={styles.txDesc}>{tx.description || '—'}</td>
                        <td><Badge color={txTypeColor(tx.type)}>{tx.type || '—'}</Badge></td>
                        <td className={`${styles.right} ${tx.type === 'credit' ? styles.txCredit : styles.txDebit}`}>
                          {formatCurrency(Math.abs(tx.amount))}
                        </td>
                        <td>
                          {tx.type === 'debit' && (
                            <Button variant="ghost" size="xs" onClick={() => setAddExpModal(tx)} title="Add as expense">
                              + Expense
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Add as Expense confirm ── */}
      <Modal
        isOpen={!!addExpModal}
        onClose={() => setAddExpModal(null)}
        title="Add as Expense"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddExpModal(null)}>Cancel</Button>
            <Button onClick={() => addAsExpense(addExpModal)}>Add Expense</Button>
          </>
        }
      >
        {addExpModal && (
          <div className={styles.addExpBody}>
            <p>Add this transaction as an expense?</p>
            <div className={styles.addExpDetail}>
              <span>{addExpModal.description}</span>
              <span className={styles.txDebit}>{formatCurrency(Math.abs(addExpModal.amount))}</span>
            </div>
            <p className={styles.addExpHint}>You can edit the category and details on the Expenses page afterward.</p>
          </div>
        )}
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirm(null)}
        title={confirmDelete === 'bulk' ? `Delete ${selected.size} Statement${selected.size !== 1 ? 's' : ''}?` : 'Delete Statement?'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete === 'bulk' ? handleBulkDelete : () => deleteStatement(confirmDelete)}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          {confirmDelete === 'bulk'
            ? `This will permanently remove ${selected.size} statement${selected.size !== 1 ? 's' : ''} and all their extracted transactions.`
            : 'This bank statement and all its extracted transactions will be removed.'}
        </p>
      </Modal>
    </div>
  );
}
