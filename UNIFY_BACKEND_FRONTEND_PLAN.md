# Implementation Plan: Unifying Pages CMS (Backend) and Docsify (Frontend)

## 1. Objective
To completely replace the standalone Express.js backend for Docsify with the existing Next.js Pages CMS backend. This unifies authentication, issue management, and content editing into a single robust system, while Docsify remains pure frontend as a "data consumer."

## 2. Implementation Steps

*   **Step 1: Backup & Logic Extraction:** Extract the specific regex logic from `docsify/backend/server.js` (used for parsing issue bodies/images) and move it into the CMS library (`pages-cms-main/lib/githubIssues.ts`).
*   **Step 2: Create the CMS API Proxy (Issues):** Build new API routes in `pages-cms-main` to act as a secure bridge. These routes will take requests from Docsify, attach the GitHub App tokens securely, and fetch or manipulate issue data using the GitHub API.
*   **Step 3: Implement Auth Verification:** Create a session-check endpoint in the CMS (`/api/auth/me`). When a user visits Docsify, the site will text this CMS API to verify if a valid collaborator session exists.
*   **Step 4: Update Docsify Frontend:** Modify the JavaScript in the Docsify site (`docsify/docs/index.html` and scripts) to point all requests to the new CMS API URLs instead of the old Express server. Handle login redirects to point to the CMS login page.
*   **Step 5: Editor Integration:** (Already completed) Configure the CMS editor to show a "View Live" button mapping to the correct Docsify URL.
*   **Step 6: Cleanup:** Safely delete the entire `docsify/backend` folder, as its responsibilities are now fully managed by the CMS.

## 3. List of Files (Modified or Created)

### In `pages-cms-main` (The Unified Backend)
| File Path | Action | Purpose |
| :--- | :--- | :--- |
| `lib/githubIssues.ts` | **Modify** | Add the issue body parsing logic (for screenshots/context) extracted from the old server. |
| `app/api/repos/[owner]/[repo]/issues/route.ts`| **New** | The main API proxy endpoint that Docsify will call to List, Create, and Update issues. |
| `app/api/auth/me/route.ts` | **New** | Endpoint to allow Docsify to verify if a user is currently logged into the CMS via GitHub. |
| `lib/utils.ts` | **Existing** | Already updated with the `getDocsifyPreviewUrl` mapping logic. |
| `components/entry/entry-form.tsx`| **Existing** | Already updated with the "View Live" button. |

### In `docsify` (The Frontend)
| File Path | Action | Purpose |
| :--- | :--- | :--- |
| `docs/index.html` | **Modify** | Update the Docsify configuration and embedded scripts to use the CMS API URLs. |
| `docs/cms-bridge.js` | **New** | (Recommended) A helper script to handle login-redirect logic and API fetching, cleanly separated from Docsify core config. |

### Files to be Deleted
| File Path | Action | Purpose |
| :--- | :--- | :--- |
| `d:\cms\docsify\backend\` | **Delete** | Remove the entire directory (including `server.js`, `api/`, `package.json`, etc.) since the Express server is obsolete. |
