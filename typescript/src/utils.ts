// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

import type { Rule } from 'eslint';
import type { CallExpression, Node, MemberExpression, Identifier } from 'estree';

/**
 * Object method names that indicate a governance / trust check.
 * e.g. engine.check(), governance.check(), trust.verify()
 */
const GOVERNANCE_OBJECT_NAMES = new Set([
  'engine',
  'governance',
  'trust',
  'policy',
  'aumos',
]);

const GOVERNANCE_METHOD_NAMES = new Set([
  'check',
  'verify',
  'validate',
  'authorize',
  'permit',
]);

/**
 * Object method names that indicate a tool invocation.
 * e.g. tool.run(), tool.execute(), tool.invoke()
 */
const TOOL_OBJECT_NAMES = new Set(['tool', 'tools', 'agent', 'executor']);

const TOOL_METHOD_NAMES = new Set([
  'run',
  'execute',
  'invoke',
  'call',
  'dispatch',
]);

/**
 * Object and function names that indicate an audit / structured log call.
 * e.g. audit.log(), logger.log(), auditLog()
 */
const AUDIT_OBJECT_NAMES = new Set(['audit', 'logger', 'log', 'auditLog']);

const AUDIT_METHOD_NAMES = new Set(['log', 'write', 'record', 'emit', 'info', 'debug', 'warn', 'error']);

const AUDIT_FUNCTION_NAMES = new Set(['auditLog', 'auditAction', 'logAction', 'recordAction']);

/**
 * Object and method names that indicate a consent check.
 * e.g. consent.check(), privacy.verify()
 */
const CONSENT_OBJECT_NAMES = new Set(['consent', 'privacy', 'gdpr', 'permissions']);

const CONSENT_METHOD_NAMES = new Set(['check', 'verify', 'hasConsent', 'isAllowed', 'grant']);

/**
 * Object and method names that indicate a budget check.
 * e.g. budget.check(), cost.verify(), quota.check()
 */
const BUDGET_OBJECT_NAMES = new Set(['budget', 'cost', 'quota', 'spend', 'billing', 'tokens']);

const BUDGET_METHOD_NAMES = new Set(['check', 'verify', 'canSpend', 'hasQuota', 'authorize', 'reserve']);

/**
 * Data-access patterns that require a prior consent check.
 * e.g. db.query(), db.find(), user.fetch()
 */
const DATA_ACCESS_OBJECT_NAMES = new Set(['db', 'database', 'repo', 'repository', 'store', 'user', 'users', 'profile', 'customer']);

const DATA_ACCESS_METHOD_NAMES = new Set(['query', 'find', 'findOne', 'findAll', 'findById', 'fetch', 'get', 'read', 'select', 'load']);

/**
 * Spending / cost patterns that require a prior budget check.
 * e.g. api.call(), openai.chat(), tokens.use()
 */
const SPEND_OBJECT_NAMES = new Set(['api', 'openai', 'anthropic', 'llm', 'model', 'tokens', 'completion', 'embedding']);

const SPEND_METHOD_NAMES = new Set(['call', 'chat', 'complete', 'generate', 'embed', 'use', 'consume', 'request', 'createCompletion', 'createChatCompletion']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMemberExpressionParts(node: MemberExpression): { object: string; property: string } | null {
  if (
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier'
  ) {
    return {
      object: (node.object as Identifier).name,
      property: (node.property as Identifier).name,
    };
  }
  return null;
}

function getCalleeIdentifier(node: CallExpression): string | null {
  if (node.callee.type === 'Identifier') {
    return (node.callee as Identifier).name;
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true when the CallExpression looks like a governance / trust check.
 * Matches: engine.check(), governance.verify(), trust.authorize(), etc.
 */
export function isGovernanceCheck(node: CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    GOVERNANCE_OBJECT_NAMES.has(parts.object) &&
    GOVERNANCE_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Returns true when the CallExpression looks like a tool invocation.
 * Matches: tool.run(), tool.execute(), tool.invoke(), executor.call(), etc.
 */
export function isToolCall(node: CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    TOOL_OBJECT_NAMES.has(parts.object) &&
    TOOL_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Returns true when the CallExpression looks like an audit / structured log call.
 * Matches: audit.log(), logger.log(), auditLog(), etc.
 */
export function isAuditLog(node: CallExpression): boolean {
  // Plain function call: auditLog(), logAction()
  const functionName = getCalleeIdentifier(node);
  if (functionName && AUDIT_FUNCTION_NAMES.has(functionName)) return true;

  // Method call: audit.log(), logger.write()
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    AUDIT_OBJECT_NAMES.has(parts.object) &&
    AUDIT_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Returns true when the CallExpression looks like a consent check.
 * Matches: consent.check(), privacy.verify(), permissions.isAllowed(), etc.
 */
export function isConsentCheck(node: CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    CONSENT_OBJECT_NAMES.has(parts.object) &&
    CONSENT_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Returns true when the CallExpression looks like a budget check.
 * Matches: budget.check(), cost.verify(), quota.canSpend(), etc.
 */
export function isBudgetCheck(node: CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    BUDGET_OBJECT_NAMES.has(parts.object) &&
    BUDGET_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Returns true when the CallExpression looks like a data-access operation.
 * Matches: db.query(), repo.findById(), user.fetch(), etc.
 */
export function isDataAccessCall(node: CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    DATA_ACCESS_OBJECT_NAMES.has(parts.object) &&
    DATA_ACCESS_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Returns true when the CallExpression looks like a spending / LLM call.
 * Matches: openai.chat(), llm.complete(), tokens.use(), etc.
 */
export function isSpendCall(node: CallExpression): boolean {
  if (node.callee.type !== 'MemberExpression') return false;
  const parts = getMemberExpressionParts(node.callee as MemberExpression);
  if (!parts) return false;
  return (
    SPEND_OBJECT_NAMES.has(parts.object) &&
    SPEND_METHOD_NAMES.has(parts.property)
  );
}

/**
 * Extracts a human-readable action name from a governance check call.
 * e.g. engine.check("read-file") => "read-file"
 *      governance.check(actionName) => "actionName"
 */
export function extractActionName(node: CallExpression): string | undefined {
  const firstArg = node.arguments[0];
  if (!firstArg) return undefined;

  if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
    return firstArg.value;
  }
  if (firstArg.type === 'Identifier') {
    return (firstArg as Identifier).name;
  }
  return undefined;
}

/**
 * Walks up the AST ancestry to find the nearest enclosing function node.
 * Returns null if no enclosing function is found (top-level code).
 */
export function findEnclosingFunction(
  node: Node,
  ancestors: Node[],
): Node | null {
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const ancestor = ancestors[index];
    if (!ancestor) continue;
    if (
      ancestor.type === 'FunctionDeclaration' ||
      ancestor.type === 'FunctionExpression' ||
      ancestor.type === 'ArrowFunctionExpression'
    ) {
      return ancestor;
    }
  }
  return null;
}

/**
 * Collects all CallExpression nodes within a given subtree node.
 * Used to search a function body for prior checks.
 */
export function collectCallExpressions(node: Node): CallExpression[] {
  const results: CallExpression[] = [];

  function walk(current: Node): void {
    if (current.type === 'CallExpression') {
      results.push(current as CallExpression);
    }
    for (const key of Object.keys(current)) {
      const child = (current as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            walk(item as Node);
          }
        }
      } else if (child && typeof child === 'object' && 'type' in child) {
        walk(child as Node);
      }
    }
  }

  walk(node);
  return results;
}

/**
 * Returns true if any CallExpression in the list appears before
 * the target node (by source location).
 */
export function anyCallPrecedesNode(
  calls: CallExpression[],
  targetNode: Node,
  predicate: (call: CallExpression) => boolean,
): boolean {
  const targetLine = (targetNode as { loc?: { start: { line: number } } }).loc?.start.line ?? Infinity;
  const targetCol = (targetNode as { loc?: { start: { column: number } } }).loc?.start.column ?? Infinity;

  return calls.some((call) => {
    if (!predicate(call)) return false;
    const callLine = (call as { loc?: { start: { line: number } } }).loc?.start.line ?? Infinity;
    const callCol = (call as { loc?: { start: { column: number } } }).loc?.start.column ?? Infinity;
    if (callLine < targetLine) return true;
    if (callLine === targetLine && callCol < targetCol) return true;
    return false;
  });
}

// Re-export the RuleContext type alias used across rules
export type RuleContext = Rule.RuleContext;
