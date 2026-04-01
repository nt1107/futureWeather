# React + Tailwind CSS 语义化编码规范（强制遵守）

## 核心原则（必须严格执行）

1. **禁止纯原子化堆砌**：className 禁止一长串无意义原子类（如 `p-6 bg-white rounded-lg ...`）
2. **必须语义化根类名**：每个组件根元素必须有 **xxx-root** 语义类名
   - 例：card-root、modal-root、sidebar-root、button-primary
3. **样式分离**：公共/静态样式必须用 **@apply** 提取到 `.module.css`
4. **少量原子类仅用于动态/微调**：仅响应式（sm:/md:）、状态（hover:）、条件渲染用原子类
5. **调试优先**：DOM 结构清晰，浏览器 Elements 面板可一眼识别组件来源
6. **可读性优先**：人类可快速阅读、定位、修改样式

---

## 正确示例

### Card 组件

```jsx
// Card/index.jsx
import styles from './index.module.css';

function Card({ title, children, variant = 'default' }) {
  return (
    <div className={`${styles['card-root']} ${styles[`card-${variant}`]}`}>
      <h2 className={styles['card-header']}>{title}</h2>
      <div className={styles['card-body']}>{children}</div>
    </div>
  );
}
```

```css
/* Card/index.module.css */
.card-root {
  @apply bg-white rounded-lg shadow-md overflow-hidden;
}

.card-default {
  @apply p-6;
}

.card-compact {
  @apply p-3;
}

.card-header {
  @apply text-xl font-bold text-gray-800 mb-4;
}

.card-body {
  @apply text-gray-600;
}

/* 动态状态 - 可以用原子类 */
.card-root:hover {
  @apply shadow-lg;
}
```

### Button 组件

```jsx
// Button/index.jsx
import styles from './index.module.css';

function Button({ children, variant = 'primary', size = 'md', disabled }) {
  return (
    <button
      className={`${styles['button-root']} ${styles[`button-${variant}`]} ${styles[`button-${size}`]}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

```css
/* Button/index.module.css */
.button-root {
  @apply inline-flex items-center justify-center rounded-md font-medium transition-colors;
}

.button-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.button-secondary {
  @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
}

.button-md {
  @apply px-4 py-2 text-sm;
}

.button-lg {
  @apply px-6 py-3 text-base;
}
```

---

## 错误示例（禁止使用）

### ❌ 纯原子化堆砌

```jsx
// 错误：一长串原子类，无法快速理解
<div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
  <h2 className="text-xl font-bold text-gray-800 mb-4">标题</h2>
  <p className="text-gray-600 text-sm leading-relaxed">内容</p>
</div>
```

### ❌ 无语义根类名

```jsx
// 错误：根元素没有语义类名
<div className={styles.wrapper}>
  {/* 难以在DOM中定位 */}
</div>
```

### ❌ 样式未分离

```jsx
// 错误：样式直接写在组件中
<div style={{ padding: '24px', backgroundColor: 'white' }}>
  {/* 无法复用，难以维护 */}
</div>
```

---

## 组件命名规范

| 组件类型 | 根类名格式 | 示例 |
|----------|-----------|------|
| 页面 | page-root | page-home-root |
| 布局 | layout-root | layout-sidebar-root |
| 卡片 | card-root | card-weather-root |
| 按钮 | button-root | button-primary |
| 表单 | form-root | form-search-root |
| 弹框 | modal-root | modal-tooltip-root |
| 导航 | nav-root | nav-breadcrumb-root |
| 图表 | chart-root | chart-map-root |

---

## 唯一允许使用原子类的场景

1. **响应式断点**：`sm:hidden md:block lg:flex`
2. **状态变化**：`hover:bg-blue-700 focus:ring-2`
3. **条件渲染**：`{isActive ? 'opacity-100' : 'opacity-50'}`
4. **动态数值**：`top-${dynamicValue}px`

---

## 检查清单

开发每个组件时，请确认：

- [ ] 根元素是否有语义类名（xxx-root）
- [ ] 静态样式是否已提取到 .module.css
- [ ] 是否避免了纯原子化堆砌
- [ ] 浏览器 Elements 面板能否快速定位组件
- [ ] 是否使用了驼峰命名或 BEM 命名