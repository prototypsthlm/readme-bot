const Anthropic = require('@anthropic-ai/sdk');
const { getConfig } = require('./config');

class ClaudeClient {
  constructor() {
    const config = getConfig();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || config.claude.apiKey,
    });
    this.model = config.claude.model || 'claude-3-5-sonnet-20241022';
  }

  async analyzeChanges(prDiff, currentReadme, options = {}) {
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

      return this.parseResponse(response.content[0].text);
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Failed to analyze changes: ${error.message}`);
    }
  }

  buildAnalysisPrompt(prDiff, currentReadme, context) {
    return `You are analyzing a pull request to determine if the README.md file needs to be updated.

**Repository:** ${context.repoName}
**PR Title:** ${context.prTitle}
**PR Description:** ${context.prDescription}
**Changed Files:** ${context.changedFiles.join(', ')}

**Current README.md:**
\`\`\`markdown
${currentReadme}
\`\`\`

**Pull Request Changes:**
\`\`\`diff
${prDiff}
\`\`\`

Please analyze these changes and determine if the README needs updates. Look for:

1. **Environment Variables:** New environment variables added to code that should be documented
2. **Dependencies:** Package.json changes, new libraries, version updates
3. **Configuration:** New config files, Docker changes, deployment updates
4. **Features:** New functionality that should be described
5. **Setup Instructions:** Changes that affect installation or setup
6. **API Changes:** New endpoints, modified interfaces
7. **Architecture:** Structural changes that impact the project description

**Response Format:**
Respond with a JSON object containing:
- "needsUpdate": boolean indicating if README needs changes
- "suggestions": array of specific suggestions with:
  - "type": category of change (env, dependency, feature, setup, api, architecture)
  - "section": README section that needs updating
  - "description": what needs to be changed
  - "priority": high/medium/low
  - "content": suggested content to add/modify

If no updates are needed, return {"needsUpdate": false, "suggestions": []}

Only suggest updates that are clearly warranted by the code changes. Be specific and actionable.`;
  }

  parseResponse(response) {
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
        error: `Failed to parse response: ${error.message}`
      };
    }
  }

  async validateAnalysis(suggestions, currentReadme) {
    if (!suggestions || suggestions.length === 0) {
      return suggestions;
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

      return this.parseResponse(response.content[0].text);
    } catch (error) {
      console.warn('Validation failed, returning original suggestions:', error);
      return { needsUpdate: true, suggestions };
    }
  }
}

module.exports = ClaudeClient;