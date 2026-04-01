import { useState, useEffect, useCallback } from 'react';
import { fetchWeatherByAdcode } from '../services/weather';

// 天气数据 Hook
export function useWeather() {
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取单个城市天气
  const fetchWeather = useCallback(async (adcode) => {
    if (weatherData[adcode]) {
      return weatherData[adcode];
    }

    try {
      const data = await fetchWeatherByAdcode(adcode);
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
        const data = await fetchWeatherByAdcode(adcode);
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