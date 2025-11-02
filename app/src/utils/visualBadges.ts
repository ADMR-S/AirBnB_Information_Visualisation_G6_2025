export interface BadgeConfig {
  icon: string;
  label: string;
  metric: (d: any) => number;
  defaultThreshold: number;
  percentile?: number; // If set, use percentile-based threshold instead
}

export const EXAMPLE_BADGES = {
  highPrice: {
    icon: '💰',
    label: 'Premium',
    metric: (d: any) => d.avgPrice || d.price || 0,
    defaultThreshold: 300,
    percentile: 75, // Top 25% in current view
  },
  popular: {
    icon: '⭐',
    label: 'Popular',
    metric: (d: any) => d.totalReviews || d.avgReviews || d.number_of_reviews || 0,
    defaultThreshold: 50,
    percentile: 75, // Top 25% in current view
  },
  highAvailability: {
    icon: '✓',
    label: 'Available',
    metric: (d: any) => d.avgAvailability || d.availability_365 || 0,
    defaultThreshold: 200,
    percentile: 75, // Top 25% in current view
  },
} as const;

/**
 * Calculate percentile-based thresholds for badges based on current data
 * @param nodes - Array of nodes to calculate thresholds from
 * @param badges - Badge configurations
 * @returns Map of badge to calculated threshold
 */
export function calculateBadgeThresholds(
  nodes: any[], 
  badges: readonly BadgeConfig[]
): Map<BadgeConfig, number> {
  const thresholds = new Map<BadgeConfig, number>();
  
  badges.forEach(badge => {
    if (badge.percentile !== undefined) {
      // Calculate percentile-based threshold from current nodes
      const values = nodes
        .map(n => badge.metric(n))
        .filter(v => v > 0)
        .sort((a, b) => a - b);
      
      if (values.length > 0) {
        const index = Math.floor((badge.percentile / 100) * values.length);
        thresholds.set(badge, values[index] || badge.defaultThreshold);
      } else {
        thresholds.set(badge, badge.defaultThreshold);
      }
    } else {
      // Use default threshold
      thresholds.set(badge, badge.defaultThreshold);
    }
  });
  
  return thresholds;
}

export function getApplicableBadges(
  data: any, 
  badges: readonly BadgeConfig[],
  thresholds?: Map<BadgeConfig, number>
): BadgeConfig[] {
  return badges.filter(badge => {
    const threshold = thresholds?.get(badge) ?? badge.defaultThreshold;
    return badge.metric(data) >= threshold;
  });
}
