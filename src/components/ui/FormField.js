import styles from './FormField.module.css';

export function FormField({ label, error, hint, required, children, className = '' }) {
  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export function Input({
  type = 'text',
  prefix,
  suffix,
  error,
  className = '',
  ...props
}) {
  if (prefix || suffix) {
    return (
      <div className={`${styles.inputWrap} ${error ? styles.hasError : ''}`}>
        {prefix && <span className={styles.adornment}>{prefix}</span>}
        <input type={type} className={`${styles.input} ${styles.adorned} ${className}`} {...props} />
        {suffix && <span className={`${styles.adornment} ${styles.right}`}>{suffix}</span>}
      </div>
    );
  }
  return (
    <input
      type={type}
      className={`${styles.input} ${error ? styles.hasError : ''} ${className}`}
      {...props}
    />
  );
}

export function Select({ error, children, className = '', ...props }) {
  return (
    <select className={`${styles.input} ${styles.select} ${error ? styles.hasError : ''} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ error, rows = 3, className = '', ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${styles.input} ${styles.textarea} ${error ? styles.hasError : ''} ${className}`}
      {...props}
    />
  );
}
