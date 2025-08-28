import 'dotenv/config';
// import crypto from 'crypto';
import ClaudeClient from './claude-client.js';
import GitHubClient from './github-client.js';

interface GitHubWebhookPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
  };
  repository: {
    full_name: string;
    name: string;
    owner: {
      login: string;
    };
  },
  installation: {
    id: string;
  };
}

interface FunctionEvent {
  http: {
    headers: Record<string, string>;
    method: string;
    path: string;
  };
  [key: string]: any; // Allow additional top-level properties
}

interface FunctionContext {
  // Digital Ocean Functions context properties
}

interface FunctionResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

// Webhook signature verification
/* function verifySignature(payload: Buffer, signature: string | undefined): boolean {
  const webhookSecret = process.env['WEBHOOK_SECRET'];
  if (!webhookSecret) return true; // Skip verification if no secret set
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`, 'utf8'),
    Buffer.from(signature || '', 'utf8')
  );
} */

// Core analysis logic extracted from CLI
async function analyzePR(owner: string, repo: string, pullNumber: number, installationId: string): Promise<void> {
  try {
    // Basic validation
    if (!process.env['ANTHROPIC_API_KEY']) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    
    const github = new GitHubClient(installationId);
    const claude = new ClaudeClient();
    
    console.log(`Fetching PR data for ${owner}/${repo}#${pullNumber}...`);
    
    // Fetch PR data step by step
    const prData = await github.getPullRequestData(owner, repo, pullNumber);
    const readme = await github.getCurrentReadme(owner, repo);
    const diff = await github.getDiffContent(owner, repo, pullNumber);
    
    console.log(`Analyzing changes with Claude...`);
    
    // Analyze with Claude
    const analysis = await claude.analyzeChanges(diff, readme, {
      repoName: `${owner}/${repo}`,
      prTitle: prData.title,
      prDescription: prData.body,
      changedFiles: prData.changedFiles
    });
    
    if (!analysis.needsUpdate) {
      console.log(`✅ README is up to date for PR #${pullNumber}`);
      return;
    }
    
    console.log(`README needs updates, committing changes...`);
    
    // Auto-commit README updates
    try {
      const commitResult = await github.commitReadmeUpdates(
        owner, 
        repo, 
        pullNumber, 
        analysis.suggestions, 
        readme
      );
      
      if (commitResult) {
        console.log(`✅ Committed ${commitResult.suggestions} README updates to PR #${pullNumber}`);
        console.log(`Commit URL: ${commitResult.url}`);
      } else {
        console.log(`ℹ️ No README changes needed for PR #${pullNumber}`);
      }
    } catch (commitError) {
      console.error(`Failed to commit README updates: ${(commitError as Error).message}`);
      console.log(`📝 Suggestions were: ${JSON.stringify(analysis.suggestions, null, 2)}`);
    }
    
  } catch (error) {
    console.error(`Analysis failed: ${(error as Error).message}`);
    throw error;
  }
}

// Main Digital Ocean Function handler
export async function main(event: FunctionEvent, _context: FunctionContext): Promise<FunctionResponse> {
  try {
    // const signature = event.http.headers['x-hub-signature-256'];
    const eventType = event.http.headers['x-github-event'];
    const delivery = event.http.headers['x-github-delivery'];
    
    console.log(`🔔 Webhook received: event=${eventType}, delivery=${delivery}`);
    
    // Only handle POST requests
    if (event.http.method !== 'POST') {
      return {
        statusCode: 405,
        body: 'Method not allowed',
        headers: { 'Content-Type': 'text/plain' }
      };
    }
    
    // For signature verification, use the entire event object as the body
    // const bodyString = JSON.stringify(event);
    // const bodyBuffer = Buffer.from(bodyString, 'utf8');
    
    // Extract the GitHub payload from the event (excluding http object)
    const { http, ...payloadData } = event;
    
    if (Object.keys(payloadData).length === 0) {
      return {
        statusCode: 400,
        body: 'No payload provided',
        headers: { 'Content-Type': 'text/plain' }
      };
    }
    
    // Verify webhook signature
    /*
    TODO: add security
    if (!verifySignature(bodyBuffer, signature)) {
      console.log('❌ Invalid webhook signature');
      return {
        statusCode: 401,
        body: 'Invalid signature',
        headers: { 'Content-Type': 'text/plain' }
      };
    } */
    
    // Only handle pull request events
    if (eventType !== 'pull_request') {
      console.log(`ℹ️ Ignoring event type: ${eventType}`);
      return {
        statusCode: 200,
        body: 'Event ignored',
        headers: { 'Content-Type': 'text/plain' }
      };
    }
    
    const payload: GitHubWebhookPayload = payloadData as GitHubWebhookPayload;
    const { action, pull_request: pr, repository: repo, installation } = payload;

    console.log(`📝 PR event: ${repo.full_name}#${pr.number} - ${action}`);
    
    // Only handle opened, synchronize, and reopened PR events
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      console.log(`ℹ️ Ignoring PR action: ${action}`);
      return {
        statusCode: 200,
        body: 'PR action ignored',
        headers: { 'Content-Type': 'text/plain' }
      };
    }
    
    console.log(`🚀 Processing PR #${pr.number} in ${repo.full_name} (${action}) for installation ${installation.id}`);
    
    await analyzePR(repo.owner.login, repo.name, pr.number, installation.id);
    console.log(`✅ Analysis complete for PR #${pr.number}`);
    
    return {
      statusCode: 200,
      body: 'Analysis complete',
      headers: { 'Content-Type': 'text/plain' }
    };
    
  } catch (error) {
    console.error(`❌ Function execution failed:`, (error as Error).message);
    return {
      statusCode: 500,
      body: 'Analysis failed',
      headers: { 'Content-Type': 'text/plain' }
    };
  }
}