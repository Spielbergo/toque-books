'use client';

import { Fragment, useRef, useState, useEffect, useId } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

// Static swatch bg colours (dots are dynamic for 'highlight')
const THEME_SWATCH = {
  light:           { bg: '#f0f2f7', dot: '#4f46e5' },
  highlight:       { bg: '#0d0f1a', dot: null },   // dot set dynamically from accent
  dark:             { bg: '#000000', dot: '#fafafa' },
  grayscale:       { bg: '#e4e4e4', dot: '#282828' },
  'high-contrast': { bg: '#000000', dot: '#ffff00' },
  warm:            { bg: '#f3ece0', dot: '#c05a00' },
};

function ThemeIcon({ theme }) {
  switch (theme) {
    case 'light':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      );
    case 'highlight':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      );
    case 'dark':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>
        </svg>
      );
    case 'grayscale':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
        </svg>
      );
    case 'high-contrast':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6l-4 6h8z" fill="currentColor"/>
        </svg>
      );
    case 'warm':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
        </svg>
      );
    default: return null;
  }
}

export default function ThemeToggle() {
  const { theme, setTheme, themes, accent, setAccent, accentColors } = useTheme();
  const [open, setOpen] = useState(false);
  const btnRef  = useRef(null);
  const menuRef = useRef(null);
  const menuId  = useId();

  const currentTheme = themes.find(t => t.id === theme) ?? themes[0];
  const currentAccent = accentColors.find(a => a.id === accent) ?? accentColors[0];

  // Close + keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll('[role="menuitemradio"]');
        const idx = [...items].findIndex(el => el === document.activeElement);
        items[(idx + 1) % items.length]?.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll('[role="menuitemradio"]');
        const idx = [...items].findIndex(el => el === document.activeElement);
        items[(idx - 1 + items.length) % items.length]?.focus();
      }
    };
    const onClickOutside = e => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  // Focus active item when menu opens
  useEffect(() => {
    if (open) {
      const active = menuRef.current?.querySelector('[aria-checked="true"]');
      const first  = menuRef.current?.querySelector('[role="menuitemradio"]');
      (active ?? first)?.focus();
    }
  }, [open]);

  const handleSelectTheme = id => { setTheme(id); if (id !== 'highlight') { setOpen(false); btnRef.current?.focus(); } };

  return (
    <div className={styles.wrapper}>
      <button
        ref={btnRef}
        className={styles.toggle}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Appearance: ${currentTheme.label}${theme === 'highlight' ? `, ${currentAccent.label} accent` : ''}. Open theme picker`}
        title="Change theme"
      >
        <ThemeIcon theme={theme} />
        <span className={styles.label}>{currentTheme.label}</span>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label="Choose a theme"
        >
          <div className={styles.menuHeader}>Appearance</div>

          {themes.map(t => {
            const swatch = THEME_SWATCH[t.id] ?? { bg: '#888', dot: '#fff' };
            const dotColor = t.id === 'highlight' ? currentAccent.color : swatch.dot;
            return (
              <Fragment key={t.id}>
                <button
                  role="menuitemradio"
                  aria-checked={theme === t.id}
                  className={`${styles.menuItem} ${theme === t.id ? styles.menuItemActive : ''}`}
                  onClick={() => handleSelectTheme(t.id)}
                >
                  <span className={styles.swatch} style={{ background: swatch.bg, border: `2px solid ${dotColor}` }} aria-hidden="true">
                    <span className={styles.swatchDot} style={{ background: dotColor }} />
                  </span>
                  <span className={styles.menuItemText}>
                    <span className={styles.menuItemLabel}>{t.label}</span>
                    <span className={styles.menuItemDesc}>{t.description}</span>
                  </span>
                  {theme === t.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.checkIcon} aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>

                {/* Accent colour picker â€” only visible when Highlight is active */}
                {t.id === 'highlight' && theme === 'highlight' && (
                  <div className={styles.accentSection} role="group" aria-label="Accent colour">
                    <div className={styles.accentLabel}>Accent colour</div>
                    <div className={styles.accentRow}>
                      {accentColors.map(a => (
                        <button
                          key={a.id}
                          className={`${styles.accentChip} ${accent === a.id ? styles.accentChipActive : ''}`}
                          style={{ '--chip-color': a.color }}
                          onClick={() => setAccent(a.id)}
                          aria-pressed={accent === a.id}
                          aria-label={`${a.label} accent${accent === a.id ? ' (active)' : ''}`}
                          title={a.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

