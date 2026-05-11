'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './Explain.module.css';

/**
 * Inline "?" button that shows a popover with an explanation.
 * Usage: <Explain text="SBD income is the portion of net income eligible for the Small Business Deduction." />
 */
export default function Explain({ text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.btn}
        aria-label="Explain this term"
        onClick={() => setOpen(v => !v)}
      >
        ?
      </button>
      {open && (
        <span className={styles.popover} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
