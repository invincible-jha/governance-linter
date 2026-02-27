// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 MuVeraAI Corporation

/**
 * AumOS Governance Linter — VS Code extension entry point.
 *
 * Lifecycle:
 *   activate()    — called once when the first matching language opens.
 *                   Registers the diagnostic collection, file watchers,
 *                   and command handlers.
 *   deactivate()  — called on extension unload; performs cleanup.
 *
 * Diagnostic refresh is triggered by:
 *   - Document open / editor focus change
 *   - Document save (when aumos.governance.checkOnSave is true)
 *   - Document change (when aumos.governance.checkOnType is true)
 *   - Manual command: aumos.governance.lint
 *
 * Code actions (quick fixes) are provided by GovernanceCodeActionProvider.
 */

import * as vscode from 'vscode';
import {
  analyzeDocument,
  DIAGNOSTIC_SOURCE,
  RULE_UNGOVERNED_OPENAI,
  RULE_UNGOVERNED_ANTHROPIC,
  RULE_UNGOVERNED_LANGCHAIN,
  RULE_MISSING_TRUST_CHECK,
  RULE_HARDCODED_TRUST_LEVEL,
  RULE_MISSING_AUDIT_LOG,
} from './diagnostics.js';

// ── Supported languages ───────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = new Set(['typescript', 'javascript', 'python']);

// ── Configuration helpers ─────────────────────────────────────────────────────

function isEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('aumos.governance')
    .get<boolean>('enabled', true);
}

function checkOnSave(): boolean {
  return vscode.workspace
    .getConfiguration('aumos.governance')
    .get<boolean>('checkOnSave', true);
}

function checkOnType(): boolean {
  return vscode.workspace
    .getConfiguration('aumos.governance')
    .get<boolean>('checkOnType', false);
}

// ── Diagnostic runner ─────────────────────────────────────────────────────────

/**
 * Run governance analysis on *document* and push the results into
 * *collection*. Clears existing diagnostics for the document first.
 * No-ops when the extension is disabled or the language is unsupported.
 */
function refreshDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
): void {
  if (!isEnabled()) {
    collection.delete(document.uri);
    return;
  }

  if (!SUPPORTED_LANGUAGES.has(document.languageId)) {
    return;
  }

  const diagnostics = analyzeDocument(document);
  collection.set(document.uri, diagnostics);
}

// ── Quick-fix code action provider ───────────────────────────────────────────

/**
 * Provides one-click quick fixes for each governance rule.
 *
 * Each fix inserts the minimal governance boilerplate immediately above the
 * flagged line so the developer only needs to fill in the action/identifier.
 */
class GovernanceCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== DIAGNOSTIC_SOURCE) continue;

      const action = this.buildFix(document, diagnostic);
      if (action) actions.push(action);
    }

    return actions;
  }

  private buildFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const ruleCode = diagnostic.code as string | undefined;
    if (!ruleCode) return null;

    const lineIndex = diagnostic.range.start.line;
    const lineText = document.lineAt(lineIndex).text;
    const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
    const insertPosition = new vscode.Position(lineIndex, 0);

    switch (ruleCode) {
      case RULE_UNGOVERNED_OPENAI:
        return this.makeInsertAction(
          diagnostic,
          "Wrap with GovernedOpenAI",
          insertPosition,
          buildGovernedOpenAISnippet(document.languageId, indent),
        );

      case RULE_UNGOVERNED_ANTHROPIC:
        return this.makeInsertAction(
          diagnostic,
          "Wrap with GovernedAnthropic",
          insertPosition,
          buildGovernedAnthropicSnippet(document.languageId, indent),
        );

      case RULE_UNGOVERNED_LANGCHAIN:
        return this.makeInsertAction(
          diagnostic,
          "Add AumOS governance callback",
          insertPosition,
          buildLangChainCallbackSnippet(document.languageId, indent),
        );

      case RULE_MISSING_TRUST_CHECK:
        return this.makeInsertAction(
          diagnostic,
          "Add governance check before tool call",
          insertPosition,
          buildGovernanceCheckSnippet(document.languageId, indent),
        );

      case RULE_HARDCODED_TRUST_LEVEL:
        return this.makeInsertAction(
          diagnostic,
          "Replace magic number with TrustLevel constant",
          insertPosition,
          buildTrustLevelImportSnippet(document.languageId, indent),
        );

      case RULE_MISSING_AUDIT_LOG:
        return this.makeInsertAction(
          diagnostic,
          "Add audit log for governance decision",
          new vscode.Position(lineIndex + 1, 0),
          buildAuditLogSnippet(document.languageId, indent),
        );

      default:
        return null;
    }
  }

  private makeInsertAction(
    diagnostic: vscode.Diagnostic,
    title: string,
    position: vscode.Position,
    insertText: string,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(
      vscode.window.activeTextEditor?.document.uri ?? ({} as vscode.Uri),
      position,
      insertText,
    );
    return action;
  }
}

// ── Snippet builders ──────────────────────────────────────────────────────────

function buildGovernedOpenAISnippet(languageId: string, indent: string): string {
  if (languageId === 'python') {
    return (
      `${indent}# TODO: replace raw OpenAI client with GovernedOpenAI wrapper\n` +
      `${indent}from aumos_governance import GovernedOpenAI\n` +
      `${indent}governed_openai = GovernedOpenAI(trust_level=2)\n`
    );
  }
  return (
    `${indent}// TODO: replace raw OpenAI client with GovernedOpenAI wrapper\n` +
    `${indent}import { createGovernedAI } from '@aumos/governance';\n` +
    `${indent}const governed = createGovernedAI({ trustLevel: 2, budget: { daily: 10 } });\n`
  );
}

function buildGovernedAnthropicSnippet(languageId: string, indent: string): string {
  if (languageId === 'python') {
    return (
      `${indent}# TODO: replace raw Anthropic client with GovernedAnthropic wrapper\n` +
      `${indent}from aumos_governance import GovernedAnthropic\n` +
      `${indent}governed_anthropic = GovernedAnthropic(trust_level=2)\n`
    );
  }
  return (
    `${indent}// TODO: replace raw Anthropic client with GovernedAnthropic wrapper\n` +
    `${indent}import { createGovernedAI } from '@aumos/governance';\n` +
    `${indent}const governed = createGovernedAI({ provider: 'anthropic', trustLevel: 2 });\n`
  );
}

function buildLangChainCallbackSnippet(languageId: string, indent: string): string {
  if (languageId === 'python') {
    return (
      `${indent}# TODO: add AumOS governance callback to this chain/agent\n` +
      `${indent}from aumos_governance.langchain import AumOSGovernanceCallback\n` +
      `${indent}governance_callback = AumOSGovernanceCallback(trust_level=2)\n`
    );
  }
  return (
    `${indent}// TODO: add AumOS governance callback to this chain/agent\n` +
    `${indent}import { AumOSGovernanceCallback } from '@aumos/governance-langchain';\n` +
    `${indent}const governanceCallback = new AumOSGovernanceCallback({ trustLevel: 2 });\n`
  );
}

function buildGovernanceCheckSnippet(languageId: string, indent: string): string {
  if (languageId === 'python') {
    return (
      `${indent}# TODO: add governance check with the correct action name\n` +
      `${indent}await engine.check("action-name")\n`
    );
  }
  return (
    `${indent}// TODO: add governance check with the correct action name\n` +
    `${indent}await engine.check('action-name');\n`
  );
}

function buildTrustLevelImportSnippet(languageId: string, indent: string): string {
  if (languageId === 'python') {
    return `${indent}from aumos_core import TrustLevel  # use TrustLevel.OPERATOR instead of a literal\n`;
  }
  return `${indent}import { TrustLevel } from '@aumos/core'; // use TrustLevel.OPERATOR instead of a literal\n`;
}

function buildAuditLogSnippet(languageId: string, indent: string): string {
  if (languageId === 'python') {
    return `${indent}await audit.log({"decision": decision, "action": "TODO: action-name"})\n`;
  }
  return `${indent}await audit.log({ decision, action: 'TODO: action-name' });\n`;
}

// ── Extension lifecycle ───────────────────────────────────────────────────────

/**
 * Called once by VS Code when the extension activates.
 * All disposables are pushed onto *context.subscriptions* so VS Code cleans
 * them up automatically on deactivation.
 */
export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
  context.subscriptions.push(collection);

  // Analyse the document that is already open when the extension activates.
  if (vscode.window.activeTextEditor) {
    refreshDiagnostics(vscode.window.activeTextEditor.document, collection);
  }

  // Refresh when the active editor changes (e.g. switching tabs).
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        refreshDiagnostics(editor.document, collection);
      }
    }),
  );

  // Refresh on save when checkOnSave is enabled.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (checkOnSave()) {
        refreshDiagnostics(document, collection);
      }
    }),
  );

  // Refresh on every edit when checkOnType is enabled.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (checkOnType()) {
        refreshDiagnostics(event.document, collection);
      }
    }),
  );

  // Remove diagnostics when a file is closed.
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      collection.delete(document.uri);
    }),
  );

  // Re-analyse all open editors when configuration changes.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('aumos.governance')) {
        for (const editor of vscode.window.visibleTextEditors) {
          refreshDiagnostics(editor.document, collection);
        }
      }
    }),
  );

  // Command: manually trigger lint on the active document.
  context.subscriptions.push(
    vscode.commands.registerCommand('aumos.governance.lint', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showWarningMessage('AumOS: No active editor to lint.');
        return;
      }
      refreshDiagnostics(editor.document, collection);
      const count = collection.get(editor.document.uri)?.length ?? 0;
      void vscode.window.showInformationMessage(
        `AumOS Governance Lint: ${count === 0 ? 'No violations found.' : `${count} violation${count === 1 ? '' : 's'} found.`}`,
      );
    }),
  );

  // Command: apply all available auto-fixes in the active document.
  context.subscriptions.push(
    vscode.commands.registerCommand('aumos.governance.fix', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showWarningMessage('AumOS: No active editor.');
        return;
      }

      // Trigger VS Code's built-in "fix all" for our source.
      await vscode.commands.executeCommand('editor.action.codeAction', {
        kind: vscode.CodeActionKind.QuickFix.value,
        apply: 'all',
      });
    }),
  );

  // Register the quick-fix code action provider for supported languages.
  const selector: vscode.DocumentSelector = [
    { language: 'typescript', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'python', scheme: 'file' },
  ];

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      selector,
      new GovernanceCodeActionProvider(),
      { providedCodeActionKinds: GovernanceCodeActionProvider.providedCodeActionKinds },
    ),
  );
}

/**
 * Called by VS Code when the extension is deactivated.
 * Subscriptions registered on context.subscriptions are disposed automatically;
 * this function exists for any additional teardown if needed in the future.
 */
export function deactivate(): void {
  // All disposables are managed via context.subscriptions — nothing extra needed.
}
