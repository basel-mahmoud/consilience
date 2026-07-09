import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function Terms() {
  return (
    <>
      <h1 className="font-display text-3xl tracking-tight">Terms of Service</h1>
      <p className="text-sm text-ink-muted">Last updated: 9 July 2026</p>

      <p className="leading-7">
        By using Consilience you agree to these terms. Please read the disclaimer
        on research output carefully — it is central to how this product should be
        used.
      </p>

      <h2 className="font-display text-xl tracking-tight">Research output is AI-generated</h2>
      <p className="leading-7">
        Consilience produces research reports using automated AI agents. Every
        claim, confidence score, and source ranking is machine-generated and{" "}
        <strong>may be incomplete, outdated, or wrong</strong>. Confidence scores
        reflect the system&rsquo;s own assessment, not a guarantee of accuracy. Do
        not rely on a report for medical, legal, financial, or other consequential
        decisions without independently verifying each claim against its cited
        sources. Consilience is a research aid, not a source of professional advice.
      </p>

      <h2 className="font-display text-xl tracking-tight">Acceptable use</h2>
      <ul className="list-disc space-y-2 pl-5 leading-7">
        <li>Do not use the service to break the law or infringe others&rsquo; rights.</li>
        <li>
          Do not attempt to overwhelm, probe, or circumvent the service&rsquo;s
          rate limits, authentication, or approval gates.
        </li>
        <li>
          Do not use it to generate content that is harmful, harassing, or
          designed to deceive.
        </li>
      </ul>

      <h2 className="font-display text-xl tracking-tight">Accounts &amp; termination</h2>
      <p className="leading-7">
        You are responsible for activity under your account. We may suspend or
        terminate accounts that abuse the service or violate these terms. You can
        delete your account and all associated data at any time from Settings.
      </p>

      <h2 className="font-display text-xl tracking-tight">Limitation of liability</h2>
      <p className="leading-7">
        The service is provided &ldquo;as is,&rdquo; without warranties of any
        kind. To the fullest extent permitted by law, the maintainer is not liable
        for any damages arising from your use of the service or reliance on its
        output, including decisions made based on AI-generated research.
      </p>

      <h2 className="font-display text-xl tracking-tight">Changes</h2>
      <p className="leading-7">
        These terms may be updated; material changes will be reflected by the date
        above. Continued use after a change constitutes acceptance.
      </p>
    </>
  );
}
