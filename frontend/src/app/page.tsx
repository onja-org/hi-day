import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/isAuthenticated";

/**
 * The root used to be the marketing landing page. That moved to its own
 * private repo when this one became open source: a self-hosted install
 * should not serve pages advertising a paid hosted version of itself.
 *
 * So the root is now a signpost into the app — the dashboard for somebody
 * already signed in, the login page for everybody else. That is what a
 * self-hoster typing their own domain expects to land on.
 */
export default async function Home() {
  redirect((await isAuthenticated()) ? "/dashboard" : "/login");
}
