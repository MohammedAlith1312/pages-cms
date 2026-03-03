import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { SignIn } from "@/components/sign-in";
import { handleGithubSignIn } from "@/lib/actions/auth";

export default async function Page() {
  const { session } = await getAuth();
  if (session) return redirect("/");

  return (
    <SignIn />
  );
}