# User Content Repository: Automatic Build & Deploy Plan

This plan explains how to set up the **user's content repository** so that whenever they save changes using the Pages CMS, their live website automatically rebuilds and redeploys.

---

## 🏗️ 1. The Workflow Concept

The Pages CMS works by committing files directly to the user's GitHub repository. To automate the "Live Website," we use a GitHub Action inside **that same user repository**.

1.  **Action**: User clicks "Save" in the CMS dashboard.
2.  **Trigger**: CMS pushes a commit (e.g., `Update blog-post.md`) to the user's repo.
3.  **Process**: GitHub sees the new commit and starts a **build workflow**.
4.  **Result**: The workflow generates the static site and pushes it to the hosting provider.

---

## 📄 2. Creating the Workflow File

In the user's repository (e.g., the Astro or Hugo project), create a file at `.github/workflows/production-deploy.yml`.

### Example Logic for different frameworks:

| Framework | Build Command | Output Folder |
| :--- | :--- | :--- |
| **Astro** | `npm run build` | `dist/` |
| **Hugo** | `hugo --minify` | `public/` |
| **Next.js (SSG)** | `npm run build` | `out/` |
| **Jekyll** | `jekyll build` | `_site/` |

---

## 🚀 3. Deployment Destinations

The workflow must include a "Deploy" step based on where the user's site is hosted:

### A. If using GitHub Pages
The workflow uses the `actions/deploy-pages` action. No external keys are needed.

### B. If using a VPS (Basic Host)
The workflow uses SSH (SCP/RSYNC) to copy the static folder to the server:
- Needs Secret: `SSH_PRIVATE_KEY`
- Needs Secret: `SERVER_IP`

### C. If using AWS S3 / Netlify / Cloudflare
The workflow uses the official CLI for those platforms (e.g., `netlify-cli` or `aws s3 sync`).

---

## 🔑 4. Key Requirement: Triggering the Action

By default, when the CMS commits to the repo, GitHub Actions will trigger. However, there are two important details:

1.  **Personal Access Token (PAT)**: If the CMS uses a standard PAT to commit, the workflow will trigger normally.
2.  **GITHUB_TOKEN limitation**: If the CMS were using the repository's internal `GITHUB_TOKEN`, it would **not** trigger other actions (to prevent infinite loops). **Pages CMS uses OAuth/App tokens, so it will trigger the build correctly.**

---

## 🛠️ 5. Implementation Steps for the User

1.  **Identify Framework**: Determine which static site generator the user's repo uses.
2.  **Add Workflow**: Place the appropriate `.yml` file in their `.github/workflows/` folder.
3.  **Add Secrets**: If deploying to a non-GitHub host, add the necessary API keys or SSH keys to the **User Repo Settings**.
4.  **Test**: Save a file in the CMS and watch the "Actions" tab in the user's repository start the build.

## ⚙️ 6. Managing CI/CD via CMS Schema (Optional)

You can allow users to edit their own deployment logic directly from the CMS dashboard by adding the workflow file to your `pages-cms.json` configuration.

### Schema Configuration Example:
Add this to the `content` array in your configuration file:

```json
{
  "name": "deployment_settings",
  "label": "🚀 Build & Deploy Settings",
  "type": "file",
  "path": ".github/workflows/production-deploy.yml",
  "fields": [
    {
      "name": "workflow_code",
      "label": "Workflow YAML",
      "type": "code",
      "language": "yaml",
      "description": "Edit the GitHub Action code here to change how your site builds and deploys."
    }
  ]
}
```

### 💡 Why use this?
*   **No Code Access Needed**: Users can tweak build steps or change deployment folders without opening VS Code or Terminal.
*   **Centralized Control**: Keep all project settings (Content, Media, and now Deployment) in one dashboard.
*   **Real-time Updates**: Saving via the CMS writes the file to the repo, which can immediately trigger a new build with the updated logic.

> **CRITICAL SECURITY NOTE**: To edit files in the `.github/` directory, the GitHub OAuth App or Personal Access Token must have the **`workflow`** scope enabled. Without this scope, GitHub will reject any attempt to save changes to this file via the CMS.

---

*Plan Prepared by Antigravity*
