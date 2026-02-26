// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Rule: no-ungoverned-tool-call
 *
 * Detects tool invocations (tool.run(), tool.execute(), tool.invoke(), etc.)
 * that are not preceded by a governance check (engine.check(),
 * governance.check(), trust.verify(), etc.) within the same function scope.
 *
 * Rationale: Every tool action an agent takes must be authorised by the
 * governance layer before execution. Skipping the check means the agent
 * can take arbitrary actions without policy enforcement.
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';
import {
  isToolCall,
  isGovernanceCheck,
  findEnclosingFunction,
  collectCallExpressions,
  anyCallPrecedesNode,
} from '../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a governance check before every tool invocation. Tool calls without a prior engine.check() / governance.check() in the same scope are ungoverned and violate agent policy.',
      url: 'https://github.com/muveraai/aumos-oss/blob/main/governance-linter/docs/rules.md#no-ungoverned-tool-call',
    },
    messages: {
      missingGovernanceCheck:
        "'{{callExpr}}' is a tool invocation but no governance check (e.g. engine.check() or governance.check()) was found before it in the enclosing function. Add a check to authorise this action.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalToolPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional object names to treat as tool objects.',
          },
          additionalCheckPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional method names to treat as governance checks.',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    return {
      CallExpression(node: Node): void {
        const callNode = node as CallExpression;

        if (!isToolCall(callNode)) return;

        // Build a human-readable callee string for the error message
        const callExpr = context.getSourceCode().getText(callNode.callee);

        // Walk up the AST to find the enclosing function body
        const ancestors = context.getAncestors();
        const enclosingFunction = findEnclosingFunction(callNode, ancestors);

        if (!enclosingFunction) {
          // Top-level tool call — no enclosing function, must still be governed
          context.report({
            node,
            messageId: 'missingGovernanceCheck',
            data: { callExpr },
          });
          return;
        }

        // Collect all call expressions inside the enclosing function
        const allCalls = collectCallExpressions(enclosingFunction);

        // Check if any governance check precedes this tool call
        const hasGovernanceCheck = anyCallPrecedesNode(
          allCalls,
          callNode,
          isGovernanceCheck,
        );

        if (!hasGovernanceCheck) {
          context.report({
            node,
            messageId: 'missingGovernanceCheck',
            data: { callExpr },
          });
        }
      },
    };
  },
};

export default rule;
