// 和风天气 API 服务

const API_BASE_URL = 'https://devapi.qweather.com/v7';

// API Key 需要在环境变量中配置
const API_KEY = import.meta.env.VITE_QWEATHER_KEY || '';

// 城市代码映射 (主要省会城市)
export const CITY_ADCODE_MAP = {
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

// 获取15天天气预报
export async function fetch15DaysWeather(locationId) {
  if (!API_KEY) {
    console.warn('天气API Key未配置，使用模拟数据');
    return generateMockWeatherData(locationId);
  }

  try {
    const url = `${API_BASE_URL}/weather/15d?location=${locationId}&key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`天气API请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== '200') {
      throw new Error(`天气API返回错误: ${data.code}`);
    }

    return data.daily;
  } catch (error) {
    console.error('获取天气数据失败:', error);
    return generateMockWeatherData(locationId);
  }
}

// 根据adcode获取天气
export async function fetchWeatherByAdcode(adcode) {
  const locationId = CITY_ADCODE_MAP[adcode] || adcode;
  return fetch15DaysWeather(locationId);
}

// 批量获取多个城市的天气数据
export async function fetchBatchWeather(adcodes) {
  const results = {};

  for (const adcode of adcodes) {
    try {
      results[adcode] = await fetchWeatherByAdcode(adcode);
    } catch (error) {
      console.error(`获取 ${adcode} 天气失败:`, error);
      results[adcode] = null;
    }
  }

  return results;
}

// 生成模拟天气数据 (用于开发测试)
function generateMockWeatherData(locationId) {
  const today = new Date();
  const daily = [];

  for (let i = 0; i < 15; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    // 模拟温度变化
    const baseTemp = 15 + Math.sin(i * 0.5) * 10;
    const tempMax = Math.round(baseTemp + 5 + Math.random() * 3);
    const tempMin = Math.round(baseTemp - 5 + Math.random() * 3);

    // 模拟天气类型
    const weatherTypes = ['晴', '多云', '阴', '小雨', '中雨', '雷阵雨'];
    const weatherIndex = Math.floor(Math.random() * weatherTypes.length);

    daily.push({
      fxDate: date.toISOString().split('T')[0],
      tempMax: String(tempMax),
      tempMin: String(tempMin),
      textDay: weatherTypes[weatherIndex],
      textNight: weatherTypes[Math.max(0, weatherIndex - 1)],
      windDirDay: ['东', '南', '西', '北'][Math.floor(Math.random() * 4)],
      windScaleDay: `${Math.floor(Math.random() * 3) + 1}-${Math.floor(Math.random() * 2) + 2}`,
      humidity: String(Math.floor(Math.random() * 30) + 40),
    });
  }

  return daily;
}

// 根据温度获取颜色
export function getTemperatureColor(temp) {
  if (temp >= 35) return '#ef4444'; // 高温
  if (temp >= 30) return '#f97316'; // 炎热
  if (temp >= 20) return '#eab308'; // 温暖
  if (temp >= 10) return '#22c55e'; // 凉爽
  if (temp >= 0) return '#3b82f6'; // 寒冷
  return '#6366f1'; // 极寒
}

// 解析天气数据为可视化格式
export function parseWeatherForVisualization(weatherData, selectedDate) {
  if (!weatherData || !weatherData.length) return null;

  const targetDate = selectedDate.toISOString().split('T')[0];
  const dayData = weatherData.find((d) => d.fxDate === targetDate);

  if (!dayData) return null;

  return {
    tempMax: parseInt(dayData.tempMax),
    tempMin: parseInt(dayData.tempMin),
    textDay: dayData.textDay,
    humidity: parseInt(dayData.humidity),
    color: getTemperatureColor(parseInt(dayData.tempMax)),
  };
}