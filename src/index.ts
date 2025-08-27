import 'dotenv/config';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import ClaudeClient from './claude-client';
import GitHubClient from './github-client';

const app = express();
const port = process.env['PORT'] || 3000;

// Middleware to parse JSON and verify GitHub webhook signature
app.use('/webhook', express.raw({ type: 'application/json' }));

// Webhook signature verification
function verifySignature(payload: Buffer, signature: string | undefined): boolean {
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
}

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

// Main webhook handler
app.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const signature = req.get('X-Hub-Signature-256');
  const event = req.get('X-GitHub-Event');
  const delivery = req.get('X-GitHub-Delivery');
  
  console.log(`🔔 Webhook received: event=${event}, delivery=${delivery}`);
  
  // Verify webhook signature
  if (!verifySignature(req.body, signature)) {
    console.log('❌ Invalid webhook signature');
    res.status(401).send('Invalid signature');
    return;
  }
  
  // Only handle pull request events
  if (event !== 'pull_request') {
    console.log(`ℹ️ Ignoring event type: ${event}`);
    res.status(200).send('Event ignored');
    return;
  }
  
  const payload: GitHubWebhookPayload = JSON.parse(req.body.toString());
  const { action, pull_request: pr, repository: repo, installation } = payload;

  console.log(`📝 PR event: ${repo.full_name}#${pr.number} - ${action}`);
  
  // Only handle opened, synchronize, and reopened PR events
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    console.log(`ℹ️ Ignoring PR action: ${action}`);
    res.status(200).send('PR action ignored');
    return;
  }
  
  console.log(`🚀 Processing PR #${pr.number} in ${repo.full_name} (${action}) for installation ${installation.id}`);
  
  try {
    await analyzePR(repo.owner.login, repo.name, pr.number, installation.id);
    console.log(`✅ Analysis complete for PR #${pr.number}`);
    res.status(200).send('Analysis complete');
  } catch (error) {
    console.error(`❌ Analysis failed for PR #${pr.number}:`, (error as Error).message);
    res.status(500).send('Analysis failed');
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

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

// Start server
app.listen(port, () => {
  console.log(`🤖 README Bot webhook server running on port ${port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down README Bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down README Bot...');
  process.exit(0);
});