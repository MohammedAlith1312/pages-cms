import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Docsify Auth Check Proxy
 * This route allows the Docsify frontend to quickly verify if the current 
 * browser session is authenticated with the CMS.
 * 
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
    try {
        const { user, session } = await getAuth();

        if (!session || !user) {
            return Response.json({
                authenticated: false,
                user: null
            });
        }

        return Response.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                githubId: user.githubId,
                githubUsername: user.githubUsername,
                name: user.githubName || user.email,
            }
        });
    } catch (error: any) {
        return Response.json({ status: "error", message: error.message }, { status: 500 });
    }
}
