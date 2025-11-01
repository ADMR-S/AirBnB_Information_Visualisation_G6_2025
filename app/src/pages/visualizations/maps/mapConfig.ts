export const MAP_CONFIG = {
  DEBUG_LOG: true,
  defaultWidth: 960,
  defaultHeight: 600,
  projection: {
    scale: 1280,
    translate: [480, 300] as [number, number] // [width/2, height/2]
  },
  zoom: {
    scaleExtent: [1, 100] as [number, number],
    cityThreshold: 3,
    transitionDuration: 300,
    zoomFactor: 1.5
  },
  bubbles: {
    citySizeRange: [3, 25] as [number, number],
    neighborhoodSizeRange: [2, 20] as [number, number],
    fillOpacity: 0.6,
    strokeColor: '#fff',
    strokeWidth: 0.5
  },
  colors: {
    interpolateRange: [0.4, 1.0] as [number, number] // Range for d3.interpolateBlues
  },
  neighborhoodFields: {
    fillOpacity: 0.4,
    strokeWidth: 0.1,
    strokeOpacity: 0.3
  },
  fisheye: {
    baseRadius: 150, // Base radius at zoom level 1
    radiusScaleFactor: 0.5, // How much radius scales with zoom (radius = baseRadius / (zoom * factor))
    distortion: 2, // Magnification factor (higher = stronger distortion)
    listingBubbleRadius: 2, // Size of individual listing bubbles
    enabled: true
  }
};
