/** Interactive controls whose hit areas must remain usable on small screens.
 * Include button-like links and navigation links, but exclude ordinary inline
 * attribution/source links so the audit measures actions rather than prose.
 */
export const LIVE_AUDIT_INTERACTIVE_TARGET_SELECTORS = Object.freeze([
  'button',
  '[role="button"]',
  'input',
  'select',
  '[role="tab"]',
  'a.atlas-button',
  'a.atlas-brand',
  'a.decision-glance__details',
  'nav a[href]',
]);

export const LIVE_AUDIT_INTERACTIVE_TARGET_SELECTOR =
  LIVE_AUDIT_INTERACTIVE_TARGET_SELECTORS.join(',');
