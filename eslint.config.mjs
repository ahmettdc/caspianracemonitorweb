export default [{
  files: ["**/*.jsx", "**/*.js"],
  languageOptions: {
    ecmaVersion: 2022, sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: { "no-use-before-define": ["error", { variables: true, functions: false, classes: false }] },
}];
