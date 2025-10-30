import * as d3 from 'd3';

const TOOLTIP_CLASS = 'viz-tooltip';

/**
 * Show a tooltip at the current mouse position
 */
export function showTooltip(
  event: MouseEvent,
  content: string,
  offset: { x?: number; y?: number } = {}
) {
  const { x = 10, y = -10 } = offset;
  
  // Remove any existing tooltips first
  hideTooltip();
  
  d3.select('body')
    .append('div')
    .attr('class', TOOLTIP_CLASS)
    .style('position', 'absolute')
    .style('background', 'rgba(0, 0, 0, 0.9)')
    .style('color', 'white')
    .style('padding', '12px')
    .style('border-radius', '6px')
    .style('pointer-events', 'none')
    .style('font-size', '13px')
    .style('z-index', '1000')
    .style('line-height', '1.6')
    .html(content)
    .style('left', `${event.pageX + x}px`)
    .style('top', `${event.pageY + y}px`);
}

/**
 * Hide the tooltip (remove it from DOM)
 */
export function hideTooltip() {
  d3.selectAll(`.${TOOLTIP_CLASS}`).remove();
}

/**
 * Update tooltip position
 * 
 * @param event - Mouse event (for new position)
 * @param offset - Optional offset from cursor {x, y}
 */
export function updateTooltipPosition(
  event: MouseEvent,
  offset: { x?: number; y?: number } = {}
) {
  const { x = 10, y = -10 } = offset;
  
  d3.select(`.${TOOLTIP_CLASS}`)
    .style('left', `${event.pageX + x}px`)
    .style('top', `${event.pageY + y}px`);
}

