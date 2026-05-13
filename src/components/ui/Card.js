import styles from './Card.module.css';

export default function Card({ children, className = '', padding = 'normal', ...props }) {
  return (
    <div className={`${styles.card} ${styles[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.headerText}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, color = 'default', icon, className = '' }) {
  return (
    <div className={`${styles.stat} ${styles[`stat_${color}`]} ${className}`}>
      {icon && <span className={styles.statIcon}>{icon}</span>}
      <div className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
}
