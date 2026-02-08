# CI/CD and Schema Synchronization Implementation Plan

This document outlines the steps to implement a custom CI/CD pipeline using **GitHub Actions** for the Pages CMS. This setup allows for automatic builds, database migrations, and deployments to hosts that do not support native "zero-config" deployments (like a VPS or dedicated server).

---

## 🏗️ Phase 1: GitHub Actions Configuration

The core of the automation will reside in a workflow file. This file tells GitHub exactly how to build and deploy your application every time you push code.

### 1. Create the Workflow File
Create a file at `.github/workflows/deploy.yml` with the following logical steps:

1.  **Trigger**: Set to run on `push` to the `main` branch.
2.  **Checkout**: Pull the latest code from the repository.
3.  **Setup Node.js**: Install the specific Node version used by the CMS.
4.  **Install Dependencies**: Run `npm install`.
5.  **Build**: Run `npm run build`. This generates the optimized `.next` folder.
6.  **Database Migration**: Run `npm run db:migrate`. (Note: This requires the `DATABASE_URL` secret).
7.  **Deployment**: 
    *   Use an SSH Action (like `appleboy/scp-action`) to transfer the `.next`, `public`, `package.json`, and `node_modules` (or just the first three if you run `npm install` on the server) to your host.
    *   Run a remote command to restart the application (e.g., `pm2 restart all`).

---

## 🔐 Phase 2: Environment Variables & Secrets

To allow GitHub to interact with your server and database safely, you must configure **GitHub Secrets**.

### Steps to configure:
1.  Navigate to your repository on GitHub.
2.  Go to **Settings** > **Secrets and variables** > **Actions**.
3.  Add the following **Repository Secrets**:

| Secret Name | Description |
| :--- | :--- |
| `DATABASE_URL` | Your production PostgreSQL connection string. |
| `AUTH_GITHUB_ID` | Your GitHub OAuth App ID. |
| `AUTH_GITHUB_SECRET` | Your GitHub OAuth App Secret. |
| `REMOTE_HOST` | The IP address or domain of your server. |
| `REMOTE_USER` | The SSH username (e.g., `root` or `deploy`). |
| `SSH_PRIVATE_KEY` | The private key used to access your server via SSH. |

---

## 💾 Phase 3: Database & Schema Synchronization

This CMS uses **Drizzle ORM**. To keep your production database in sync with your code changes:

1.  **Local Change**: Modify `db/schema.ts`.
2.  **Generate Migration**: Run `npm run db:generate` on your local machine.
3.  **Commit**: Commit the new SQL files generated in `db/migrations/` to your repository.
4.  **Automatic Update**: The GitHub Action (from Phase 1) will execute `npm run db:migrate` using the production `DATABASE_URL`, ensuring your live database always matches your code.

---

## 🌐 Phase 4: Server-Side Preparation (VPS)

Before the first deployment, your server needs a one-time setup:

1.  **Install Node.js & NPM**: Ensure the versions match your local environment.
2.  **Install PM2**: Run `npm install -g pm2` to manage the Next.js process and handle auto-restarts.
3.  **Authorize GitHub**: Add the public key corresponding to your `SSH_PRIVATE_KEY` to the server's `~/.ssh/authorized_keys` file.
4.  **Directory Setup**: Create the target folder (e.g., `/var/www/pages-cms`) and ensure your user has write permissions.

---

## ✅ Phase 5: Verification & Testing

1.  **Push a Change**: Commit a small README change and push to `main`.
2.  **Monitor Actions**: Check the **Actions** tab in GitHub to ensure the workflow finishes with a green checkmark.
3.  **Check Live Site**: Verify that the changes are reflected on your server.
4.  **Logs**: If something fails, check the GitHub Action logs or run `pm2 logs` on your server.

---

*Plan Prepared by Antigravity*
