// GeoJSON 数据预加载服务
// 分级加载：省级(立即) -> 市级(预加载) -> 县级(预加载)

// 省份adcode列表
const PROVINCE_ADCODES = [
  '110000', '120000', '130000', '140000', '150000',
  '210000', '220000', '230000', '310000', '320000',
  '330000', '340000', '350000', '360000', '370000',
  '410000', '420000', '430000', '440000', '450000',
  '460000', '500000', '510000', '520000', '530000',
  '540000', '610000', '620000', '630000', '640000',
  '650000', '710000', '810000', '820000',
];

// 特殊行政区划（无县级数据或数据不完整）
// 使用Set提高查询效率
const SKIP_COUNTY_ADCODES = new Set([
  // 新疆直辖市 (659xxx)
  '659001', '659002', '659003', '659004', '659005',
  '659006', '659007', '659008', '659009', '659010',
  '659011', '659012', '659013', '659014',
  // 海南省直辖县 (469xxx) - 全部跳过
  '469001', '469002', '469003', '469004', '469005',
  '469006', '469007', '469008', '469009', '469010',
  '469011', '469012', '469013', '469014', '469015',
  '469016', '469017', '469018', '469019', '469020',
  '469021', '469022', '469023', '469024', '469025',
  '469026', '469027', '469028', '469029', '469030',
  // 海南三沙市、儋州市等（无县级数据）
  '460400', '460300',
  // 河南省直辖县级市 (419xxx)
  '419001',
  // 湖北省直辖县级市 (429xxx)
  '429001', '429002', '429003', '429004', '429005',
  '429006', '429021',
  // 广东东莞、中山（地级市无县级区划）
  '441900', '442000',
  // 甘肃嘉峪关
  '620200',
]);

// 检查是否应该跳过该区域
function shouldSkipAdcode(adcode) {
  const code = String(adcode);
  // 检查Set
  if (SKIP_COUNTY_ADCODES.has(code)) return true;
  // 检查前缀
  if (code.startsWith('469') || code.startsWith('659')) return true;
  return false;
}

const GEO_BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound';

// 数据存储
const geoDataCache = {
  provinces: null,    // 省级GeoJSON合并数据
  cities: null,       // 市级GeoJSON合并数据
  counties: null,     // 县级GeoJSON合并数据
  provinceMap: {},    // 单个省数据缓存
  cityMap: {},        // 单个市数据缓存
};

// 加载状态
const loadStatus = {
  provinces: 'pending',
  cities: 'pending',
  counties: 'pending',
};

// 加载回调队列
const loadCallbacks = {
  provinces: [],
  cities: [],
  counties: [],
};

// 合并多个GeoJSON的features
function mergeGeoJSONFeatures(geoJSONList) {
  const allFeatures = [];

  geoJSONList.forEach((geoJSON) => {
    if (geoJSON && geoJSON.features) {
      geoJSON.features.forEach((feature) => {
        // 简化GeoJSON：减少属性，降低坐标精度
        const simplifiedFeature = {
          type: 'Feature',
          properties: {
            adcode: feature.properties.adcode,
            name: feature.properties.name,
            center: feature.properties.center,
            level: feature.properties.level,
            parent: feature.properties.parent,
          },
          geometry: simplifyGeometry(feature.geometry),
        };
        allFeatures.push(simplifiedFeature);
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features: allFeatures,
  };
}

// 简化几何坐标精度（保留4位小数）
function simplifyGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return geometry;

  const simplifyCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      // 单个坐标点
      return [
        Math.round(coords[0] * 10000) / 10000,
        Math.round(coords[1] * 10000) / 10000,
      ];
    }
    // 坐标数组，递归处理
    return coords.map(simplifyCoords);
  };

  return {
    type: geometry.type,
    coordinates: simplifyCoords(geometry.coordinates),
  };
}

// 加载单个GeoJSON（完全静默，不打印任何错误）
async function fetchSingleGeoJSON(adcode) {
  try {
    const url = `${GEO_BASE_URL}/${adcode}_full.json`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

// 加载省级数据（全国）
async function loadProvincesGeoJSON() {
  // 如果已经在加载或已加载，直接返回
  if (loadStatus.provinces === 'loaded') {
    return geoDataCache.provinces;
  }
  if (loadStatus.provinces === 'loading') {
    return waitForLoad('provinces');
  }

  loadStatus.provinces = 'loading';

  try {
    // 加载全国省级数据
    const chinaGeoJSON = await fetchSingleGeoJSON('100000');

    if (chinaGeoJSON && chinaGeoJSON.features) {
      // 只保留省级features（过滤掉国家级）
      const provinceFeatures = chinaGeoJSON.features.filter(
        (f) => f.properties.adcode !== '100000'
      );

      geoDataCache.provinces = {
        type: 'FeatureCollection',
        features: provinceFeatures.map((f) => ({
          type: 'Feature',
          properties: {
            adcode: f.properties.adcode,
            name: f.properties.name,
            center: f.properties.center,
            level: 'province', // 强制设置为province
          },
          geometry: simplifyGeometry(f.geometry),
        })),
      };

      loadStatus.provinces = 'loaded';
      notifyLoadComplete('provinces');
      return geoDataCache.provinces;
    } else {
      throw new Error('GeoJSON数据无效');
    }
  } catch (error) {
    console.error('加载省级数据失败:', error);
    loadStatus.provinces = 'error';
    notifyLoadComplete('provinces');
    return null;
  }
}

// 加载市级数据（全国所有市）
async function loadCitiesGeoJSON() {
  loadStatus.cities = 'loading';

  try {
    const geoJSONList = [];

    // 逐省加载市级数据
    for (const provinceAdcode of PROVINCE_ADCODES.slice(0, 34)) {
      // 排除台湾、香港、澳门（数据可能不完整）
      if (provinceAdcode === '710000' || provinceAdcode === '810000' || provinceAdcode === '820000') {
        continue;
      }

      const geoJSON = await fetchSingleGeoJSON(provinceAdcode);
      if (geoJSON) {
        geoDataCache.provinceMap[provinceAdcode] = geoJSON;

        // 提取市级features，强制设置level为city
        const cityFeatures = geoJSON.features?.filter(
          (f) => f.properties.level === 'city' ||
                 (f.properties.adcode !== provinceAdcode && f.properties.adcode !== '100000')
        ).map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            level: 'city', // 强制设置为city
          },
        })) || [];

        geoJSONList.push({ features: cityFeatures });
      }

      // 分批加载，避免请求过多
      if (geoJSONList.length % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    geoDataCache.cities = mergeGeoJSONFeatures(geoJSONList);
    loadStatus.cities = 'loaded';
    notifyLoadComplete('cities');
    return geoDataCache.cities;
  } catch (error) {
    console.error('加载市级数据失败:', error);
    loadStatus.cities = 'error';
  }

  return null;
}

// 加载县级数据（全国所有县）- 分批加载
async function loadCountiesGeoJSON(onProgress) {
  // 如果已经在加载或已加载，直接返回
  if (loadStatus.counties === 'loaded') {
    return geoDataCache.counties;
  }
  if (loadStatus.counties === 'loading') {
    return waitForLoad('counties');
  }

  loadStatus.counties = 'loading';

  try {
    const allFeatures = [];
    let loadedCount = 0;
    const totalCount = 350; // 约350个市需要加载县级数据

    // 需要先确保省级数据已加载，以获取市级adcode
    if (Object.keys(geoDataCache.provinceMap).length === 0) {
      // 先加载各省数据
      for (const provinceAdcode of PROVINCE_ADCODES) {
        if (['710000', '810000', '820000'].includes(provinceAdcode)) {
          continue;
        }
        const geoJSON = await fetchSingleGeoJSON(provinceAdcode);
        if (geoJSON) {
          geoDataCache.provinceMap[provinceAdcode] = geoJSON;
        }
      }
    }

    // 收集所有市级adcode（排除特殊区域）
    const cityAdcodes = [];
    let skippedCount = 0;

    Object.values(geoDataCache.provinceMap).forEach((provinceGeoJSON) => {
      if (!provinceGeoJSON?.features) return;

      provinceGeoJSON.features.forEach((f) => {
        const adcode = String(f.properties.adcode);
        const level = f.properties.level;

        // 使用统一的跳过检查函数
        if (shouldSkipAdcode(adcode)) {
          skippedCount++;
          return;
        }

        // 市级特征
        if (level === 'city') {
          cityAdcodes.push(adcode);
        }
      });
    });

    // 分批加载县级数据
    const batchSize = 10;
    for (let i = 0; i < cityAdcodes.length; i += batchSize) {
      const batch = cityAdcodes.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (cityAdcode) => {
          try {
            const geoJSON = await fetchSingleGeoJSON(cityAdcode);
            loadedCount++;

            if (onProgress) {
              onProgress(loadedCount, totalCount);
            }

            if (geoJSON && geoJSON.features) {
              // 提取县级features
              return geoJSON.features.filter((f) => {
                const level = f.properties.level;
                return level === 'district' || level === 'county';
              }).map((f) => ({
                type: 'Feature',
                properties: {
                  adcode: f.properties.adcode,
                  name: f.properties.name,
                  center: f.properties.center,
                  level: f.properties.level,
                  parent: f.properties.parent,
                },
                geometry: simplifyGeometry(f.geometry),
              }));
            }
            return [];
          } catch (err) {
            loadedCount++;
            if (onProgress) {
              onProgress(loadedCount, totalCount);
            }
            // 不打印警告，因为已经在黑名单中跳过了大部分
            return [];
          }
        })
      );

      batchResults.forEach((features) => {
        allFeatures.push(...features);
      });

      // 批次间隔
      if (i + batchSize < cityAdcodes.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    geoDataCache.counties = {
      type: 'FeatureCollection',
      features: allFeatures,
    };
    loadStatus.counties = 'loaded';
    notifyLoadComplete('counties');
    return geoDataCache.counties;
  } catch (error) {
    console.error('加载县级数据失败:', error);
    loadStatus.counties = 'error';
    notifyLoadComplete('counties');
  }

  return null;
}

// 通知加载完成
function notifyLoadComplete(level) {
  loadCallbacks[level].forEach((cb) => cb(geoDataCache[level]));
  loadCallbacks[level] = [];
}

// 等待数据加载完成
function waitForLoad(level) {
  // 支持单数和复数形式
  const levelMap = {
    'province': 'provinces',
    'city': 'cities',
    'county': 'counties',
    'provinces': 'provinces',
    'cities': 'cities',
    'counties': 'counties',
  };
  const key = levelMap[level] || level;

  return new Promise((resolve) => {
    if (loadStatus[key] === 'loaded') {
      resolve(geoDataCache[key]);
    } else if (loadStatus[key] === 'loading') {
      loadCallbacks[key].push(resolve);
    } else {
      // 未开始加载，触发加载
      if (key === 'provinces') {
        loadProvincesGeoJSON().then(resolve);
      } else if (key === 'cities') {
        loadCitiesGeoJSON().then(resolve);
      } else if (key === 'counties') {
        loadCountiesGeoJSON().then(resolve);
      }
    }
  });
}

// 获取指定层级的数据
function getGeoJSONByLevel(level) {
  // 支持单数和复数形式
  const levelMap = {
    'province': 'provinces',
    'city': 'cities',
    'county': 'counties',
    'provinces': 'provinces',
    'cities': 'cities',
    'counties': 'counties',
  };
  const key = levelMap[level] || level;
  return geoDataCache[key];
}

// 获取加载状态
function getLoadStatus() {
  return loadStatus;
}

// 初始化：立即加载省级数据
function initGeoDataService() {
  loadProvincesGeoJSON();
}

// 导出服务
export {
  initGeoDataService,
  loadProvincesGeoJSON,
  loadCitiesGeoJSON,
  loadCountiesGeoJSON,
  waitForLoad,
  getGeoJSONByLevel,
  getLoadStatus,
  geoDataCache,
};