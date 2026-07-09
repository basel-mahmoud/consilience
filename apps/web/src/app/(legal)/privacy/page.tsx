import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function Privacy() {
  return (
    <>
      <h1 className="font-display text-3xl tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-ink-muted">Last updated: 9 July 2026</p>

      <p className="leading-7">
        This policy describes exactly what Consilience collects, why, and how long
        it is kept. It is written to match how the product actually works — not
        generic boilerplate.
      </p>

      <h2 className="font-display text-xl tracking-tight">What we collect</h2>
      <ul className="list-disc space-y-2 pl-5 leading-7">
        <li>
          <strong>Account data (via Clerk):</strong> your email address, name if
          you provide one, and authentication data. Clerk is our authentication
          provider and stores your credentials; we never see your password.
        </li>
        <li>
          <strong>Research content:</strong> the questions you submit and the
          reports the agents produce (claims, sources, confidence scores,
          contradictions, evaluations, and the agent activity trace).
        </li>
        <li>
          <strong>Technical data:</strong> your IP address, used transiently to
          enforce rate limits and protect against abuse, and a
          &ldquo;last seen&rdquo; timestamp on your account.
        </li>
      </ul>
      <p className="leading-7">
        We do <strong>not</strong> run third-party advertising or analytics
        trackers, and we do not sell your data.
      </p>

      <h2 className="font-display text-xl tracking-tight">Why we collect it</h2>
      <p className="leading-7">
        Account data authenticates you and scopes your research to you alone.
        Research content is stored so you can revisit and export your reports.
        Technical data protects the service from abuse and runaway cost.
      </p>

      <h2 className="font-display text-xl tracking-tight">Retention</h2>
      <p className="leading-7">
        Research content is kept until you delete it or your account. When you
        delete your account, all of your research data is erased immediately, and
        your Clerk identity is deleted as part of the same flow. IP addresses are
        used transiently for rate limiting and are not stored in a durable,
        user-linked log.
      </p>

      <h2 className="font-display text-xl tracking-tight">Your rights (GDPR / CCPA)</h2>
      <p className="leading-7">
        You can access and export your research (the export button on any report),
        and you can delete all of your data at any time from{" "}
        <span className="font-mono text-sm">Settings → Delete account</span>. If you
        are in the EU or California, you have the right to access, correct, and
        delete your personal data and to data portability; the in-app export and
        deletion tools satisfy these directly. See{" "}
        <a
          href="https://github.com/basel-mahmoud/consilience/blob/main/DATA_HANDLING.md"
          className="text-accent underline-offset-4 hover:underline"
        >
          DATA_HANDLING.md
        </a>{" "}
        for the full data inventory.
      </p>

      <h2 className="font-display text-xl tracking-tight">Contact</h2>
      <p className="leading-7">
        For any privacy request, contact the maintainer via the{" "}
        <a
          href="https://github.com/basel-mahmoud/consilience"
          className="text-accent underline-offset-4 hover:underline"
        >
          project repository
        </a>
        .
      </p>
    </>
  );
}
