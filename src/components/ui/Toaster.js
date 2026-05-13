'use client';

import { useEffect, useState } from 'react';
import styles from './Toaster.module.css';

const TYPE_ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      className={`${styles.toast} ${styles[toast.type] ?? styles.success} ${visible ? styles.visible : ''}`}
    >
      <span className={styles.icon}>{TYPE_ICONS[toast.type] ?? TYPE_ICONS.success}</span>
      <div className={styles.body}>
        <span className={styles.message}>{toast.message}</span>
        {toast.detail && <span className={styles.detail}>{toast.detail}</span>}
      </div>
      <button
        className={styles.close}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export default function Toaster({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
