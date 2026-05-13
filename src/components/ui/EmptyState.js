import Link from 'next/link';
import Button from './Button';
import styles from './EmptyState.module.css';

export default function EmptyState({ icon, title, description, action }) {
  const renderAction = () => {
    if (!action) return null;
    if (typeof action === 'object' && !Array.isArray(action)) {
      const { label, onClick, href } = action;
      if (typeof label === 'string' || typeof label === 'number') {
        if (href) {
          return (
            <Link href={href}>
              <Button>{label}</Button>
            </Link>
          );
        }
        if (typeof onClick === 'function') {
          return <Button onClick={onClick}>{label}</Button>;
        }
        return label;
      }
    }
    return action;
  };

  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{renderAction()}</div>}
    </div>
  );
}
