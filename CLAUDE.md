# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-screen weather visualization map application built with React + Vite + ECharts + Tailwind CSS. Features:
- Interactive China map with zoom-based level switching (province → city → county)
- 15-day weather forecast display with hover tooltips
- Temperature-based region coloring

## Commands

```bash
npm run dev      # Start dev server (default port 5173)
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Environment Setup

Create `.env` file with:
```
VITE_QWEATHER_KEY=your_qweather_api_key
```

Without API key, the app uses mock weather data automatically.

## Architecture

### Map Rendering (MapChart component)
- Uses ECharts map series with GeoJSON data from Aliyun DataV API
- **Zoom-based level switching**: province (zoom < 8) → city (8-12) → county (> 12)
- **Parent border rendering**: Uses ECharts graphic component to draw parent-level borders as SVG polylines on top of map, with `silent: true` to avoid intercepting mouse events
- All GeoJSON data is preloaded on init via `geoDataService.js`

### GeoJSON Data Loading (geoDataService.js)
- Province data loaded first (immediate)
- City and county data preloaded in background
- Special administrative areas (469xxx Hainan, 659xxx Xinjiang) skipped due to missing county data

### Weather Data (weather.js + useWeather.js)
- QWeather API for 15-day forecasts
- Automatic fallback to mock data if API key missing
- City adcode to location ID mapping provided

## Coding Standards

**Tailwind CSS Semantic Naming (mandatory)**:
- Every component root element must have `xxx-root` semantic class name
- Use `@apply` in `.module.css` files for static styles
- No inline atomic class chains (e.g., avoid `className="p-6 bg-white rounded-lg..."`)
- Only use atomic classes for responsive/state/conditional cases

Example:
```css
/* Card/index.module.css */
.card-root {
  @apply bg-white rounded-lg shadow-md;
}
```

```jsx
// Card/index.jsx
<div className={styles['card-root']}>...</div>
```

## Key Files

- `src/components/MapChart/index.jsx` - Core map rendering with zoom level handling
- `src/services/geoDataService.js` - GeoJSON loading and caching
- `src/services/weather.js` - Weather API integration
- `src/hooks/useWeather.js` - Weather state management