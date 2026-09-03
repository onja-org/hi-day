"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type FadeInProps = {
  children: ReactNode;
};

function FadeInOnMount({ children }: FadeInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={clsx(
        "transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

export function FadeIn({ children }: FadeInProps) {
  const pathname = usePathname();
  return <FadeInOnMount key={pathname}>{children}</FadeInOnMount>;
}
