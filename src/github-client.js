const { Octokit } = require('@octokit/rest');
const { getConfig } = require('./config');

class GitHubClient {
  constructor() {
    const config = getConfig();
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || config.github.token,
    });
  }

  async getPullRequestData(owner, repo, pullNumber) {
    try {
      const [prResponse, filesResponse, commitsResponse] = await Promise.all([
        this.octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
        this.octokit.pulls.listFiles({ owner, repo, pull_number: pullNumber }),
        this.octokit.pulls.listCommits({ owner, repo, pull_number: pullNumber })
      ]);

      const pr = prResponse.data;
      const files = filesResponse.data;
      const commits = commitsResponse.data;

      return {
        title: pr.title,
        body: pr.body || '',
        number: pr.number,
        state: pr.state,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        author: pr.user.login,
        files: files.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch,
          sha: file.sha
        })),
        commits: commits.map(commit => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author.name
        })),
        changedFiles: files.map(f => f.filename)
      };
    } catch (error) {
      throw new Error(`Failed to fetch PR data: ${error.message}`);
    }
  }

  async getCurrentReadme(owner, repo, ref = 'main') {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'README.md',
        ref
      });

      if (response.data.type !== 'file') {
        throw new Error('README.md is not a file');
      }

      return Buffer.from(response.data.content, 'base64').toString('utf8');
    } catch (error) {
      if (error.status === 404) {
        return ''; // No README exists
      }
      throw new Error(`Failed to fetch README.md: ${error.message}`);
    }
  }

  async getDiffContent(owner, repo, pullNumber) {
    try {
      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        headers: {
          accept: 'application/vnd.github.diff'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch PR diff: ${error.message}`);
    }
  }

  async createComment(owner, repo, pullNumber, body) {
    try {
      const response = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }

  async createReview(owner, repo, pullNumber, body, event = 'COMMENT') {
    try {
      const response = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        event
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create review: ${error.message}`);
    }
  }

  async updateComment(owner, repo, commentId, body) {
    try {
      const response = await this.octokit.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to update comment: ${error.message}`);
    }
  }

  async findExistingComment(owner, repo, pullNumber, commentMarker = '<!-- README-BOT -->') {
    try {
      const response = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: pullNumber
      });

      return response.data.find(comment => 
        comment.body && comment.body.includes(commentMarker)
      );
    } catch (error) {
      console.warn('Failed to find existing comment:', error.message);
      return null;
    }
  }

  parseRepositoryUrl(url) {
    // Handle various GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)$/,
      /github\.com\/([^\/]+)\/([^\/]+)\.git$/,
      /github\.com\/([^\/]+)\/([^\/]+)\/$/,
      /^([^\/]+)\/([^\/]+)$/ // owner/repo format
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace('.git', '')
        };
      }
    }

    throw new Error(`Invalid GitHub repository URL: ${url}`);
  }

  static fromEnvironment() {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const repository = process.env.GITHUB_REPOSITORY;
    
    if (!eventPath || !repository) {
      throw new Error('GitHub environment variables not found');
    }

    const [owner, repo] = repository.split('/');
    
    try {
      const event = require(eventPath);
      const pullNumber = event.pull_request?.number;
      
      if (!pullNumber) {
        throw new Error('Not a pull request event');
      }

      return {
        owner,
        repo,
        pullNumber,
        event
      };
    } catch (error) {
      throw new Error(`Failed to parse GitHub event: ${error.message}`);
    }
  }
}

module.exports = GitHubClient;