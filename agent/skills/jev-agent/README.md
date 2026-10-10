# Jev Agent Skill

An Agent Skill for Claude Code, Codex, Cursor, and other compatible agents to
use the Jev AI typed decision API.

English is the default documentation and onboarding language. Simplified
Chinese is also supported with `JEV_LANGUAGE=zh-CN`.

On first use, the Skill guides the user through:

1. Language: English (`en-US`) by default, or Simplified Chinese (`zh-CN`);
2. API key: a Jev AI account key beginning with `sk_`;
3. Help: when to use Choice, Score, and Noul.

## Installation

```bash
npx skills add jev-ai/jev-agent-skill
```

For a manual project-local installation, copy `SKILL.md` to
`.agents/skills/jev-agent/SKILL.md`.

## Configuration

Create an API key at the [Jev AI API key page](https://thejevai.com/settings/apikeys).
Keep it in the local environment. Never commit it to Git or paste it into an
Agent conversation.

```bash
export JEV_API_KEY="sk_your_key_here"
export JEV_LANGUAGE="en-US"
```

To use Chinese guidance and examples:

```bash
export JEV_LANGUAGE="zh-CN"
```

Optional settings:

```bash
export JEV_API_BASE_URL="https://thejevai.com"
export JEV_MODEL="typesafe/jev-1.13"
```

The default endpoint is:

```text
POST https://thejevai.com/v1/systemone
Authorization: Bearer $JEV_API_KEY
```

## Basic usage

After installation, ask the Agent:

```text
Use the Jev Agent skill to decide which workflow should handle this task.
```

For setup and help:

```text
Use the Jev Agent skill to check my configuration and show the help guide.
```

Jev provides typed judgments. Your application still owns business logic,
permissions, human approval, and the final action.

## Five Agent examples

The following prompts can be copied directly to an Agent that has this Skill.
They use English because it is the default; set `JEV_LANGUAGE=zh-CN` to ask
the Agent to explain the workflow and write questions in Chinese.

### 1. Route a support ticket

```text
Use the Jev Agent skill. Classify this support ticket into exactly one team:
billing, technical, account, or sales. Return the selected team,
probabilities, and confidence. Do not contact the customer or modify any
ticket yet.

Ticket:
"I was charged twice for my annual plan and need a refund."
```

The Agent should use `choice` with the allowed teams in `criteria`. Application
code can route using `answers.route.choice`; low-confidence tickets should go
to human review.

### 2. Guard a tool call

```text
Use the Jev Agent skill before running this proposed tool call. Judge whether
it is safe to run without additional human approval. Consider the side
effects, reversibility, scope, and the stated policy. If the result is
uncertain or risky, do not execute the tool and explain what approval is
needed.

Tool: delete_customer_records
Arguments: {"where": "last_login < 2023-01-01"}
Policy: destructive database operations require a backup and human approval.
```

The Agent should use `noul` for the safety judgment. Jev provides a risk
signal; it does not replace permission checks, backup checks, or human approval.

### 3. Route an Agent to a model

```text
Use the Jev Agent skill to choose one approved model for this task. Optimize
for quality first, then context capacity and cost. Return the selected model,
the probabilities, and whether the task should be escalated because no
candidate is suitable. Do not call any model yet.

Task: review a 100k-token customer dispute and suggest a safe resolution.
Candidates:
- fast-model: 32k context, low cost, low latency, basic reasoning
- reasoning-model: 200k context, high cost, medium latency, strong reasoning
- fallback-model: 128k context, medium cost, high latency, no tool use
```

The Agent should use `choice` for the approved candidates and a separate
`noul` question for escalation. Candidates must come from the application's
allowlist; Jev must not invent an unauthorized model ID.

### 4. Verify research evidence

```text
Use the Jev Agent skill to check whether the evidence is sufficient to publish
the following claim. Consider source quality, freshness, direct support, and
contradictory evidence. Return a yes/no probability and list the missing
verification work. Do not publish or cite the claim yet.

Claim: "Our API reduced median processing time by 40%."
Evidence:
- an internal benchmark from last month with 120 test cases;
- no production traffic data;
- one older report showing a 12% improvement.
```

The Agent should use `noul` to judge whether the evidence supports publication.
If the evidence is insufficient, it should request production data or resolve
the conflicting report.

### 5. Review task completion

```text
Use the Jev Agent skill to review whether this task is actually complete.
Return one of: complete, verify_more, or incomplete. Consider the original
objective, the files changed, tests run, known gaps, and whether the result
was verified in the target environment. Do not claim completion if a required
check is still missing.

Objective: add API-key authentication to the production endpoint.
Completed work: added the Authorization header check and an API-key lookup.
Verification: unit tests pass; production request was not tested.
Known gap: rate-limit behavior has not been checked.
```

The Agent should use `choice` or `score` for completion status and map
`verify_more` to the next verification action instead of reporting that the
task is complete.

## Resources

- [Jev AI documentation](https://thejevai.com/docs)
- [Jev AI Playground](https://thejevai.com/playground)
- [API key management](https://thejevai.com/settings/apikeys)
