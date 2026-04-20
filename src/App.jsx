import { useState, useEffect, useCallback } from 'react';
import DatePicker from './components/DatePicker';
import MapChart from './components/MapChart';
import WeatherTooltip from './components/WeatherTooltip';
import Legend from './components/Legend';
import { useWeather } from './hooks/useWeather';
import { getDateRange } from './utils/helpers';
import styles from './App.module.css';

// 层级名称映射
const LEVEL_NAMES = {
  province: '省级视图',
  city: '市级视图',
  county: '县级视图',
};

function App() {
  // 日期相关
  const { minDate, maxDate } = getDateRange(15);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 当前层级
  const [currentLevel, setCurrentLevel] = useState('province');

  // 悬浮弹框状态
  const [hoverArea, setHoverArea] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // 天气数据
  const { weatherData, fetchWeather } = useWeather();

  // 日期变化处理
  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
  }, []);

  // 层级变化处理
  const handleLevelChange = useCallback((level) => {
    setCurrentLevel(level);
    // 清除悬浮状态
    setHoverArea(null);
    setTooltipVisible(false);
  }, []);

  // 区域悬浮处理 - 只显示tooltip，不累积天气数据影响地图颜色
  const handleAreaHover = useCallback(
    async (area) => {
      if (!area) {
        setTooltipVisible(false);
        setHoverArea(null);
        return;
      }

      // 获取天气数据用于tooltip显示，但不更新全局weatherData
      const weather = await fetchWeather(area.adcode);

      setHoverArea({
        name: area.name,
        adcode: area.adcode,
        level: area.level,
        weatherData: weather,
        selectedDate,
        position: area.position,
      });
      setTooltipVisible(true);
    },
    [fetchWeather, selectedDate]
  );

  // 关闭弹框
  const handleCloseTooltip = useCallback(() => {
    setTooltipVisible(false);
  }, []);

  return (
    <div className={styles['app-root']}>
      {/* 全屏地图 */}
      <MapChart
        selectedDate={selectedDate}
        onAreaHover={handleAreaHover}
        onLevelChange={handleLevelChange}
        weatherData={weatherData}
      />

      {/* 悬浮控件层 */}
      <div className={styles['app-controls-overlay']}>
        {/* 日期选择器 */}
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          minDate={minDate}
          maxDate={maxDate}
        />

        {/* 层级指示器 */}
        <div className={styles['app-level-indicator']}>
          {LEVEL_NAMES[currentLevel]}
        </div>
      </div>

      {/* 天气图例 */}
      <div className={styles['app-legend']}>
        <Legend />
      </div>

      {/* 悬浮弹框 */}
      <WeatherTooltip
        visible={tooltipVisible}
        position={hoverArea?.position || { x: 0, y: 0 }}
        data={hoverArea}
        onClose={handleCloseTooltip}
      />
    </div>
  );
}

export default App;