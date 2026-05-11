'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export const THEMES = [
  { id: 'light',         label: 'Light',          description: 'Clean white interface' },
  { id: 'highlight',     label: 'Highlight',       description: 'Dark base + custom accent colour' },
  { id: 'dark',          label: 'Dark',            description: 'True black, no colour' },
  { id: 'grayscale',     label: 'Grayscale',       description: 'Neutral gray palette' },
  { id: 'high-contrast', label: 'High Contrast',   description: 'WCAG AAA — yellow on black' },
  { id: 'warm',          label: 'Warm',            description: 'Amber tones, reduced blue light' },
];

export const ACCENT_COLORS = [
  { id: 'purple', color: '#7c6ff7', label: 'Purple' },
  { id: 'blue',   color: '#3b82f6', label: 'Blue'   },
  { id: 'cyan',   color: '#06b6d4', label: 'Cyan'   },
  { id: 'green',  color: '#10b981', label: 'Green'  },
  { id: 'orange', color: '#f97316', label: 'Orange' },
  { id: 'red',    color: '#ef4444', label: 'Red'    },
  { id: 'pink',   color: '#ec4899', label: 'Pink'   },
];

const VALID_THEMES  = THEMES.map(t => t.id);
const VALID_ACCENTS = ACCENT_COLORS.map(a => a.id);

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme,  setThemeState]  = useState('highlight');
  const [accent, setAccentState] = useState('purple');
  const [mounted, setMounted]    = useState(false);
  const userUidRef   = useRef(null);
  const saveTimerRef = useRef(null);

  // Load persisted values on mount
  useEffect(() => {
    const storedTheme  = localStorage.getItem('canbooks-theme');
    const storedAccent = localStorage.getItem('canbooks-accent');

    if (storedTheme === 'dark') {
      // Migrate legacy 'dark' key to the renamed 'highlight'
      setThemeState('highlight');
    } else if (storedTheme === 'bw') {
      // Migrate legacy 'bw' key to the renamed 'dark'
      setThemeState('dark');
    } else if (storedTheme && VALID_THEMES.includes(storedTheme)) {
      setThemeState(storedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setThemeState('light');
    }

    if (storedAccent && VALID_ACCENTS.includes(storedAccent)) {
      setAccentState(storedAccent);
    }

    setMounted(true);
  }, []);

  // Sync with Firestore when user logs in/out
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        userUidRef.current = firebaseUser.uid;
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            const appearance = snap.data()?.appearance;
            if (appearance?.theme && VALID_THEMES.includes(appearance.theme)) {
              setThemeState(appearance.theme);
            }
            if (appearance?.accent && VALID_ACCENTS.includes(appearance.accent)) {
              setAccentState(appearance.accent);
            }
          }
        } catch {
          // Firestore unavailable — keep localStorage values
        }
      } else {
        userUidRef.current = null;
      }
    });
    return unsub;
  }, []);

  // Apply theme to <html> and persist
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('canbooks-theme', theme);
    const announcement = document.getElementById('theme-announcement');
    if (announcement) {
      const found = THEMES.find(t => t.id === theme);
      announcement.textContent = `Theme changed to ${found?.label ?? theme}`;
    }
  }, [theme, mounted]);

  // Apply accent to <html> and persist
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('canbooks-accent', accent);
  }, [accent, mounted]);

  // Save appearance to Firestore (1 s debounce so rapid cycling doesn't spam writes)
  useEffect(() => {
    if (!mounted || !userUidRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setDoc(
        doc(db, 'users', userUidRef.current),
        { appearance: { theme, accent } },
        { merge: true },
      ).catch(() => {/* non-critical — localStorage already saved */});
    }, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [theme, accent, mounted]);

  // Listen for OS high-contrast preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-contrast: more)');
    const handler = e => {
      if (e.matches && !localStorage.getItem('canbooks-theme')) {
        setThemeState('high-contrast');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme  = id => { if (VALID_THEMES.includes(id))  setThemeState(id);  };
  const setAccent = id => { if (VALID_ACCENTS.includes(id)) setAccentState(id); };

  const cycleTheme = () => {
    setThemeState(prev => {
      const idx = VALID_THEMES.indexOf(prev);
      return VALID_THEMES[(idx + 1) % VALID_THEMES.length];
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, mounted, themes: THEMES, accent, setAccent, accentColors: ACCENT_COLORS }}>
      {/* Hidden live region for screen reader announcements */}
      <div
        id="theme-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
