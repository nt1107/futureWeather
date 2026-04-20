import { useRef, useLayoutEffect, useState } from 'react';
import styles from './index.module.css';

// 天气图标映射
const weatherIcons = {
  '晴': '☀️',
  '多云': '⛅',
  '阴': '☁️',
  '小雨': '🌧️',
  '中雨': '🌧️',
  '大雨': '🌧️',
  '暴雨': '⛈️',
  '雷阵雨': '⛈️',
  '阵雨': '🌧️',
  '雨': '🌧️',
  '雪': '❄️',
  '小雪': '❄️',
  '中雪': '❄️',
  '大雪': '❄️',
  '雨夹雪': '🌨️',
  '雾': '🌫️',
  '霾': '🌫️',
  '风': '💨',
};

function WeatherTooltip({ visible, position, data, onClose }) {
  const tooltipRef = useRef(null);

  // 计算弹框位置
  useLayoutEffect(() => {
    if (!visible || !position || !tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 340;
    const tooltipHeight = tooltipRect.height || 400;
    const offset = 15;

    let left = position.x + offset;
    let top = position.y + offset;

    // 如果右侧空间不足，显示在鼠标左侧
    if (position.x + tooltipWidth + offset > window.innerWidth) {
      left = position.x - tooltipWidth - offset;
    }

    // 如果下方空间不足，显示在鼠标上方
    if (position.y + tooltipHeight + offset > window.innerHeight) {
      top = position.y - tooltipHeight - offset;
    }

    // 确保不超出左边界
    if (left < 0) {
      left = 10;
    }

    // 确保不超出上边界
    if (top < 0) {
      top = 10;
    }

    // 直接设置DOM样式，避免re-render
    tooltipRef.current.style.left = `${left}px`;
    tooltipRef.current.style.top = `${top}px`;
  }, [visible, position]);

  if (!visible || !data) return null;

  const { name, weatherData, selectedDate } = data;

  // 找到选中日期的天气
  const selectedWeather = weatherData?.find(
    (d) => d.fxDate === selectedDate.toISOString().split('T')[0]
  );

  // 获取未来几天的天气列表（显示5天概要）
  const weatherList = weatherData?.slice(0, 5) || [];

  // 计算温度范围用于图表
  const temperatures = weatherData?.map((d) => ({
    date: d.fxDate,
    max: parseInt(d.tempMax),
    min: parseInt(d.tempMin),
    weather: d.textDay,
  })) || [];

  // 绘制简单的温度折线图 (使用SVG)
  const chartWidth = 280;
  const chartHeight = 100;
  const padding = 25;

  const maxTemp = Math.max(...temperatures.map((t) => t.max));
  const minTemp = Math.min(...temperatures.map((t) => t.min));
  const tempRange = maxTemp - minTemp || 20;

  const xStep = (chartWidth - 2 * padding) / (temperatures.length - 1);
  const yScale = (chartHeight - 2 * padding) / tempRange;

  const maxPathPoints = temperatures.map((t, i) => ({
    x: padding + i * xStep,
    y: chartHeight - padding - (t.max - minTemp) * yScale,
    weather: t.weather,
  }));

  const minPathPoints = temperatures.map((t, i) => ({
    x: padding + i * xStep,
    y: chartHeight - padding - (t.min - minTemp) * yScale,
  }));

  const maxPath = maxPathPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const minPath = minPathPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return (
    <div
      ref={tooltipRef}
      className={styles['tooltip-root']}
      style={{
        left: (position?.x || 0) + 15,
        top: (position?.y || 0) + 15,
      }}
      onMouseLeave={onClose}
    >
      <div className={styles['tooltip-header']}>
        <span className={styles['tooltip-title']}>{name}</span>
        <button className={styles['tooltip-close']} onClick={onClose}>
          ×
        </button>
      </div>

      {/* 当前选中日期天气详情 */}
      {selectedWeather && (
        <div className={styles['tooltip-current']}>
          <div className={styles['tooltip-weather-icon']}>
            {weatherIcons[selectedWeather.textDay] || '🌤️'}
          </div>
          <div className={styles['tooltip-weather-info']}>
            <span className={styles['tooltip-weather-text']}>{selectedWeather.textDay}</span>
            <span className={styles['tooltip-temp-range']}>
              {selectedWeather.tempMin}°C ~ {selectedWeather.tempMax}°C
            </span>
          </div>
          <div className={styles['tooltip-weather-extra']}>
            <span className={styles['tooltip-humidity']}>湿度 {selectedWeather.humidity}%</span>
            <span className={styles['tooltip-wind']}>
              {selectedWeather.windDirDay}风 {selectedWeather.windScaleDay}级
            </span>
          </div>
        </div>
      )}

      {/* 温度趋势图表 */}
      {temperatures.length > 0 && (
        <div className={styles['tooltip-chart']}>
          <div className={styles['tooltip-chart-title']}>15天温度趋势</div>
          <svg width={chartWidth} height={chartHeight}>
            {/* 高温折线 */}
            <path d={maxPath} fill="none" stroke="#ef4444" strokeWidth="2" />
            {/* 低温折线 */}
            <path d={minPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
            {/* 数据点 */}
            {maxPathPoints.map((p, i) => (
              <circle key={`max-${i}`} cx={p.x} cy={p.y} r="3" fill="#ef4444" />
            ))}
            {minPathPoints.map((p, i) => (
              <circle key={`min-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
            ))}
            {/* 温度标签 */}
            <text x={5} y={12} className={styles['tooltip-chart-label']}>
              {maxTemp}°
            </text>
            <text x={5} y={chartHeight - 8} className={styles['tooltip-chart-label']}>
              {minTemp}°
            </text>
          </svg>
        </div>
      )}

      {/* 5天天气概览 */}
      <div className={styles['tooltip-days']}>
        {weatherList.map((day, index) => (
          <div key={day.fxDate} className={styles['tooltip-day-item']}>
            <span className={styles['tooltip-day-date']}>
              {index === 0 ? '今天' : index === 1 ? '明天' : `${index + 1}天后`}
            </span>
            <span className={styles['tooltip-day-icon']}>
              {weatherIcons[day.textDay] || '🌤️'}
            </span>
            <span className={styles['tooltip-day-temp']}>
              {day.tempMin}~{day.tempMax}°
            </span>
            <span className={styles['tooltip-day-weather']}>{day.textDay}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeatherTooltip;