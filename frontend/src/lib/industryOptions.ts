import type { Industry } from "@/types/organisation";

/** Mirrors the backend's `INDUSTRY_VALUES`, in the order the form lists them. */
export const INDUSTRY_OPTIONS: readonly { value: Industry; label: string }[] = [
  { value: "software_it", label: "Software & IT" },
  { value: "consulting", label: "Consulting" },
  { value: "marketing_advertising", label: "Marketing & advertising" },
  { value: "design", label: "Design" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "construction", label: "Construction" },
  { value: "legal", label: "Legal" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "non_profit", label: "Non-profit" },
  { value: "government", label: "Government" },
  { value: "media", label: "Media" },
  { value: "other", label: "Other" },
];
