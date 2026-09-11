"use client";

export default function QuickActions({
  name,
  lat,
  lng,
  lampEnabled,
}: {
  name: string;
  lat: number;
  lng: number;
  lampEnabled: boolean;
}) {
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  };

  const scrollToLamp = () => {
    document.getElementById("light-a-lamp")?.scrollIntoView({ behavior: "smooth" });
  };

  const btn =
    "ui border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm hover:bg-[var(--paper-soft)]";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        className={btn + " !text-[var(--ink)] hover:!no-underline"}
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Get Directions
      </a>
      {lampEnabled && (
        <button className={btn} onClick={scrollToLamp}>
          🪔 Light a Lamp
        </button>
      )}
      <button
        className={btn}
        onClick={scrollToLamp}
        title="Seva booking opens in a later phase"
      >
        Book Seva
      </button>
      <button className={btn} onClick={share}>
        Share
      </button>
    </div>
  );
}
