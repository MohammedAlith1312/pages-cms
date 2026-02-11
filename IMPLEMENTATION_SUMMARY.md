# Implementation Summary: GitHub Issues Integration in Rich Text Editor

This document summarizes the changes and features implemented to integrate GitHub Issues management directly into the rich text editor of the Pages CMS.

## 1. Feature Overview

The goal was to allow content creators to easily create, view, and manage GitHub issues directly from the content editor, linking specific text to issues.

## 2. Key Components Implemented

### A. Rich Text Editor Integration (`fields/core/rich-text/edit-component.tsx`)

*   **Bubble Menu Integration**: Added a context-aware menu that appears when selecting text or clicking an existing issue link.
*   **Issue Creation**: 
    *   Allows users to create a new GitHub issue from selected text.
    *   **Smart Title/Description Logic**:
        *   **With Selection**: Selected text (truncated to 10 chars) becomes the Title. Typed text becomes the Description.
        *   **Without Selection**: First line of typed text becomes Title. Remaining lines become Description.
    *   **Auto-Sizing Textarea**: Implemented a "Grid Stack" solution where a hidden `div` mirrors the `textarea` content to allow it to auto-expand in height while respecting width constraints (`min-w-0`, `w-full`).

### B. Issue Status Management

*   **Real-time Status Sync**: The editor automatically checks the status of linked issues against GitHub.
*   **Visual Indicators**:
    *   **Open Issues**: Displayed as links with a specific class. Bubble menu shows "View" and "Close" buttons.
    *   **Closed Issues**: 
        *   **Automatic Unlinking**: When an issue is detected as closed during sync, the link is automatically removed from the text, allowing the text to be selected again for new issues.
        *   **Manual Closing**: Clicking "Close" in the bubble menu closes the issue on GitHub and immediately removes the link from the editor.
*   **UI Refinements**: Removed the "Reopen" button to simplify the workflow. Closed issues are strictly for history/reference on GitHub, not for reopening from the CMS.

### C. Technical Fixes & Improvements

*   **Selection Tracking**: Added `selectionTick` state and `onSelectionUpdate` to the Tiptap editor to ensure the Bubble Menu UI updates immediately when the cursor moves or selection changes.
*   **Grid Layout Fixes**: Added `min-w-0` and `w-full` to the textarea grid container to prevent layout "blowouts" caused by long, unbroken words.

## 3. Workflow Description

1.  **Select Text**: User selects text in the editor.
2.  **Create Issue**: User types a description/title in the popup and presses `Cmd+Enter` or clicks the send icon.
3.  **Link Created**: The text is turned into a link pointing to the new GitHub issue.
4.  **Manage**:
    *   Clicking the link shows the issue details (Number, Title).
    *   User can click "View" to open it on GitHub.
    *   User can click "Close" to close the issue.
5.  **Close/Resolve**: When an issue is closed (either via the button or externally), the link is removed from the text in the editor.

## 4. API Endpoints

*   **POST** `/api/[owner]/[repo]/[branch]/github-issues`: Creates a new issue.
*   **PATCH** `/api/[owner]/[repo]/[branch]/github-issues`: Updates issue state (close/reopen).
*   **GET** `/api/[owner]/[repo]/[branch]/github-issues`: Fetches current status of issues.
