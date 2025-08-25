const path = require('path');
const fs = require('fs');

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
      commentMarker: '<!-- README-BOT -->',
      createReview: false,
      updateExistingComment: true
    },
    analysis: {
      enableValidation: true,
      skipFiles: [
        'node_modules/**',
        '.git/**',
        '**/*.min.js',
        '**/dist/**',
        '**/build/**'
      ],
      priorityRules: {
        env: 'high',
        dependency: 'medium',
        feature: 'medium',
        setup: 'high',
        api: 'high',
        architecture: 'medium'
      }
    },
    output: {
      format: 'github',
      groupBySeverity: true,
      includeMetadata: true,
      verbose: false
    }
  };

  // Try to load user config
  const configPaths = [
    path.join(process.cwd(), 'readme-bot.config.json'),
    path.join(process.cwd(), '.readme-bot.json'),
    path.join(process.cwd(), 'config', 'readme-bot.json'),
    path.join(__dirname, '..', 'config', 'default.json')
  ];

  let userConfig = {};
  
  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        userConfig = JSON.parse(configContent);
        console.log(`Loaded config from: ${configPath}`);
        break;
      }
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${configPath}:`, error.message);
    }
  }

  // Merge configurations
  cachedConfig = mergeDeep(defaultConfig, userConfig);
  
  // Override with environment variables
  if (process.env.ANTHROPIC_API_KEY) {
    cachedConfig.claude.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  
  if (process.env.GITHUB_TOKEN) {
    cachedConfig.github.token = process.env.GITHUB_TOKEN;
  }
  
  if (process.env.CLAUDE_MODEL) {
    cachedConfig.claude.model = process.env.CLAUDE_MODEL;
  }

  return cachedConfig;
}

function mergeDeep(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
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
    errors.push('Claude API key is required (ANTHROPIC_API_KEY environment variable or config file)');
  }

  if (!cfg.github.token && !process.env.GITHUB_TOKEN) {
    errors.push('GitHub token is required (GITHUB_TOKEN environment variable or config file)');
  }

  // Validate model name
  if (cfg.claude.model && !cfg.claude.model.startsWith('claude-')) {
    errors.push(`Invalid Claude model name: ${cfg.claude.model}`);
  }

  // Validate priority rules
  const validPriorities = ['high', 'medium', 'low'];
  for (const [type, priority] of Object.entries(cfg.analysis.priorityRules)) {
    if (!validPriorities.includes(priority)) {
      errors.push(`Invalid priority '${priority}' for type '${type}'. Must be one of: ${validPriorities.join(', ')}`);
    }
  }

  // Validate output format
  const validFormats = ['github', 'cli', 'json'];
  if (!validFormats.includes(cfg.output.format)) {
    errors.push(`Invalid output format '${cfg.output.format}'. Must be one of: ${validFormats.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  return true;
}

function createDefaultConfig() {
  const configPath = path.join(process.cwd(), 'readme-bot.config.json');
  
  if (fs.existsSync(configPath)) {
    throw new Error(`Configuration file already exists at: ${configPath}`);
  }

  const defaultConfig = {
    claude: {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 4000,
      temperature: 0.1
    },
    github: {
      commentMarker: "<!-- README-BOT -->",
      createReview: false,
      updateExistingComment: true
    },
    analysis: {
      enableValidation: true,
      skipFiles: [
        "node_modules/**",
        ".git/**",
        "**/*.min.js",
        "**/dist/**",
        "**/build/**"
      ],
      priorityRules: {
        env: "high",
        dependency: "medium", 
        feature: "medium",
        setup: "high",
        api: "high",
        architecture: "medium"
      }
    },
    output: {
      format: "github",
      groupBySeverity: true,
      includeMetadata: true,
      verbose: false
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  return configPath;
}

module.exports = {
  getConfig,
  resetConfig,
  validateConfig,
  createDefaultConfig
};