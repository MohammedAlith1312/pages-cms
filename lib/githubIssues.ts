import { createOctokitInstance } from "@/lib/utils/octokit";

export const isRepoCollaborator = async (
    token: string,
    owner: string,
    repo: string,
    username: string
) => {
    try {
        const octokit = createOctokitInstance(token);
        const res = await octokit.rest.repos.checkCollaborator({
            owner,
            repo,
            username,
        });
        // 204 = is a collaborator
        return res.status === 204;
    } catch (err: any) {
        // 404 = not a collaborator, anything else = error
        if (err.status === 404) return false;
        console.error("Auth: Collaborator check error:", err.message);
        return false;
    }
};

export const getIssues = async (
    token: string,
    owner: string,
    repo: string,
    options: { state?: "open" | "closed" | "all"; labels?: string } = {}
) => {
    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        ...options,
    });
    return response.data;
};

export const getIssue = async (
    token: string,
    owner: string,
    repo: string,
    issueNumber: number
) => {
    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
    });
    return response.data;
};

export const createIssue = async (
    token: string,
    owner: string,
    repo: string,
    issue: { title: string; body?: string; labels?: string[] }
) => {
    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.issues.create({
        owner,
        repo,
        ...issue,
    });
    return response.data;
};

export const updateIssue = async (
    token: string,
    owner: string,
    repo: string,
    issueNumber: number,
    issue: { title?: string; body?: string; state?: "open" | "closed"; labels?: string[] }
) => {
    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...issue,
    });
    return response.data;
};

export const createComment = async (
    token: string,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
) => {
    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
    });
    return response.data;
};

export const parseDocsifyIssue = (issue: any) => {
    const body = issue.body || '';
    let extractedText = '';

    const contextMatch = body.match(/\*\*(?:Selected Context|Selected Text|Selected Image):\*\*\n(>\s*|)(.*)/i);
    if (contextMatch) {
        extractedText = contextMatch[2].trim();
    } else {
        if (body.includes('**Selected Text:**\n> ')) extractedText = body.split('**Selected Text:**\n> ')[1]?.split('\n')[0]?.trim();
        else if (body.includes('**Selected Image:**\n')) extractedText = body.split('**Selected Image:**\n')[1]?.split('\n')[0]?.trim();
    }

    const urlMatch = body.match(/(?:\*\*URL:\*\*|URL:)[\s\r\n]*(http[^\s]+)/i);
    const pageUrl = urlMatch ? urlMatch[1].trim() : '';

    return {
        id: `issue-${issue.id}`,
        issueNumber: issue.number,
        title: issue.title,
        body: body,
        url: issue.html_url,
        pageUrl: pageUrl,
        selectedText: extractedText || 'No direct text reference',
        state: (issue.state || 'open').toLowerCase(),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
    };
};
