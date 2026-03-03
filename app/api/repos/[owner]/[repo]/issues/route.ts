import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { getToken, getInstallationToken } from "@/lib/token";
import { createIssue, getIssue, getIssues, updateIssue, createComment, parseDocsifyIssue } from "@/lib/githubIssues";
import { checkRepoAccess } from "@/lib/githubCache";

export const dynamic = "force-dynamic";

/**
 * Docsify API Proxy for Issues
 * This route allows the Docsify frontend to fetch and manage GitHub Issues
 * securely through the CMS, without exposing tokens.
 */

export async function GET(
    request: NextRequest,
    { params }: { params: { owner: string, repo: string } }
) {
    try {
        const { user, session } = await getAuth();
        let token;

        if (session && user) {
            token = await getToken(user, params.owner, params.repo);
        } else {
            // Unauthenticated users (public visitors on Docsify) use the App installation token
            // to read public issues (if the App is installed on the repo).
            token = await getInstallationToken(params.owner, params.repo);
        }

        if (!token) throw new Error("Token not found or repository not accessible");

        const { searchParams } = new URL(request.url);
        const issueNumber = searchParams.get("number");

        if (issueNumber) {
            const data = await getIssue(token, params.owner, params.repo, parseInt(issueNumber));
            return Response.json({ status: "success", data: parseDocsifyIssue(data) });
        }

        const rawIssues = await getIssues(token, params.owner, params.repo, { state: 'all' });
        const issues = rawIssues.filter((i: any) => !i.pull_request).map(parseDocsifyIssue);

        return Response.json({ status: "success", issues });
    } catch (error: any) {
        return Response.json({ status: "error", message: error.message }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { owner: string, repo: string } }
) {
    try {
        const { user, session } = await getAuth();
        if (!session) return new Response(JSON.stringify({ status: "error", message: "Unauthorized" }), { status: 401 });

        const token = await getToken(user, params.owner, params.repo);
        if (!token) throw new Error("Token not found");

        if (user.githubId) {
            const hasAccess = await checkRepoAccess(token, params.owner, params.repo, user.githubId);
            if (!hasAccess) throw new Error(`No access to repository ${params.owner}/${params.repo}.`);
        }

        const data = await request.json();
        const { title, body, action, number, comment } = data;

        // --- Handle 'Comment' Action ---
        if (action === 'comment') {
            if (!number || !comment) throw new Error("Issue number and comment text are required");
            const responseData = await createComment(token, params.owner, params.repo, number, comment);
            return Response.json({ status: "success", data: responseData });
        }

        // --- Handle 'Create Issue' Action (Default) ---
        if (!title) throw new Error("Title is required");

        const responseData = await createIssue(token, params.owner, params.repo, { title, body });

        return Response.json({
            status: "success",
            url: responseData.html_url,
            number: responseData.number
        });
    } catch (error: any) {
        return Response.json({ status: "error", message: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { owner: string, repo: string } }
) {
    try {
        const { user, session } = await getAuth();
        if (!session) return new Response(JSON.stringify({ status: "error", message: "Unauthorized" }), { status: 401 });

        const token = await getToken(user, params.owner, params.repo);
        if (!token) throw new Error("Token not found");

        const data = await request.json();
        const { number, state, title, body } = data;

        if (!number) throw new Error("Issue number is required");

        const responseData = await updateIssue(token, params.owner, params.repo, number, { state, title, body });

        return Response.json({ status: "success", data: responseData });
    } catch (error: any) {
        return Response.json({ status: "error", message: error.message }, { status: 500 });
    }
}
