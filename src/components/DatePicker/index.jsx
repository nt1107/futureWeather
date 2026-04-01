import styles from './index.module.css';

function DatePicker({ selectedDate, onDateChange, minDate, maxDate }) {
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === 2) return '后天';

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const generateDates = () => {
    const dates = [];
    const start = new Date(minDate);
    const end = new Date(maxDate);

    while (start <= end) {
      dates.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }

    return dates;
  };

  const dates = generateDates();

  return (
    <div className={styles['datepicker-root']}>
      <div className={styles['datepicker-label']}>选择日期</div>
      <div className={styles['datepicker-dropdown']}>
        <button className={styles['datepicker-button']}>
          {formatDisplayDate(selectedDate)}
        </button>
        <div className={styles['datepicker-menu']}>
          {dates.map((date) => (
            <button
              key={formatDate(date)}
              className={`${styles['datepicker-option']} ${
                formatDate(date) === formatDate(selectedDate)
                  ? styles['datepicker-option-active']
                  : ''
              }`}
              onClick={() => onDateChange(date)}
            >
              {formatDisplayDate(date)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DatePicker;