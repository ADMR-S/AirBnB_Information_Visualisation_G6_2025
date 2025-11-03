/**
 * Creates a throttled function that only invokes the provided function at most once per specified time period
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  let lastResult: any;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
}

/**
 * Creates a throttled function using requestAnimationFrame for smooth animations
 * Better for visual updates like mouse movements
 * @param func The function to throttle
 * @param delay Minimum delay between calls in milliseconds (default: 0 = every frame ~16ms)
 * @returns Throttled function
 */
export function throttleRAF<T extends (...args: any[]) => void>(
  func: T,
  delay: number = 0
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number = 0;
  
  const scheduleExecution = function(this: any) {
    rafId = requestAnimationFrame(() => {
      const now = Date.now();
      
      if (lastArgs && (now - lastCallTime >= delay)) {
        func.apply(this, lastArgs);
        lastCallTime = now;
        lastArgs = null;
        rafId = null;
      } else if (lastArgs) {
        // Delay hasn't passed yet, reschedule for next frame
        scheduleExecution.call(this);
      } else {
        rafId = null;
      }
    });
  };
  
  return function(this: any, ...args: Parameters<T>) {
    lastArgs = args;
    
    if (rafId === null) {
      scheduleExecution.call(this);
    }
  };
}
