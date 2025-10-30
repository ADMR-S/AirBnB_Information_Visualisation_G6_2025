import * as d3 from 'd3';

export interface ColorBreak {
  min: number;
  max: number;
  color: string;
  label: string;
}

export const COLOR_PALETTES = {
  greenToRed: { start: '#22c55e', end: '#ef4444' },
  redToGreen: { start: '#ef4444', end: '#22c55e' },
  blueToRed: { start: '#3b82f6', end: '#ef4444' },
  purpleToOrange: { start: '#8b5cf6', end: '#f97316' },
} as const;

export function sampleColors(numColors: number, startColor: string, endColor: string): string[] {
  if (numColors <= 0) return [];
  if (numColors === 1) return [startColor];
  
  const interpolator = d3.interpolateRgb(startColor, endColor);
  const colors: string[] = [];
  
  for (let i = 0; i < numColors; i++) {
    colors.push(d3.rgb(interpolator(i / (numColors - 1))).formatHex());
  }
  
  return colors;
}

export function createColorBreaks(breaks: number[], labels: string[], colors: string[]): ColorBreak[] {
  const colorBreaks: ColorBreak[] = [];
  
  for (let i = 0; i < breaks.length - 1; i++) {
    colorBreaks.push({
      min: breaks[i],
      max: breaks[i + 1],
      color: colors[Math.min(i, colors.length - 1)],
      label: labels[Math.min(i, labels.length - 1)],
    });
  }
  
  return colorBreaks;
}

export function getColorForValue(value: number, colorBreaks: ColorBreak[], defaultColor: string = '#999'): string {
  if (colorBreaks.length === 0) return defaultColor;
  
  for (const colorBreak of colorBreaks) {
    if (value >= colorBreak.min && value < colorBreak.max) {
      return colorBreak.color;
    }
  }
  
  const lastBreak = colorBreaks[colorBreaks.length - 1];
  return value >= lastBreak.min ? lastBreak.color : defaultColor;
}
