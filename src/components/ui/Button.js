import styles from './Button.module.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading || undefined}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${loading ? styles.loading : ''} ${className}`}
      {...props}
    >
      {loading && (
        <span className={styles.spinner} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
