module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // Add or adjust rules as needed
      semi: ["error", "always"],
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-extra-semi": "error",
    },
    plugins: {},
  },
];
