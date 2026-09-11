import type { Review } from "@/lib/types";

export default function Reviews({ reviews }: { reviews: Review[] }) {
  if (!reviews?.length) return null;
  return (
    <div className="space-y-3">
      {reviews.map((r, i) => (
        <blockquote key={i} className="border-l-2 border-[var(--line)] pl-4">
          <p className="text-[15px] italic">“{r.text}”</p>
          <footer className="ui mt-1 text-xs text-[var(--ink-soft)]">
            {"★".repeat(r.rating)}
            {"☆".repeat(5 - r.rating)} — {r.author}, {r.date}
          </footer>
        </blockquote>
      ))}
      <p className="ui text-xs text-[var(--ink-soft)]">
        Testimonials are moderated for relevance and tone.
      </p>
    </div>
  );
}
