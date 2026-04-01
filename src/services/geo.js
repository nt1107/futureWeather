// GeoJSON 数据加载服务

const GEO_BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound';

// 行政区划层级
export const LEVEL = {
  PROVINCE: 'province', // 省级
  CITY: 'city', // 地级市
  COUNTY: 'county', // 区/县
};

// 获取GeoJSON数据
export async function fetchGeoJSON(adcode) {
  try {
    const url = `${GEO_BASE_URL}/${adcode}_full.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`加载GeoJSON失败: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取GeoJSON失败:', error);
    throw error;
  }
}

// 中国省级GeoJSON (adcode: 100000)
export async function fetchChinaGeoJSON() {
  return fetchGeoJSON('100000');
}

// 获取省/市级GeoJSON
export async function fetchProvinceGeoJSON(adcode) {
  return fetchGeoJSON(adcode);
}

// 获取区/县级GeoJSON
export async function fetchCountyGeoJSON(adcode) {
  return fetchGeoJSON(adcode);
}

// 注册地图到ECharts
export async function registerMap(echarts, name, adcode) {
  const geoJSON = await fetchGeoJSON(adcode);
  echarts.registerMap(name, geoJSON);
  return geoJSON;
}

// 从GeoJSON获取子区域列表
export function getChildAreas(geoJSON) {
  if (!geoJSON || !geoJSON.features) {
    return [];
  }

  return geoJSON.features.map((feature) => ({
    adcode: feature.properties.adcode,
    name: feature.properties.name,
    level: feature.properties.level,
    parent: feature.properties.parent?.adcode,
  }));
}