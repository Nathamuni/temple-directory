import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "Temple Directory — a free encyclopedia of Hindu temples",
    template: "%s - Temple Directory",
  },
  description:
    "A structured, cited, Wikipedia-style reference of Hindu temples worldwide — history, architecture, worship SOPs, festivals, and Akhand Deepam lamp sponsorship.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
