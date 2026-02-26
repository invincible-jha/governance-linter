// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Rule: require-budget-check
 *
 * Detects spending / cost patterns (openai.chat(), llm.complete(),
 * tokens.use(), api.call(), etc.) that are not preceded by a budget check
 * (budget.check(), cost.verify(), quota.canSpend(), etc.) in the same
 * function scope.
 *
 * Rationale: Agent systems can consume significant resources through LLM API
 * calls and external API usage. Without a prior budget check, an agent may
 * exceed configured cost limits, causing unexpected charges or resource
 * exhaustion. The budget check must precede the spend so the call is
 * blocked if the budget is insufficient.
 */

import type { Rule } from 'eslint';
import type { CallExpression, Node } from 'estree';
import {
  isSpendCall,
  isBudgetCheck,
  findEnclosingFunction,
  collectCallExpressions,
  anyCallPrecedesNode,
} from '../utils.js';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require a budget check before spending operations (LLM calls, external API calls, token usage). Calls to openai.chat(), llm.complete(), tokens.use(), etc. must be preceded by budget.check() or an equivalent.',
      url: 'https://github.com/muveraai/aumos-oss/blob/main/governance-linter/docs/rules.md#require-budget-check',
    },
    messages: {
      missingBudgetCheck:
        "'{{callExpr}}' is a spending operation but no budget check (e.g. budget.check() or quota.canSpend()) was found before it in the enclosing function. Check available budget before incurring cost.",
    },
    schema: [],
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    return {
      CallExpression(node: Node): void {
        const callNode = node as CallExpression;

        if (!isSpendCall(callNode)) return;

        const callExpr = context.getSourceCode().getText(callNode.callee);

        const ancestors = context.getAncestors();
        const enclosingFunction = findEnclosingFunction(callNode, ancestors);

        if (!enclosingFunction) {
          context.report({
            node,
            messageId: 'missingBudgetCheck',
            data: { callExpr },
          });
          return;
        }

        const allCalls = collectCallExpressions(enclosingFunction);

        const hasBudgetCheck = anyCallPrecedesNode(
          allCalls,
          callNode,
          isBudgetCheck,
        );

        if (!hasBudgetCheck) {
          context.report({
            node,
            messageId: 'missingBudgetCheck',
            data: { callExpr },
          });
        }
      },
    };
  },
};

export default rule;
