# Phase 3: Specification

> Read this file in full when entering spec drafting. Directory conventions and the traceability summary live in `SKILL.md`.

The Spec answers: **"How does the system work?"** Specs are **required** for any feature that goes through this workflow, regardless of whether an ADR exists.

Specs live in the repo's specs directory (default `docs/specs/`, but check for an existing repo convention first — see "Directory conventions" in `SKILL.md`) and follow the naming convention `YYYY-MM-DD-spec-name.md`.

## Phased projects: one spec per phase

When the effort is phased (see the "Phasing" checklist item in `phases/discovery.md`), do not write one monolithic spec covering every phase. Each phase gets its own spec file — a reviewer should be able to read and approve the spec for the phase about to be built without digesting the whole project.

- **The phase map is defined up front, with a brief per phase.** The ADR (or the spec Background when no ADR exists) names the phases, their boundaries, what each must demonstrate before the next begins, and confirms each ships to the integration branch on its own. Alongside the map, every later phase gets a **phase brief** — a paragraph or two, written at planning time: its goal, its scope boundary, the contracts, tables, or surfaces it expects to touch, and its open questions. The map and briefs have **one authoritative home**: the ADR's Phasing subsection when an ADR exists, otherwise the first phase spec's Background; anywhere else that mentions the phases links there instead of restating. Writing the briefs is not optional and not clerical: exploring phase N deeply enough to write an honest brief is what surfaces the choices that reshape phases 1 through N−1, and that learning is only available at planning time. The map is a plan, not a contract: when an earlier phase's learning redraws later boundaries, update the map and briefs where they live — don't force the stale plan.
- **The current phase gets the full spec; later phases stay briefs until they're next.** Write the complete, review-ready spec for the phase about to be built. Fleshing out phase N's brief into its full spec is the **first step of starting phase N** — it happens when phase N−1 has shipped and it's time to implement, with the brief corrected by everything the shipped phases taught. Do not write full specs for far-future phases: the cross-phase learning came from the exploration behind the briefs, and a fully-detailed phase-4 spec written before phase 1 ships is detail that will be rewritten, not learning. A phase's full spec is approved like any other spec — a non-author's approval of the PR that carries it, whether that's a spec-only PR opening the phase or the phase's first implementation PR.
- **Naming:** shared project slug with a phase suffix, e.g. `YYYY-MM-DD-<project>-phase-1-<slug>.md`; each phase's full spec carries the date it is written. Each phase spec links the ADR and the previous phase's spec in its header.
- **Deferred-to-a-later-phase callouts are load-bearing.** When a capability is deliberately pushed to a later phase, say so at the point of deferral — "deferred to phase 2 (#NNN)" — with a tracking issue, exactly like any other deferred work. With per-phase files these callouts are the only signal that an omission is intentional; without them, a phase-1 spec reads as a design that forgot something. Each later phase's spec names which inherited deferrals it resolves, so nothing languishes unclaimed between files.
- **Shared contracts live in one place.** The domain model, entities, and cross-phase contracts belong to the spec of the phase that introduces them; later phase specs link to them instead of restating them. If a later phase changes a shared contract, that change is part of that phase's spec — and the introducing spec gets a one-line amendment pointer ("amended by the phase-3 spec") so neither document silently lies.

## Specs are living documents

A spec is the current truth of the design, not a snapshot of what was believed at planning time. Requirements change, and new ones surface mid-implementation; when they do, the spec is updated **in the same PR as the code that responds to them** — a merged change whose behavior contradicts its spec is a defect in the spec. This workflow isn't running during implementation, so the rule has to travel with the artifact: every spec this workflow produces carries the standing note below in its header (see Header), and repos should mirror the rule in their own always-loaded guidance (e.g. CLAUDE.md).

## Header — with or without an ADR

**If an ADR exists**, the spec links to it in the header:

```
ADR: [docs/decisions/YYYY-MM-DD-adr-name.md](../decisions/YYYY-MM-DD-adr-name.md)
```

The ADR holds the Discovery Summary as its Context section, and the spec's Background section can be a brief pointer (one or two sentences) plus a link back to the ADR for the full context.

**If no ADR exists**, the spec opens with an inlined Discovery Summary as its **Background** section (the structure below mirrors the ADR Context exactly). The header omits the ADR line, or replaces it with:

```
ADR: none (no architectural decision warranting a separate record; see Background)
```

## Subsystem traceability

Every major subsystem within the spec should include a short Intent statement explaining why that subsystem exists, traceable back to a stakeholder, desired outcome, or business impact. The trace target is the ADR Context (if one exists) or the Background section (if not). If traceability cannot be established, challenge whether the subsystem belongs in the system.

Reference: [openai/symphony SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)

## Document structure

The sections below are listed in order. **Assign section numbers sequentially in the final document** (`## 1. Problem Statement`, `## 2. Goals and Non-Goals`, ...). Sections that are skipped — legitimate for small specs, see "Length calibration" — do not reserve numbers; renumber so the final spec has no gaps. Always pair numbers with titles so cross-references survive renumbering. Two structural elements sit outside this sequence: the Header is unnumbered, and Background (when present) is fixed at `## 0. Background` — the no-gaps rule applies from Section 1 onward.

### Header
- Title: `<Project Name> Service Specification` (or Feature/System Specification)
- Status line: `Status: Draft v1` (or RFC, Final, etc.)
- ADR link (if applicable; see "Header — with or without an ADR" above)
- Purpose: One sentence describing what the system does.
- Standing note (verbatim, so the rule is present when the spec is read during implementation): `This spec is a living document: when implementation deviates from it or new requirements surface, update it in the same PR as the change.`

### Background (Section 0 — when no ADR exists)

When the spec has no companion ADR, the spec must open with a **Background** section that inlines the Discovery Summary. Use the same seven-subsection structure as the ADR Context — defined canonically by the Discovery Summary template in `phases/discovery.md` (see also `phases/adr.md` and the bundled `templates/adr-template.md`):

- Problem (statement separated from solution; specific stakeholders; current pain)
- Outcomes (desired outcomes; measurable success metrics; Decision Quality Test — improving axes only)
- Impact & opportunity cost (cost of inaction; why now; what this displaces)
- Constraints (Fixed / Negotiable / Unknown)
- Evidence & Confidence (classified load-bearing claims — Assumed entries double as the assumptions list; mechanically derived Problem Confidence; uncertainty step or accepted risk when not High)
- Phasing (phase boundaries + briefs, or "single phase"; throwaway STV only when the hypothesis is in doubt)
- Failure-of-success analysis

As in the ADR Context, subsections that genuinely don't apply collapse into a single **Not applicable:** line at the end of Background, each with a one-clause rationale — no heading-plus-"n/a" chains.

If the spec has a companion ADR, the Background section can collapse to a one-paragraph summary plus an ADR link.

### Problem Statement
- One paragraph defining what the system is.
- Bulleted list of 3-5 operational problems it solves.
- "Important boundary" subsection: what the system is NOT responsible for.

### Goals and Non-Goals
- **Goals**: Bulleted list of concrete, verifiable behaviors the system must support.
- **Non-Goals**: Explicit list of things that are out of scope. This prevents scope creep and sets expectations. Distinguish a permanent non-goal (never intended) from *deferred* work (intended, just later). Any deferred item MUST carry a linked GitHub issue (`#NNN`) so it isn't forgotten — see the deferred-work rule under Recommended Extensions.

### System Overview
- **Main Components**: Numbered list. Each component gets a name (backtick-quoted), 2-4 bullet points describing its responsibility.
- **Abstraction Levels/Layers**: Name each layer and its concern. Helps implementors understand where code belongs.
- **External Dependencies**: Bulleted list of everything outside the system boundary.

### Core Domain Model
- **Entities**: Each entity gets its own subsection with:
  - One-line description of what it represents.
  - `Fields:` bulleted list where each field has:
    - Name (backtick-quoted) + type in parentheses
    - Indented bullet explaining semantics, defaults, nullability
- **Normalization Rules**: Explicit rules for how identifiers are sanitized, compared, composed.

### Subsystem Specifications
One section per major subsystem. Each section follows this pattern:
- **Intent**: One paragraph — why this subsystem exists, traced to the ADR Context (or the spec's Background section when no ADR exists).
- **Discovery/Resolution**: How the subsystem finds its inputs.
- **Format/Schema**: The exact shape of config, messages, or data.
  - For config: field name, type, default, dynamic reload behavior.
  - For protocols: exact message sequence with JSON examples.
- **Validation and Error Surface**: Named error classes. What blocks operation vs. what fails gracefully.
- **Behavioral Contract**: Step-by-step what happens, in what order, under what conditions.

Key subsystem sections to consider:
- Configuration (sources, precedence, dynamic reload, validation)
- State Machine (states, transitions, triggers, idempotency rules)
- Scheduling/Coordination (polling, candidate selection, concurrency, retry/backoff formulas)
- Resource Management (lifecycle, creation, reuse, cleanup, safety invariants)
- Integration Protocols (launch contract, handshake sequence, streaming, event handling)
- External Service Integration (required operations, query semantics, normalization, error handling)
- Prompt/Template Construction (inputs, rendering rules, failure semantics)

### Observability
- **Logging Conventions**: Required context fields, message formatting rules.
- **Logging Outputs**: What sinks are required/optional.
- **Metrics**: What must be tracked (tokens, runtime, etc.), accounting rules.
- **Optional API/Dashboard**: If applicable, define endpoints with example JSON response shapes.

### Failure Model
- **Failure Classes**: Numbered categories (config, workspace, session, external service, observability).
- **Recovery Behavior**: For each failure class, what happens (skip dispatch, retry, keep running, etc.).
- **Restart Recovery**: What state survives restarts and what doesn't. How the system bootstraps from nothing.
- **Operator Intervention Points**: How operators can control behavior without code changes.

### Security
- **Trust Boundary**: What is trusted, what isn't. What each implementation must document.
- **Filesystem/Resource Safety**: Mandatory invariants (path containment, sanitization).
- **Secret Handling**: How secrets are referenced, resolved, and protected from logging.
- **Hardening Guidance**: Possible measures, explicitly not mandating a single posture.

### Reference Algorithms
- Language-agnostic pseudocode for the most complex flows.
- Use `function name():` style with clear variable names.
- Cover: startup, main loop, reconciliation, dispatch, worker lifecycle, retry handling.
- These are reference implementations, not prescriptive code.

### Test and Validation Matrix
- Define validation profiles: Core Conformance, Extension Conformance, Real Integration.
- Organize test requirements by subsystem.
- Each bullet is a specific testable behavior, not a vague category.
- Extension tests are prefixed with "If ... is implemented".
- Real integration tests acknowledge credential/network requirements.

### Implementation Checklist
- Definition of Done, organized by the same validation profiles.
- Each item is a concrete deliverable, not a process step.
- Include a "Recommended Extensions" section with TODO items for future work. **Every deferred / future-work item here must link a GitHub issue (`#NNN` or full URL).** Deferred work without a tracking issue gets forgotten. If no issue exists yet, open one and link it before the spec is finalized.
- Include "Operational Validation" for pre-production checks.

## Writing principles

### Be explicit about defaults
Every configurable value must have:
- Type (string, integer, map, list)
- Default value (exact, not "reasonable")
- Whether it supports dynamic reload
- Coercion rules (string-to-int, comma-separated-to-list, etc.)

### Be explicit about error handling
For every operation that can fail:
- Name the error class
- State what happens to the caller (abort, skip, retry, log-and-continue)
- State what happens to the system (keep running, block dispatch, fail startup)

### Separate required from optional
- Use clear language: "required for conformance" vs "optional extension"
- Optional features that are implemented must still meet their extension spec
- Never leave it ambiguous whether something is required

### Use concrete examples
- JSON examples for message formats and API responses
- Pseudocode for algorithms
- Example values for config fields

### State what you don't prescribe
- "Implementation-defined" for things that vary by deployment
- "This specification does not require..." for explicit non-requirements
- "The spec does not prescribe..." followed by what IS required

### Forward compatibility
- Unknown config keys should be ignored
- Document extensibility points
- Extensions should document their own schema

### Normalization rules
- Always specify how strings are compared (trim + lowercase, exact match, etc.)
- Always specify how identifiers are sanitized
- Always specify how composite keys are formed

### Cross-reference
- Use "Section X.Y (Title)" references when behaviors depend on other sections — include the title so references survive renumbering
- Include a "Cheat Sheet" subsection for config fields that are scattered across sections
- Repeat critical information (like safety invariants) where it matters, noting the repetition is intentional

## Section numbering convention
- Top-level sections: `## 2. Goals and Non-Goals`
- Subsections: `### 2.1 Goals`
- Sub-subsections: `#### 2.1.1 Specific Topic`
- Consistent depth -- don't go deeper than 3 levels

## Length calibration

Length should follow scope. This skill runs on a small B2B codebase — most specs will be smaller than the upper bounds below.

- **Large new system/service** (a new daemon, ingestion pipeline, multi-subsystem feature): 1500-2500 lines, with each subsystem 100-200 lines, domain model 150-250, test matrix 100-150, reference algorithms 200-300 lines of pseudocode. If a system at this scope is shorter than 500 lines, it's probably missing failure handling, test requirements, or normalization rules.
- **Medium feature** (a self-contained capability with 2-3 subsystems): 400-900 lines is typical and fine.
- **Small feature or extension** (single subsystem, well-scoped change to existing code): 150-400 lines. Some sections will collapse to a few lines or be skipped — that is correct, not a defect. The smallest defensible spec is the right spec.

The line-count heuristics above are diagnostic, not mandatory. A 200-line spec that genuinely covers a small feature's contract, failure model, and tests is better than a padded 600-line spec.

## Pre-review self-audit

Run this checklist over the finished draft before requesting review. Each item is a mechanical check against the text — do not trust the memory of having written it correctly.

1. **Banned vagueness.** Search the draft for "appropriately", "as needed", "properly", "robust", "gracefully", "etc.", "handle errors" (without saying how). Each occurrence either becomes a concrete behavior or is deleted.
2. **Defaults are exact.** Every configurable value states a type and an exact default. "A reasonable default" is not a default.
3. **Errors are named.** Every operation that can fail names its error class and states what happens to the caller and to the system.
4. **UNKNOWN over invention.** Any section that could not be answered from the ADR/Background, the codebase, or the user says UNKNOWN, with the gap surfaced explicitly — in the Background's Open Questions when the spec carries one, otherwise called out in the review request — no plausible filler. Filler test: if a sentence could appear unchanged in any project's spec, cut it or make it concrete.
5. **Traceability spot-check.** Take the two largest subsystems and confirm each Intent traces to a named stakeholder, outcome, or business impact in the ADR Context / Background. A failed trace means the subsystem gets challenged, not padded.
6. **Deferred work is tracked.** Every deferred/future item in Non-Goals and Recommended Extensions links a GitHub issue; capabilities pushed to a later phase say so at the point of deferral ("deferred to phase 2 (#NNN)").
7. **No unmeasured predictions.** The spec mints no numeric outcome claims ("30% faster", "half the code"). Success metrics live in the Background / ADR Context, sourced from Discovery; nothing else in the document predicts numbers nobody will ever measure.

## Required approval

**Every spec must be reviewed and approved before it is considered accepted** by at least one approver who is **not the author**. If the spec has a companion ADR, the ADR also requires non-author review (see `phases/adr.md`). When no ADR exists, the spec stands alone and its review covers both the Background (Discovery output) and the implementation design.

The approver definition, the implementation-does-not-wait rule (and its expensive-rework exception), the PR-approval-is-the-document-approval rule, and the business-impact stakeholder flag from the Required approval section in `phases/adr.md` apply to specs identically — when no ADR exists, the flag goes in the spec's Background section instead. In particular: a non-author's approval of the PR carrying the spec **is** the spec approval and nothing is recorded in the document itself, and implementation does not wait on document approval — the review lands on the PR before merge.

Multi-model adversarial review — for example an adversarial-review skill in document mode — is strongly encouraged as review input for specs as well; it does not by itself satisfy the non-author approval requirement.
