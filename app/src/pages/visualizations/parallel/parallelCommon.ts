// Utilities shared by parallel coordinate views
import * as d3 from 'd3';

export function setupCanvas(canvasEl: HTMLCanvasElement, totalWidth: number, totalHeight: number) {
  const ratio = window.devicePixelRatio || 1;
  canvasEl.width = Math.round(totalWidth * ratio);
  canvasEl.height = Math.round(totalHeight * ratio);
  canvasEl.style.width = `${totalWidth}px`;
  canvasEl.style.height = `${totalHeight}px`;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return { ctx: null as CanvasRenderingContext2D | null, ratio };
  ctx.save();
  ctx.scale(ratio, ratio);
  return { ctx, ratio };
}

export function clearBackingStore(ctx: CanvasRenderingContext2D | null, canvasEl: HTMLCanvasElement | null) {
  if (!ctx || !canvasEl) return;
  ctx.save();
  // reset transform so we clear the full backing store (pixel buffer)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.restore();
}

export function computeTicks(domain0: number, domain1: number, count = 5) {
  return d3.ticks(domain0, domain1, count);
}
