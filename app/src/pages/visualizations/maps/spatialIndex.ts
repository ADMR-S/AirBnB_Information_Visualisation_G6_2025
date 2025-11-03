import { quadtree } from 'd3-quadtree';
import type { Quadtree } from 'd3-quadtree';
import type { AirbnbListing } from '../../../types/airbnb.types';
import type * as d3 from 'd3';

export interface ProjectedListing {
  listing: AirbnbListing;
  x: number;
  y: number;
}

/**
 * Builds a spatial quadtree index for fast nearest-neighbor and radius queries
 * @param listings Array of Airbnb listings
 * @param projection D3 geo projection to convert lat/lng to x/y
 * @returns Quadtree index of projected listings
 */
export function buildListingSpatialIndex(
  listings: AirbnbListing[],
  projection: d3.GeoProjection
): Quadtree<ProjectedListing> {
  // Project all listings to screen coordinates
  const projectedListings: ProjectedListing[] = [];
  
  for (const listing of listings) {
    const projected = projection([listing.longitude, listing.latitude]);
    if (projected) {
      projectedListings.push({
        listing,
        x: projected[0],
        y: projected[1]
      });
    }
  }
  
  // Build quadtree with x/y accessors
  return quadtree<ProjectedListing>()
    .x(d => d.x)
    .y(d => d.y)
    .addAll(projectedListings);
}

/**
 * Finds all listings within a circular radius using the quadtree
 * @param tree Quadtree spatial index
 * @param center Center point [x, y]
 * @param radius Search radius
 * @returns Array of projected listings within the radius
 */
export function findListingsInRadius(
  tree: Quadtree<ProjectedListing>,
  center: [number, number],
  radius: number
): ProjectedListing[] {
  const results: ProjectedListing[] = [];
  const radiusSquared = radius * radius;
  
  // Use quadtree.visit() to efficiently traverse only relevant nodes
  tree.visit((node, x1, y1, x2, y2) => {
    // Check if this node (and its children) could possibly contain points in the circle
    // If the node's bounding box doesn't intersect the search circle, prune it
    const nodeIntersectsCircle = (
      x1 <= center[0] + radius &&
      x2 >= center[0] - radius &&
      y1 <= center[1] + radius &&
      y2 >= center[1] - radius
    );
    
    if (!nodeIntersectsCircle) {
      return true; // Prune this branch
    }
    
    // If this is a leaf node, check all points
    if (!node.length) {
      // D3 quadtree leaf nodes store data directly
      // In v7, leaf nodes have a 'data' property
      const data = node.data;
      if (data) {
        const dx = data.x - center[0];
        const dy = data.y - center[1];
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared <= radiusSquared) {
          results.push(data);
        }
      }
    }
    
    return false; // Continue visiting children
  });
  
  return results;
}

/**
 * Finds the nearest listing to a given point
 * @param tree Quadtree spatial index
 * @param point Point [x, y] to search from
 * @param maxDistance Maximum search distance (optional)
 * @returns Nearest projected listing or null if none found
 */
export function findNearestListing(
  tree: Quadtree<ProjectedListing>,
  point: [number, number],
  maxDistance: number = Infinity
): ProjectedListing | null {
  let closest: ProjectedListing | null = null;
  let closestDistance = maxDistance * maxDistance; // Use squared distance for performance
  
  tree.visit((node, x1, y1, x2, y2) => {
    // Calculate minimum possible distance to this node's bounding box
    const dx = Math.max(x1 - point[0], 0, point[0] - x2);
    const dy = Math.max(y1 - point[1], 0, point[1] - y2);
    const minDistanceSquared = dx * dx + dy * dy;
    
    // Prune if this node can't possibly contain a closer point
    if (minDistanceSquared > closestDistance) {
      return true;
    }
    
    // Check points in leaf nodes
    if (!node.length) {
      const data = node.data;
      if (data) {
        const dx = data.x - point[0];
        const dy = data.y - point[1];
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared < closestDistance) {
          closestDistance = distanceSquared;
          closest = data;
        }
      }
    }
    
    return false;
  });
  
  return closest;
}
