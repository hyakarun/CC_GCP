import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
    js.configs.recommended,
    prettierRecommended,
    {
        files: ["**/*.js", "**/*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                CONFIG: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off",
            "no-undef": "warn"
        }
    },
    {
        files: ["public/**/*.js"],
        ignores: ["public/js/config.js"],
        languageOptions: {
            sourceType: "script",
            globals: {
                ...globals.browser,
                CONFIG: "readonly"
            }
        }
    },
    {
        files: ["public/js/config.js"],
        languageOptions: {
            sourceType: "script",
            globals: {
                ...globals.browser
            }
        },
        rules: {
            "no-redeclare": "off"
        }
    }
];
