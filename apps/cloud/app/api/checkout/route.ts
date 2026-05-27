import { authenticateRequest } from '@/lib/auth';
import Stripe from 'stripe';

export async function GET(): Promise<Response> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!secretKey || !priceId) {
    return Response.json(
      { error: 'Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' },
      { status: 503 },
    );
  }

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
  });

  return Response.redirect(session.url ?? `${appUrl}/pricing`, 303);
}

export async function POST(req: Request): Promise<Response> {
  const project = await authenticateRequest(req);
  if (!project) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return GET();
}
