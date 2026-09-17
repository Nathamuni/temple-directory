import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "Temple Directory — a sourced encyclopedia of Hindu temples",
    template: "%s - Temple Directory",
  },
  description:
    "A structured, sourced reference of Hindu temples — sacred significance, history, temple-specific worship guidance, daily poojas, festivals and visiting information, with the evidence behind every claim.",
};

/**
 * Restores the reader's Clean/Evidence choice before first paint, so turning
 * evidence on does not flash the page on every navigation. Deliberately inline
 * and tiny; the toggle itself lives in the header.
 */
const EVIDENCE_BOOTSTRAP = `try{if(localStorage.getItem('td:evidence')==='1')document.documentElement.classList.add('show-evidence')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* suppressHydrationWarning: the bootstrap script below sets a class on
       <html> before React hydrates, which is exactly the mismatch this flag is
       for. It applies only to this element's own attributes. */
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EVIDENCE_BOOTSTRAP }} />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
