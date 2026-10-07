import Image from "next/image";
import Link from "next/link";

/** The Hi Day lockup at the top of the signed-out pages, linking home. */
export function AuthLogo() {
  return (
    <Link href="/" aria-label="Hi Day home" className="mb-6 block w-fit">
      <Image src="/brand/hiday-lockup.svg" alt="" width={112} height={32} preload />
    </Link>
  );
}
