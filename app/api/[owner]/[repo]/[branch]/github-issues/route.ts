import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { createIssue, getIssue, getIssues, updateIssue } from "@/lib/githubIssues";
import { checkRepoAccess } from "@/lib/githubCache";
import { clearInstallationToken } from "@/lib/token";

export async function GET(
    request: NextRequest,
    { params }: { params: { owner: string, repo: string, branch: string } }
) {
    try {
        const { user, session } = await getAuth();
        if (!session) return new Response(null, { status: 401 });

        const token = await getToken(user, params.owner, params.repo);
        if (!token) throw new Error("Token not found");

        const { searchParams } = new URL(request.url);
        const issueNumber = searchParams.get("number");
        const issueNumbers = searchParams.get("numbers");

        if (issueNumber) {
            const data = await getIssue(token, params.owner, params.repo, parseInt(issueNumber));
            return Response.json({ status: "success", data });
        }

        if (issueNumbers) {
            const numbers = issueNumbers.split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n));
            const data = await Promise.all(numbers.map(n => getIssue(token, params.owner, params.repo, n)));
            return Response.json({ status: "success", data });
        }

        const data = await getIssues(token, params.owner, params.repo);
        return Response.json({ status: "success", data });
    } catch (error: any) {
        return Response.json({ status: "error", message: error.message });
    }
}

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

        let responseData;
        try {
            responseData = await createIssue(token, params.owner, params.repo, {
                title,
                body,
                labels: labels || [],
            });
        } catch (error: any) {
            if (error.message.includes("Resource not accessible by integration")) {
                // Force clear token and retry once
                await clearInstallationToken(params.owner, params.repo);
                const newToken = await getToken(user, params.owner, params.repo, true);
                responseData = await createIssue(newToken, params.owner, params.repo, {
                    title,
                    body,
                    labels: labels || [],
                });
            } else {
                throw error;
            }
        }

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

export async function PATCH(
    request: NextRequest,
    { params }: { params: { owner: string, repo: string, branch: string } }
) {
    try {
        const { user, session } = await getAuth();
        if (!session) return new Response(null, { status: 401 });

        const token = await getToken(user, params.owner, params.repo);
        if (!token) throw new Error("Token not found");

        const data = await request.json();
        const { number, state, title, body } = data;

        if (!number) throw new Error("Issue number is required");

        let responseData;
        try {
            responseData = await updateIssue(token, params.owner, params.repo, number, {
                state,
                title,
                body
            });
        } catch (error: any) {
            if (error.message.includes("Resource not accessible by integration")) {
                // Force clear token and retry once
                await clearInstallationToken(params.owner, params.repo);
                const newToken = await getToken(user, params.owner, params.repo, true);
                responseData = await updateIssue(newToken, params.owner, params.repo, number, {
                    state,
                    title,
                    body
                });
            } else {
                throw error;
            }
        }

        return Response.json({
            status: "success",
            message: `Issue #${number} updated successfully`,
            data: responseData,
        });
    } catch (error: any) {
        return Response.json({
            status: "error",
            message: error.message,
        });
    }
}
