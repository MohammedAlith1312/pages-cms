import { verifyRequestOrigin } from "lucia";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const originHeader = request.headers.get("Origin");
	const hostHeader = request.headers.get("Host");

	// Define authorized origins for CORS and CSRF
	const allowedOrigins = [
		"http://localhost:5000",
		"https://mohammedalith1312.github.io",
		"https://pages-cms-ten-psi.vercel.app"
	];

	// 1. Handle preflight requests for CORS
	if (request.method === "OPTIONS") {
		return new NextResponse(null, {
			status: 200,
			headers: {
				"Access-Control-Allow-Origin": originHeader && (allowedOrigins.includes(originHeader) || originHeader.includes("localhost")) ? originHeader : "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
				"Access-Control-Allow-Credentials": "true",
			},
		});
	}

	// 2. Wrap the response to add CORS headers to regular requests
	let response = NextResponse.next();

	// If the origin is in our allowed list, set the CORS header explicitly to allow Credentials
	if (originHeader && (allowedOrigins.includes(originHeader) || originHeader.includes("localhost"))) {
		response.headers.set("Access-Control-Allow-Origin", originHeader);
		response.headers.set("Access-Control-Allow-Credentials", "true");
	}

	if (request.method === "GET") {
		return response;
	}

	// CSRF Protection for non-GET requests (Lucia)
	const allowedHosts = [
		hostHeader || "localhost:3000",
		"localhost:5000",
		"pages-cms-ten-psi.vercel.app",
		"mohammedalith1312.github.io"
	];

	if (!originHeader || !hostHeader || !verifyRequestOrigin(originHeader, allowedHosts)) {
		return new NextResponse(null, {
			status: 403
		});
	}

	return response;
}

export const config = {
	matcher: "/api/:path((?!webhook).*)"
}