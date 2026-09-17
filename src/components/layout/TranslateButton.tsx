"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Google Website Translate, driven from our own control.
 *
 * Google's widget renders a <select class="goog-te-combo"> and a top banner
 * that neither matches this site nor sits where we want it. So the widget is
 * mounted hidden (globals.css suppresses its chrome) and this component drives
 * that select programmatically — Google still does the translating and still
 * sets its own `googtrans` cookie, so the choice survives navigation.
 *
 * The script is loaded on first use rather than on every page load: it is a
 * third-party request most visitors never need.
 */

const ELEMENT_ID = "google_translate_element";
const SCRIPT_ID = "google-translate-script";

/** Indian languages first — this is a directory of Indian temples. */
const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as", label: "Assamese", native: "অসমীয়া" },
  { code: "sa", label: "Sanskrit", native: "संस्कृतम्" },
  { code: "ne", label: "Nepali", native: "नेपाली" },
  { code: "si", label: "Sinhala", native: "සිංහල" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "ja", label: "Japanese", native: "日本語" },
];

const INCLUDED = LANGUAGES.map((l) => l.code).join(",");

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (options: Record<string, unknown>, element: string) => unknown;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

/** Google stores the active pair in a `googtrans` cookie, e.g. "/en/ta". */
function activeLanguage(): string {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return "en";
  const parts = decodeURIComponent(match[1]).split("/");
  return parts[2] || "en";
}

/** Clearing the cookie on every host form is what actually restores the original. */
function clearTranslateCookie(): void {
  const { hostname } = window.location;
  const domains = ["", `; domain=${hostname}`, `; domain=.${hostname}`];
  for (const domain of domains) {
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
  }
}

export default function TranslateButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("en");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(activeLanguage());
  }, []);

  // Reopening a translated page should show the widget already initialised.
  useEffect(() => {
    if (activeLanguage() !== "en") void ensureScript().catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ensureScript = useCallback((): Promise<void> => {
    if (document.getElementById(SCRIPT_ID)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      window.googleTranslateElementInit = () => {
        if (!window.google?.translate) {
          reject(new Error("Google Translate did not initialise"));
          return;
        }
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: INCLUDED,
            // Our own control is the UI; Google's banner stays suppressed.
            autoDisplay: false,
          },
          ELEMENT_ID
        );
        resolve();
      };
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.onerror = () => reject(new Error("Could not load Google Translate"));
      document.body.appendChild(script);
    });
  }, []);

  async function choose(code: string) {
    setOpen(false);
    if (code === current) return;

    if (code === "en") {
      // Google has no "translate back to source"; clearing the cookie is the reset.
      clearTranslateCookie();
      window.location.reload();
      return;
    }

    setLoading(true);
    setFailed(false);
    try {
      await ensureScript();
      const combo = await waitForLanguage(code);
      combo.value = code;
      combo.dispatchEvent(new Event("change"));
      setCurrent(code);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const label = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Google must not translate the language picker itself.
        className="notranslate flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
        translate="no"
      >
        <span aria-hidden>🌐</span>
        <span>{loading ? "Translating…" : label.native}</span>
        <span aria-hidden className="text-[10px] opacity-70">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Translate this page"
          translate="no"
          className="notranslate absolute right-0 z-50 mt-2 max-h-[70vh] w-56 overflow-auto rounded-xl border border-line bg-paper p-1.5 text-ink shadow-[0_18px_50px_rgba(59,29,14,.25)]"
        >
          <p className="m-0 px-2.5 py-1.5 text-[10px] font-black tracking-[0.12em] text-[#7a5c36] uppercase">
            Translate this page
          </p>
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              role="option"
              aria-selected={language.code === current}
              onClick={() => choose(language.code)}
              className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${
                language.code === current ? "bg-[#f0e2ca] font-bold text-maroon" : "hover:bg-[#f6ecd8]"
              }`}
            >
              <span>{language.native}</span>
              <span className="text-[11px] text-muted">{language.label}</span>
            </button>
          ))}
          <p className="m-0 border-t border-line px-2.5 pt-2 pb-1 text-[10px] leading-snug text-muted">
            Machine translation by Google. Temple names, quoted sources and
            citations may not translate accurately — check the English original
            before relying on a detail.
          </p>
        </div>
      )}

      {failed && (
        <p className="absolute right-0 mt-2 w-56 rounded-lg bg-[#fff1dc] px-2.5 py-2 text-[11px] text-[#7b3518]">
          Google Translate could not be reached. Check your connection and try again.
        </p>
      )}

      {/* Google mounts its widget here; globals.css keeps it out of sight. */}
      <div id={ELEMENT_ID} aria-hidden className="hidden" />
    </div>
  );
}

/**
 * Waits for Google's <select> AND for the language we want to exist in it.
 *
 * The element appears a tick after the script initialises, but its <option>
 * list is populated later still. Waiting only for the element means assigning
 * `combo.value` to a language that is not there yet, which the DOM silently
 * ignores — the select stays on its first option and nothing translates.
 */
function waitForLanguage(code: string, timeoutMs = 10000): Promise<HTMLSelectElement> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const combo = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
      if (combo && [...combo.options].some((option) => option.value === code)) {
        return resolve(combo);
      }
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`Google Translate did not offer "${code}" in time`));
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}
