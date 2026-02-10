# GitHub Issues Architectural & Structural Flow

This document details the architecture and logic flow for creating, managing, and synchronizing GitHub issues within the Rich Text Editor.

---

## 1. System Architecture

```text
+------------------------+      +---------------------------+      +-------------------------+
|     USER INTERFACE     |      |      NEXT.JS BACKEND      |      |      EXTERNAL API       |
|  (Rich Text Editor)    |      |      (Route Handler)      |      |      (GitHub REST)      |
+-----------+------------+      +-------------+-------------+      +------------+------------+
            |                                 |                                 |
            |  HTTP POST / GET / PATCH        |       Octokit (GitHub App)      |
            +-------------------------------> |  +----------------------------> |
            |      (JSON Payload)             |       (Bearer Token Auth)       |
            |                                 |                                 |
            | <-------------------------------+ | <-----------------------------+
            |      (Success/Error)            |       (Issue Data JSON)         |
            |                                 |                                 |
```

---

## 2. Structural Interaction Flows

### A. Creating a New Issue
When a user marks a bug for a specific text selection.

```text
1. [ UI ]       User selects text -> Clicks Bug Icon -> Enters Title
2. [ EDITOR ]   Captures selection & sends payload to /api/.../github-issues
3. [ BACKEND ]  Validates session -> Fetches GitHub App Token -> Calls createIssue()
4. [ GITHUB ]   Processes request -> Returns new Issue Number & URL
5. [ BACKEND ]  Returns high-level Success object to Editor
6. [ EDITOR ]   Wraps selection in <a class="gh-issue-link"> with data attributes
7. [ UI ]       Displays Highlight (Green + Bug Icon)
```

### B. Closing an Issue
When a user resolves a bug directly from the context bubble.

```text
1. [ UI ]       User clicks 🐞 link -> Clicks "Close Issue"
2. [ EDITOR ]   Optimistically changes state to "closed" & styling to grayscale
3. [ BACKEND ]  Sends PATCH to /github-issues with { state: 'closed' }
4. [ GITHUB ]   Updates remote issue status
5. [ BACKEND ]  Confirms update success
6. [ EDITOR ]   Triggers background sync to reconcile final state
```

### C. Background Sync (State Persistence)
Triggered on page load or when the window regains focus.

```text
1. [ EDITOR ]   Scans doc for nodes with [data-issue-number]
2. [ EDITOR ]   Batches IDs -> GET /github-issues?numbers=101,102...
3. [ BACKEND ]  Queries GitHub for current state of all IDs
4. [ BACKEND ]  Returns array of { number, state, title }
5. [ EDITOR ]   Iterates through document nodes
6. [ EDITOR ]   If state is 'closed': Apply grayscale/strikethrough class
7. [ EDITOR ]   If state is 'open'  : Apply green highlight class
```

---

## 3. Data Schema (HTML Persistence)

This metadata is what allows the highlights to "stay" after you refresh the page.

| Component | Responsibility |
| :--- | :--- |
| `data-issue-number` | Core identifier for the remote issue. |
| `data-issue-state` | Determines styling (rendered as 'open' or 'closed'). |
| `class="gh-issue-link"` | Standard CSS trigger for the 🐞 icon and highlight. |
| `href` | Link back to the GitHub web interface. |

---

## 4. CSS Stylistic Flow

```text
[ data-issue-state="open" ]   ===>  Green Background + Normal Text + 🐞 Icon
[ data-issue-state="closed" ] ===>  Muted Gray + Strikethrough + 🐞 Icon (Low Opacity)
```
