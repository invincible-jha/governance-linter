// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Rule: require-consent-check
 *
 * Detects data-access patterns (db.query(), repo.find(), user.fetch(), etc.)
 * that are not preceded by a consent check (consent.check(),
 * privacy.verify(), permissions.isAllowed(), etc.) in the same function scope.
 *
 * Rationale: Accessing personal or sensitive data without first verifying that
 * the user or subject has consented is a privacy violation. The consent check
 * must precede the access so that the access is never performed if consent is
 * absent.
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';
import {
  isDataAccessCall,
  isConsentCheck,
  findEnclosingFunction,
  collectCallExpressions,
  anyCallPrecedesNode,
} from '../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require a consent check before data-access operations. Calls to db.query(), repo.find(), user.fetch(), etc. must be preceded by consent.check() or an equivalent in the same function scope.',
      url: 'https://github.com/muveraai/aumos-oss/blob/main/governance-linter/docs/rules.md#require-consent-check',
    },
    messages: {
      missingConsentCheck:
        "'{{callExpr}}' accesses data but no consent check (e.g. consent.check() or privacy.verify()) was found before it in the enclosing function. Verify consent before reading personal data.",
    },
    schema: [],
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    return {
      CallExpression(node: Node): void {
        const callNode = node as CallExpression;

        if (!isDataAccessCall(callNode)) return;

        const callExpr = context.getSourceCode().getText(callNode.callee);

        const ancestors = context.getAncestors();
        const enclosingFunction = findEnclosingFunction(callNode, ancestors);

        if (!enclosingFunction) {
          context.report({
            node,
            messageId: 'missingConsentCheck',
            data: { callExpr },
          });
          return;
        }

        const allCalls = collectCallExpressions(enclosingFunction);

        const hasConsentCheck = anyCallPrecedesNode(
          allCalls,
          callNode,
          isConsentCheck,
        );

        if (!hasConsentCheck) {
          context.report({
            node,
            messageId: 'missingConsentCheck',
            data: { callExpr },
          });
        }
      },
    };
  },
};

export default rule;
