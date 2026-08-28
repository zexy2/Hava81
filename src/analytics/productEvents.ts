export type ProductEventName =
  | 'daily_plan_viewed'
  | 'activity_preference_changed'
  | 'temperature_sensitivity_changed'
  | 'activity_window_changed'
  | 'activity_window_cleared'
  | 'commute_schedule_changed'
  | 'commute_schedule_cleared'
  | 'commute_plan_viewed'
  | 'compare_opened'
  | 'share_created'
  | 'alert_opt_in'
  | 'route_checked';

export interface ProductEventDetail {
  name: ProductEventName;
  properties?: Record<string, unknown>;
  at: string;
}

export const trackProductEvent = (name: ProductEventName, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  const detail: ProductEventDetail = { name, properties, at: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent<ProductEventDetail>('hava81:product-event', { detail }));
};
