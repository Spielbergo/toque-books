'use client';

import { useState } from 'react';
import styles from './FAQAccordion.module.css';

export default function FAQAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className={styles.accordion}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={`${styles.item} ${isOpen ? styles.itemOpen : ''}`}>
            <button
              className={styles.trigger}
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              <span className={styles.question}>{item.question}</span>
              <span className={styles.icon} aria-hidden="true">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            <div className={styles.body} aria-hidden={!isOpen}>
              <p className={styles.answer}>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
