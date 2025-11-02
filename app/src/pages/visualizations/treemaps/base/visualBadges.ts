export interface BadgeConfig {
  icon: string;
  label: string;
  metric: (d: any) => number;
  defaultThreshold: number;
  minThreshold?: number; // Minimum value for slider
  maxThreshold?: number; // Maximum value for slider
  unit?: string; // Display unit (e.g., 'd' for days, '$' for dollars)
}

export const EXAMPLE_BADGES = {
  highPrice: {
    icon: '💰',
    label: 'Premium',
    metric: (d: any) => d.avgPrice || d.price || 0,
    defaultThreshold: 200,
    minThreshold: 50,
    maxThreshold: 1000,
    unit: '$',
  },
  popular: {
    icon: '⭐',
    label: 'Popular',
    metric: (d: any) => d.totalReviews || d.avgReviews || d.number_of_reviews || 0,
    defaultThreshold: 100,
    minThreshold: 10,
    maxThreshold: 500,
    unit: '',
  },
  highActivity: {
    icon: '🔥',
    label: 'High Activity',
    metric: (d: any) => d.avgReviewsPerMonth || d.reviews_per_month || 0,
    defaultThreshold: 20,
    minThreshold: 0.5,
    maxThreshold: 50,
    unit: '/mo',
  },
} as const;

export function calculatePercentileFromThreshold(
  listings: any[],
  badge: BadgeConfig,
  threshold: number
): number {
  const values = listings
    .map(listing => badge.metric(listing))
    .filter(v => v > 0)
    .sort((a, b) => a - b);

  if (values.length === 0) return 0;

  // Count how many values are below threshold
  const countBelow = values.filter(v => v < threshold).length;
  const percentile = (countBelow / values.length) * 100;
  
  return Math.round(percentile);
}

export function calculateConcentration(
  nodeListings: any[],
  badge: BadgeConfig,
  threshold: number
): number {
  if (nodeListings.length === 0) return 0;
  
  const meetingThreshold = nodeListings.filter(
    listing => badge.metric(listing) >= threshold
  ).length;
  
  return (meetingThreshold / nodeListings.length) * 100;
}

export function getApplicableBadgesByConcentration(
  nodeListings: any[],
  badges: readonly BadgeConfig[],
  thresholds: Map<BadgeConfig, number>,
  minConcentrations: Map<BadgeConfig, number>
): BadgeConfig[] {
  return badges.filter(badge => {
    const threshold = thresholds.get(badge) ?? badge.defaultThreshold;
    
    // For High Activity badge, just check if ANY listings meet the threshold
    if (badge.label === 'High Activity') {
      const concentration = calculateConcentration(nodeListings, badge, threshold);
      return concentration > 0;
    }
    
    // For other badges, use the concentration check
    const minConcentration = minConcentrations.get(badge) ?? 15;
    const concentration = calculateConcentration(nodeListings, badge, threshold);
    return concentration >= minConcentration;
  });
}
