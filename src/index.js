#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
require('dotenv').config();

const ClaudeClient = require('./claude-client');
const GitHubClient = require('./github-client');
const SuggestionFormatter = require('./suggestion-formatter');
const { getConfig, validateConfig, createDefaultConfig } = require('./config');

const program = new Command();

program
  .name('readme-bot')
  .description('AI-powered README maintenance tool')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a pull request for README updates')
  .option('-r, --repo <repository>', 'GitHub repository (owner/repo)')
  .option('-p, --pr <number>', 'Pull request number')
  .option('--format <format>', 'Output format (github, cli, json)', 'cli')
  .option('--post-comment', 'Post results as PR comment')
  .option('--update-comment', 'Update existing comment if found')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      await validateConfig();
      
      const { repo, pr, format, postComment, updateComment, verbose } = options;
      
      if (!repo || !pr) {
        console.error(chalk.red('Error: Repository and PR number are required'));
        console.log(chalk.yellow('Usage: readme-bot analyze -r owner/repo -p 123'));
        process.exit(1);
      }

      const spinner = ora('Analyzing pull request...').start();

      try {
        const github = new GitHubClient();
        const claude = new ClaudeClient();
        
        // Parse repository
        const { owner, repo: repoName } = github.parseRepositoryUrl(repo);
        
        // Fetch PR data
        spinner.text = 'Fetching pull request data...';
        const [prData, readme, diff] = await Promise.all([
          github.getPullRequestData(owner, repoName, parseInt(pr)),
          github.getCurrentReadme(owner, repoName),
          github.getDiffContent(owner, repoName, parseInt(pr))
        ]);

        // Analyze with Claude
        spinner.text = 'Analyzing changes with Claude...';
        const analysis = await claude.analyzeChanges(diff, readme, {
          repoName: `${owner}/${repoName}`,
          prTitle: prData.title,
          prDescription: prData.body,
          changedFiles: prData.changedFiles
        });

        spinner.stop();

        // Format results
        const formatter = SuggestionFormatter.create(format, { verbose });
        const output = formatter.format(analysis, {
          repoName: `${owner}/${repoName}`,
          prNumber: pr,
          author: prData.author
        });

        console.log(output);

        // Auto-commit README updates by default, or post comment if requested
        if (analysis.needsUpdate) {
          if (postComment || updateComment) {
            // Legacy comment mode
            const commentSpinner = ora('Posting comment to GitHub...').start();
            
            try {
              const githubFormatter = SuggestionFormatter.create('github');
              const commentBody = githubFormatter.format(analysis, {
                repoName: `${owner}/${repoName}`,
                prNumber: pr,
                author: prData.author
              });

              let comment;
              if (updateComment) {
                const existing = await github.findExistingComment(owner, repoName, parseInt(pr));
                if (existing) {
                  comment = await github.updateComment(owner, repoName, existing.id, commentBody);
                  commentSpinner.succeed('Updated existing comment');
                } else {
                  comment = await github.createComment(owner, repoName, parseInt(pr), commentBody);
                  commentSpinner.succeed('Posted new comment');
                }
              } else {
                comment = await github.createComment(owner, repoName, parseInt(pr), commentBody);
                commentSpinner.succeed('Posted comment');
              }

              if (verbose) {
                console.log(chalk.gray(`Comment URL: ${comment.html_url}`));
              }
            } catch (error) {
              commentSpinner.fail('Failed to post comment');
              if (verbose) {
                console.error(chalk.red(error.message));
              }
            }
          } else {
            // Default: Auto-commit README updates
            const commitSpinner = ora('Committing README updates to PR branch...').start();
            
            try {
              const commitResult = await github.commitReadmeUpdates(
                owner, 
                repoName, 
                parseInt(pr), 
                analysis.suggestions, 
                readme
              );
              
              if (commitResult) {
                commitSpinner.succeed(`Committed ${commitResult.suggestions} README updates`);
                
                if (verbose) {
                  console.log(chalk.gray(`Commit URL: ${commitResult.url}`));
                  console.log(chalk.blue(`💡 README changes are now in the PR for you to review!`));
                }
              } else {
                commitSpinner.info('No README changes needed');
              }
            } catch (error) {
              commitSpinner.fail('Failed to commit README updates');
              if (verbose) {
                console.error(chalk.red(error.message));
              }
              
              // Fallback to showing suggestions
              console.log(chalk.yellow('\n📝 Here are the suggested changes:'));
              console.log(output);
            }
          }
        }

        // Exit with error code if updates are needed (for CI)
        if (analysis.needsUpdate) {
          process.exit(1);
        }

      } catch (error) {
        spinner.fail('Analysis failed');
        throw error;
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('action')
  .description('Run as GitHub Action')
  .option('--format <format>', 'Output format', 'github')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      await validateConfig();
      
      const { format, verbose } = options;
      
      // Get GitHub Action context
      const context = GitHubClient.fromEnvironment();
      const { owner, repo, pullNumber } = context;

      const spinner = ora('Running README analysis...').start();

      try {
        const github = new GitHubClient();
        const claude = new ClaudeClient();

        // Fetch data
        spinner.text = 'Fetching pull request data...';
        const [prData, readme, diff] = await Promise.all([
          github.getPullRequestData(owner, repo, pullNumber),
          github.getCurrentReadme(owner, repo),
          github.getDiffContent(owner, repo, pullNumber)
        ]);

        // Analyze
        spinner.text = 'Analyzing with Claude...';
        const analysis = await claude.analyzeChanges(diff, readme, {
          repoName: `${owner}/${repo}`,
          prTitle: prData.title,
          prDescription: prData.body,
          changedFiles: prData.changedFiles
        });

        spinner.stop();

        // Format and post results
        const formatter = SuggestionFormatter.create(format);
        const output = formatter.format(analysis, {
          repoName: `${owner}/${repo}`,
          prNumber: pullNumber,
          author: prData.author
        });

        // Auto-commit README updates by default
        if (analysis.needsUpdate) {
          const commitSpinner = ora('Committing README updates to PR branch...').start();
          
          try {
            const commitResult = await github.commitReadmeUpdates(
              owner, 
              repo, 
              pullNumber, 
              analysis.suggestions, 
              readme
            );
            
            if (commitResult) {
              commitSpinner.succeed(`Committed ${commitResult.suggestions} README updates`);
              
              if (verbose) {
                console.log(chalk.gray(`Commit URL: ${commitResult.url}`));
                console.log(chalk.blue(`💡 README changes are now in the PR for review!`));
              }
            } else {
              commitSpinner.info('No README changes needed');
            }
          } catch (error) {
            commitSpinner.fail('Failed to commit README updates');
            
            if (verbose) {
              console.error(chalk.red(error.message));
            }
            
            // Fallback: post as comment instead
            console.log(chalk.yellow('📝 Falling back to comment mode...'));
            const config = getConfig();
            const commentSpinner = ora('Posting suggestions as comment...').start();
            
            try {
              let comment;
              if (config.github.updateExistingComment) {
                const existing = await github.findExistingComment(owner, repo, pullNumber);
                if (existing) {
                  comment = await github.updateComment(owner, repo, existing.id, output);
                } else {
                  comment = await github.createComment(owner, repo, pullNumber, output);
                }
              } else {
                comment = await github.createComment(owner, repo, pullNumber, output);
              }
              
              commentSpinner.succeed('Posted README suggestions as comment');
              
              if (verbose) {
                console.log(chalk.gray(`Comment URL: ${comment.html_url}`));
              }
            } catch (fallbackError) {
              commentSpinner.fail('Failed to post comment fallback');
              throw fallbackError;
            }
          }
        } else {
          console.log(chalk.green('✅ README is up to date!'));
        }

        // Output results for GitHub Actions
        if (process.env.GITHUB_OUTPUT) {
          const fs = require('fs');
          fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs_update=${analysis.needsUpdate}\n`);
          fs.appendFileSync(process.env.GITHUB_OUTPUT, `suggestion_count=${analysis.suggestions?.length || 0}\n`);
        }

        // Don't exit with error in action mode (non-blocking)
        
      } catch (error) {
        spinner.fail('Action failed');
        throw error;
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      
      // Set action as failed but don't block PR
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs_update=unknown\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `error=${error.message}\n`);
      }
      
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create default configuration file')
  .action(async () => {
    try {
      const configPath = createDefaultConfig();
      console.log(chalk.green(`✅ Created configuration file: ${configPath}`));
      console.log(chalk.yellow('📝 Remember to set your API keys:'));
      console.log(chalk.gray('   - ANTHROPIC_API_KEY environment variable'));
      console.log(chalk.gray('   - GITHUB_TOKEN environment variable'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration')
  .action(async () => {
    try {
      await validateConfig();
      console.log(chalk.green('✅ Configuration is valid'));
    } catch (error) {
      console.error(chalk.red(`❌ Configuration validation failed:`));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

program.parse();