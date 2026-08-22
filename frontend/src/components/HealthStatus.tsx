"use client";

import { useHealthCheck } from "@/hooks/useHealthCheck";

export function HealthStatus() {
  const { health, error } = useHealthCheck();

  if (error) return <p className="text-red-600">{error}</p>;
  if (!health) return <p className="text-zinc-500">Checking backend connection…</p>;
  return <p className="text-green-600">{health.message}</p>;
}
