import styles from './index.module.css';

function Breadcrumb({ path, onNavigate }) {
  return (
    <div className={styles['breadcrumb-root']}>
      {path.map((item, index) => (
        <div key={item.adcode} className={styles['breadcrumb-item']}>
          {index > 0 && <span className={styles['breadcrumb-separator']}>›</span>}
          <button
            className={styles['breadcrumb-link']}
            onClick={() => onNavigate(index)}
            disabled={index === path.length - 1}
          >
            {item.name}
          </button>
        </div>
      ))}
    </div>
  );
}

export default Breadcrumb;