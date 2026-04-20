/**
 * 视口裁剪工具函数
 * 用于计算当前视口的地理坐标范围，过滤可见区域
 */

// 获取当前视口的地理坐标边界
export function getViewportBounds(chart) {
  if (!chart) return null;

  try {
    const width = chart.getWidth();
    const height = chart.getHeight();

    // 获取视口四个角的像素坐标
    const corners = [
      [0, 0],           // 左上
      [width, 0],       // 右上
      [width, height],  // 右下
      [0, height],      // 左下
    ];

    // 将像素坐标转为地理坐标
    const geoCorners = corners.map(([x, y]) => {
      try {
        return chart.convertFromPixel({ seriesIndex: 0 }, [x, y]);
      } catch (e) {
        return null;
      }
    }).filter(c => c !== null);

    if (geoCorners.length < 4) return null;

    // 计算地理边界 [minLng, minLat, maxLng, maxLat]
    const lngs = geoCorners.map(c => c[0]);
    const lats = geoCorners.map(c => c[1]);

    return {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      width: width,
      height: height,
    };
  } catch (e) {
    return null;
  }
}

// 检查区域是否在视口范围内
export function isInViewport(feature, bounds, margin = 0.1) {
  if (!bounds || !feature) return true;

  const center = feature.properties?.center;
  if (!center) return true; // 无中心点数据时默认显示

  // 扩展视口边界（margin为扩展比例）
  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;
  const expandedMinLng = bounds.minLng - lngRange * margin;
  const expandedMaxLng = bounds.maxLng + lngRange * margin;
  const expandedMinLat = bounds.minLat - latRange * margin;
  const expandedMaxLat = bounds.maxLat + latRange * margin;

  const lng = center[0];
  const lat = center[1];

  return lng >= expandedMinLng && lng <= expandedMaxLng &&
         lat >= expandedMinLat && lat <= expandedMaxLat;
}

// 过滤GeoJSON只保留视口可见区域
export function filterGeoJSONByViewport(geoJSON, bounds, margin = 0.1) {
  if (!geoJSON || !geoJSON.features) return geoJSON;

  const visibleFeatures = geoJSON.features.filter(feature =>
    isInViewport(feature, bounds, margin)
  );

  return {
    type: 'FeatureCollection',
    features: visibleFeatures,
  };
}

// 计算视口内区域数量
export function countVisibleFeatures(geoJSON, bounds) {
  if (!geoJSON || !geoJSON.features) return 0;

  return geoJSON.features.filter(feature =>
    isInViewport(feature, bounds, 0)
  ).length;
}

// 节流函数
export function throttle(fn, delay) {
  let lastCall = 0;
  let pendingCall = null;

  return function(...args) {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else {
      // 记录待执行的调用
      pendingCall = { args, fn, this: this };
    }
  };
}

// 带尾调用的节流函数（确保最后一次调用会被执行）
export function throttleWithTail(fn, delay) {
  let lastCall = 0;
  let timeoutId = null;

  return function(...args) {
    const now = Date.now();

    // 清除之前的尾调用
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else {
      // 设置尾调用，确保最后一次调用被执行
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn.apply(this, args);
        timeoutId = null;
      }, delay - (now - lastCall));
    }
  };
}