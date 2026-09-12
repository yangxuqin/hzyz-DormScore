// 图表主题：从 CSS 变量读取 MD3 令牌，主题切换时同步
import type { EChartsOption } from 'echarts';

export function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export interface ChartTheme {
  palette: string[];
  text: string;
  axis: string;
  split: string;
  surface: string;
  border: string;
  onSurface: string;
}

export function readChartTheme(): ChartTheme {
  return {
    palette: Array.from({ length: 7 }, (_, i) => cssVar(`--chart-${i + 1}`, '#2f6d55')),
    text: cssVar('--chart-text', '#3f4942'),
    axis: cssVar('--chart-axis', '#bfc9c1'),
    split: cssVar('--chart-split', '#e4ebe5'),
    surface: cssVar('--md-surface-container-lowest', '#ffffff'),
    border: cssVar('--md-outline-variant', '#bfc9c1'),
    onSurface: cssVar('--md-on-surface', '#161d18'),
  };
}

/** 主题化 tooltip / 文本默认项，供各图表合并 */
export function themedDefaults(): EChartsOption {
  const t = readChartTheme();
  return {
    color: t.palette,
    textStyle: { color: t.text },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.onSurface, fontSize: 12 },
      extraCssText: 'box-shadow: var(--elev-2); border-radius: 12px; padding: 10px 12px;',
    },
  };
}

/** 按得分档位取色（日历 / 分数相关图表） */
export function scoreColor(score: number | null): string {
  if (score === null) return cssVar('--score-none', '#dee5df');
  if (score >= 20) return cssVar('--score-excellent', '#2f8f5b');
  if (score >= 15) return cssVar('--score-good', '#6bbf7f');
  if (score >= 10) return cssVar('--score-fair', '#d9b64a');
  if (score >= 5) return cssVar('--score-poor', '#e08a4b');
  return cssVar('--score-critical', '#c65f52');
}
