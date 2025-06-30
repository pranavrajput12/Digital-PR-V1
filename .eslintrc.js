module.exports = {
  "env": {
    "browser": true,
    "es2021": true,
    "webextensions": true, // This enables 'chrome' as a global
    "node": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "script" // Chrome extensions typically use script, not module
  },
  "rules": {
    // Relaxed rules for development
    "no-unused-vars": "warn",
    "no-undef": "warn",
    "semi": ["warn", "always"],
    // Syntax error detection (these should be errors, not warnings)
    "no-unexpected-multiline": "error",
    "no-unreachable": "error",
    "no-extra-parens": "warn",
    "no-extra-semi": "warn",
    "no-empty": "warn",
    // Rules to catch unclosed blocks
    "curly": ["error", "all"],
    "brace-style": ["warn", "1tbs"]
  },
  "globals": {
    "chrome": "readonly",
    "browser": "readonly",
    // Add other globals specific to your extension
    "aiService": "writable",
    "opportunityProcessor": "writable",
    "aiEnabled": "writable",
    "aiProcessing": "writable",
    "allOpportunities": "writable",
    "applyFilters": "writable",
    "showNotification": "writable",
    "updateStats": "writable",
    "saveOpportunities": "writable",
    "initializeView": "writable",
    "filters": "writable",
    "allButtons": "writable"
  }
};
