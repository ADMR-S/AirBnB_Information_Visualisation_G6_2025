import * as d3 from 'd3';

export function calculateNaturalBreaks(data: number[], numClasses: number = 6): number[] {
  if (data.length === 0) return [];
  if (data.length === 1) return [data[0], data[0]];
  
  const sortedData = [...data].sort((a, b) => a - b);
  const breaks: number[] = [sortedData[0]];
  
  for (let i = 1; i < numClasses; i++) {
    const value = d3.quantile(sortedData, i / numClasses);
    if (value !== undefined) breaks.push(Math.round(value));
  }
  
  breaks.push(sortedData[sortedData.length - 1]);
  return [...new Set(breaks)].sort((a, b) => a - b);
}

export function formatNumber(value: number, decimals: number = 0): string {
  if (value >= 10000) return `${(value / 1000).toFixed(decimals)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(decimals);
}

export function createLabels(breaks: number[], prefix: string = '', suffix: string = ''): string[] {
  const labels: string[] = [];
  
  for (let i = 0; i < breaks.length - 1; i++) {
    const min = breaks[i];
    const max = breaks[i + 1];
    const isLast = i === breaks.length - 2;
    
    const label = isLast && max >= 10000
      ? `${prefix}${formatNumber(min)}${suffix}+`
      : `${prefix}${formatNumber(min)}-${formatNumber(max)}${suffix}`;
    
    labels.push(label);
  }
  
  return labels;
}
