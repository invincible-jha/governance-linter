// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Rule: no-unlogged-action
 *
 * Detects governance checks (engine.check(), governance.check(), etc.) that
 * are made but whose result is never passed to an audit logger
 * (audit.log(), logger.log(), auditLog(), etc.) anywhere in the same
 * function scope.
 *
 * Rationale: Governance decisions must be auditable. If a check is performed
 * but the outcome is never recorded, the system cannot be retrospectively
 * audited, which breaks compliance requirements.
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';
import {
  isGovernanceCheck,
  isAuditLog,
  findEnclosingFunction,
  collectCallExpressions,
} from '../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require that every governance check is followed by an audit log call in the same function scope. Un-logged governance decisions break audit trails.',
      url: 'https://github.com/muveraai/aumos-oss/blob/main/governance-linter/docs/rules.md#no-unlogged-action',
    },
    messages: {
      missingAuditLog:
        "'{{callExpr}}' is a governance check but no audit log call (e.g. audit.log() or logger.log()) was found in the enclosing function. Log the outcome so it can be audited.",
    },
    schema: [],
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    return {
      CallExpression(node: Node): void {
        const callNode = node as CallExpression;

        if (!isGovernanceCheck(callNode)) return;

        const callExpr = context.getSourceCode().getText(callNode.callee);

        const ancestors = context.getAncestors();
        const enclosingFunction = findEnclosingFunction(callNode, ancestors);

        if (!enclosingFunction) {
          // Top-level governance check — no enclosing function scope to search
          context.report({
            node,
            messageId: 'missingAuditLog',
            data: { callExpr },
          });
          return;
        }

        // Collect all call expressions in the enclosing function
        const allCalls = collectCallExpressions(enclosingFunction);

        // Check whether any audit log call exists anywhere in the function
        // (it need not precede the check — it may be in a then-branch or finally)
        const hasAuditLog = allCalls.some(isAuditLog);

        if (!hasAuditLog) {
          context.report({
            node,
            messageId: 'missingAuditLog',
            data: { callExpr },
          });
        }
      },
    };
  },
};

export default rule;
