// 和风天气 API 服务

const API_BASE_URL = 'https://devapi.qweather.com/v7';

// API Key
const API_KEY = import.meta.env.VITE_QWEATHER_KEY || '';

// 天气图标映射
const WEATHER_ICONS = {
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

// 省级adcode到locationId映射
const PROVINCE_LOCATION_MAP = {
  '110000': '101010100', // 北京
  '120000': '101020100', // 天津
  '130000': '101090101', // 河北 - 石家庄
  '140000': '101100101', // 山西 - 太原
  '150000': '101080101', // 内蒙古 - 呼和浩特
  '210000': '101070101', // 辽宁 - 沈阳
  '220000': '101060101', // 吉林 - 长春
  '230000': '101050101', // 黑龙江 - 哈尔滨
  '310000': '101020300', // 上海
  '320000': '101190101', // 江苏 - 南京
  '330000': '101210101', // 浙江 - 杭州
  '340000': '101220101', // 安徽 - 合肥
  '350000': '101230101', // 福建 - 福州
  '360000': '101240101', // 江西 - 南昌
  '370000': '101120101', // 山东 - 济南
  '410000': '101180101', // 河南 - 郑州
  '420000': '101200101', // 湖北 - 武汉
  '430000': '101250101', // 湖南 - 长沙
  '440000': '101280101', // 广东 - 广州
  '450000': '101300101', // 广西 - 南宁
  '460000': '101310101', // 海南 - 海口
  '500000': '101040100', // 重庆
  '510000': '101270101', // 四川 - 成都
  '520000': '101260101', // 贵州 - 贵阳
  '530000': '101290101', // 云南 - 昆明
  '540000': '101320101', // 西藏 - 拉萨
  '610000': '101110101', // 陕西 - 西安
  '620000': '101160101', // 甘肃 - 兰州
  '630000': '101150101', // 青海 - 西宁
  '640000': '101170101', // 宁夏 - 银川
  '650000': '101130101', // 新疆 - 乌鲁木齐
  '710000': '101340101', // 台湾 - 台北
  '810000': '101330101', // 香港
  '820000': '101330201', // 澳门
};

// 获取天气图标
export function getWeatherIcon(text) {
  return WEATHER_ICONS[text] || '🌤';
}

// 根据温度获取颜色
export function getTemperatureColor(temp) {
  if (temp >= 35) return '#ef4444';
  if (temp >= 30) return '#f97316';
  if (temp >= 20) return '#eab308';
  if (temp >= 10) return '#22c55e';
  if (temp >= 0) return '#3b82f6';
  return '#6366f1';
}

// 获取15天天气预报（通过locationId或经纬度）
export async function fetch15DaysWeather(location) {
  if (!API_KEY) {
    return generateMockWeatherData(location);
  }

  try {
    const url = `${API_BASE_URL}/weather/15d?location=${location}&key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== '200') {
      throw new Error(`API错误: ${data.code}`);
    }

    return data.daily;
  } catch (error) {
    console.warn('获取天气失败，使用模拟数据:', error.message);
    return generateMockWeatherData(location);
  }
}

// 批量获取天气数据（用于地图显示）
export async function fetchBatchWeatherForMap(features, targetDate) {
  const results = {};
  const targetDateStr = targetDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];

  // 省级：使用真实API（数量少，约34个）
  // 市级和县级：使用模拟数据（数量太多，API可能不够）
  const isProvinceLevel = features.length <= 50;

  if (isProvinceLevel && API_KEY) {
    // 批量获取省级天气
    const batchSize = 5;
    const batches = [];

    for (let i = 0; i < features.length; i += batchSize) {
      batches.push(features.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(async (feature) => {
        const adcode = feature.properties.adcode;
        const locationId = PROVINCE_LOCATION_MAP[adcode];

        if (locationId) {
          try {
            const weather = await fetch15DaysWeather(locationId);
            return { adcode, weather };
          } catch (e) {
            return { adcode, weather: generateMockWeatherData(adcode) };
          }
        } else {
          // 没有映射，使用模拟数据
          return { adcode, weather: generateMockWeatherData(adcode) };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ adcode, weather }) => {
        results[adcode] = weather;
      });

      // 批次间隔，避免API限流
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  } else {
    // 市级/县级：生成模拟数据
    features.forEach(feature => {
      const adcode = feature.properties.adcode;
      results[adcode] = generateMockWeatherData(adcode);
    });
  }

  return results;
}

// 获取指定日期的天气摘要
export function getWeatherSummary(weatherData, targetDate) {
  if (!weatherData || !weatherData.length) return null;

  const targetDateStr = targetDate.toISOString().split('T')[0];
  const dayData = weatherData.find(d => d.fxDate === targetDateStr);

  if (!dayData) return null;

  return {
    text: dayData.textDay,
    icon: getWeatherIcon(dayData.textDay),
    tempMax: parseInt(dayData.tempMax),
    tempMin: parseInt(dayData.tempMin),
    tempRange: `${dayData.tempMin}~${dayData.tempMax}°`,
  };
}

// 生成模拟天气数据
function generateMockWeatherData(seed) {
  const today = new Date();
  const daily = [];
  const seedNum = typeof seed === 'string' ? parseInt(seed.slice(-3)) || 0 : 0;

  for (let i = 0; i < 15; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    // 使用seed生成不同的模拟数据
    const baseTemp = 15 + Math.sin(i * 0.5 + seedNum * 0.1) * 10;
    const tempMax = Math.round(baseTemp + 5 + Math.sin(seedNum) * 3);
    const tempMin = Math.round(baseTemp - 5 + Math.cos(seedNum) * 3);

    const weatherTypes = ['晴', '多云', '阴', '小雨', '中雨'];
    const weatherIndex = Math.floor((i + seedNum) % weatherTypes.length);

    daily.push({
      fxDate: date.toISOString().split('T')[0],
      tempMax: String(tempMax),
      tempMin: String(tempMin),
      textDay: weatherTypes[weatherIndex],
      textNight: weatherTypes[Math.max(0, weatherIndex - 1)],
      windDirDay: ['东', '南', '西', '北'][Math.floor((seedNum + i) % 4)],
      windScaleDay: `${Math.floor(Math.random() * 3) + 1}-${Math.floor(Math.random() * 2) + 2}`,
      humidity: String(Math.floor(Math.random() * 30) + 40 + seedNum % 20),
    });
  }

  return daily;
}

// 导出省级映射供其他模块使用
export { PROVINCE_LOCATION_MAP };