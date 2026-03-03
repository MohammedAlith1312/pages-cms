import { github } from "@/lib/auth";
import { cookies } from "next/headers";
import { isRepoCollaborator } from "@/lib/githubIssues";
import { getInstallationToken } from "@/lib/token";

/**
 * Direct GitHub OAuth callback for Documentation/Docsify.
 * Replicates the logic of the old standalone backend.
 * 
 * GET /api/auth/callback
 */
export async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const storedState = cookies().get("github_oauth_state")?.value ?? null;
    const redirectTo = cookies().get("github_oauth_redirect")?.value || "/";

    // Clean up cookies
    cookies().delete("github_oauth_state");
    cookies().delete("github_oauth_redirect");

    if (!code || !state || !storedState || state !== storedState) {
        return Response.redirect(`${redirectTo}/login.html?auth_error=no_code`, 302);
    }

    try {
        // 1. Exchange code for access token
        const token = await github.validateAuthorizationCode(code);
        const accessToken = token.accessToken;

        // 2. Fetch user profile
        const githubUserResponse = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        const githubUser = await githubUserResponse.json();

        // 3. Collaborator Check
        // We need owner and repo. We'll use the ones from env or fall back to defaults.
        const owner = process.env.GITHUB_OWNER || "MohammedAlith1312";
        const repo = process.env.GITHUB_REPO || "document-in-docsify";

        // Use App token to check collaborator (requires installation)
        const appToken = await getInstallationToken(owner, repo);
        const isAuthorized = await isRepoCollaborator(appToken, owner, repo, githubUser.login);

        if (!isAuthorized) {
            console.warn(`Auth Proxy: ACCESS DENIED — ${githubUser.login} is not a collaborator on ${owner}/${repo}`);
            return Response.redirect(`${redirectTo}/login.html?auth_error=unauthorized`, 302);
        }

        // 4. Redirect back to frontend with token and info
        const params = new URLSearchParams({
            access_token: accessToken,
            login: githubUser.login,
            name: githubUser.name || githubUser.login,
            avatar_url: githubUser.avatar_url,
        });

        // Ensure redirectTo doesn't have a trailing slash if we're adding one, or handle carefully
        const targetUrl = redirectTo.endsWith('/') ? redirectTo.slice(0, -1) : redirectTo;

        return Response.redirect(`${targetUrl}?${params.toString()}`, 302);

    } catch (e) {
        console.error("Auth Proxy Callback error:", e);
        return Response.redirect(`${redirectTo}/login.html?auth_error=server_error`, 302);
    }
}
