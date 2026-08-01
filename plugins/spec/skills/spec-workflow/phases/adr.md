# Phase 2: ADR (conditional)

> Read this file in full when entering the ADR phase — including when writing a Rejected-Discovery ADR. The "Is an ADR required?" routing check and the directory conventions live in `SKILL.md`.

The ADR answers two questions:
- **Why should this exist?** (Captured in the Context section, populated directly from the Discovery Summary.)
- **Why was this approach selected?** (Captured in Decision + Discarded alternatives.)

ADRs live in the repo's decisions directory (default `docs/decisions/`, but check for an existing repo convention first — see "Directory conventions" in `SKILL.md`) and follow the naming convention `YYYY-MM-DD-adr-name.md`.

**Template:** use the repo's own ADR template if one exists (conventionally `docs/decisions/template.md`). If the repo has none, use this skill's bundled `templates/adr-template.md` as the starting point, and offer to copy it into the repo for future use. Either way, the Context section mirrors the Discovery Summary structure exactly.

If the repo's template predates this skill version — e.g. it still has an "Options Considered" or "Consensus" section — flag the divergence and offer to update the repo template from the bundled one before writing the ADR. Do not silently produce the outdated structure.

## ADR Status options

`Proposed` | `Accepted` | `Rejected (Discovery)` | `Deprecated` | `Superseded by ADR-XXXX`

- **Rejected (Discovery)** — Discovery concluded the effort should not proceed. The full Context structure would be overhead for a rejection, so a **compressed Rejected-Discovery form** is acceptable:
  - **Problem** (one sentence, separated from solution)
  - **Stakeholders** (one line)
  - **Evidence** (the load-bearing claims, classified)
  - **Kill criteria triggered** (which conditions from the Kill criteria list applied)
  - **Decision** ("Do not proceed" + rationale)
  - Other Context subsections may be skipped or compressed; the Discarded alternatives section is omitted.
  - The ADR exists so the rejection and its reasoning are durable and searchable.

## ADR Context section

The Context section is the **inlined Discovery Summary** — same subsections, same content, no link-and-trust-the-link. The structure is defined canonically by the Discovery Summary template in `phases/discovery.md`; the seven subsections below mirror it:

- **Problem** — the problem separated from any proposed solution; the specific stakeholders who have it; how it's handled today and why that's insufficient.
- **Outcomes** — what success looks like; measurable metrics with targets; Decision Quality Test (only the axes that improve).
- **Impact & opportunity cost** — cost of inaction; why now; what this displaces.
- **Constraints** — each tagged Fixed / Negotiable / Unknown (technical, operational, financial, timeline, organizational).
- **Evidence & Confidence** — each load-bearing claim classified Measured / Observed / Reported / Assumed with a source; the Assumed entries double as the assumptions list; Problem Confidence derived mechanically; when Low/Medium, the uncertainty-reduction step taken or the risk explicitly accepted.
- **Phasing** — phase boundaries (each phase complete within its scope, shipping to the integration branch on its own, with a brief per later phase); a throwaway Smallest Testable Version only when the hypothesis itself is in doubt. May be "single phase."
- **Failure-of-success analysis** — how this fails despite shipping correctly.

If any subsection is empty, return to Discovery. Do not paper over gaps with vague language.

Subsections that genuinely don't apply collapse into a single **Not applicable:** line at the end of Context, each item with a one-clause rationale. That counts as filled, not empty. Do not write heading-plus-"n/a" chains: a Context section where half the headings say "n/a" trains the reader to skim, and a skimmed Context defeats its purpose. Every heading that survives carries real content.

## Decision and Discarded alternatives

The Decision section comes first and leads with what was chosen, then argues why — traced to Context, especially Constraints and the Decision Quality Test. Comparative reasoning ("X over Y because…") belongs inside this argument, in prose. There is no Options Considered section, no per-option Pros/Cons lists, and no "Do Nothing" option — the cost of inaction lives in Context's Impact & opportunity cost.

**Discarded alternatives** follows the Decision as a terse list: one entry per alternative seriously considered, each carrying the decisive fact(s) that killed it — two per entry, max. The section exists to preserve rejection facts a future reader could not reconstruct (the pricing tier that was too small, the missing SQL feature, the operational surface it would have added, the stakeholder who said no) — not to demonstrate diligence. An entry whose content is inferable from the Decision section is decoration; delete it.

Every Accepted ADR must name at least one realistic discarded alternative — one a competent engineer might actually have picked. If none exists, question whether an ADR is warranted at all (see "Is an ADR required?" in `SKILL.md`).

Rejected-Discovery ADRs omit the section entirely — no approach is being selected.

## Pre-review self-audit

Run this checklist before requesting review. A "no" means fix the draft first.

1. **Context is Discovery, not prose.** Every Context subsection is filled from the Discovery Summary or appears on the Not-applicable line with rationale — no subsection was invented at ADR-writing time, and no Constraint, Evidence item, or Open Question from the Summary was dropped because it was inconvenient for the chosen approach.
2. **The Decision cites the Context and is argued once.** The "why" references specific Constraints or Decision Quality Test outcomes, not generic engineering virtues ("more scalable", "cleaner", "best practice") — and the rationale appears exactly once in the document: not re-run in Consequences, not mirrored across Discarded-alternatives entries.
3. **Discarded entries carry facts.** Each entry states something concrete about the alternative that the reader could not infer from the Decision section. An entry that mirrors the chosen approach's advantages, restates Context, or exists only to be knocked down gets deleted, not reworded. At least one entry is an alternative a competent engineer might actually have picked.
4. **No ritual content.** No "Do Nothing" entry anywhere; no heading-plus-"n/a" chains in Context; Consequences mint no numeric predictions that nobody will ever measure.

## Required approval

**A non-author must review and approve every ADR before it moves to "Accepted" — and the PR approval is that approval.** When a non-author approves the PR that carries the ADR (and its companion spec), the documents are approved; nothing is recorded in the ADR itself, and there is no Consensus or sign-off section. The reviewer is expected to have actually read the documents as part of the PR review; if they explicitly scoped their approval to exclude them, the document approval is still outstanding. When no ADR is written, this section does not apply — the spec carries the full review burden in Phase 3.

**Implementation does not wait for approval.** Code is cheap, and a design is almost always easy to fix before it ships. Implementation may begin as soon as the ADR/spec is drafted — the non-author review happens on the PR before merge, and that approval covers the documents and the implementation together. The gate is at merge, not at the first commit.

The exception is judgment, not policy: when rework would be genuinely expensive before the merge gate can catch it — say, a schema migration that will already have been applied to production data, or an external contract a customer starts building against immediately — flag it and get early eyes on the ADR. Flag it explicitly; don't silently wait.

**Who counts as an approver:** another engineer (human). Multi-model adversarial review — for example an adversarial-review skill in document mode — is strongly encouraged as review input, but it does not by itself satisfy the non-author approval requirement.

**Business-impacting decisions — flag the stakeholder:** when a decision involves a significant pricing change or adjusts customer obligations, add a prominent note to the ADR and say it out loud in the conversation: *"This is a business-impacting decision; consult the responsible business stakeholder before implementation."* The workflow does not require a recorded sign-off — raising the flag is the requirement; the responsible engineer follows up. (In practice the CTO is often already looping the stakeholder in; the flag exists so it never silently doesn't happen.) Merely customer-visible or expensive-to-reverse changes do NOT warrant the flag on their own.
