import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { isAuthenticated } from "@/lib/isAuthenticated";

export default async function Home() {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header />
      <main>
       <div className="container"> <h1>Main content</h1></div>
      </main>
    </>
  );
}
