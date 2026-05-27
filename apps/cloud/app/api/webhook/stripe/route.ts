import Stripe from 'stripe';

export async function POST(req: Request): Promise<Response> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return Response.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await req.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return Response.json(
      { error: `Invalid signature: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  // TODO Month 7: map checkout.session.completed → mark project as Pro.
  // Requires linking Stripe customer to project at checkout time.
  console.log('Stripe webhook received', event.type);

  return Response.json({ received: true });
}
