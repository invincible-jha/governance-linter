// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Rule: no-hardcoded-trust-level
 *
 * Detects numeric literals in the range 0–5 that appear as the right-hand
 * operand of a binary comparison where the left side contains a trust-related
 * identifier (e.g. "level", "trust", "trustLevel", "tier").
 *
 * Patterns flagged:
 *   if (level >= 3)           // 3 is a magic number
 *   if (trustLevel === 2)     // 2 is a magic number
 *   if (user.trust > 1)       // 1 is a magic number
 *
 * Correct form:
 *   if (level >= TRUST_LEVELS.OPERATOR)
 *   if (trustLevel === TrustLevel.ELEVATED)
 *
 * Rationale: Hard-coded numeric trust levels are brittle and unclear.
 * Named constants document intent and allow the trust model to be refactored
 * without hunt-and-replace across the codebase.
 */

import type { Rule } from 'eslint';
import type { BinaryExpression, Node, MemberExpression, Identifier } from 'estree';

const TRUST_IDENTIFIER_PATTERN = /trust|level|tier|clearance/i;

const COMPARISON_OPERATORS = new Set(['===', '!==', '==', '!=', '<', '<=', '>', '>=']);

function nodeContainsTrustIdentifier(node: Node): boolean {
  if (node.type === 'Identifier') {
    return TRUST_IDENTIFIER_PATTERN.test((node as Identifier).name);
  }
  if (node.type === 'MemberExpression') {
    const memberNode = node as MemberExpression;
    return (
      nodeContainsTrustIdentifier(memberNode.object) ||
      nodeContainsTrustIdentifier(memberNode.property)
    );
  }
  return false;
}

function isSmallNumericLiteral(node: Node): node is { type: 'Literal'; value: number } & Node {
  return (
    node.type === 'Literal' &&
    typeof (node as { value: unknown }).value === 'number' &&
    (node as { value: number }).value >= 0 &&
    (node as { value: number }).value <= 5
  );
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow numeric literals (0–5) in trust-level comparisons. Use named constants instead of magic numbers so the trust model is explicit and easy to refactor.',
      url: 'https://github.com/muveraai/aumos-oss/blob/main/governance-linter/docs/rules.md#no-hardcoded-trust-level',
    },
    messages: {
      hardcodedTrustLevel:
        "Magic number {{value}} used in a trust comparison. Replace with a named constant (e.g. TrustLevel.OPERATOR or TRUST_LEVELS.ELEVATED) so the intent is explicit.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxMagicValue: {
            type: 'number',
            description: 'Upper bound (inclusive) of the magic-number range to flag. Default: 5.',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    const options = (context.options[0] as { maxMagicValue?: number } | undefined) ?? {};
    const maxMagicValue = options.maxMagicValue ?? 5;

    return {
      BinaryExpression(node: Node): void {
        const binaryNode = node as BinaryExpression;

        if (!COMPARISON_OPERATORS.has(binaryNode.operator)) return;

        const { left, right } = binaryNode;

        // Pattern A: trust-related identifier OP numeric_literal
        if (nodeContainsTrustIdentifier(left) && isSmallNumericLiteral(right)) {
          const numericValue = (right as { value: number }).value;
          if (numericValue <= maxMagicValue) {
            context.report({
              node: right,
              messageId: 'hardcodedTrustLevel',
              data: { value: String(numericValue) },
            });
          }
          return;
        }

        // Pattern B: numeric_literal OP trust-related identifier (reversed)
        if (isSmallNumericLiteral(left) && nodeContainsTrustIdentifier(right)) {
          const numericValue = (left as { value: number }).value;
          if (numericValue <= maxMagicValue) {
            context.report({
              node: left,
              messageId: 'hardcodedTrustLevel',
              data: { value: String(numericValue) },
            });
          }
        }
      },
    };
  },
};

export default rule;
