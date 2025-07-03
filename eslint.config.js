module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // Basic syntax and style
      "semi": ["error", "always"],
      "no-extra-semi": "error",
      "quotes": ["warn", "single", { "allowTemplateLiterals": true }],
      
      // Variable and function rules
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "no-undefined": "warn",
      "prefer-const": "warn",
      
      // Error prevention
      "no-console": "warn",
      "no-debugger": "error",
      "no-alert": "warn",
      "no-eval": "error",
      
      // Code quality
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "consistent-return": "warn",
      "no-duplicate-imports": "error",
      
      // Chrome extension specific
      "no-global-assign": "error",
      "no-implicit-globals": "error"
    },
    plugins: {},
  },
];
