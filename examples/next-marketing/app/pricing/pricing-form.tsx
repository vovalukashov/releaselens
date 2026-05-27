'use client';

import { track } from '../../lib/analytics';

export function PricingForm() {
  return (
    <form
      data-form="pricing-lead"
      action="/api/lead"
      method="post"
      onSubmit={() => track('pricing_form_submit', { plan: 'pro' })}
    >
      <input name="email" type="email" required />
      <button type="submit">Get started</button>
    </form>
  );
}
