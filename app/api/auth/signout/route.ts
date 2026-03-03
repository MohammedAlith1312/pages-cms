import { cookies } from "next/headers";
import { getAuth, lucia } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function GET() {
    const { session } = await getAuth();
    if (!session) {
        return redirect("/");
    }

    await lucia.invalidateSession(session.id);

    const sessionCookie = lucia.createBlankSessionCookie();
    cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return redirect("/");
}
