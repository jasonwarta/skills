# ADR: [Short Title]

## ADR Author/s

## Update Date

YYYY-MM-DD

## Status

[Proposed | Accepted | Rejected (Discovery) | Deprecated | Superseded by ADR-XXXX]

> **Rejected (Discovery)**: Phase 1 of the `spec-workflow` concluded the effort should not proceed. Use the **compressed Rejected-Discovery form** (defined in the spec-workflow skill): Problem, Stakeholders, Evidence, Kill criteria triggered, Decision ("Do not proceed" + rationale). Other Context subsections may be skipped or compressed; the Discarded alternatives section is omitted (no approach is being selected). The ADR exists so the rejection is durable and searchable.

## Who should be notified of ADR changes?
List GitHub handles or teams to notify when this ADR changes (e.g., @org/team-name).

## Context

The Context section is the **inlined Discovery Summary** from Phase 1 of the `spec-workflow` skill — seven subsections, same content, populated here in full rather than linked. If you cannot fill a subsection, return to Discovery.

Keep it readable. Subsections that genuinely don't apply collapse into a single **Not applicable:** line at the *end* of Context, each item with a one-clause rationale (e.g., "Not applicable: Phasing (single-phase, two-day change); Timeline constraints (none stated)"). Do not write heading-plus-"n/a" chains; every heading that remains in Context carries real content.

### Problem

The underlying problem, separated from any proposed solution — bad: "We need a dashboard"; good: "Engineers cannot identify emerging failures quickly enough. (Proposed solution: a dashboard.)" Then: the specific roles, teams, or named people who have it (not "users" or "the team"), how it is handled today, and why that is insufficient — cite concrete incidents, tickets, manual workarounds, or specific friction.

### Outcomes

What success looks like for the stakeholders above, and the measurable metrics that will move, with target values where possible (e.g., "p95 dispatch latency < 200ms," "manual reconciliation tickets reduced from ~5/week to 0" — not "improved DX"). Close with the Decision Quality Test: which decisions become **easier**, **faster**, **more accurate**, or **newly possible**? List only the axes that improve; if none do, challenge whether the effort is worth pursuing.

### Impact & opportunity cost

What happens if nothing changes — the cost of inaction (lost revenue, eroded trust, compounding tech debt, regulatory exposure). Why now, and what is being delayed, deprioritized, or skipped because resources are spent here (deferred maintenance, reliability work, tech debt, other feature requests, customer commitments)? Is this worth more than what it displaces?

### Constraints

Identify each constraint and tag it as **Fixed**, **Negotiable**, or **Unknown**.

- **Technical** — platform limits, required integrations, performance requirements.
- **Operational** — support burden, on-call considerations, deployment restrictions.
- **Financial** — cloud spend, licensing, budget ceilings.
- **Timeline** — regulatory deadlines, customer commitments, seasonal needs.
- **Organizational** — team size, available expertise, approval processes.

### Evidence & Confidence

Classify each load-bearing claim — the ones that, if wrong, would change the decision:

- `<Claim>` — [Measured | Observed | Reported | Assumed], source: `<link or citation>`

(**Measured** — metrics, logs, dashboards, reports. **Observed** — repeated firsthand observation. **Reported** — stakeholder statements, customer feedback. **Assumed** — unvalidated belief, explicitly including forward-looking premises like "customers will adopt this" — the future has no source; record who holds the belief and why.)

**The Assumed entries are the assumptions list** — there is no separate Assumptions section. Each must be explicitly accepted or drive an uncertainty-reduction step.

**Problem Confidence: High | Medium | Low** — one-sentence rationale citing the claims above. Derive mechanically, applying these rules in order to the load-bearing claims (load-bearing: cited by, or the only support for, the Problem section, Outcomes — a claim supporting only a success metric still counts — Impact & opportunity cost, or the Decision's rationale; when unsure, treat as load-bearing): (1) any unaccepted Assumed load-bearing claim → Low; (2) at least one Measured claim, or two independent Observed claims, supporting the problem statement — independent meaning not traceable to the same root observation — → High; (3) otherwise → Medium. Do not claim High confidence the evidence does not support.

When confidence is Medium or Low, record the cheap learning step taken before this ADR (customer interviews with names, ticket analysis over a defined window, dogfooding, a spreadsheet prototype, running the workflow manually, a one-customer pilot, a temporary report) — or state explicitly why none was, e.g., "user accepted the risk; cost of being wrong is bounded."

### Phasing

The phase boundaries, when the effort is phased — the default shape at this scale. Each phase is a shippable increment, deliberately complete within its scope (deployed code that does its slice properly, not a proof of concept), merging to the integration branch (e.g. `dev`) on its own. No stacked-PR chains — if phase 1 can't land until phase 3 exists, redraw the boundaries. When an ADR exists, this subsection is the **authoritative home** of the phase map and the per-phase briefs; without an ADR they live in the first phase spec's Background (see "Phased projects" in the skill's `phases/spec.md`). Reach for a throwaway Smallest Testable Version (weekly email instead of a dashboard, manual report, one-customer pilot) only when the hypothesis itself is in doubt, and name what it must demonstrate. A single-phase effort says "single phase."

### Failure-of-success analysis

How could this effort fail *despite* a successful implementation? (Adoption fails, the metric we picked was wrong, the workflow this enables never gets used, downstream system can't keep up, etc.)

## Decision

What we chose and why, in prose — decision first. Open with the choice in one or two sentences, then argue it: cite the specific Constraints, Evidence, and Decision Quality Test outcomes from Context that drove it. Where a discarded alternative was genuinely competitive, the comparison belongs here, inside the argument — not in per-option pro/con lists. Implementation detail belongs in the spec.

State the rationale exactly once. If a sentence here would be repeated in Consequences or in a Discarded-alternatives entry, pick one home for it.

## Discarded alternatives

> Omit this section for `Rejected (Discovery)` ADRs — no approach is being selected.

One entry per alternative seriously considered, 1–3 lines each:

- **[Name]** — what it is, one sentence. Discarded: decisive reason; second reason only if load-bearing.

Rules:

- Each reason is a **concrete fact about the alternative** — its cost, a missing capability, an operational surface it adds, who rejected it and why — not the mirror image of the chosen approach's advantages, and not a restatement of Context.
- **Two reasons max.** Needing a third means the decision was close — argue it in the Decision section instead.
- **No "Do Nothing" entry.** The cost of inaction lives in Context's Impact & opportunity cost.
- If Context already rules an alternative out (a Fixed constraint, the Phasing subsection), one line citing that subsection — don't re-litigate it here.
- Deletion test: an entry whose content the reader could infer from the Decision section carries no information — delete it, don't reword it.

## Consequences

New obligations, risks, and follow-ups this decision *creates* — things that are true because we chose this, and that the Decision section doesn't already say.

### Positive

- ...

### Negative

- ...

Rules:

- Do not restate the Decision's rationale as consequences. If a bullet argued *for* the choice ("simpler", "consistent with existing patterns"), it lives in Decision only.
- No generic entries that could appear unchanged in any ADR ("learning curve", "another service to maintain") unless quantified for this specific change.
- **No invented metrics.** Success metrics live in Context, sourced from Discovery. Do not mint numeric predictions here ("30% less code expected") — a number nobody will ever measure is filler.

> Any consequence, limitation, or follow-up this ADR explicitly **defers** ("out of scope for now", "follow-up", "future work", "revisit later") MUST link a GitHub issue (`#NNN`) that tracks it. Deferred work without a tracking issue gets forgotten. Open the issue and link it before this ADR is Accepted.

## Spec

<!-- Link to the implementation spec if one exists -->
- Spec: [docs/specs/YYYY-MM-DD-spec-name.md](../specs/YYYY-MM-DD-spec-name.md)

## References

- Related ADRs: [ADR title](./YYYY-MM-DD-adr-name.md)
- Related docs: ...
- Implementation: ...

> **Approval** is not recorded in this document. A non-author must review the ADR before it moves to "Accepted"; a non-author's approval of the PR that carries the ADR **is** that approval. See "Required approval" in the spec-workflow skill's `phases/adr.md`.
