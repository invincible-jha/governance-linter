// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * Governance diagnostics provider.
 *
 * Analyses open VS Code documents for governance violations and returns
 * an array of vscode.Diagnostic objects. Each diagnostic carries:
 *   - A precise source range
 *   - A human-readable message with remediation guidance
 *   - A severity mapped from the extension configuration
 *   - A source tag ("aumos-governance") for filtering in the Problems panel
 *   - A rule code for the Quick Fix code-action provider
 *
 * Rule coverage:
 *   AUMOS-001  Ungoverned OpenAI API call (new / legacy SDK)
 *   AUMOS-002  Ungoverned Anthropic API call
 *   AUMOS-003  Ungoverned LangChain tool execution
 *   AUMOS-004  Missing trust level check before tool invocation
 *   AUMOS-005  Hardcoded trust level above the safe threshold
 *   AUMOS-006  Missing audit log after a governance decision
 */

import * as vscode from 'vscode';

// ── Rule identifiers ──────────────────────────────────────────────────────────

export const RULE_UNGOVERNED_OPENAI = 'AUMOS-001';
export const RULE_UNGOVERNED_ANTHROPIC = 'AUMOS-002';
export const RULE_UNGOVERNED_LANGCHAIN = 'AUMOS-003';
export const RULE_MISSING_TRUST_CHECK = 'AUMOS-004';
export const RULE_HARDCODED_TRUST_LEVEL = 'AUMOS-005';
export const RULE_MISSING_AUDIT_LOG = 'AUMOS-006';

export const DIAGNOSTIC_SOURCE = 'aumos-governance';

// Maximum trust level that may be hardcoded without a named constant.
// Values strictly greater than this trigger AUMOS-005.
const MAX_SAFE_LITERAL_TRUST_LEVEL = 3;

// ── Pattern definitions ───────────────────────────────────────────────────────

/**
 * Patterns that identify a raw (unwrapped) OpenAI API call.
 *
 * Matches:
 *   openai.ChatCompletion.create(...)          — legacy v3 SDK
 *   client.chat.completions.create(...)        — v4+ SDK
 *   new OpenAI(...)                            — client construction without wrapper
 *   openai.completions.create(...)             — legacy completions
 */
const OPENAI_RAW_CALL_PATTERNS: RegExp[] = [
  /openai\.ChatCompletion\.create\s*\(/,
  /\.chat\.completions\.create\s*\(/,
  /\.completions\.create\s*\(/,
  /new\s+OpenAI\s*\(/,
  /openai\.Completion\.create\s*\(/,
];

/**
 * Pattern that identifies a GovernedOpenAI wrapper or import, used to
 * suppress false positives when the wrapper is already in scope.
 */
const GOVERNED_OPENAI_PATTERN = /GovernedOpenAI|governed_openai|createGovernedAI/;

/**
 * Patterns that identify a raw Anthropic API call.
 *
 * Matches:
 *   client.messages.create(...)
 *   anthropic.messages.create(...)
 */
const ANTHROPIC_RAW_CALL_PATTERNS: RegExp[] = [
  /\.messages\.create\s*\(/,
  /anthropic\.messages\./,
  /new\s+Anthropic\s*\(/,
];

const GOVERNED_ANTHROPIC_PATTERN = /GovernedAnthropic|governed_anthropic/;

/**
 * Patterns for ungoverned LangChain tool execution.
 *
 * Matches:
 *   tool.run(...)
 *   chain.run(...)
 *   agent.run(...)
 *
 * Note: we look for .run( calls that are not inside a governance callback setup.
 */
const LANGCHAIN_TOOL_CALL_PATTERNS: RegExp[] = [
  /\b(?:tool|chain|agent|executor)\s*\.\s*run\s*\(/,
  /\b(?:tool|chain|agent)\s*\.\s*invoke\s*\(/,
  /\b(?:tool|chain|agent)\s*\.\s*execute\s*\(/,
];

const GOVERNANCE_CALLBACK_PATTERN = /AumOSGovernanceCallback|GovernanceCallback|governance_callback/;

/**
 * Pattern for a governance / trust check call.
 *
 * Matches:
 *   engine.check(...)
 *   governance.check(...)
 *   trust.verify(...)
 *   policy.permit(...)
 *   aumos.check(...)
 */
const TRUST_CHECK_PATTERN = /\b(?:engine|governance|trust|policy|aumos)\s*\.\s*(?:check|verify|validate|authorize|permit)\s*\(/;

/**
 * Patterns for audit log calls that record governance decisions.
 *
 * Matches:
 *   audit.log(...)
 *   logger.log(...)
 *   auditLog(...)
 *   audit.record(...)
 */
const AUDIT_LOG_PATTERN = /\b(?:audit|logger)\s*\.\s*(?:log|write|record|emit)\s*\(|\bauditLog\s*\(|\bauditAction\s*\(|\blogAction\s*\(/;

/**
 * Pattern for a governance decision assignment — the line that produces a
 * governed result which must subsequently be logged.
 *
 * Matches:
 *   const decision = engine.check(...)
 *   const permitted = governance.verify(...)
 *   const result = trust.authorize(...)
 */
const GOVERNANCE_DECISION_PATTERN = /(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?\b(?:engine|governance|trust|policy|aumos)\s*\.\s*(?:check|verify|validate|authorize|permit)\s*\(/;

/**
 * Pattern for a hardcoded trust level literal greater than the safe threshold.
 * Captures the numeric literal so it can be included in the diagnostic message.
 *
 * Matches:
 *   trust_level = 4
 *   trustLevel = 5
 *   level >= 4
 *   tier > 3
 */
const HARDCODED_HIGH_TRUST_PATTERN = /\b(?:trust(?:_?[Ll]evel)?|level|tier|clearance)\s*(?:=|>=|<=|>|<|===|!==)\s*([4-9]|\d{2,})\b|\b([4-9]|\d{2,})\s*(?:=|>=|<=|>|<|===|!==)\s*(?:trust(?:_?[Ll]evel)?|level|tier|clearance)\b/;

// ── Diagnostic helpers ────────────────────────────────────────────────────────

/**
 * Map a configuration severity string to a vscode.DiagnosticSeverity value.
 */
function resolveSeverity(configured: string): vscode.DiagnosticSeverity {
  switch (configured) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'information':
      return vscode.DiagnosticSeverity.Information;
    case 'hint':
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}

/**
 * Build a Diagnostic for a single matched line.
 */
function makeDiagnostic(
  lineIndex: number,
  matchStart: number,
  matchLength: number,
  message: string,
  ruleCode: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic {
  const range = new vscode.Range(
    lineIndex,
    matchStart,
    lineIndex,
    matchStart + matchLength,
  );
  const diagnostic = new vscode.Diagnostic(range, message, severity);
  diagnostic.source = DIAGNOSTIC_SOURCE;
  diagnostic.code = ruleCode;
  return diagnostic;
}

/**
 * Search for the first match of a pattern on a given line and return a
 * Diagnostic if found. Returns null when there is no match.
 */
function detectOnLine(
  lineText: string,
  lineIndex: number,
  pattern: RegExp,
  message: string,
  ruleCode: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic | null {
  const match = pattern.exec(lineText);
  if (!match) return null;
  return makeDiagnostic(
    lineIndex,
    match.index,
    match[0].length,
    message,
    ruleCode,
    severity,
  );
}

// ── Window-based helpers ──────────────────────────────────────────────────────

/**
 * Return the text of the N lines immediately before lineIndex, joined.
 * Used for "look-behind" checks (e.g. does a governance check precede this call?).
 */
function precedingContext(lines: readonly string[], lineIndex: number, windowSize: number): string {
  const start = Math.max(0, lineIndex - windowSize);
  return lines.slice(start, lineIndex).join('\n');
}

/**
 * Return the text of the N lines immediately after lineIndex, joined.
 * Used for "look-ahead" checks (e.g. does an audit log follow a decision?).
 */
function followingContext(lines: readonly string[], lineIndex: number, windowSize: number): string {
  const end = Math.min(lines.length, lineIndex + windowSize + 1);
  return lines.slice(lineIndex + 1, end).join('\n');
}

// ── Per-rule analysis functions ───────────────────────────────────────────────

/**
 * AUMOS-001: Ungoverned OpenAI API call.
 *
 * Reports when a raw OpenAI API call is found and the file does not
 * contain a GovernedOpenAI / createGovernedAI import or assignment in
 * the 30 lines surrounding the call.
 */
function checkUngovernedOpenAI(
  lines: readonly string[],
  fullText: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic[] {
  // If the file already imports a governed wrapper, suppress all AUMOS-001.
  if (GOVERNED_OPENAI_PATTERN.test(fullText)) return [];

  const diagnostics: vscode.Diagnostic[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineText = lines[lineIndex] ?? '';

    for (const pattern of OPENAI_RAW_CALL_PATTERNS) {
      const diagnostic = detectOnLine(
        lineText,
        lineIndex,
        pattern,
        'Ungoverned OpenAI API call. Wrap the client with GovernedOpenAI or ' +
          "import createGovernedAI from '@aumos/governance' to enforce trust " +
          'checks and budget limits before each request.',
        RULE_UNGOVERNED_OPENAI,
        severity,
      );
      if (diagnostic) {
        diagnostics.push(diagnostic);
        break; // one diagnostic per line per rule
      }
    }
  }

  return diagnostics;
}

/**
 * AUMOS-002: Ungoverned Anthropic API call.
 */
function checkUngovernedAnthropic(
  lines: readonly string[],
  fullText: string,
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic[] {
  if (GOVERNED_ANTHROPIC_PATTERN.test(fullText)) return [];

  const diagnostics: vscode.Diagnostic[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineText = lines[lineIndex] ?? '';

    for (const pattern of ANTHROPIC_RAW_CALL_PATTERNS) {
      const diagnostic = detectOnLine(
        lineText,
        lineIndex,
        pattern,
        'Ungoverned Anthropic API call. Wrap the client with GovernedAnthropic ' +
          "or import createGovernedAI from '@aumos/governance' to ensure " +
          'governance checks run before every messages.create() call.',
        RULE_UNGOVERNED_ANTHROPIC,
        severity,
      );
      if (diagnostic) {
        diagnostics.push(diagnostic);
        break;
      }
    }
  }

  return diagnostics;
}

/**
 * AUMOS-003: Ungoverned LangChain tool execution.
 *
 * A LangChain tool/chain.run() call is considered governed when
 * AumOSGovernanceCallback (or equivalent) is referenced anywhere in
 * the 40 lines surrounding the call site.
 */
function checkUngovernedLangChain(
  lines: readonly string[],
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const CONTEXT_WINDOW = 40;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineText = lines[lineIndex] ?? '';

    for (const pattern of LANGCHAIN_TOOL_CALL_PATTERNS) {
      if (!pattern.test(lineText)) continue;

      const surrounding =
        precedingContext(lines, lineIndex, CONTEXT_WINDOW) +
        '\n' +
        followingContext(lines, lineIndex, CONTEXT_WINDOW);

      if (!GOVERNANCE_CALLBACK_PATTERN.test(surrounding)) {
        const match = pattern.exec(lineText);
        if (match) {
          diagnostics.push(
            makeDiagnostic(
              lineIndex,
              match.index,
              match[0].length,
              'LangChain tool call without an AumOS governance callback. ' +
                'Add AumOSGovernanceCallback to the agent/chain callbacks list ' +
                'so every tool invocation is checked against the governance policy.',
              RULE_UNGOVERNED_LANGCHAIN,
              severity,
            ),
          );
        }
      }
      break; // one diagnostic per line per rule
    }
  }

  return diagnostics;
}

/**
 * AUMOS-004: Missing trust level check before tool invocation.
 *
 * Flags tool invocation patterns (tool.run / execute / invoke) that are
 * not preceded by a trust/governance check within a 20-line window.
 */
function checkMissingTrustCheck(
  lines: readonly string[],
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const LOOK_BEHIND = 20;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineText = lines[lineIndex] ?? '';

    for (const pattern of LANGCHAIN_TOOL_CALL_PATTERNS) {
      if (!pattern.test(lineText)) continue;

      const preceding = precedingContext(lines, lineIndex, LOOK_BEHIND);

      if (!TRUST_CHECK_PATTERN.test(preceding)) {
        const match = pattern.exec(lineText);
        if (match) {
          diagnostics.push(
            makeDiagnostic(
              lineIndex,
              match.index,
              match[0].length,
              'Tool invocation without a preceding trust level check. ' +
                'Call engine.check() or governance.verify() before invoking ' +
                'this tool to ensure the caller has the required trust level.',
              RULE_MISSING_TRUST_CHECK,
              severity,
            ),
          );
        }
      }
      break;
    }
  }

  return diagnostics;
}

/**
 * AUMOS-005: Hardcoded trust level above the safe threshold.
 *
 * Flags numeric literals greater than MAX_SAFE_LITERAL_TRUST_LEVEL
 * when used in a comparison or assignment with a trust-related identifier.
 */
function checkHardcodedTrustLevel(
  lines: readonly string[],
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineText = lines[lineIndex] ?? '';
    const match = HARDCODED_HIGH_TRUST_PATTERN.exec(lineText);
    if (!match) continue;

    // Extract the captured numeric literal from either capture group
    const literalStr = match[1] ?? match[2] ?? '';
    const literalValue = parseInt(literalStr, 10);

    if (!isNaN(literalValue) && literalValue > MAX_SAFE_LITERAL_TRUST_LEVEL) {
      diagnostics.push(
        makeDiagnostic(
          lineIndex,
          match.index,
          match[0].length,
          `Trust level ${literalValue} is hardcoded. Use a named constant from ` +
            "TrustLevel (e.g. TrustLevel.OPERATOR) so the trust model can be " +
            'changed centrally without hunting for magic numbers.',
          RULE_HARDCODED_TRUST_LEVEL,
          severity,
        ),
      );
    }
  }

  return diagnostics;
}

/**
 * AUMOS-006: Missing audit log after a governance decision.
 *
 * Flags lines that produce a governance decision (const result = engine.check(...))
 * when no audit log call appears within the next 15 lines.
 */
function checkMissingAuditLog(
  lines: readonly string[],
  severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const LOOK_AHEAD = 15;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineText = lines[lineIndex] ?? '';

    if (!GOVERNANCE_DECISION_PATTERN.test(lineText)) continue;

    const following = followingContext(lines, lineIndex, LOOK_AHEAD);

    if (!AUDIT_LOG_PATTERN.test(following)) {
      const match = GOVERNANCE_DECISION_PATTERN.exec(lineText);
      if (match) {
        diagnostics.push(
          makeDiagnostic(
            lineIndex,
            match.index,
            match[0].length,
            'Governance decision is not logged to the audit trail. ' +
              'Call audit.log() or auditLog() with the decision result ' +
              'so that every governance outcome is recorded for compliance.',
            RULE_MISSING_AUDIT_LOG,
            severity,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse a VS Code TextDocument and return governance Diagnostics.
 *
 * Only TypeScript, JavaScript, and Python documents are analysed;
 * all other language IDs receive an empty array.
 */
export function analyzeDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
  const languageId = document.languageId;
  if (languageId !== 'typescript' && languageId !== 'javascript' && languageId !== 'python') {
    return [];
  }

  const config = vscode.workspace.getConfiguration('aumos.governance');
  const configuredSeverity: string = config.get<string>('severity', 'warning');
  const severity = resolveSeverity(configuredSeverity);

  const fullText = document.getText();
  const lines: readonly string[] = fullText.split('\n');

  return [
    ...checkUngovernedOpenAI(lines, fullText, severity),
    ...checkUngovernedAnthropic(lines, fullText, severity),
    ...checkUngovernedLangChain(lines, severity),
    ...checkMissingTrustCheck(lines, severity),
    ...checkHardcodedTrustLevel(lines, severity),
    ...checkMissingAuditLog(lines, severity),
  ];
}
