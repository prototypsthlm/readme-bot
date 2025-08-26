
let cachedConfig = null;

function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Default configuration
  const defaultConfig = {
    claude: {
      model: 'claude-3-5-sonnet-20241022',
      apiKey: null,
      maxTokens: 4000,
      temperature: 0.1
    },
    github: {
      token: null,
      clientId: null,
      clientSecret: null
    }
  };

  // Use default config (no file loading needed for webhook server)
  cachedConfig = { ...defaultConfig };
  
  // Override with environment variables
  if (process.env.ANTHROPIC_API_KEY) {
    cachedConfig.claude.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  
  if (process.env.GH_TOKEN) {
    cachedConfig.github.token = process.env.GH_TOKEN;
  }
  
  if (process.env.GH_CLIENT_ID) {
    cachedConfig.github.clientId = process.env.GH_CLIENT_ID;
  }
  
  if (process.env.GH_CLIENT_SECRET) {
    cachedConfig.github.clientSecret = process.env.GH_CLIENT_SECRET;
  }
  
  if (process.env.CLAUDE_MODEL) {
    cachedConfig.claude.model = process.env.CLAUDE_MODEL;
  }

  return cachedConfig;
}


function getConfig() {
  return loadConfig();
}

function resetConfig() {
  cachedConfig = null;
}

function validateConfig(config = null) {
  const cfg = config || getConfig();
  const errors = [];

  // Validate required fields
  if (!cfg.claude.apiKey && !process.env.ANTHROPIC_API_KEY) {
    errors.push('Claude API key is required (ANTHROPIC_API_KEY environment variable)');
  }

  // Check for either GitHub token or OAuth App credentials
  const hasToken = cfg.github.token || process.env.GH_TOKEN;
  const hasClientId = cfg.github.clientId || process.env.GH_CLIENT_ID;
  const hasClientSecret = cfg.github.clientSecret || process.env.GH_CLIENT_SECRET;
  
  const hasOAuthAuth = hasClientId && hasClientSecret;
  
  if (!hasToken && !hasOAuthAuth) {
    errors.push('GitHub authentication is required. Either provide GH_TOKEN or OAuth App credentials (GH_CLIENT_ID, GH_CLIENT_SECRET)');
  }
  
  // If OAuth App credentials are partially provided, require both
  if ((hasClientId || hasClientSecret) && !hasOAuthAuth) {
    errors.push('GitHub OAuth App authentication requires both: GH_CLIENT_ID and GH_CLIENT_SECRET');
  }

  // Validate model name
  if (cfg.claude.model && !cfg.claude.model.startsWith('claude-')) {
    errors.push(`Invalid Claude model name: ${cfg.claude.model}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  return true;
}

module.exports = {
  getConfig,
  resetConfig,
  validateConfig
};