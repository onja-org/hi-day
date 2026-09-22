import { notFound } from "next/navigation";

// Hidden from the platform: not linked from nav, and direct navigation 404s.
// The underlying disclosure/consent data model, API, and audit trail are
// unchanged (see docs/adr/0015-disclosure-as-passive-non-blocking-notice.md).
export default function DisclosureSettingsPage() {
  notFound();
}
