const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');

class GitHubClient {
  constructor() {
    if (!this.isGitHubAppConfigured()) {
      throw new Error('GitHub App configuration is required. Set GH_APP_ID, GH_CLIENT_ID, GH_CLIENT_SECRET, and GH_PRIVATE_KEY_BASE64');
    }
    this.installationClients = new Map(); // Cache Octokit clients by installationId
  }

  async getInstallationOctokit(installationId) {
    if (!this.installationClients.has(installationId)) {
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          clientId: process.env.GH_CLIENT_ID,
          clientSecret: process.env.GH_CLIENT_SECRET,
          appId: process.env.GH_APP_ID,
          privateKey: this.decodePrivateKey(process.env.GH_PRIVATE_KEY_BASE64),
          installationId: installationId,
        }
      });

      this.installationClients.set(installationId, octokit);
    }

    return this.installationClients.get(installationId);
  }

  decodePrivateKey(base64Key) {
    if (!base64Key) return null;
    return Buffer.from(base64Key, 'base64').toString('utf8');
  }

  isGitHubAppConfigured() {
    return !!(process.env.GH_APP_ID && process.env.GH_PRIVATE_KEY_BASE64 && process.env.GH_CLIENT_ID && process.env.GH_CLIENT_SECRET);
  }

  async getPullRequestData(owner, repo, pullNumber, installationId) {
    try {
      const octokit = await this.getInstallationOctokit(installationId);
      const [prResponse, filesResponse, commitsResponse] = await Promise.all([
        octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
        octokit.pulls.listFiles({ owner, repo, pull_number: pullNumber }),
        octokit.pulls.listCommits({ owner, repo, pull_number: pullNumber })
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

  async getCurrentReadme(owner, repo, installationId, ref = 'main') {
    try {
      const octokit = await this.getInstallationOctokit(installationId);
      const response = await octokit.repos.getContent({
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

  async getDiffContent(owner, repo, pullNumber, installationId) {
    try {
      const octokit = await this.getInstallationOctokit(installationId);
      const response = await octokit.pulls.get({
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

  async commitReadmeUpdates(owner, repo, pullNumber, suggestions, currentReadme, installationId) {
    try {
      const octokit = await this.getInstallationOctokit(installationId);
      // Get PR details to get the head branch
      const pr = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });

      const headBranch = pr.data.head.ref;
      const headOwner = pr.data.head.repo.owner.login;
      const headRepo = pr.data.head.repo.name;

      // Apply suggestions to README content
      const updatedReadme = this.applySuggestionsToReadme(currentReadme, suggestions);
      
      if (updatedReadme === currentReadme) {
        console.log('No changes needed to README content');
        return null;
      }

      // Get current README file details from the head branch
      let readmeFileData;
      try {
        readmeFileData = await octokit.repos.getContent({
          owner: headOwner,
          repo: headRepo,
          path: 'README.md',
          ref: headBranch
        });
      } catch (error) {
        if (error.status === 404) {
          // README doesn't exist, we'll create it
          readmeFileData = null;
        } else {
          throw error;
        }
      }

      // Create commit message
      const commitMessage = this.generateCommitMessage(suggestions);

      // Update or create README.md on the PR branch
      const updateData = {
        owner: headOwner,
        repo: headRepo,
        path: 'README.md',
        message: commitMessage,
        content: Buffer.from(updatedReadme).toString('base64'),
        branch: headBranch
      };

      if (readmeFileData) {
        updateData.sha = readmeFileData.data.sha;
      }

      const result = await octokit.repos.createOrUpdateFileContents(updateData);
      
      return {
        commit: result.data.commit,
        content: result.data.content,
        suggestions: suggestions.length,
        url: result.data.commit.html_url
      };

    } catch (error) {
      throw new Error(`Failed to commit README updates: ${error.message}`);
    }
  }

  applySuggestionsToReadme(readmeContent, suggestions) {
    let content = readmeContent;
    
    for (const suggestion of suggestions) {
      content = this.applySingleSuggestion(content, suggestion);
    }
    
    return content;
  }

  applySingleSuggestion(content, suggestion) {
    const { section, type, content: suggestionContent } = suggestion;
    
    if (!suggestionContent) return content;
    
    // Handle different section targeting strategies
    if (section.toLowerCase().includes('new section')) {
      // Add new section at the end
      return content + '\n\n' + suggestionContent;
    }
    
    if (section.toLowerCase().includes('after ')) {
      // Insert after specific section
      const afterMatch = section.match(/after\s+(.+)$/i);
      if (afterMatch) {
        const afterSection = afterMatch[1];
        return this.insertAfterSection(content, afterSection, suggestionContent);
      }
    }
    
    // Try to find and update existing section
    const existingSection = this.findSection(content, section);
    if (existingSection) {
      return this.updateSection(content, section, suggestionContent);
    }
    
    // Default: add at the end
    return content + '\n\n' + suggestionContent;
  }

  findSection(content, sectionName) {
    const lines = content.split('\n');
    const sectionPattern = new RegExp(`^#{1,6}\\s*${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      if (sectionPattern.test(lines[i])) {
        return { lineIndex: i, line: lines[i] };
      }
    }
    
    return null;
  }

  insertAfterSection(content, afterSectionName, newContent) {
    const lines = content.split('\n');
    const afterPattern = new RegExp(`^#{1,6}\\s*${afterSectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      if (afterPattern.test(lines[i])) {
        // Find the end of this section (next heading or end of file)
        let insertIndex = i + 1;
        while (insertIndex < lines.length && !lines[insertIndex].match(/^#{1,6}\s/)) {
          insertIndex++;
        }
        
        lines.splice(insertIndex, 0, '', ...newContent.split('\n'), '');
        return lines.join('\n');
      }
    }
    
    // Section not found, add at end
    return content + '\n\n' + newContent;
  }

  updateSection(content, sectionName, newContent) {
    const lines = content.split('\n');
    const sectionPattern = new RegExp(`^#{1,6}\\s*${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      if (sectionPattern.test(lines[i])) {
        // Find the end of this section
        let endIndex = i + 1;
        while (endIndex < lines.length && !lines[endIndex].match(/^#{1,6}\s/)) {
          endIndex++;
        }
        
        // Replace section content
        const newLines = newContent.split('\n');
        lines.splice(i, endIndex - i, ...newLines);
        return lines.join('\n');
      }
    }
    
    return content;
  }

  generateCommitMessage(suggestions) {
    if (suggestions.length === 1) {
      const suggestion = suggestions[0];
      return `docs: update README - ${suggestion.type} (${suggestion.section})\n\n🤖 Generated with README-Bot powered by Claude AI`;
    }
    
    const types = [...new Set(suggestions.map(s => s.type))];
    return `docs: update README with ${suggestions.length} improvements\n\n- ${types.join('\n- ')}\n\n🤖 Generated with README-Bot powered by Claude AI`;
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