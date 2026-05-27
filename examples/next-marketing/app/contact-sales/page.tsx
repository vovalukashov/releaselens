import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Sales — Acme',
  description: 'Talk to our team about your needs.',
};

export default function ContactSalesPage() {
  return (
    <main>
      <h1>Contact Sales</h1>
      <form data-form="contact-sales" action="/api/contact" method="post">
        <input name="email" type="email" required />
        <textarea name="message" required />
        <button type="submit">Send</button>
      </form>
    </main>
  );
}
