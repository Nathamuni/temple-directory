"use client";

import { useEffect, useState } from "react";

const KEY = "td:evidence";

/**
 * Clean view / Evidence switch.
 *
 * The chips themselves are server-rendered and hidden by CSS, so this only
 * toggles a class on <html> and remembers the choice. That keeps the temple
 * page a Server Component and costs no network round trip.
 */
export default function EvidenceToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(document.documentElement.classList.contains("show-evidence"));
  }, []);

  function set(next: boolean) {
    setOn(next);
    document.documentElement.classList.toggle("show-evidence", next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Private browsing or blocked storage: the toggle still works for this page view.
    }
  }

  return (
    <div role="group" aria-label="Evidence view" className="flex items-center rounded-full border border-white/10 bg-white/10 p-1">
      <button
        type="button"
        aria-pressed={!on}
        onClick={() => set(false)}
        className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? "text-[#d9cec6]" : "bg-white text-[#3c1d15]"}`}
      >
        Clean view
      </button>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => set(true)}
        className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? "bg-white text-[#3c1d15]" : "text-[#d9cec6]"}`}
      >
        Evidence
      </button>
    </div>
  );
}
