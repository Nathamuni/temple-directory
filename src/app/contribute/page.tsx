import type { Metadata } from "next";
import ContributeForm from "@/components/contribute/ContributeForm";

export const metadata: Metadata = {
  title: "Contribute a temple",
  description: "Submit a new temple entry to the Temple Directory as a draft for review.",
};

export default function ContributePage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <h1 className="text-2xl">Contribute a temple</h1>
      <p className="ui mt-1 text-sm text-[var(--ink-soft)]">
        Submits a draft entry with the core details below. A reviewer will verify sources
        and complete the remaining sections before publishing.
      </p>
      <ContributeForm />
    </div>
  );
}
