import type { RestEndpointMethodTypes } from '@octokit/rest';

// Shared business logic types
export interface Suggestion {
  type: string;
  section: string;
  description: string;
  priority: string;
  content: string;
}

export interface AnalysisOptions {
  repoName?: string;
  prTitle?: string;
  prDescription?: string;
  changedFiles?: string[];
}

export interface AnalysisResult {
  needsUpdate: boolean;
  suggestions: Suggestion[];
  error?: string;
}

// GitHub client types
export type IssueComment = RestEndpointMethodTypes['issues']['createComment']['response']['data'];
export type Review = RestEndpointMethodTypes['pulls']['createReview']['response']['data'];

export interface CommitResult {
  commit: any;
  content: any;
  suggestions: number;
  url: string;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
}

export interface GitHubEnvironment {
  owner: string;
  repo: string;
  pullNumber: number;
  event: any;
}

export interface ProcessedPullRequestData {
  title: string;
  body: string;
  number: number;
  state: string;
  baseBranch: string;
  headBranch: string;
  author: string;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch: string | undefined;
    sha: string;
  }>;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
  }>;
  changedFiles: string[];
}