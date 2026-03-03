import { github } from "@/lib/auth";
import { generateState } from "arctic";
import { cookies } from "next/headers";

/**
 * Initiates the GitHub OAuth flow for Documentation/Docsify.
 * This is a direct proxy to GitHub, avoiding CMS UI.
 * 
 * GET /api/auth/login
 */
export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const redirectUrl = url.searchParams.get("redirect") || "/";

    const state = generateState();
    const authUrl = await github.createAuthorizationURL(state, {
        scopes: ["repo", "read:user", "user:email"]
    });

    const finalAuthUrl = new URL(authUrl.toString());

    cookies().set("github_oauth_state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax"
    });

    // Store the final destination (the Documentation page)
    cookies().set("github_oauth_redirect", redirectUrl, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax"
    });

    return new Response(null, {
        status: 302,
        headers: {
            Location: finalAuthUrl.toString()
        }
    });
}
