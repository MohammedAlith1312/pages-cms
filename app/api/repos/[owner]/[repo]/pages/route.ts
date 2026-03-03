import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { getRepoPagesInfo } from "@/lib/githubApp";
import { getUserToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * Fetches GitHub Pages information for a repository.
 * 
 * GET /api/repos/[owner]/[repo]/pages
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { owner: string; repo: string } }
) {
    try {
        const { session } = await getAuth();
        if (!session) return new Response(null, { status: 401 });

        const token = await getUserToken();
        if (!token) throw new Error("GitHub token not found");

        const pagesInfo = await getRepoPagesInfo(token, params.owner, params.repo);

        return Response.json({
            status: "success",
            data: pagesInfo,
        });
    } catch (error: any) {
        console.error("Error fetching repository pages info:", error);
        return Response.json({
            status: "error",
            message: error.message,
        });
    }
}
