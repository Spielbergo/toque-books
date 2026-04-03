'use client';

import { useState, useCallback } from 'react';
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
  const statements = Object.values(state.fiscalYears || {}).flatMap(fy => fy.bankStatements || []);

  const [uploading, setUploading]     = useState(false);
  const [uploadResults, setUpload]    = useState([]);
  const [viewStmt, setViewStmt]       = useState(null);
  const [confirmDelete, setConfirm]   = useState(null);
  const [addExpModal, setAddExpModal] = useState(null); // transaction to add as expense

  // ── Upload ──────────────────────────────────────
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
      const results = data.results || [];
      setUpload(results);
    } catch (err) {
      setUpload([{ error: err.message }]);
    } finally {
      setUploading(false);
    }
  }, []);

  const saveStatement = result => {
    if (!result || result.error) return;
    const stmt = {
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
    };
    dispatch({ type: 'ADD_BANK_STATEMENT', payload: stmt });
    setUpload(prev => prev.filter(r => r !== result));
  };

  const saveAll = () => {
    uploadResults.filter(r => !r.error).forEach(saveStatement);
  };

  const deleteStatement = id => {
    dispatch({ type: 'DELETE_BANK_STATEMENT', payload: id });
    setConfirm(null);
    if (viewStmt?.id === id) setViewStmt(null);
  };

  // ── Add expense from transaction ─────────────────
  const addAsExpense = tx => {
    const amount = Math.abs(tx.amount);
    dispatch({
      type: 'ADD_EXPENSE',
      payload: {
        id: uuidv4(),
        date: tx.date || '',
        vendor: tx.description || '',
        category: 'other',
        subtotal: amount,
        hst: 0,
        total: amount,
        paymentMethod: 'bank',
        notes: `Imported from bank statement`,
        receiptPath: '',
        homeOffice: false,
      },
    });
    setAddExpModal(null);
  };

  const txTypeColor = type => type === 'credit' ? 'success' : type === 'debit' ? 'danger' : 'muted';

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

      {/* Saved statements list */}
      <div className={styles.stmtList}>
        {statements.length === 0 ? (
          uploadResults.length === 0 && (
            <EmptyState
              icon="🏦"
              title="No bank statements"
              description="Upload PDF bank statements above to extract transactions."
            />
          )
        ) : (
          statements.map(stmt => (
            <div key={stmt.id} className={styles.stmtCard}>
              <div className={styles.stmtHeader}>
                <div className={styles.stmtMeta}>
                  <span className={styles.stmtBank}>{stmt.bank}</span>
                  {stmt.period && <span className={styles.stmtPeriod}>{stmt.period}</span>}
                  <span className={styles.stmtFilename}>{stmt.filename}</span>
                </div>
                <div className={styles.stmtActions}>
                  <Button variant="secondary" size="xs" onClick={() => setViewStmt(stmt)}>
                    View ({stmt.transactions?.length || 0} txns)
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => setConfirm(stmt.id)}>🗑</Button>
                </div>
              </div>
              {(stmt.openingBalance != null || stmt.closingBalance != null) && (
                <div className={styles.stmtBalances}>
                  {stmt.openingBalance != null && (
                    <div className={styles.stmtBalance}>
                      <span className={styles.stmtBalLabel}>Opening</span>
                      <span className={styles.stmtBalVal}>{formatCurrency(stmt.openingBalance)}</span>
                    </div>
                  )}
                  {stmt.closingBalance != null && (
                    <div className={styles.stmtBalance}>
                      <span className={styles.stmtBalLabel}>Closing</span>
                      <span className={styles.stmtBalVal}>{formatCurrency(stmt.closingBalance)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
            {viewStmt.transactions?.length === 0 ? (
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
        title="Delete Statement?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteStatement(confirmDelete)}>Delete</Button>
          </>
        }
      >
        <p>This bank statement and all its extracted transactions will be removed.</p>
      </Modal>
    </div>
  );
}
