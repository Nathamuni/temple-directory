import type { Temple } from "@/lib/types";
import QuickActions from "./QuickActions";
import ImageWithCredit from "./ImageWithCredit";

export default function TempleHero({ temple }: { temple: Temple }) {
  return (
    <header>
      <h1 className="text-3xl font-normal leading-tight">{temple.name}</h1>
      {temple.nameLocal && (
        <div className="mt-0.5 text-xl text-[var(--ink-soft)]">{temple.nameLocal.text}</div>
      )}
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">{temple.subtitle}</p>
      <div className="mt-1 h-px w-full bg-[var(--line)]" />
      <QuickActions
        name={temple.name}
        lat={temple.location.coordinates.lat}
        lng={temple.location.coordinates.lng}
        lampEnabled={temple.lamp?.enabled ?? false}
      />
      <figure className="mt-4">
        <ImageWithCredit image={temple.heroImage} className="max-h-[440px] w-full object-cover" />
      </figure>
    </header>
  );
}
