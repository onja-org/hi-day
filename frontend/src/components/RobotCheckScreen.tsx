"use client";

import clsx from "clsx";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "./Spinner";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
// The widget can resolve in under a frame once the script/iframe are cached,
// which makes the spinner disappear before it's ever perceived — enforce a
// floor so the loading state is always visible for at least this long.
const MIN_SPINNER_MS = 500;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      render: (
        container: HTMLElement,
        params: { sitekey: string; callback: (token: string) => void },
      ) => number;
    };
  }
}

type RobotCheckScreenProps = {
  onVerified: (token: string) => void;
};

export function RobotCheckScreen({ onVerified }: RobotCheckScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [minSpinnerElapsed, setMinSpinnerElapsed] = useState(false);
  const [widgetRendered, setWidgetRendered] = useState(false);
  const rendering = !(minSpinnerElapsed && widgetRendered);

  useEffect(() => {
    const timeout = setTimeout(() => setMinSpinnerElapsed(true), MIN_SPINNER_MS);
    return () => clearTimeout(timeout);
  }, []);

  function renderWidget() {
    if (renderedRef.current || !containerRef.current || !window.grecaptcha) {
      return;
    }

    window.grecaptcha.ready(() => {
      if (renderedRef.current || !containerRef.current || !window.grecaptcha) {
        return;
      }

      renderedRef.current = true;
      window.grecaptcha.render(containerRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: onVerified,
      });
      setWidgetRendered(true);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-primary-dark px-4 text-white">
      <Script
        id="recaptcha-script"
        src="https://www.google.com/recaptcha/api.js"
        onReady={renderWidget}
      />
      {rendering && <Spinner className="h-8 w-8" />}
      <div className={clsx("flex flex-col items-center gap-6", rendering && "hidden")}>
        <h1 className="text-2xl font-semibold">Verify you&apos;re human</h1>
        <p className="max-w-sm text-center text-white/80">
          We&apos;ve noticed too many attempts. Complete the check below to
          continue.
        </p>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
