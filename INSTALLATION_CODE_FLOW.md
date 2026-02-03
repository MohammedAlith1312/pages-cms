# GitHub App Installation: Code-Wise Breakdown

This document provides a detailed, step-by-step technical explanation of the GitHub App installation process in the Pages CMS project, mapped directly to the code implementation.

---

## 1. User Initiates Installation

**Context:** The user has signed in but hasn't installed the GitHub App on any account yet.

### `app/(main)/page.tsx` (Frontend)
Displays the "Install" button when no accounts are found.

```tsx
// 1. Checks if user has accounts
if (user.accounts.length > 0) {
  // ... shows repositories
} else {
  // 2. Shows install message
  <Message title="Install the GitHub app" ...>
    {/* 3. Calls Server Action on submit */}
    <form action={handleAppInstall}>
      <SubmitButton type="submit">Install</SubmitButton>
    </form>
  </Message>
}
```

---

## 2. Server Redirects to GitHub

**Context:** The application prepares the OAuth state and sends the user to GitHub to authorize the installation.

### `lib/actions/app.ts` (Server Action)
Handles the redirection logic.

```typescript
export const handleAppInstall = async () => {
  // 1. Generate random state for CSRF protection
  const state = generateState();
  
  // 2. Construct GitHub Installation URL
  // Format: https://github.com/apps/[APP_NAME]/installations/new
  const url = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new?state=${encodeURIComponent(state)}`;
  
  // 3. Store state in cookie (secure, httpOnly)
  cookies().set("github_oauth_state", state, { ... });

  // 4. Redirect user to GitHub
  return redirect(url);
};
```

---

## 3. GitHub UI Interaction (External)

**Context:** The user is on `github.com`.
1. User selects an account (Personal or Organization).
2. User selects specific repositories (or "All repositories").
3. User clicks "Install".
4. GitHub redirects the user back to the application (usually to the homepage or callback URL).

---

## 4. Installation Discovery (Read Flow)

**Context:** The app detects the new installation immediately by querying the GitHub API. It does **not** rely on a webhook to create a local database record for the installation itself.

### `app/(main)/layout.tsx` (Data Fetching)
Runs on every page load in the main app.

```typescript
export default async function Layout(...) {
  const { session, user } = await getAuth();
  
  // 1. Fetch accounts (installations) for the user
  const accounts = await getAccounts(user);
  
  // 2. Pass accounts to the client-side provider
  const userWithAccounts = { ...user, accounts };
  return <Providers user={userWithAccounts}>{children}</Providers>;
}
```

### `lib/utils/accounts.ts` (Logic)
Orchestrates fetching accounts.

```typescript
const getAccounts = async (user: User) => {
  if (user.githubId) {
    // 1. Get user's OAuth access token
    const token = await getUserToken();
    
    // 2. Fetch installations from GitHub API
    const installations = await getInstallations(token);

    // 3. Map GitHub response to internal Account format
    return installations.map(inst => ({
      login: inst.account.login,
      type: inst.account.type,
      installationId: inst.id, // Critical for future API calls
      repositorySelection: inst.repository_selection
    }));
  }
  // ... handling for email-only collaborators
};
```

### `lib/githubApp.ts` (API Call)
Direct communication with GitHub.

```typescript
const getInstallations = async (token: string, ...) => {
  const octokit = createOctokitInstance(token);
  
  // 1. Call GitHub REST API
  // Endpoint: GET /user/installations
  const response = await octokit.rest.apps.listInstallationsForAuthenticatedUser({
    per_page: 100
  });

  return response.data.installations;
};
```

---

## 5. Webhook Cleanup (Write/Delete Flow)

**Context:** When a user **uninstalls** the app or **removes** a repository, a webhook is sent to clean up local data (like collaborators and cache). The app does not need a webhook for *creation* because of the read flow above.

### `app/api/webhook/github/route.ts`

```typescript
export async function POST(request: Request) {
  // ... verify signature ...

  switch (event) {
    // Case A: App Uninstalled from Account
    case "installation":
      if (data.action === "deleted") {
        // 1. Delete collaborators linked to this installation
        await db.delete(collaboratorTable).where(
          eq(collaboratorTable.installationId, data.installation.id)
        );
        
        // 2. Delete installation tokens
        await db.delete(githubInstallationTokenTable).where(...)
        
        // 3. Clear file cache for the entire account
        await clearFileCache(accountLogin);
      }
      break;

    // Case B: Repositories Removed from Installation
    case "installation_repositories":
      if (data.action === "removed") {
        // 1. Remove collaborators for specific repos
        await db.delete(collaboratorTable).where(...)
        
        // 2. Clear cache for specific repos
        await clearFileCache(owner, repoName);
      }
      break;
  }
}
```

---

## 6. Displaying Installations (UI)

### `components/installations.tsx`
Renders the list of connected accounts/installations.

```tsx
const Installations = () => {
  const { user } = useUser(); // Access data from Layout -> Context

  return (
    <ul>
      {user.accounts.map(account => (
        <li key={account.login}>
          {/* Account Info */}
          <img src={`https://github.com/${account.login}.png`} ... />
          <span>{account.login}</span>

          {/* Link to Manage on GitHub */}
          <a href={`https://github.com/settings/installations/${account.installationId}`}>
            Manage <ArrowUpRight />
          </a>
        </li>
      ))}
    </ul>
  );
};
```

---

## Summary of Data Flow

1.  **Action:** User clicks "Install" → `lib/actions/app.ts` redirects to GitHub.
2.  **External:** User performs installation on GitHub.
3.  **Read:** App immediately sees the installation via `lib/utils/accounts.ts` calling `octokit.rest.apps.listInstallationsForAuthenticatedUser`.
4.  **Write (Cleanup):** If (and only if) the user *removes* the app, the Webhook (`app/api/webhook/github/route.ts`) acts to clean up the local database.

This architecture avoids data synchronization issues (like "webhook didn't arrive so dashboard is empty") by reading the "source of truth" (GitHub API) directly for the list of installations.
