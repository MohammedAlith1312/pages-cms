import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { createIssue } from "@/lib/githubIssues";
import { checkRepoAccess } from "@/lib/githubCache";

export async function POST(
    request: NextRequest,
    { params }: { params: { owner: string, repo: string, branch: string } }
) {
    try {
        const { user, session } = await getAuth();
        if (!session) return new Response(null, { status: 401 });

        const token = await getToken(user, params.owner, params.repo);
        if (!token) throw new Error("Token not found");

        if (user.githubId) {
            const hasAccess = await checkRepoAccess(token, params.owner, params.repo, user.githubId);
            if (!hasAccess) throw new Error(`No access to repository ${params.owner}/${params.repo}.`);
        }

        const data = await request.json();
        const { title, body, labels } = data;

        if (!title) throw new Error("Title is required");

        const responseData = await createIssue(token, params.owner, params.repo, {
            title,
            body,
            labels: labels || [],
        });

        return Response.json({
            status: "success",
            message: "Issue created successfully",
            data: responseData,
        });
    } catch (error: any) {
        console.error(error);
        return Response.json({
            status: "error",
            message: error.message,
        });
    }
}
