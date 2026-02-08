import { createOctokitInstance } from "@/lib/utils/octokit";

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
