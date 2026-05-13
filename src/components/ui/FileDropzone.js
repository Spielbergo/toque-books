'use client';

import { useRef, useState } from 'react';
import styles from './FileDropzone.module.css';

export default function FileDropzone({ onFiles, accept = '.pdf,.png,.jpg,.jpeg', label = 'Drop files here or click to upload', hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = files => {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  };

  const onDragEnter = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = e => { e.preventDefault(); setDragging(false); };
  const onDragOver  = e => { e.preventDefault(); };
  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.hidden}
        multiple
        onChange={e => handleFiles(e.target.files)}
      />
      <div className={styles.icon}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <p className={styles.label}>{label}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
