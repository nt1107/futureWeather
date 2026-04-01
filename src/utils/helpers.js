// 工具函数

// 格式化日期
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取未来N天的日期范围
export function getDateRange(days = 15) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days - 1);

  return {
    minDate: today,
    maxDate: endDate,
  };
}

// 生成日期列表
export function generateDateList(days = 15) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  return dates;
}

// 防抖函数
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 获取显示文本
export function getDateDisplayText(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === 2) return '后天';

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}