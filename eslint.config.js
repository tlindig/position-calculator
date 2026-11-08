import js from "@eslint/js";
import globals from "globals";

// Replaces the .jshintrc rules. "asi", "eqnull", "expr", "laxbreak", "multistr" and "sub" were
// relaxations in JSHint and have no counterpart: the matching ESLint rules are simply not enabled.
const rules = {
    curly: "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "new-cap": "error",
    "no-caller": "error",
    "no-extend-native": "error",
    "no-new": "error",
    "no-use-before-define": ["error", { functions: false }],
    // JSHint "unused" did not check catch parameters
    "no-unused-vars": ["error", { caughtErrors: "none" }],
};

export default [
    { ignores: ["dist/", "node_modules/", "test/reference/"] },
    js.configs.recommended,
    { rules },
    {
        files: ["src/**/*.js"],
        languageOptions: { ecmaVersion: 2020, sourceType: "module", globals: { ...globals.browser } },
    },
    {
        // classic scripts, loaded by the HTML pages in test/
        files: [
            "test/support/{harness,load-impl,scene}.js",
            "test/*.test.js",
            "test/*_test.js",
            "test/adapter.js",
            "test/manually_tests.js",
        ],
        languageOptions: { ecmaVersion: 2020, sourceType: "script", globals: { ...globals.browser } },
    },
    {
        files: ["test/manually_tests.js"],
        languageOptions: { globals: { jQuery: "readonly" } },
    },
    {
        // "<\/script>" is the usual escape when markup is written with document.write
        files: ["test/support/load-impl.js"],
        rules: { "no-useless-escape": "off" },
    },
    {
        files: [
            "scripts/**/*.js",
            "test/run.js",
            "test/cross-browser.js",
            "test/support/server.js",
            "test/node-import.js",
            "eslint.config.js",
        ],
        languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { ...globals.node } },
    },
];
