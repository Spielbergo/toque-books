import styles from './FormField.module.css';

export function FormField({ label, error, hint, extra, required, children, className = '' }) {
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
      {extra}
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
  // Currency inputs: switch to text+inputMode so trailing zeros are preserved
  // (type="number" always strips trailing zeros, making $1.10 display as $1.1)
  const isCurrency = type === 'number' && prefix === '$';
  const resolvedType = isCurrency ? 'text' : type;
  const extraProps = isCurrency ? { inputMode: 'decimal' } : {};

  if (prefix || suffix) {
    return (
      <div className={`${styles.inputWrap} ${error ? styles.hasError : ''}`}>
        {prefix && <span className={styles.adornment}>{prefix}</span>}
        <input type={resolvedType} className={`${styles.input} ${styles.adorned} ${className}`} {...extraProps} {...props} />
        {suffix && <span className={`${styles.adornment} ${styles.right}`}>{suffix}</span>}
      </div>
    );
  }
  return (
    <input
      type={resolvedType}
      className={`${styles.input} ${error ? styles.hasError : ''} ${className}`}
      {...extraProps}
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
