interface Testimonial {
  quote: string;
  author: string;
}

interface TestimonialGridProps {
  items: Testimonial[];
}

export function TestimonialGrid({ items }: TestimonialGridProps) {
  return (
    <section>
      <ul>
        {items.map((item) => (
          <li key={item.author}>
            <blockquote>{item.quote}</blockquote>
            <cite>{item.author}</cite>
          </li>
        ))}
      </ul>
    </section>
  );
}
