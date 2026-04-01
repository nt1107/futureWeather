import styles from './index.module.css';

function Legend() {
  const temperatureRanges = [
    { label: '高温', range: '≥35°C', color: '#ef4444' },
    { label: '炎热', range: '30-35°C', color: '#f97316' },
    { label: '温暖', range: '20-30°C', color: '#eab308' },
    { label: '凉爽', range: '10-20°C', color: '#22c55e' },
    { label: '寒冷', range: '0-10°C', color: '#3b82f6' },
    { label: '极寒', range: '<0°C', color: '#6366f1' },
  ];

  return (
    <div className={styles['legend-root']}>
      <div className={styles['legend-title']}>温度图例</div>
      <div className={styles['legend-items']}>
        {temperatureRanges.map((item) => (
          <div key={item.label} className={styles['legend-item']}>
            <span
              className={styles['legend-color']}
              style={{ backgroundColor: item.color }}
            />
            <span className={styles['legend-label']}>{item.label}</span>
            <span className={styles['legend-range']}>{item.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Legend;