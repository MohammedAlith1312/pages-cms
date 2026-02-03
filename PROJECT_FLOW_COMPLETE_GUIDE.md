# Pages CMS - Complete Step-by-Step Flow Guide

This document provides a comprehensive breakdown of how the Pages CMS project works from start to finish.

---

## 📋 Table of Contents

1. [Initial Setup & Configuration](#1-initial-setup--configuration)
2. [User Authentication Flow](#2-user-authentication-flow)
3. [GitHub App Installation](#3-github-app-installation)
4. [Repository Connection](#4-repository-connection)
5. [Configuration Loading](#5-configuration-loading)
6. [Content Management](#6-content-management)
7. [Cache System](#7-cache-system)
8. [Media Management](#8-media-management)
9. [Collaborator System](#9-collaborator-system)
10. [Webhook Processing](#10-webhook-processing)
11. [Cron Jobs](#11-cron-jobs)
12. [Complete Request Flow](#12-complete-request-flow)

---

## 1. Initial Setup & Configuration

### Step 1.1: Environment Setup
```bash
# Required environment variables
DATABASE_URL              # PostgreSQL connection string
CRYPTO_KEY               # Encryption key for GitHub tokens
GITHUB_APP_ID            # GitHub App ID
GITHUB_APP_NAME          # GitHub App machine name
GITHUB_APP_PRIVATE_KEY   # PEM private key
GITHUB_APP_WEBHOOK_SECRET # Webhook validation secret
GITHUB_APP_CLIENT_ID     # OAuth client ID
GITHUB_APP_CLIENT_SECRET # OAuth client secret
RESEND_API_KEY          # Email service API key
RESEND_FROM_EMAIL       # Sender email address
CRON_SECRET            # Cron job authorization token
FILE_CACHE_TTL         # Cache TTL in minutes (default: 1440)
PERMISSION_CACHE_TTL   # Permission cache TTL in minutes (default: 60)
```

### Step 1.2: Database Migration
```bash
npm run db:migrate
```

**What happens:**
- Creates 8 PostgreSQL tables via Drizzle ORM:
  - `user` - User accounts
  - `session` - Authentication sessions
  - `github_user_token` - Encrypted user OAuth tokens
  - `github_installation_token` - App installation tokens
  - `email_login_token` - Email-based login tokens
  - `collaborator` - Repository collaborators
  - `config` - CMS configuration cache
  - `cache_file` - File content cache
  - `cache_permission` - Repository permission cache

### Step 1.3: Server Startup
```bash
npm run dev  # Development
npm run build && npm start  # Production
```

**What happens:**
- Next.js server starts on port 3000
- Middleware activates for CSRF protection
- API routes become available
- SSR/Static pages are ready

---

## 2. User Authentication Flow

### Step 2.1: User Visits Sign-In Page
**Route:** `/sign-in`  
**File:** `app/(auth)/sign-in/page.tsx`

**What happens:**
1. User clicks "Sign in with GitHub"
2. System generates OAuth state token
3. Redirects to GitHub OAuth authorization

### Step 2.2: GitHub OAuth Authorization
**GitHub URL:** `https://github.com/login/oauth/authorize`

**Parameters:**
- `client_id` - Your GitHub App client ID
- `state` - CSRF protection token
- `redirect_uri` - `/api/auth/github`

**What happens:**
1. User authorizes the GitHub App
2. GitHub redirects back with `code` and `state`

### Step 2.3: OAuth Callback Processing
**Route:** `GET /api/auth/github`  
**File:** `app/api/auth/github/route.ts`

**Step-by-step process:**

```typescript
1. Validate state parameter (CSRF protection)
   ↓
2. Exchange code for access token
   ↓
3. Fetch user info from GitHub API
   ↓
4. Encrypt access token with CRYPTO_KEY
   ↓
5. Check if user exists in database
   ↓
   YES → Update token in github_user_token table
   NO  → Create new user + token records
   ↓
6. Create Lucia session
   ↓
7. Set session cookie
   ↓
8. Redirect to homepage
```

**Database changes:**
```sql
-- New user
INSERT INTO user (id, github_id, github_username, github_email, github_name);
INSERT INTO github_user_token (ciphertext, iv, user_id);
INSERT INTO session (id, expires_at, user_id);

-- Existing user
UPDATE github_user_token SET ciphertext=?, iv=? WHERE user_id=?;
INSERT INTO session (id, expires_at, user_id);
```

---

## 3. GitHub App Installation

### Step 3.1: User Installs GitHub App
**Action:** User installs the GitHub App on their account/org

**What happens:**
1. GitHub sends webhook to `/api/webhook/github`
2. Event type: `installation`
3. CMS receives installation details

### Step 3.2: Select Repositories
**Action:** User selects which repositories to grant access

**What happens:**
1. GitHub sends `installation_repositories` webhook
2. CMS caches installation ID and repository info
3. Tokens are stored encrypted in database

---

## 4. Repository Connection

### Step 4.1: Homepage - Repository Selection
**Route:** `/`  
**File:** `app/(main)/page.tsx`

**What happens:**
1. Fetch user's GitHub installations via API
2. Display list of accessible repositories
3. User clicks on a repository

### Step 4.2: Branch Selection
**Route:** `/[owner]/[repo]`  
**File:** `app/(main)/[owner]/[repo]/page.tsx`

**What happens:**
1. Fetch branches from GitHub API
2. Display list of branches
3. User selects a branch (usually `main`)

### Step 4.3: Dashboard Loading
**Route:** `/[owner]/[repo]/[branch]`  
**File:** `app/(main)/[owner]/[repo]/[branch]/page.tsx`

**Step-by-step:**
```typescript
1. Validate user permissions
   ↓
2. Get installation token for this repo
   ↓
3. Load .pages.yml configuration file
   ↓
4. Parse and validate configuration
   ↓
5. Cache configuration in database
   ↓
6. Display dashboard with:
   - Collections (content types)
   - Media folders
   - Files
```

---

## 5. Configuration Loading

### Step 5.1: Fetch Configuration File
**File:** `lib/config.ts` → `getConfig()`

**Process:**
```typescript
1. Check config cache in PostgreSQL
   ↓
   CACHE HIT → Return cached config
   ↓
   CACHE MISS → Continue
   ↓
2. Fetch .pages.yml from GitHub
   ↓
3. Parse YAML content
   ↓
4. Validate against schema (Zod)
   ↓
5. Cache in config table with SHA
   ↓
6. Return parsed configuration
```

### Step 5.2: Configuration Schema
**File:** `lib/configSchema.ts`

**Structure:**
```yaml
# .pages.yml
title: My Website
description: CMS for my static site

collections:
  - name: posts
    label: Blog Posts
    path: content/posts
    format: md
    fields:
      - { name: title, type: string, required: true }
      - { name: date, type: date }
      - { name: content, type: rich-text }

media:
  - name: images
    label: Images
    path: static/images

files:
  - name: config
    label: Site Config
    file: config.json
```

---

## 6. Content Management

### Step 6.1: Viewing a Collection
**Route:** `/[owner]/[repo]/[branch]/collection/[name]`  
**File:** `app/(main)/[owner]/[repo]/[branch]/collection/[name]/page.tsx`

**Process:**
```typescript
1. Load collection configuration
   ↓
2. Get collection path from config (e.g., content/posts)
   ↓
3. Fetch directory contents:
   a. Check cache_file table for entries
   b. If expired/missing → Fetch from GitHub GraphQL
   c. Cache results in PostgreSQL
   ↓
4. Parse frontmatter from each file
   ↓
5. Display in table view with filters/sorting
```

### Step 6.2: Creating New Content
**Route:** `/[owner]/[repo]/[branch]/collection/[name]/new`  
**File:** `app/(main)/[owner]/[repo]/[branch]/collection/[name]/new/page.tsx`

**Step-by-step:**
```typescript
1. Load collection field configuration
   ↓
2. Render dynamic form based on field types:
   - string → Text input
   - rich-text → TipTap editor
   - date → Date picker
   - image → Media selector
   - select → Dropdown
   - etc.
   ↓
3. User fills out form
   ↓
4. On submit → Call API endpoint
```

### Step 6.3: Saving Content via API
**Route:** `POST /api/[owner]/[repo]/[branch]/entries/[path]`  
**File:** `app/api/[owner]/[repo]/[branch]/entries/[path]/route.ts`

**Complete save process:**
```typescript
1. Validate user permissions
   ↓
2. Get installation token
   ↓
3. Serialize form data to frontmatter + content
   ↓
4. Create commit on GitHub:
   a. Get current file SHA (if updating)
   b. Encode content as base64
   c. Create/update file via GitHub API
   ↓
5. Update cache_file table:
   a. Insert/update file entry
   b. Store content, SHA, commit info
   c. Update parent folder cache
   ↓
6. Return success response
```

**GitHub API call:**
```typescript
await octokit.rest.repos.createOrUpdateFileContents({
  owner,
  repo,
  path: 'content/posts/my-post.md',
  message: 'Create my-post.md',
  content: base64Content,
  sha: existingSha,  // For updates
  branch
});
```

### Step 6.4: Editing Existing Content
**Route:** `/[owner]/[repo]/[branch]/collection/[name]/edit/[path]`  
**File:** `app/(main)/[owner]/[repo]/[branch]/collection/[name]/edit/[path]/page.tsx`

**Process:**
```typescript
1. Load file from cache or GitHub
   ↓
2. Parse frontmatter and content
   ↓
3. Pre-fill form with existing data
   ↓
4. User edits → Submit → Same save process as new content
```

### Step 6.5: Deleting Content
**API:** `DELETE /api/[owner]/[repo]/[branch]/entries/[path]`

**Process:**
```typescript
1. Get file SHA from GitHub
   ↓
2. Delete file via GitHub API
   ↓
3. Remove from cache_file table
   ↓
4. Update parent folder cache
```

---

## 7. Cache System

### Step 7.1: Cache Architecture

**Three-tier caching:**
```
1. PostgreSQL Database Cache (persistent)
   ↓
2. Client-side Image Cache (30-second TTL)
   ↓
3. Configuration Cache (file-based)
```

### Step 7.2: File Cache Flow
**File:** `lib/githubCache.ts`

**Get Collection Cache:**
```typescript
function getCollectionCache(owner, repo, branch, dirPath, token)
  ↓
1. Query cache_file table
   WHERE owner=? AND repo=? AND branch=? AND parentPath=?
   ↓
2. Check if cache exists and is fresh
   ↓
   CACHE VALID → Return cached entries
   ↓
   CACHE EXPIRED/MISSING:
   ↓
3. Fetch from GitHub GraphQL API:
   query {
     repository(owner:, name:) {
       object(expression: "branch:path") {
         ... on Tree {
           entries {
             name, path, type
             object { ... on Blob { text, oid, byteSize } }
           }
         }
       }
     }
   }
   ↓
4. Insert into cache_file table
   ↓
5. Return entries
```

### Step 7.3: Cache Invalidation

**Triggered by webhooks:**
```typescript
// Push event
Webhook receives commit data
  ↓
Extract added, modified, removed files
  ↓
Update cache_file entries:
  - DELETE removed files
  - UPSERT modified files
  - INSERT new files
  ↓
Update parent folder caches
```

### Step 7.4: Permission Cache
**File:** `lib/githubCache.ts` → `checkRepoAccess()`

**Process:**
```typescript
1. Check cache_permission table
   WHERE github_id=? AND owner=? AND repo=?
   AND last_updated > (NOW - PERMISSION_CACHE_TTL)
   ↓
   CACHE HIT → Return true
   ↓
   CACHE MISS:
   ↓
2. Call GitHub API: repos.get()
   ↓
   SUCCESS → Insert into cache_permission
   ↓
   FAILURE → Return false and deny access
```

---

## 8. Media Management

### Step 8.1: Media Folder View
**Route:** `/[owner]/[repo]/[branch]/media/[name]`  
**File:** `app/(main)/[owner]/[repo]/[branch]/media/[name]/page.tsx`

**Process:**
```typescript
1. Get media configuration from .pages.yml
   ↓
2. Fetch directory from cache or GitHub REST API
   ↓
3. Display files with:
   - Thumbnails (for images)
   - File names
   - Upload button
```

### Step 8.2: Media Upload
**Component:** `components/media/media-upload.tsx`

**Upload process:**
```typescript
1. User selects file(s)
   ↓
2. Read file as base64
   ↓
3. POST to /api/[owner]/[repo]/[branch]/media/[name]/[path]
   ↓
4. Create file on GitHub:
   octokit.repos.createOrUpdateFileContents({
     content: base64Data,
     message: 'Upload image.jpg'
   })
   ↓
5. Update cache_file table (context: 'media')
   ↓
6. Return download URL
```

### Step 8.3: Image URL Resolution
**File:** `lib/githubImage.ts`

**For private repositories:**
```typescript
function getRawUrl(owner, repo, branch, path, isPrivate)
  ↓
  if PUBLIC:
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  ↓
  if PRIVATE:
    1. Get parent folder from cache
    2. Find file's download URL
    3. Return temp authenticated URL
```

---

## 9. Collaborator System

### Step 9.1: Invite Collaborator
**Route:** `/[owner]/[repo]/[branch]/collaborators`  
**Component:** `components/collaborators.tsx`

**Process:**
```typescript
1. User enters collaborator email
   ↓
2. Generate unique token
   ↓
3. Insert into collaborator table
   ↓
4. Send invitation email via Resend
   ↓
5. Email contains link: /sign-in/collaborator/[token]
```

### Step 9.2: Accept Invitation
**Route:** `/sign-in/collaborator/[token]`  
**File:** `app/(auth)/sign-in/collaborator/[token]/page.tsx`

**Process:**
```typescript
1. Validate token in collaborator table
   ↓
2. User signs in with GitHub
   ↓
3. Link user_id to collaborator record
   ↓
4. Grant access to repository
```

### Step 9.3: Access Control
**Every API request:**
```typescript
1. Check if user owns the repository
   OR
2. Check if user is in collaborator table for this repo
   ↓
   AUTHORIZED → Proceed
   ↓
   UNAUTHORIZED → Return 403
```

---

## 10. Webhook Processing

### Step 10.1: Webhook Receipt
**Route:** `POST /api/webhook/github`  
**File:** `app/api/webhook/github/route.ts`

**Security validation:**
```typescript
1. Extract X-Hub-Signature-256 header
   ↓
2. Compute HMAC SHA-256 of request body
   ↓
3. Compare with signature
   ↓
   MATCH → Process webhook
   ↓
   MISMATCH → Return 403
```

### Step 10.2: Event Processing

**Supported events:**

#### Event: `installation` (deleted)
```typescript
Action: App uninstalled
  ↓
1. DELETE FROM collaborator WHERE installation_id=?
2. DELETE FROM github_installation_token WHERE installation_id=?
3. Clear file cache for account
```

#### Event: `repository` (deleted)
```typescript
Action: Repository deleted
  ↓
1. DELETE FROM collaborator WHERE repo_id=?
2. Clear file cache for owner/repo
```

#### Event: `repository` (renamed)
```typescript
Action: Repository renamed
  ↓
1. UPDATE collaborator SET repo=new_name WHERE repo_id=?
2. UPDATE cache_file SET repo=new_name WHERE owner=? AND repo=old_name
```

#### Event: `push`
```typescript
Action: Files changed
  ↓
1. Extract from commits:
   - added files
   - modified files
   - removed files
   ↓
2. Get installation token
   ↓
3. Batch fetch file contents via GraphQL
   ↓
4. Update cache_file table:
   - DELETE removed files
   - UPSERT added/modified files
   ↓
5. Update parent folder caches
```

**GraphQL batch query example:**
```graphql
query($owner: String!, $repo: String!, 
      $exp0: String!, $exp1: String!) {
  repository(owner: $owner, name: $repo) {
    file0: object(expression: $exp0) {
      ... on Blob { text oid byteSize }
    }
    file1: object(expression: $exp1) {
      ... on Blob { text oid byteSize }
    }
  }
}
```

---

## 11. Cron Jobs

### Step 11.1: Vercel Cron Configuration
**File:** `vercel.json`

```json
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "0 0 * * *"  // Daily at midnight UTC
  }]
}
```

### Step 11.2: Cron Execution
**Route:** `GET /api/cron`  
**File:** `app/api/cron/route.ts`

**Process:**
```typescript
1. Validate Authorization header
   Bearer ${CRON_SECRET}
   ↓
2. Calculate expiry dates:
   fileExpiry = NOW - FILE_CACHE_TTL
   permissionExpiry = NOW - PERMISSION_CACHE_TTL
   ↓
3. Delete expired file cache:
   DELETE FROM cache_file
   WHERE last_updated < fileExpiry
   ↓
4. Delete expired permission cache:
   DELETE FROM cache_permission
   WHERE last_updated < permissionExpiry
   ↓
5. Run PostgreSQL VACUUM:
   VACUUM cache_file;
   VACUUM cache_permission;
   ↓
6. Return deletion counts
```

---

## 12. Complete Request Flow

### Example: User Creates a New Blog Post

**Step-by-step complete flow:**

```
1. USER ACTION
   User navigates to /owner/repo/main/collection/posts/new
   ↓

2. AUTHENTICATION CHECK
   Middleware validates session cookie
   Layout checks: session exists?
   → YES: Continue
   → NO: Redirect to /sign-in
   ↓

3. PERMISSION CHECK
   API checks:
   - Is user the repo owner? OR
   - Is user a collaborator?
   → YES: Continue
   → NO: Return 403
   ↓

4. CONFIGURATION LOADING
   getConfig(owner, repo, branch)
   → Check config cache table
   → If missing: Fetch .pages.yml from GitHub
   → Parse and validate YAML
   → Cache in database
   ↓

5. RENDER FORM
   Load "posts" collection config
   Generate form fields dynamically:
   - Title (string input)
   - Date (date picker)
   - Content (rich text editor)
   ↓

6. USER FILLS FORM
   User enters:
   - Title: "My First Post"
   - Date: 2026-02-03
   - Content: "Hello world..."
   ↓

7. SUBMIT FORM
   POST /api/owner/repo/main/entries/content/posts/my-first-post.md
   Body: { title, date, content }
   ↓

8. API PROCESSING
   a. Get installation token from github_installation_token
      (decrypt with CRYPTO_KEY)
   
   b. Serialize to markdown:
      ---
      title: My First Post
      date: 2026-02-03
      ---
      Hello world...
   
   c. Create file on GitHub:
      octokit.repos.createOrUpdateFileContents({
        path: 'content/posts/my-first-post.md',
        content: base64(markdown),
        message: 'Create my-first-post.md'
      })
   
   d. Update cache:
      INSERT INTO cache_file (
        context: 'collection',
        path: 'content/posts/my-first-post.md',
        content: markdown,
        sha: commitSha
      )
   
   e. Update parent cache:
      Ensure 'content' and 'content/posts' dirs exist
   ↓

9. GITHUB WEBHOOK (5-10 seconds later)
   GitHub sends push webhook
   → Extract: added=['content/posts/my-first-post.md']
   → Update cache_file (already done by API, so may skip)
   → Cache stays synchronized
   ↓

10. REDIRECT USER
    Redirect to /owner/repo/main/collection/posts
    Shows newly created post in list
    ↓

11. STATIC SITE BUILD (External)
    User's static site generator (Jekyll/Hugo/Next.js)
    runs on GitHub Actions
    Reads new file and rebuilds site
```

---

## 🔄 Architecture Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ HTTPS
       ↓
┌─────────────────────────────────────────┐
│         Next.js Application              │
│  ┌────────────────────────────────────┐ │
│  │  Middleware (CSRF Protection)      │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌──────────────┐   ┌────────────────┐ │
│  │   Pages      │   │   API Routes   │ │
│  │   (SSR)      │   │   (REST)       │ │
│  └──────────────┘   └────────────────┘ │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │   Server Actions & Utilities     │   │
│  │   - lib/auth.ts                  │   │
│  │   - lib/config.ts                │   │
│  │   - lib/githubCache.ts           │   │
│  │   - lib/schema.ts                │   │
│  └─────────────────────────────────┘   │
└──────────┬───────────────┬──────────────┘
           │               │
           ↓               ↓
    ┌──────────┐    ┌──────────────┐
    │   Drizzle│    │   Octokit    │
    │    ORM   │    │  (GitHub API)│
    └─────┬────┘    └──────┬───────┘
          │                │
          ↓                ↓
    ┌──────────┐    ┌──────────────┐
    │PostgreSQL│    │   GitHub     │
    │ Database │    │   Servers    │
    └──────────┘    └──────────────┘
```

---

## 🗄️ Database Schema Flow

```
User Sign-In
    ↓
user table ──→ session table
    │              (expires_at)
    ├──→ github_user_token table
    │       (encrypted)
    └──→ collaborator table

Repository Access
    ↓
github_installation_token table
    (auto-refreshed)
    ↓
cache_permission table
    (60-min TTL)

Content Caching
    ↓
config table ──→ cache_file table
 (.pages.yml)      (24-hour TTL)
                   (context: collection|media)
```

---

## 🔐 Security Layers

1. **Authentication:** Lucia + GitHub OAuth
2. **Authorization:** Per-repo permission checks
3. **CSRF Protection:** Middleware origin validation
4. **Token Encryption:** AES-256-GCM encryption
5. **Webhook Validation:** HMAC SHA-256 signatures
6. **Cron Authorization:** Bearer token validation
7. **Rate Limiting:** GitHub API rate limits (5000/hour)

---

## ⚡ Performance Optimizations

1. **PostgreSQL Caching:** Reduces GitHub API calls by 90%+
2. **GraphQL Batching:** Fetches multiple files in one request
3. **Configuration Caching:** Avoids re-parsing YAML
4. **Permission Caching:** Reduces auth checks
5. **Webhook Updates:** Real-time cache invalidation
6. **VACUUM Jobs:** Maintains database performance

---

## 📊 Monitoring Points

1. **Cache Hit Rate:** Monitor cache_file table queries
2. **GitHub API Usage:** Track rate limit headers
3. **Webhook Processing:** Log all webhook events
4. **Authentication Failures:** Monitor 401/403 responses
5. **Cron Job Success:** Verify daily cleanup runs
6. **Database Size:** Monitor cache table growth

---

## 🎯 Key Takeaways

- **PostgreSQL** is the core caching layer, NOT just for auth
- **GraphQL** is used for batch file fetching, not as an API layer
- **Webhooks** ensure real-time cache synchronization
- **Encryption** protects sensitive GitHub tokens
- **Drizzle ORM** manages all database interactions
- **Next.js App Router** provides SSR and API routes
- **Lucia Auth** handles session management
- **Arctic** manages OAuth flows

---

## 🚀 Development vs Production

### Development
- Local PostgreSQL or remote (Neon/Supabase)
- ngrok for webhook testing
- Hot reload with `npm run dev`
- Verbose logging enabled

### Production (Vercel)
- Vercel PostgreSQL or Supabase
- Public webhook endpoint
- Optimized builds
- Cron jobs automatically scheduled
- Edge functions for API routes

---

This guide covers the complete architecture and flow of the Pages CMS project. Each component works together to provide a seamless, performant content management experience backed by GitHub.
