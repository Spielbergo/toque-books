'use client';

import { useEffect, useRef, useId } from 'react';
import Button from './Button';
import styles from './Modal.module.css';

// Selectors for all focusable elements inside the modal
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  const overlayRef  = useRef(null);
  const dialogRef   = useRef(null);
  const titleId     = useId();
  // Keep a stable ref to onClose so the focus-trap effect never has it as a
  // dependency. Without this, every parent re-render (e.g. controlled inputs)
  // would recreate onClose → re-run the effect → re-focus the close button.
  const onCloseRef  = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Focus trap + keyboard handling — depends only on isOpen
  useEffect(() => {
    if (!isOpen) return;

    // Save and restore focus
    const previouslyFocused = document.activeElement;

    // Focus first focusable element inside dialog
    const firstFocusable = dialogRef.current?.querySelector(FOCUSABLE);
    firstFocusable?.focus();

    const onKey = e => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
      if (focusable.length === 0) { e.preventDefault(); return; }

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Return focus to the element that opened the modal
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {children}
        </div>

        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
