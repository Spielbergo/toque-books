import styles from './Badge.module.css';

export default function Badge({ children, color = 'default', size = 'sm' }) {
  return (
    <span className={`${styles.badge} ${styles[color]} ${styles[size]}`}>
      {children}
    </span>
  );
}
