---
name: spec-workflow
description: Phased workflow for designing significant features and systems — Discovery (with a real decision gate that can recommend reject), an optional ADR when an architectural decision needs documenting, and a Specification. Use when a new feature, system, service, or major change is being proposed, or when implementation work is about to start without a spec. Resist the urge to skip ahead to design.
---

# Spec Workflow

This skill drives a phased design process. **Its goal is better decisions, not better documentation.** The phases are:

1. **Discovery** — understand the problem before designing anything. Ends with an explicit Decision Gate: **Proceed | Reduce Uncertainty | Continue Discovery | Reject**.
2. **ADR** — *conditional.* Only required when an architectural decision is being made that someone will reasonably want to cite later. See **"Is an ADR required?"** below. Many small features go straight from Discovery to Spec.
3. **Specification** — describe how the system works in implementation detail. **Always required** for features. When no ADR exists, the spec absorbs the Discovery Summary as a top-of-spec **Background** section. Phased efforts get **one spec per phase** — see "Phased projects" in `phases/spec.md`.

```
Discovery → Decision Gate ─┬─ Reject             → Write Rejected-Discovery ADR. Stop.
                           ├─ Reduce Uncertainty → Run the cheapest learning step. Resume Discovery with new evidence.
                           ├─ Continue Discovery → Stay in Discovery; ask harder questions about what we already have.
                           └─ Proceed            → ADR-required check ─┬─ Yes → ADR → Spec
                                                                       └─ No  → Spec (Discovery Summary embedded as Background)
```

The AI must not skip phases unless the user explicitly authorizes it or the off-ramp criteria below are met. Agreement is not the goal. Understanding is. **Rejecting a request is a valid and desirable outcome** when evidence, value, stakeholder alignment, or business impact are insufficient.

## How to use this skill

The detailed instructions for each phase live in separate files alongside this one. **On entering a phase, read that phase's file in full before doing any phase work.** Do not improvise phase content from this overview — the phase files carry the checklists, templates, and gate criteria that make the workflow rigorous.

| Phase | File | Read when |
|---|---|---|
| 1. Discovery | `phases/discovery.md` | Starting the workflow (this is the default entry point) |
| 2. ADR | `phases/adr.md` | The Decision Gate returned Proceed and the ADR-required check (below) returned Yes — or Discovery ended in Reject (Rejected-Discovery ADR) |
| 3. Specification | `phases/spec.md` | Entering spec drafting, with or without an ADR |

The ADR → Spec sequence is the default, not an absolute: spec drafting may begin before the ADR is Accepted, and implementation does not wait on document approval — the non-author review lands on the PR before merge. See "Required approval" in `phases/adr.md`.

A bundled ADR template lives at `templates/adr-template.md` (see "Directory conventions" for when to use it vs. a repo-local template).

## Execution discipline

These rules bind in every phase. They exist because the failure mode of a structured workflow is not skipping it — it is *hollow compliance*: filling every section with plausible text that was never investigated.

- **UNKNOWN over invention.** Never fill a checklist, template, or spec section with plausible generic content. If the answer is not evidenced in the conversation or the repo, write UNKNOWN and surface it as an open question. An honest gap is workflow-conformant; manufactured content is not.
- **Sources or it's Assumed.** Every load-bearing claim names a source consulted in this session — a file (with path), a command actually run, a document actually opened, or a user statement (quoted, not paraphrased upward in strength). A claim whose source cannot be named is Assumed by definition.
- **Self-audit before every gate.** Each phase file defines a pre-gate/pre-review checklist. Run it before presenting a gate or requesting review — including when the phase "went well." Especially then.
- **Recommend against the current when warranted.** Gate recommendations follow the evidence, not the user's apparent preference. The user's enthusiasm for a solution is not evidence for the problem. Reduce Uncertainty and Reject are first-class outcomes.

## Calibration: small B2B product

This skill is calibrated for a **small B2B product** (~300 users, high value per customer, direct access to stakeholders and engineers, limited ability to run statistically significant experiments). Implications baked into the rest of this skill:

- **Statistical significance is not the bar.** Sufficient confidence to make a good decision with limited resources is.
- **Small-N evidence is legitimate** — a pilot with 2 customers, a week of support tickets, one engineer's careful observation. Treat it honestly: name what you actually saw; do not dress small-N up as something it isn't.
- **Manual is a feature, not a workaround.** Spreadsheet prototypes, manual reports, and human-in-the-loop workflows are often the right learning step before any automation investment.
- **Customer access is a resource.** Use it. An interview with one design partner often beats a month of inferring from telemetry.
- **Optimize for learning, not experimentation.** "Reduce uncertainty" is the operative verb. Formal A/B testing is rarely the right tool at this scale.

## Directory conventions

Artifacts default to these locations, but **check the repo's existing convention before writing anything**:

- **ADRs**: default `docs/decisions/`, named `YYYY-MM-DD-adr-name.md`.
- **Specs**: default `docs/specs/`, named `YYYY-MM-DD-spec-name.md`.

Before creating either, look for existing ADR/spec directories and any repo guidance (CLAUDE.md, README, existing documents). If the repo already has a convention — different paths, different naming — follow it. Only fall back to the defaults above when no convention exists.

**ADR template**: prefer the repo's own template (`docs/decisions/template.md` or wherever the repo keeps it) if one exists. Otherwise use this skill's bundled `templates/adr-template.md`, and offer to copy it into the repo so future ADRs have a local starting point.

## Phase-state visibility

The AI must keep the user oriented in the workflow at all times. Exact formatting is implementation-defined — a phase header line, inline phrasing, or a short status note all work. What matters is that these properties hold:

- **Current phase is always recoverable** — if the user asks "what phase are we in?" the AI can answer unambiguously without re-deriving it.
- **Mode shifts within a phase are signaled** — e.g., transitioning from gathering inputs to drafting the Discovery Summary.
- **Phase transitions are explicit and gated.** Before leaving a phase, the AI must:
  1. Summarize what was produced.
  2. List unresolved questions or accepted assumptions.
  3. State the Decision Gate recommendation (Phase 1) or readiness assessment (Phases 2-3).
  4. Request explicit user authorization to advance, reject, or pursue uncertainty reduction.

What is **not** acceptable: silently rolling between phases, drifting from Discovery into solutioning without an announced transition, or leaving the user uncertain about where the workflow currently sits.

## Off-ramps (when to skip the workflow)

**Skip the entire workflow** for:
- Bug fixes
- Refactors that don't change behavior
- Config / environment changes
- Typo fixes and cosmetic one-liners

**Compressed Discovery** is allowed when the user can already answer the Phase 1 questions in one paragraph. In that case:
- Capture their answers verbatim.
- Still produce the **Discovery Summary** — but terse, one-line answers per section are fine. (Terse, not unsourced: Evidence entries must still name a real source per the sourcing rule in `phases/discovery.md`.)
- For sections the user genuinely cannot answer (e.g. "no constraints I'm aware of"), write that explicitly rather than leaving the section blank — an explicit "none", or a spot on the Summary's **Not applicable** roll-up line with a one-clause rationale (see the Summary template in `phases/discovery.md`). **Blank ≠ acceptable; explicit and reasoned is.**
- State explicitly: "Compressed Discovery — proceeding to the ADR-required check pending confirmation."
- Get user confirmation before moving on.

When in doubt, run full Discovery. The cost of asking a few questions is small; the cost of designing the wrong thing is large.

## Is an ADR required?

This check runs at the Decision Gate when the recommendation is Proceed.

**Write an ADR if any of the following are true:**

- There are **two or more realistic approaches** with non-trivial tradeoffs, and someone might reasonably pick a different one 6-12 months from now.
- The choice **constrains future work** or sets an architectural precedent others will follow.
- The change **cross-cuts** subsystems, touches a public API surface, modifies the data model, or has security/compliance implications.
- **Reversal is expensive** (migration required, customer-visible change, vendor lock-in).
- A stakeholder beyond the implementing engineer needs to be briefed on **why** this was done this way.

**Skip the ADR if all of the following are true:**

- There is essentially **one sensible approach** and any alternatives are obviously worse.
- The change is **contained to a single subsystem** with no cross-cutting implications.
- **Reversal is cheap** (small refactor, single feature, easy to rip out).
- The decisions involved are **implementation details** of an already-decided larger system.

When in doubt, **skip the ADR** — overhead matters at this product's scale. The Discovery Summary still lives durably in the spec's Background section either way. If a non-trivial decision surfaces later, an ADR can be added then with the spec's Background as starting material.

If an ADR is skipped, jump directly from the Decision Gate to Phase 3 (Spec). The Discovery Summary becomes the spec's Background section.

## Traceability summary

Every artifact must trace upstream. The chain depends on whether an ADR was written:

**With ADR:**
- **Spec** → ADR (linked in header).
- **Spec subsystems** → ADR Context items (stakeholder, outcome, business impact).
- **ADR Context** → Discovery checklist answers (folded into Context).

**Without ADR (spec only):**
- **Spec Background** → Discovery checklist answers (inlined as the Background section).
- **Spec subsystems** → Background items (stakeholder, outcome, business impact).

Either way: if a feature, subsystem, or section cannot be traced to a stakeholder, desired outcome, or business impact, challenge whether it belongs in the system.
