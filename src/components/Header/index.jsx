import styles from './index.module.css';

function Header() {
  return (
    <header className={styles['header-root']}>
      <div className={styles['header-logo']}>
        <span className={styles['header-title']}>未来天气</span>
      </div>
    </header>
  );
}

export default Header;