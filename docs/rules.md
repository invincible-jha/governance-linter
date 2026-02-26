# Governance Lint Rules

This document describes all five rules shipped in `eslint-plugin-aumos-governance` (TypeScript) and `aumos-governance-linter` (Python). Both implementations share the same rule IDs, rationale, and detection logic.

---

## Table of Contents

1. [no-ungoverned-tool-call](#no-ungoverned-tool-call)
2. [no-unlogged-action](#no-unlogged-action)
3. [no-hardcoded-trust-level](#no-hardcoded-trust-level)
4. [require-consent-check](#require-consent-check)
5. [require-budget-check](#require-budget-check)

---

## no-ungoverned-tool-call

**Severity (recommended):** `error`

**Category:** Governance enforcement

### Rationale

Every action an agent takes through a tool must be authorised by the governance layer before execution. Calling a tool without a prior governance check means the agent can perform arbitrary actions without policy enforcement, bypassing trust gates and audit pipelines.

### What is detected

Function calls to known tool invocation patterns (`tool.run()`, `tool.execute()`, `tool.invoke()`, `executor.call()`, `agent.dispatch()`, etc.) that are **not** preceded by a governance check (`engine.check()`, `governance.verify()`, `trust.authorize()`, `policy.permit()`, etc.) in the same function scope.

### Failing example

```typescript
async function runAgentTask(taskId: string) {
  const result = await tool.run(taskId);  // error: no governance check
  return result;
}
```

```python
async def run_agent_task(task_id: str):
    result = await tool.run(task_id)  # error: no governance check
    return result
```

### Passing example

```typescript
async function runAgentTask(taskId: string) {
  await engine.check("run-task", { taskId });
  const result = await tool.run(taskId);  // OK
  return result;
}
```

```python
async def run_agent_task(task_id: str):
    await engine.check("run-task", {"task_id": task_id})
    result = await tool.run(task_id)  # OK
    return result
```

### Recognised patterns

| Side | Objects | Methods |
|------|---------|---------|
| Tool call | `tool`, `tools`, `agent`, `executor` | `run`, `execute`, `invoke`, `call`, `dispatch` |
| Governance check | `engine`, `governance`, `trust`, `policy`, `aumos` | `check`, `verify`, `validate`, `authorize`, `permit` |

---

## no-unlogged-action

**Severity (recommended):** `warn`

**Category:** Audit trail

### Rationale

Governance decisions must be auditable. If a check is performed but the outcome is never recorded, the system cannot be retrospectively audited, which breaks compliance requirements and makes incident investigation impossible.

### What is detected

Governance check calls (`engine.check()`, `governance.verify()`, etc.) that appear in a function scope where **no** audit log call (`audit.log()`, `logger.log()`, `auditLog()`, etc.) exists anywhere in the same function.

Note: The log call need not immediately follow the check — it may be in a `try/finally` block or conditional branch. The rule only requires that at least one log call is present in the same function scope.

### Failing example

```typescript
async function authoriseAction(action: string) {
  const permitted = await engine.check(action);
  // warn: permitted is never logged
  return permitted;
}
```

```python
async def authorise_action(action: str) -> bool:
    permitted = await engine.check(action)
    # warn: result is never logged
    return permitted
```

### Passing example

```typescript
async function authoriseAction(action: string) {
  const permitted = await engine.check(action);
  await audit.log({ action, permitted });
  return permitted;
}
```

```python
async def authorise_action(action: str) -> bool:
    permitted = await engine.check(action)
    await audit.log({"action": action, "permitted": permitted})
    return permitted
```

### Recognised patterns

| Side | Objects | Methods / Functions |
|------|---------|---------------------|
| Governance check | `engine`, `governance`, `trust`, `policy`, `aumos` | `check`, `verify`, `validate`, `authorize`, `permit` |
| Audit log | `audit`, `logger`, `log`, `auditLog` | `log`, `write`, `record`, `emit`, `info`, `debug`, `warn`, `error` |
| Audit function (standalone) | — | `auditLog`, `auditAction`, `logAction`, `recordAction` |

---

## no-hardcoded-trust-level

**Severity (recommended):** `warn`

**Category:** Maintainability

### Rationale

Hard-coded numeric trust levels (e.g. `if (level >= 3)`) are brittle and unclear. They require readers to know the trust model by heart and make refactoring dangerous. Named constants document intent and allow the trust model to be changed in one place.

### What is detected

Numeric literals in the range 0–5 used as the operand of a binary comparison (`===`, `!==`, `<`, `<=`, `>`, `>=`) where the other operand contains a trust-related identifier fragment (`trust`, `level`, `tier`, `clearance`).

### Failing example

```typescript
if (agent.trustLevel >= 3) {        // warn: magic number
  performPrivilegedAction();
}

if (level === 0) {                  // warn: magic number
  denyAccess();
}
```

```python
if agent.trust_level >= 3:         # warn: magic number
    perform_privileged_action()

if level == 0:                     # warn: magic number
    deny_access()
```

### Passing example

```typescript
import { TrustLevel } from '@aumos/core';

if (agent.trustLevel >= TrustLevel.OPERATOR) {  // OK
  performPrivilegedAction();
}
```

```python
from aumos_core import TrustLevel

if agent.trust_level >= TrustLevel.OPERATOR:    # OK
    perform_privileged_action()
```

---

## require-consent-check

**Severity (recommended):** `warn`

**Category:** Privacy / consent

### Rationale

Accessing personal or sensitive data without first verifying that the user or data subject has consented is a privacy violation (GDPR, CCPA, etc.). The consent check must precede the data access so that the access never occurs if consent is absent.

### What is detected

Data-access calls (`db.query()`, `repo.find()`, `user.fetch()`, etc.) that are **not** preceded by a consent check (`consent.check()`, `privacy.verify()`, `permissions.isAllowed()`, etc.) in the same function scope.

### Failing example

```typescript
async function getUserProfile(userId: string) {
  const profile = await db.findById(userId);  // warn: no consent check
  return profile;
}
```

```python
async def get_user_profile(user_id: str):
    profile = await db.find_by_id(user_id)   # warn: no consent check
    return profile
```

### Passing example

```typescript
async function getUserProfile(userId: string) {
  await consent.check({ userId, purpose: "profile-display" });
  const profile = await db.findById(userId);  // OK
  return profile;
}
```

```python
async def get_user_profile(user_id: str):
    await consent.check({"user_id": user_id, "purpose": "profile-display"})
    profile = await db.find_by_id(user_id)   # OK
    return profile
```

### Recognised patterns

| Side | Objects | Methods |
|------|---------|---------|
| Data access | `db`, `database`, `repo`, `repository`, `store`, `user`, `users`, `profile`, `customer` | `query`, `find`, `find_one`, `findOne`, `find_all`, `findAll`, `find_by_id`, `findById`, `fetch`, `get`, `read`, `select`, `load` |
| Consent check | `consent`, `privacy`, `gdpr`, `permissions` | `check`, `verify`, `has_consent`, `hasConsent`, `is_allowed`, `isAllowed`, `grant` |

---

## require-budget-check

**Severity (recommended):** `warn`

**Category:** Cost governance

### Rationale

Agent systems can consume significant resources through LLM API calls and external API usage. Without a prior budget check, an agent may exceed configured cost limits, causing unexpected charges or resource exhaustion. The budget check must precede the spend so the call is blocked if the budget is insufficient.

### What is detected

Spending / LLM calls (`openai.chat()`, `llm.complete()`, `tokens.use()`, `api.call()`, etc.) that are **not** preceded by a budget check (`budget.check()`, `cost.verify()`, `quota.canSpend()`, etc.) in the same function scope.

### Failing example

```typescript
async function generateSummary(text: string) {
  const response = await openai.chat({ messages: [{ role: "user", content: text }] });
  // warn: no budget check
  return response.content;
}
```

```python
async def generate_summary(text: str) -> str:
    response = await openai.chat(messages=[{"role": "user", "content": text}])
    # warn: no budget check
    return response.content
```

### Passing example

```typescript
async function generateSummary(text: string) {
  await budget.check({ operation: "chat-completion", estimatedTokens: 500 });
  const response = await openai.chat({ messages: [{ role: "user", content: text }] });
  return response.content;
}
```

```python
async def generate_summary(text: str) -> str:
    await budget.check({"operation": "chat-completion", "estimated_tokens": 500})
    response = await openai.chat(messages=[{"role": "user", "content": text}])
    return response.content
```

### Recognised patterns

| Side | Objects | Methods |
|------|---------|---------|
| Spend | `api`, `openai`, `anthropic`, `llm`, `model`, `tokens`, `completion`, `embedding` | `call`, `chat`, `complete`, `generate`, `embed`, `use`, `consume`, `request`, `create`, `create_completion`, `createCompletion`, `create_chat_completion`, `createChatCompletion` |
| Budget check | `budget`, `cost`, `quota`, `spend`, `billing`, `tokens` | `check`, `verify`, `can_spend`, `canSpend`, `has_quota`, `hasQuota`, `authorize`, `reserve` |
