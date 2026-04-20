import { useState, useEffect, useCallback } from 'react';
import { fetch15DaysWeather, PROVINCE_LOCATION_MAP } from '../services/weather';

// 天气数据 Hook
export function useWeather() {
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取单个城市天气（通过adcode）
  const fetchWeather = useCallback(async (adcode) => {
    if (weatherData[adcode]) {
      return weatherData[adcode];
    }

    try {
      // 省级adcode有映射，其他层级用adcode作为locationId（模拟数据）
      const locationId = PROVINCE_LOCATION_MAP[adcode] || adcode;
      const data = await fetch15DaysWeather(locationId);
      setWeatherData((prev) => ({
        ...prev,
        [adcode]: data,
      }));
      return data;
    } catch (err) {
      console.error(`获取天气失败: ${adcode}`, err);
      return null;
    }
  }, [weatherData]);

  // 批量获取天气
  const fetchBatchWeather = useCallback(async (adcodes) => {
    setLoading(true);
    setError(null);

    const results = {};

    for (const adcode of adcodes) {
      try {
        const locationId = PROVINCE_LOCATION_MAP[adcode] || adcode;
        const data = await fetch15DaysWeather(locationId);
        results[adcode] = data;
      } catch (err) {
        results[adcode] = null;
      }
    }

    setWeatherData((prev) => ({
      ...prev,
      ...results,
    }));
    setLoading(false);
    return results;
  }, []);

  // 清除缓存
  const clearCache = useCallback(() => {
    setWeatherData({});
  }, []);

  return {
    weatherData,
    loading,
    error,
    fetchWeather,
    fetchBatchWeather,
    clearCache,
  };
}

export default useWeather;