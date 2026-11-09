import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
// Independent quality check for this branch. No Next hardening/CI from PR #16.
export default tseslint.config(
 { ignores:['**/node_modules/**','**/.next/**','**/dist/**','**/coverage/**','**/test-results/**','**/playwright-report/**','**/next-env.d.ts'] },
 js.configs.recommended,
 ...tseslint.configs.recommended,
 { languageOptions:{globals:{...globals.node,...globals.browser}},rules:{
  '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none',ignoreRestSiblings:true}],
  'no-empty':['error',{allowEmptyCatch:true}],
 } },
 { files:['**/*.mjs','**/*.js'],rules:{'@typescript-eslint/no-require-imports':'off'} },
);
