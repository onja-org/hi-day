import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  message: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useHealthCheck() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        return res.json() as Promise<HealthResponse>;
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the backend.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { health, error };
}
