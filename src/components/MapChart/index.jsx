import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import styles from './index.module.css';
import {
  waitForLoad,
  getGeoJSONByLevel,
  loadCitiesGeoJSON,
  loadCountiesGeoJSON,
} from '../../services/geoDataService';
import {
  fetchBatchWeatherForMap,
  getWeatherSummary,
  getWeatherIcon,
  getTemperatureColor,
} from '../../services/weather';

// 层级配置 - 缩放过渡平滑
const LEVEL_CONFIG = {
  province: {
    name: '省级',
    minZoom: 0,
    maxZoom: 5,      // 降低省级最大缩放，避免跳太大
    baseZoom: 3,
    sourceId: 'province-source',
    fillLayerId: 'province-fill',
    lineLayerId: 'province-line',
    labelLayerId: 'province-label',
    labelSize: 12,
  },
  city: {
    name: '市级',
    minZoom: 5,      // 与省级衔接
    maxZoom: 8,      // 降低市级最大缩放
    baseZoom: 6,     // 进入市级时的缩放，能看到多个市
    sourceId: 'city-source',
    fillLayerId: 'city-fill',
    lineLayerId: 'city-line',
    labelLayerId: 'city-label',
    labelSize: 11,
  },
  county: {
    name: '县级',
    minZoom: 8,      // 与市级衔接
    maxZoom: 18,
    baseZoom: 8,     // 进入县级时的缩放，能看到多个县
    sourceId: 'county-source',
    fillLayerId: 'county-fill',
    lineLayerId: 'county-line',
    labelLayerId: 'county-label',
    labelSize: 10,
  },
};

// 根据zoom获取层级
function getLevelByZoom(zoom) {
  if (zoom < LEVEL_CONFIG.city.minZoom) return 'province';
  if (zoom < LEVEL_CONFIG.county.minZoom) return 'city';
  return 'county';
}

// 父级边界颜色
const PARENT_BORDER_COLORS = {
  province: '#1a73e8',
  city: '#34a853',
};

// 空白底图样式（使用开源glyphs服务）
const emptyStyle = {
  version: 8,
  sources: {},
  layers: [],
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
};

// 地图组件
function MapChart({ selectedDate, onAreaHover, onLevelChange, weatherData }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [currentLevelName, setCurrentLevelName] = useState('省级');

  // 状态refs
  const currentLevelRef = useRef('province');
  const isInitializedRef = useRef(false);
  const sourcesLoadedRef = useRef({ province: false, city: false, county: false });

  // 批量天气数据（用于地图显示）
  const levelWeatherDataRef = useRef({
    province: {},
    city: {},
    county: {},
  });

  // Hover状态
  const hoverTimerRef = useRef(null);
  const lastHoverAreaRef = useRef(null);
  const lastHoverFeatureIdRef = useRef(null);
  const isDraggingRef = useRef(false);

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current || isInitializedRef.current) return;

    const initMap = async () => {
      setLoading(true);

      try {
        // 创建MapLibre地图实例（无需token）
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: emptyStyle,
          center: [104, 36],
          zoom: LEVEL_CONFIG.province.baseZoom,
          minZoom: 0.5,
          maxZoom: 18,
          attributionControl: false,
        });

        mapRef.current = map;

        // 等待地图加载完成
        await new Promise((resolve) => map.on('load', resolve));

        // 加载并添加省级GeoJSON
        const provinceGeoJSON = await waitForLoad('province');
        if (!provinceGeoJSON) {
          console.error('省级数据加载失败');
          setLoading(false);
          return;
        }

        // 获取省级天气数据
        const provinceWeather = await fetchBatchWeatherForMap(provinceGeoJSON.features, selectedDate || new Date());
        levelWeatherDataRef.current.province = provinceWeather;

        // 添加省级地图数据
        const enhancedProvince = enhanceGeoJSONWithWeather(provinceGeoJSON, provinceWeather, selectedDate);
        addGeoJSONSource('province', enhancedProvince);

        // 后台预加载市级和县级数据（同时获取天气）
        loadCitiesGeoJSON().then(async () => {
          const cityGeoJSON = getGeoJSONByLevel('city');
          if (cityGeoJSON && mapRef.current) {
            const cityWeather = await fetchBatchWeatherForMap(cityGeoJSON.features, selectedDate || new Date());
            levelWeatherDataRef.current.city = cityWeather;
            addGeoJSONSource('city', enhanceGeoJSONWithWeather(cityGeoJSON, cityWeather, selectedDate));
            sourcesLoadedRef.current.city = true;
          }
        });

        loadCountiesGeoJSON().then(async () => {
          const countyGeoJSON = getGeoJSONByLevel('county');
          if (countyGeoJSON && mapRef.current) {
            const countyWeather = await fetchBatchWeatherForMap(countyGeoJSON.features, selectedDate || new Date());
            levelWeatherDataRef.current.county = countyWeather;
            addGeoJSONSource('county', enhanceGeoJSONWithWeather(countyGeoJSON, countyWeather, selectedDate));
            sourcesLoadedRef.current.county = true;
          }
        });

        // 绑定事件
        bindMapEvents(map);

        isInitializedRef.current = true;
        setLoading(false);
      } catch (error) {
        console.error('初始化地图失败:', error);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 为GeoJSON添加天气信息（用于label显示）
  const enhanceGeoJSONWithWeather = (geoJSON, levelWeather, date) => {
    if (!geoJSON || !geoJSON.features) return geoJSON;

    const targetDateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const enhancedFeatures = geoJSON.features.map((feature) => {
      const adcode = feature.properties.adcode;
      const weather = levelWeather?.[adcode];

      let labelText = feature.properties.name;
      let weatherColor = '#f5f5f5';

      if (weather) {
        const summary = getWeatherSummary(weather, date || new Date());
        if (summary) {
          labelText = `${feature.properties.name}\n${summary.icon} ${summary.tempRange}`;
          weatherColor = getTemperatureColor(summary.tempMax);
        }
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          labelText,
          weatherColor,
        },
      };
    });

    return { type: 'FeatureCollection', features: enhancedFeatures };
  };

  // 获取并更新当前层级的天气数据
  const fetchLevelWeatherData = async (level) => {
    const geoJSON = getGeoJSONByLevel(level);
    if (!geoJSON) return;

    const weatherResults = await fetchBatchWeatherForMap(geoJSON.features, selectedDate || new Date());
    levelWeatherDataRef.current[level] = weatherResults;

    // 更新地图显示
    updateMapWeatherDisplay(level);
  };

  // 更新地图天气显示
  const updateMapWeatherDisplay = (level) => {
    const map = mapRef.current;
    if (!map || !sourcesLoadedRef.current[level]) return;

    const geoJSON = getGeoJSONByLevel(level);
    if (!geoJSON) return;

    const enhanced = enhanceGeoJSONWithWeather(geoJSON, levelWeatherDataRef.current[level], selectedDate);
    const source = map.getSource(LEVEL_CONFIG[level].sourceId);

    if (source) {
      source.setData(enhanced);
    }
  };

  // 添加GeoJSON数据源和图层
  const addGeoJSONSource = (level, geoJSON) => {
    const map = mapRef.current;
    if (!map || !geoJSON) return;

    const config = LEVEL_CONFIG[level];

    // 如果source已存在，先移除所有图层
    if (map.getSource(config.sourceId)) {
      if (map.getLayer(config.labelLayerId)) map.removeLayer(config.labelLayerId);
      if (map.getLayer(config.lineLayerId)) map.removeLayer(config.lineLayerId);
      if (map.getLayer(config.fillLayerId)) map.removeLayer(config.fillLayerId);
      map.removeSource(config.sourceId);
    }

    // 添加source - 启用generateId以支持feature-state
    map.addSource(config.sourceId, {
      type: 'geojson',
      data: geoJSON,
      generateId: true,  // 为每个feature生成唯一id
    });

    // 添加填充图层 - 支持hover高亮
    map.addLayer({
      id: config.fillLayerId,
      type: 'fill',
      source: config.sourceId,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#e3f2fd',  // hover时的颜色
          '#f5f5f5',  // 默认颜色
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.9,
          0.85,
        ],
      },
      minzoom: config.minZoom,
      maxzoom: config.maxZoom + 0.5,
    });

    // 添加边界线图层
    map.addLayer({
      id: config.lineLayerId,
      type: 'line',
      source: config.sourceId,
      paint: {
        'line-color': level === 'province' ? '#e0e0e0' : '#c8c8c8',
        'line-width': level === 'province' ? 1.5 : 0.8,
      },
      minzoom: config.minZoom,
      maxzoom: config.maxZoom + 0.5,
    });

    // 添加名称标签图层（显示天气图标和温度）
    map.addLayer({
      id: config.labelLayerId,
      type: 'symbol',
      source: config.sourceId,
      layout: {
        'text-field': ['get', 'labelText'],  // 使用增强后的labelText
        'text-font': ['Open Sans Regular'],
        'text-size': config.labelSize,
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#333333',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
      minzoom: config.minZoom,
      maxzoom: config.maxZoom + 0.5,
    });

    sourcesLoadedRef.current[level] = true;
  };

  // 绑定地图事件
  const bindMapEvents = (map) => {
    // 缩放结束 - 切换层级
    map.on('zoomend', () => {
      const zoom = map.getZoom();
      const newLevel = getLevelByZoom(zoom);

      if (newLevel !== currentLevelRef.current) {
        handleLevelChange(newLevel);
      }
    });

    // 拖拽开始
    map.on('dragstart', () => {
      isDraggingRef.current = true;

      // 清除hover feature-state
      const level = currentLevelRef.current;
      if (lastHoverFeatureIdRef.current !== null) {
        map.setFeatureState(
          { source: LEVEL_CONFIG[level].sourceId, id: lastHoverFeatureIdRef.current },
          { hover: false }
        );
        lastHoverFeatureIdRef.current = null;
      }

      clearHoverTimer();
      onAreaHover?.(null);
    });

    // 拖拽结束
    map.on('dragend', () => {
      setTimeout(() => (isDraggingRef.current = false), 100);
    });

    // 鼠标移动 - hover检测
    map.on('mousemove', (e) => {
      if (isDraggingRef.current) return;

      const level = currentLevelRef.current;
      const fillLayerId = LEVEL_CONFIG[level].fillLayerId;

      const features = map.queryRenderedFeatures(e.point, { layers: [fillLayerId] });

      if (features.length > 0) {
        const feature = features[0];
        const featureId = feature.id;
        const adcode = feature.properties.adcode;
        const name = feature.properties.name;

        // 清除上一个hover区域的feature-state
        if (lastHoverFeatureIdRef.current !== null && lastHoverFeatureIdRef.current !== featureId) {
          map.setFeatureState(
            { source: LEVEL_CONFIG[level].sourceId, id: lastHoverFeatureIdRef.current },
            { hover: false }
          );
        }

        // 设置当前hover区域的feature-state
        if (featureId !== undefined) {
          map.setFeatureState(
            { source: LEVEL_CONFIG[level].sourceId, id: featureId },
            { hover: true }
          );
          lastHoverFeatureIdRef.current = featureId;
        }

        clearHoverTimer();

        hoverTimerRef.current = setTimeout(() => {
          if (lastHoverAreaRef.current?.adcode !== adcode) {
            lastHoverAreaRef.current = { adcode, name };
            onAreaHover?.({
              adcode,
              name,
              level,
              position: { x: e.point.x, y: e.point.y },
            });
          }
        }, 800);
      } else {
        // 鼠标移出区域，清除hover状态
        if (lastHoverFeatureIdRef.current !== null) {
          map.setFeatureState(
            { source: LEVEL_CONFIG[level].sourceId, id: lastHoverFeatureIdRef.current },
            { hover: false }
          );
          lastHoverFeatureIdRef.current = null;
        }
        clearHoverTimer();
        if (lastHoverAreaRef.current) {
          lastHoverAreaRef.current = null;
          onAreaHover?.(null);
        }
      }
    });

    // 鼠标离开地图容器
    map.getCanvas().addEventListener('mouseleave', () => {
      const level = currentLevelRef.current;
      const map = mapRef.current;

      // 清除hover feature-state
      if (lastHoverFeatureIdRef.current !== null && map) {
        map.setFeatureState(
          { source: LEVEL_CONFIG[level].sourceId, id: lastHoverFeatureIdRef.current },
          { hover: false }
        );
        lastHoverFeatureIdRef.current = null;
      }

      clearHoverTimer();
      lastHoverAreaRef.current = null;
      onAreaHover?.(null);
    });

    // resize
    const handleResize = () => map.resize();
    window.addEventListener('resize', handleResize);
  };

  // 处理层级变化
  const handleLevelChange = async (newLevel) => {
    const map = mapRef.current;
    const oldLevel = currentLevelRef.current;

    // 清除旧层级的hover状态
    if (lastHoverFeatureIdRef.current !== null && map && sourcesLoadedRef.current[oldLevel]) {
      map.setFeatureState(
        { source: LEVEL_CONFIG[oldLevel].sourceId, id: lastHoverFeatureIdRef.current },
        { hover: false }
      );
      lastHoverFeatureIdRef.current = null;
    }

    currentLevelRef.current = newLevel;
    setCurrentLevelName(LEVEL_CONFIG[newLevel].name);
    onLevelChange?.(newLevel);

    // 确保该层级数据已加载并获取天气
    if (!sourcesLoadedRef.current[newLevel]) {
      setLoading(true);

      if (newLevel === 'city') await loadCitiesGeoJSON();
      else if (newLevel === 'county') await loadCountiesGeoJSON();

      const geoJSON = await waitForLoad(newLevel);
      if (geoJSON && mapRef.current) {
        // 获取该层级天气数据
        const weatherData = await fetchBatchWeatherForMap(geoJSON.features, selectedDate || new Date());
        levelWeatherDataRef.current[newLevel] = weatherData;

        addGeoJSONSource(newLevel, enhanceGeoJSONWithWeather(geoJSON, weatherData, selectedDate));
      }

      setLoading(false);
    } else {
      // 已加载，只需更新天气显示
      updateMapWeatherDisplay(newLevel);
    }

    // 更新父级边界线
    updateParentBorder(newLevel);
  };

  // 更新父级边界线
  const updateParentBorder = (level) => {
    const map = mapRef.current;
    if (!map) return;

    // 移除现有父级边界
    ['province-border', 'city-border'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(`${id}-source`)) map.removeSource(`${id}-source`);
    });

    // 添加父级边界（省级视图不需要）
    if (level !== 'province') {
      const parentLevel = level === 'city' ? 'province' : 'city';
      const parentGeoJSON = getGeoJSONByLevel(parentLevel);

      if (parentGeoJSON) {
        const borderId = `${parentLevel}-border`;
        map.addSource(`${borderId}-source`, { type: 'geojson', data: parentGeoJSON });
        map.addLayer({
          id: borderId,
          type: 'line',
          source: `${borderId}-source`,
          paint: {
            'line-color': PARENT_BORDER_COLORS[parentLevel],
            'line-width': 2.5,
          },
          minzoom: LEVEL_CONFIG[level].minZoom,
        });
      }
    }
  };

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  // 日期切换时更新天气显示
  useEffect(() => {
    if (!isInitializedRef.current) return;

    // 更新当前层级的天气显示
    const level = currentLevelRef.current;
    updateMapWeatherDisplay(level);
  }, [selectedDate]);

  return (
    <div className={styles['mapchart-root']}>
      {loading && (
        <div className={styles['mapchart-loading']}>
          <span className={styles['mapchart-loading-text']}>加载中...</span>
        </div>
      )}
      <div ref={mapContainerRef} className={styles['mapchart-container']} />
    </div>
  );
}

export default MapChart;