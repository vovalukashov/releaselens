interface PricingHeroProps {
  headline: string;
  subhead?: string;
}

export function PricingHero({ headline, subhead }: PricingHeroProps) {
  return (
    <section>
      <h2>{headline}</h2>
      {subhead ? <p>{subhead}</p> : null}
    </section>
  );
}
