// localStorage persistence layer

const STORAGE_KEY = 'canbooks_v1';
const LEGACY_KEY  = 'toque_books_v1';

/** Silently migrate data from the old key on first access */
function migrate() {
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        console.info('Data migrated from legacy storage key.');
      }
    }
  } catch (err) {
    console.error('localStorage migration error:', err);
  }
}

export function loadData() {
  if (typeof window === 'undefined') return null;
  migrate();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('localStorage load error:', err);
    return null;
  }
}

export function saveData(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, _savedAt: new Date().toISOString() }));
  } catch (err) {
    console.error('localStorage save error:', err);
  }
}

export function clearData() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('localStorage clear error:', err);
  }
}

export function exportDataAsJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canbooks-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDataFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}
