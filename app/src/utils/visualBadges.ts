export interface BadgeConfig {
  icon: string;
  label: string;
  color: string;
  threshold: number;
  metric: (d: any) => number;
}

export const EXAMPLE_BADGES = {
  highPrice: {
    icon: '💰',
    label: 'Premium',
    color: '#ef4444',
    threshold: 300,
    metric: (d: any) => d.avgPrice || d.price || 0,
  },
  lowPrice: {
    icon: '💵',
    label: 'Budget',
    color: '#10b981',
    threshold: 50,
    metric: (d: any) => {
      const price = d.avgPrice || d.price || 999;
      return price <= 50 ? 1 : 0;
    },
  },
  popular: {
    icon: '⭐',
    label: 'Popular',
    color: '#f59e0b',
    threshold: 50,
    metric: (d: any) => d.totalReviews || d.avgReviews || d.number_of_reviews || 0,
  },
  highlyRated: {
    icon: '🌟',
    label: 'Top Rated',
    color: '#f59e0b',
    threshold: 100,
    metric: (d: any) => d.totalReviews || d.avgReviews || d.number_of_reviews || 0,
  },
  highAvailability: {
    icon: '✓',
    label: 'Available',
    color: '#10b981',
    threshold: 200,
    metric: (d: any) => d.avgAvailability || d.availability_365 || 0,
  },
  active: {
    icon: '🔥',
    label: 'Active',
    color: '#f97316',
    threshold: 2,
    metric: (d: any) => d.reviews_per_month || d.reviewsPerMonth || 0,
  },
} as const;

export function getApplicableBadges(data: any, badges: readonly BadgeConfig[]): BadgeConfig[] {
  return badges.filter(badge => badge.metric(data) >= badge.threshold);
}
