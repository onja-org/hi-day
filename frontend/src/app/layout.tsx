import type { Metadata } from "next";
import localFont from "next/font/local";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

// The Hi Day brand faces, self-hosted (latin subset): Figtree for UI and
// body copy, Bricolage Grotesque for headings, JetBrains Mono for timers.
const figtree = localFont({
  src: "./fonts/Figtree-Variable.woff2",
  variable: "--font-figtree",
  weight: "400 800",
  display: "swap",
});
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  weight: "400 800",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains-mono",
  weight: "500 700",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hiday.io"),
  applicationName: "Hi Day",
  // Pages set just their own name (e.g. "Projects"); the template adds the
  // product name, so every tab reads "Projects — Hi Day".
  title: {
    default: "Hi Day",
    template: "%s — Hi Day",
  },
  description:
    "Time tracking, activity, projects and team management for your organisation — on the web and the desktop app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${bricolage.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
