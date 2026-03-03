import { verifyRequestOrigin } from "lucia";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	// 1. Handle preflight requests for CORS
	if (request.method === "OPTIONS") {
		return new NextResponse(null, {
			status: 200,
			headers: {
				"Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
				"Access-Control-Allow-Credentials": "true",
			},
		});
	}

	if (request.method === "GET") {
		return NextResponse.next();
	}

	const originHeader = request.headers.get("Origin");
	const hostHeader = request.headers.get("Host");

	// Allow the CMS itself and the Documentation site origins
	const allowedHosts = [
		hostHeader || "localhost:3000",
		"localhost:5000",
		"pages-cms-ten-psi.vercel.app"
	];

	if (!originHeader || !hostHeader || !verifyRequestOrigin(originHeader, allowedHosts)) {
		return new NextResponse(null, {
			status: 403
		});
	}

	return NextResponse.next();
}

export const config = {
	matcher: "/api/:path((?!webhook).*)"
}