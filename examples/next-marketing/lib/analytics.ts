export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  console.log('[track]', event, properties);
}
