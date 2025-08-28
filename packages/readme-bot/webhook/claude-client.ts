import Anthropic from '@anthropic-ai/sdk';
import type { Suggestion, AnalysisOptions, AnalysisResult } from './types';

class ClaudeClient {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
    this.model = process.env['CLAUDE_MODEL'] || 'claude-sonnet-4-20250514';
  }

  async analyzeChanges(prDiff: string, currentReadme: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const {
      repoName = 'Unknown Repository',
      prTitle = '',
      prDescription = '',
      changedFiles = []
    } = options;

    const prompt = this.buildAnalysisPrompt(prDiff, currentReadme, {
      repoName,
      prTitle,
      prDescription,
      changedFiles
    });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content?.type === 'text') {
        return this.parseResponse(content.text);
      }
      throw new Error('Unexpected response format from Claude API');
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Failed to analyze changes: ${(error as Error).message}`);
    }
  }

  private buildAnalysisPrompt(prDiff: string, currentReadme: string, context: AnalysisOptions): string {
    return `You are analyzing a COMPLETE pull request diff to determine if the README.md file needs to be updated.

IMPORTANT: This diff contains ALL changes from the entire pull request, not just a single commit. Analyze the full scope of changes.

**Repository:** ${context.repoName}
**PR Title:** ${context.prTitle}
**PR Description:** ${context.prDescription}
**Changed Files:** ${context.changedFiles?.join(', ') || 'None'} (${context.changedFiles?.length || 0} files total)

**Current README.md (${currentReadme.length} characters):**
\`\`\`markdown
${currentReadme}
\`\`\`

**Complete Pull Request Diff (${prDiff.length} characters):**
\`\`\`diff
${prDiff}
\`\`\`

ANALYSIS INSTRUCTIONS:
Thoroughly analyze the ENTIRE pull request diff above. Look for ANY changes across ALL commits and files that might affect the README, including:

1. **Environment Variables:** New environment variables in any file that should be documented
2. **Dependencies:** Package.json changes, new libraries, version updates across the PR
3. **Configuration:** New config files, Docker changes, deployment updates
4. **Features:** New functionality, endpoints, components, or capabilities added
5. **Setup Instructions:** Changes that affect installation, build, or setup process
6. **API Changes:** New endpoints, modified interfaces, changed parameters
7. **Architecture:** Structural changes, new modules, refactoring that impacts project description
8. **File Structure:** New important files or directories that should be documented
9. **Scripts:** New npm/yarn scripts or build processes
10. **Breaking Changes:** Any changes that might affect how users interact with the project

EVALUATION CRITERIA:
- Consider if the current README already covers what was changed
- Only suggest updates for changes that genuinely impact users or contributors
- Be conservative but thorough - if there's clear evidence of missing documentation, flag it
- Look at the magnitude and scope of changes across the ENTIRE PR

**Response Format:**
Respond with a JSON object containing:
- "needsUpdate": boolean indicating if README needs changes based on COMPLETE PR analysis
- "suggestions": array of specific suggestions with:
  - "type": category of change (env, dependency, feature, setup, api, architecture, etc.)
  - "section": README section that needs updating
  - "description": what needs to be changed and why
  - "priority": high/medium/low based on impact to users
  - "content": suggested content to add/modify

If no updates are needed, return {"needsUpdate": false, "suggestions": []}

Be thorough but only suggest updates that are clearly warranted by the code changes in this COMPLETE PR diff.`;
  }

  private parseResponse(response: string): AnalysisResult {
    try {
      // Clean up the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (typeof parsed.needsUpdate !== 'boolean') {
        throw new Error('Invalid response: needsUpdate must be boolean');
      }
      
      if (!Array.isArray(parsed.suggestions)) {
        throw new Error('Invalid response: suggestions must be array');
      }

      return parsed;
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      console.error('Raw response:', response);
      
      // Return a safe fallback
      return {
        needsUpdate: false,
        suggestions: [],
        error: `Failed to parse response: ${(error as Error).message}`
      };
    }
  }

  async validateAnalysis(suggestions: Suggestion[], currentReadme: string): Promise<AnalysisResult> {
    if (!suggestions || suggestions.length === 0) {
      return { needsUpdate: false, suggestions };
    }

    const validationPrompt = `Please review these README update suggestions for accuracy and relevance:

**Current README:**
\`\`\`markdown
${currentReadme}
\`\`\`

**Suggestions:**
${JSON.stringify(suggestions, null, 2)}

Validate each suggestion and return only those that are:
1. Not already covered in the current README
2. Actually relevant to the code changes
3. Specific and actionable

Return the same JSON structure with only valid suggestions.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: validationPrompt
          }
        ]
      });

      const content = response.content[0];
      if (content?.type === 'text') {
        return this.parseResponse(content.text);
      }
      return { needsUpdate: true, suggestions };
    } catch (error) {
      console.warn('Validation failed, returning original suggestions:', error);
      return { needsUpdate: true, suggestions };
    }
  }
}

export default ClaudeClient;