// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * eslint-plugin-aumos-governance
 *
 * ESLint plugin that enforces governance controls on agent action code.
 * Import the plugin and use the `recommended` config to enable all rules at
 * their default severity levels, or cherry-pick individual rules.
 *
 * Usage (ESLint flat config):
 *
 *   import aumos from 'eslint-plugin-aumos-governance';
 *
 *   export default [
 *     aumos.configs.recommended,
 *   ];
 */

import noUngovernedToolCall from './rules/no-ungoverned-tool-call.js';
import noUnloggedAction from './rules/no-unlogged-action.js';
import noHardcodedTrustLevel from './rules/no-hardcoded-trust-level.js';
import requireConsentCheck from './rules/require-consent-check.js';
import requireBudgetCheck from './rules/require-budget-check.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-aumos-governance',
    version: '0.1.0',
  },

  rules: {
    'no-ungoverned-tool-call': noUngovernedToolCall,
    'no-unlogged-action': noUnloggedAction,
    'no-hardcoded-trust-level': noHardcodedTrustLevel,
    'require-consent-check': requireConsentCheck,
    'require-budget-check': requireBudgetCheck,
  },

  configs: {} as Record<string, unknown>,
};

// The recommended config is defined after the plugin object so we can
// reference the plugin itself within the config (required by ESLint flat
// config conventions).
plugin.configs = {
  recommended: {
    plugins: { 'aumos-governance': plugin },
    rules: {
      'aumos-governance/no-ungoverned-tool-call': 'error',
      'aumos-governance/no-unlogged-action': 'warn',
      'aumos-governance/no-hardcoded-trust-level': 'warn',
      'aumos-governance/require-consent-check': 'warn',
      'aumos-governance/require-budget-check': 'warn',
    },
  },
};

export default plugin;
