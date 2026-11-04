import Image from "next/image";
import { WEBSITE_URL } from "@/lib/cloudSiteUrl";

const LOGO = (
  <Image src="/brand/hiday-lockup.svg" alt="Hi Day" width={112} height={32} preload />
);

/**
 * The lockup at the top of the signed-out pages. Links to the public
 * website where there is one — in a new tab, so a half-filled login form
 * survives the detour. Plain image otherwise; it used to link to `/`, which
 * now redirects back to the login page it is already on.
 */
export function AuthLogo() {
  if (!WEBSITE_URL) {
    return <div className="mb-6 w-fit">{LOGO}</div>;
  }

  return (
    <a
      href={WEBSITE_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Hi Day — opens the website in a new tab"
      className="mb-6 block w-fit"
    >
      {LOGO}
    </a>
  );
}
