import { useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import styles from './index.module.css';
import {
  waitForLoad,
  getGeoJSONByLevel,
  loadCitiesGeoJSON,
  loadCountiesGeoJSON,
} from '../../services/geoDataService';

// 天气图标映射
const weatherIcons = {
  '晴': '☀',
  '多云': '⛅',
  '阴': '☁',
  '小雨': '🌧',
  '中雨': '🌧',
  '大雨': '🌧',
  '暴雨': '⛈',
  '雷阵雨': '⛈',
  '阵雨': '🌧',
  '雨': '🌧',
  '雪': '❄',
  '小雪': '❄',
  '中雪': '❄',
  '大雪': '❄',
  '雨夹雪': '🌨',
  '雾': '🌫',
  '霾': '🌫',
  '风': '💨',
};

// 层级配置
const LEVEL_CONFIG = {
  province: {
    name: '省级',
    minZoom: 0.5,
    maxZoom: 8.0,
    baseZoom: 2.5,
    labelSize: 12,
  },
  city: {
    name: '市级',
    minZoom: 8.0,
    maxZoom: 12.0,
    baseZoom: 9.0,
    labelSize: 10,
  },
  county: {
    name: '县级',
    minZoom: 12.0,
    maxZoom: 25,
    baseZoom: 14.0,
    labelSize: 9,
  },
};

// 根据zoom获取当前层级
function getLevelByZoom(zoom) {
  if (zoom < LEVEL_CONFIG.city.minZoom) return 'province';
  if (zoom < LEVEL_CONFIG.county.minZoom) return 'city';
  return 'county';
}

// 根据温度获取颜色
function getTemperatureColor(temp) {
  if (temp >= 35) return '#ef4444';
  if (temp >= 30) return '#f97316';
  if (temp >= 20) return '#eab308';
  if (temp >= 10) return '#22c55e';
  if (temp >= 0) return '#3b82f6';
  return '#6366f1';
}

// 提取GeoJSON几何边界坐标（用于lines系列）
function extractBoundaryCoords(geometry) {
  const coords = [];
  if (!geometry || !geometry.coordinates) return coords;

  const extract = (arr) => {
    if (typeof arr[0] === 'number') {
      // 单个坐标点 [lng, lat]
      return [arr];
    }
    // 坐标数组，递归处理
    return arr.flatMap(extract);
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => {
      coords.push(ring.map((p) => [p[0], p[1]]));
    });
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        coords.push(ring.map((p) => [p[0], p[1]]));
      });
    });
  }

  return coords;
}

// 格式化天气显示文本
function formatWeatherLabel(weather) {
  if (!weather) return '';
  const icon = weatherIcons[weather.textDay] || '';
  const temp = `${weather.tempMin}~${weather.tempMax}°`;
  return `${icon} ${temp}`;
}

// 绘制父级边框线条（使用series坐标系）
function drawParentBorderGraphics(chart, parentGeoJSON, borderColor) {
  if (!chart || !parentGeoJSON) return [];

  const graphicElements = [];

  parentGeoJSON.features.forEach((feature) => {
    const coords = extractBoundaryCoords(feature.geometry);

    coords.forEach((coordLine) => {
      // 使用series坐标系转换
      const pixelCoords = coordLine.map((coord) => {
        try {
          // 使用seriesIndex指定坐标系
          return chart.convertToPixel({ seriesIndex: 0 }, coord);
        } catch (e) {
          return null;
        }
      }).filter((p) => p !== null);

      if (pixelCoords.length > 1) {
        graphicElements.push({
          type: 'polyline',
          shape: {
            points: pixelCoords,
          },
          style: {
            stroke: borderColor,
            lineWidth: 2,
          },
          silent: true,
          z: 100,
        });
      }
    });
  });

  return graphicElements;
}

// 父级边界配色
const parentBorderColor = {
  province: '#1a73e8',
  city: '#34a853',
};

// 地图组件
function MapChart({
  selectedDate,
  onAreaHover,
  onLevelChange,
  weatherData,
}) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [loading, setLoading] = useState(false);
  const [currentLevelName, setCurrentLevelName] = useState('省级');

  // 状态ref
  const currentLevel = useRef('province');
  const isInitialized = useRef(false);
  const isTransitioning = useRef(false);

  // 弹框相关
  const hoverTimerRef = useRef(null);
  const lastHoverAreaRef = useRef(null);
  const isDraggingRef = useRef(false);

  // 初始化
  useEffect(() => {
    if (!chartRef.current || isInitialized.current) return;

    const initMap = async () => {
      setLoading(true);
      try {
        chartInstance.current = echarts.init(chartRef.current);

        // 加载省级数据
        const geoJSON = await waitForLoad('province');
        if (!geoJSON) {
          console.error('省级数据加载失败');
          setLoading(false);
          return;
        }

        // 后台预加载市级和县级数据
        loadCitiesGeoJSON().then(() => {
          console.log('市级数据预加载完成');
          return loadCountiesGeoJSON();
        }).then(() => {
          console.log('县级数据预加载完成');
        });

        // 注册并渲染
        echarts.registerMap('china_map', geoJSON);
        renderMapByLevel('province', geoJSON, LEVEL_CONFIG.province.baseZoom);

        isInitialized.current = true;
        setLoading(false);

        // 绑定事件
        bindEvents();
      } catch (error) {
        console.error('初始化地图失败:', error);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  // 更新父级边框graphic（缩放/平移后像素坐标变化）
  const updateParentBorderGraphics = () => {
    const level = currentLevel.current;
    if (level === 'province') return;

    const parentLevel = level === 'city' ? 'province' : 'city';
    const parentGeoJSON = getGeoJSONByLevel(parentLevel);

    if (parentGeoJSON && chartInstance.current) {
      const borderColor = parentBorderColor[parentLevel];
      const graphics = drawParentBorderGraphics(chartInstance.current, parentGeoJSON, borderColor);
      if (graphics.length > 0) {
        chartInstance.current.setOption({
          graphic: graphics,
        });
      }
    }
  };

  // 渲染地图 - map series + custom边框线条（renderItem）
  const renderMapByLevel = (level, geoJSON, zoom, center = [104, 36]) => {
    if (!geoJSON || !chartInstance.current) return;

    const config = LEVEL_CONFIG[level];

    // 边框配色方案
    let borderWidth = 1;
    let borderColor = '#e0e0e0';
    if (level === 'city') {
      borderWidth = 0.6;
      borderColor = '#d0d0d0';
    } else if (level === 'county') {
      borderWidth = 0.4;
      borderColor = '#c8c8c8';
    }

    // 构建 data 数组（仅当前层级）
    const data = [];

    geoJSON.features.forEach((feature) => {
      const adcode = feature.properties.adcode;
      const name = feature.properties.name;
      const weather = weatherData?.[adcode];

      let itemStyle = {
        borderColor: borderColor,
        borderWidth: borderWidth,
        areaColor: '#f5f5f5',
      };
      let labelFormatter = name;
      const showWeather = level === 'province';

      if (weather && selectedDate && showWeather) {
        const targetDate = selectedDate.toISOString().split('T')[0];
        const dayWeather = weather.find((d) => d.fxDate === targetDate);
        if (dayWeather) {
          const temp = parseInt(dayWeather.tempMax);
          itemStyle.areaColor = getTemperatureColor(temp);
          labelFormatter = `${name}\n${formatWeatherLabel(dayWeather)}`;
        }
      }

      data.push({
        name,
        value: adcode,
        itemStyle,
        label: { formatter: labelFormatter },
      });
    });

    // 注册当前层级地图
    const mapName = `map_${level}_${Date.now()}`;
    echarts.registerMap(mapName, geoJSON);

    // 先清空图表
    chartInstance.current.clear();

    // 构建 option
    const option = {
      backgroundColor: '#fafafa',
      tooltip: { show: false },
      series: [{
        type: 'map',
        map: mapName,
        roam: true,
        zoom: zoom,
        center: center,
        scaleLimit: { min: 0.5, max: 25 },
        label: {
          show: true,
          fontSize: config.labelSize,
          color: '#333',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: config.labelSize + 2,
            fontWeight: 'bold',
            color: '#000',
          },
          itemStyle: {
            areaColor: '#e3f2fd',
          },
        },
        itemStyle: {
          areaColor: '#f5f5f5',
        },
        data: data,
      }],
    };

    chartInstance.current.setOption(option);
    currentLevel.current = level;
    setCurrentLevelName(config.name);

    // 绘制父级边框graphic（纯线条，不遮挡事件）
    if (level === 'city' || level === 'county') {
      const parentLevel = level === 'city' ? 'province' : 'city';
      const parentGeoJSON = getGeoJSONByLevel(parentLevel);

      if (parentGeoJSON) {
        const borderColor = parentBorderColor[parentLevel];
        // 等待渲染完成后再绘制graphic（否则坐标系未就绪）
        setTimeout(() => {
          const graphics = drawParentBorderGraphics(chartInstance.current, parentGeoJSON, borderColor);
          if (graphics.length > 0) {
            chartInstance.current.setOption({
              graphic: graphics,
            });
          }
        }, 50);
      }
    } else {
      // 省级视图，清除graphic
      chartInstance.current.setOption({
        graphic: [],
      });
    }
  };

  // 绑定事件
  const bindEvents = () => {
    if (!chartInstance.current) return;

    // 鼠标移入 - 延迟显示
    chartInstance.current.on('mouseover', (params) => {
      if (isDraggingRef.current || !params.value) return;

      clearHoverTimer();
      hoverTimerRef.current = setTimeout(() => {
        if (lastHoverAreaRef.current?.adcode !== params.value) {
          lastHoverAreaRef.current = { adcode: params.value, name: params.name };
          onAreaHover?.({
            adcode: params.value,
            name: params.name,
            level: currentLevel.current,
            position: { x: params.event.offsetX, y: params.event.offsetY },
          });
        }
      }, 800);
    });

    chartInstance.current.on('mouseout', () => {
      clearHoverTimer();
      lastHoverAreaRef.current = null;
      onAreaHover?.(null);
    });

    // 缩放事件
    chartInstance.current.on('georoam', () => {
      if (isTransitioning.current) return;

      isDraggingRef.current = true;
      clearHoverTimer();
      onAreaHover?.(null);

      const option = chartInstance.current.getOption();
      const zoom = option.series[0].zoom;
      const center = option.series[0].center;

      const newLevel = getLevelByZoom(zoom);

      // 层级变化
      if (newLevel !== currentLevel.current) {
        handleLevelChange(newLevel, zoom, center);
      } else {
        // 同层级缩放，更新graphic线条位置
        updateParentBorderGraphics();
      }

      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    });

    // 窗口resize
    window.addEventListener('resize', () => {
      chartInstance.current?.resize();
    });
  };

  // 处理层级变化
  const handleLevelChange = async (newLevel, zoom, center) => {
    isTransitioning.current = true;

    let geoJSON = getGeoJSONByLevel(newLevel);

    if (!geoJSON) {
      setLoading(true);
      if (newLevel === 'city') {
        await loadCitiesGeoJSON();
      } else if (newLevel === 'county') {
        await loadCountiesGeoJSON();
      }
      geoJSON = await waitForLoad(newLevel);
    }

    if (geoJSON) {
      // 重新注册地图
      echarts.registerMap('china_map', geoJSON);
      renderMapByLevel(newLevel, geoJSON, zoom, center);
      onLevelChange?.(newLevel);
    }

    setLoading(false);
    setTimeout(() => {
      isTransitioning.current = false;
    }, 300);
  };

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  // 天气数据更新
  useEffect(() => {
    if (!isInitialized.current || currentLevel.current !== 'province') return;

    const geoJSON = getGeoJSONByLevel('province');
    if (!geoJSON || !chartInstance.current) return;

    const option = chartInstance.current.getOption();
    const zoom = option.series[0].zoom;
    const center = option.series[0].center;

    renderMapByLevel('province', geoJSON, zoom, center);
  }, [weatherData, selectedDate]);

  return (
    <div className={styles['mapchart-root']}>
      {loading && (
        <div className={styles['mapchart-loading']}>
          <span className={styles['mapchart-loading-text']}>加载地图数据...</span>
        </div>
      )}
      <div ref={chartRef} className={styles['mapchart-container']} />
    </div>
  );
}

export default MapChart;