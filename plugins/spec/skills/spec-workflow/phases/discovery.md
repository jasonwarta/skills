# Phase 1: Discovery

> Read this file in full when entering Discovery. The phase map, calibration, off-ramps, and the "Is an ADR required?" check live in `SKILL.md`.

This is the default starting phase. Discovery is the highest-leverage phase in the workflow — its job is not to "write a spec," it is to **decide whether the effort should proceed at all** and, if so, on what understanding it should be built.

Discovery produces a **Discovery Summary** artifact that either feeds the ADR Context (if the recommendation is Proceed) or stands alone as the rationale for not proceeding (if the recommendation is Reject).

## The objective is better decisions, not better documentation

The workflow does not exist to manufacture ADRs and Specs. It exists to ensure that the work that does get built is the right work to build. Rejecting a request after Discovery — concluding that no ADR should be written — is a valid and desirable outcome.

## Run Discovery as an interview

Discovery is a conversation with the developer, not a form to fill. Do not dump the whole checklist on the user, and do not silently fill it from the repo and present a finished Summary. Work through it in rounds:

- **Ask 2–4 questions at a time**, grouped by topic — the problem first, then outcomes, then impact, constraints, and evidence. Wait for answers before the next round.
- **Drill into answers.** "Customers keep asking for this" earns a follow-up — which customers, how many times, where is that recorded? — before it becomes an Evidence entry.
- **Confirm classifications with the user.** "You said X — is that measured anywhere, or is it your read on the situation?" Classifying the user's words without asking is how Reported gets dressed up as Observed.
- **Read back each topic** in a sentence or two before moving on, and let the user correct it. Corrections at this stage are the cheapest they will ever be.
- **Investigate between rounds.** Check the repo, tickets, and dashboards so the next round's questions are informed and specific, not generic.

The checklist below defines what Discovery must answer; the interview is how it gets answered.

**Detailed source material changes the questions, not the requirement.** Discovery increasingly starts from an issue written in enough detail to be a PRD — nearly an ADR+spec in itself, handed off for someone else to build. The interview still happens; what changes is what it is for. Mine the source first and cite it as Evidence (classified honestly — an issue author's assertion is Reported), and do not spend the rounds re-asking what is already written down. Interview about what the document cannot say for itself: checklist items it leaves open, tensions between the issue and what the repo or tickets actually show, assumptions the author baked in without noticing, and anything that has changed since it was written. Open the first round with a read-back — "the issue covers X and Y; here is what it leaves open" — so the author sees their document was actually read.

This applies only when the source actually carries that detail. Judge the issue by what it answers, not by the fact that it exists: a terse two-line report — internal or client-filed — answers nothing and gets the full interview and exploration, not a discounted one.

## Resist designing

During Discovery the AI must **not sketch architecture, propose components, or shape a solution**. If a solution is emerging, that is a signal to ask harder questions about the problem, not to start designing. Pause and challenge.

## Separate problem from solution

Many requests arrive as solutions wearing problem clothing. Reframe them explicitly:

> **Bad:** Problem: "We need a dashboard."
>
> **Good:** Problem: "Engineers cannot identify emerging failures quickly enough." Proposed solution: "A dashboard."

If the user provides only a solution, the AI must surface the underlying problem before proceeding. A solution without a problem statement is a strong signal to challenge the request.

## Classify evidence

Not all inputs to Discovery carry the same weight. Each load-bearing claim in the Discovery Summary must be classified. A claim is **load-bearing** if the Summary relies on it — it is cited by, or is the only support for, the Problem section, Outcomes (a claim supporting only a success metric still counts), Impact & Opportunity Cost, or the Recommendation's rationale. When unsure whether a claim is load-bearing, treat it as load-bearing.

- **Measured** — direct metrics, logs, dashboards, telemetry, reports. Strongest.
- **Observed** — repeated firsthand observation by the team.
- **Reported** — stakeholder statements, customer feedback, anecdotes.
- **Assumed** — belief that has not been validated. Weakest. This explicitly includes **forward-looking premises** ("customers will adopt this", "volume stays under X/day") — the future has no source; record who holds the belief and why.

Prefer **Measured > Observed > Reported > Assumed**. When a key decision rests primarily on Assumed evidence, the AI must call that out and recommend either an uncertainty-reduction step (see below) or explicit acceptance of the risk.

Inline tagging (`The current dispatcher drops ~3% of jobs under load [reported]`) is encouraged but not required for every sentence. A dedicated Evidence subsection in the Summary is required.

**Sourcing rule:** every Evidence entry must name a source that was actually consulted in this session — a file (with path), a command run and its output, a ticket or document opened, or a user statement quoted verbatim. If no source can be named, the claim is Assumed by definition. Do not paraphrase the user's framing upward in strength: "the user believes X" is Reported at best, never Observed or Measured.

## Discovery checklist

Discovery cannot conclude until the AI can answer each of these — or has documented the gap as an accepted assumption with the user's explicit acknowledgement.

**Problem**
- Who has the problem? (Specific stakeholders. "Users" is not an answer.)
- What are they trying to accomplish?
- How do they handle this today, and why is that insufficient?

**Outcomes**
- What outcome do the stakeholders want?
- What measurable success metric will move, and by how much? (Vague metrics like "improved DX" are not acceptable.)
- Decision Quality Test — which decisions become easier, faster, more accurate, or newly possible if this succeeds? Name only the axes that improve; if none do, challenge whether the effort is worth pursuing.

**Impact & opportunity cost**
- What happens if nothing changes? (Cost of inaction — this is the status-quo baseline; there is no "Do Nothing" option anywhere else.)
- Why should this be worked on now, and what gets delayed, deprioritized, or skipped because resources are spent here? (Deferred maintenance, reliability work, tech debt, other feature requests, customer commitments.)
- Is this more valuable than the work it displaces?

**Constraints** — identify and classify each as Fixed / Negotiable / Unknown:
- **Technical** — platform limits, required integrations, performance requirements.
- **Operational** — support burden, on-call load, deployment restrictions.
- **Financial** — cloud spend, licensing, budget ceilings.
- **Timeline** — regulatory deadlines, customer commitments, seasonal needs.
- **Organizational** — team size, available expertise, approval processes.

**Evidence & Confidence**
- Classify every load-bearing claim per "Classify evidence" above. **The Assumed entries are the assumptions list** — there is no separate Assumptions section; each Assumed claim must be explicitly accepted by the user or drive the uncertainty step below.
- Rate Problem Confidence **High | Medium | Low**, derived **mechanically** from the classifications — apply these rules in order; the first that matches wins:
  1. Any load-bearing claim classified Assumed that the user has not explicitly accepted → **Low**.
  2. At least one Measured claim, or two independent Observed claims, supporting the problem statement → **High**. *Independent* means the two claims do not trace back to the same root observation — different people, systems, incidents, or documents.
  3. Otherwise → **Medium** — including when the Reported claims are vivid, unanimous, or come from the user directly.
- State the rationale in one sentence, citing the specific claims that set the rating. Do not invent confidence the evidence does not support — if the rules say Medium, the rating is Medium regardless of how convinced anyone feels. Low or Medium is a strong signal to recommend **Reduce Uncertainty** at the Decision Gate rather than Proceed.
- **When confidence is Low or Medium**, name the **cheapest** next step that would meaningfully change the rating — customer interviews (1–3 design partners), support-ticket analysis over a defined window, internal dogfooding, a spreadsheet prototype, running the workflow manually for a week, a one-customer pilot, a temporary report or one-off script, operational observation over a defined window. The output is a **named, executable, low-cost step**, not a research project; if no plausible cheap step exists, that is itself a finding worth surfacing at the gate. If the user accepts the risk instead, record that explicitly.

**Phasing**
- The default shape of an effort at this scale is **phases**: shippable increments, each deliberately complete within its scope — deployed code that does its slice properly, not a proof of concept. Name the phase boundaries; every phase must merge to the integration branch (e.g. `dev`) on its own and deliver value or learning by itself. No stacked-PR chains holding early phases hostage to later ones — if phase 1 can't land until phase 3 exists, redraw the boundaries. (Each phase gets a brief at planning time and a full spec when it comes up — see "Phased projects" in `phases/spec.md`.)
- Reach for a throwaway **Smallest Testable Version** (a weekly email instead of a dashboard, a manual report instead of a pipeline, a script instead of a service, a one-customer pilot) only when the *hypothesis itself* is in doubt — it is an uncertainty-reduction step for "whether", not a way to build. Name what it must demonstrate (or disprove) before building it, then return to the Decision Gate with the results as new Evidence. When the uncertainty is about "how" rather than "whether", scope phase 1 tighter instead of building a PoC.

**Failure-of-success**
- How could this fail *despite* a successful implementation? (Adoption fails, wrong metric chosen, downstream system can't keep up, the workflow this enables never gets used, etc.)

## Discovery Summary

At the conclusion of Discovery, produce a structured Summary. This is the primary handoff artifact — it either becomes the ADR Context section (Proceed) or stands as the standalone record (Reject).

```
## Discovery Summary

Status: Complete | Partial | Assumption-driven

Problem: <one-sentence problem statement, separated from any proposed solution; the specific stakeholders who have it (named roles/teams/people, not "users"); how it's handled today and why that's insufficient>

Outcomes: <what success looks like for the stakeholders; the measurable metric(s) that will move, with targets (small-N is acceptable when named honestly); Decision Quality Test — only the axes that improve (Easier | Faster | Accurate | Possible); if none improve, challenge the effort>

Impact & Opportunity Cost: <cost of inaction if nothing changes; why now; what this displaces, and whether it's worth more than that>

Constraints:
- <category>: <items, each tagged Fixed | Negotiable | Unknown>
- <cover Technical, Operational, Financial, Timeline, Organizational; categories with nothing to report go on the Not applicable line instead of listing "none" each>

Evidence & Confidence:
- <Claim 1> — [Measured | Observed | Reported | Assumed], source: <link/citation>
- <Claim 2> — ...
- <Assumed entries are the assumptions list: each explicitly user-accepted, or driving the uncertainty step below>
- Problem Confidence: High | Medium | Low — <one-sentence rationale citing the claims above; derived mechanically per the checklist rules>
- <when Low/Medium: the named cheap uncertainty-reduction step taken or scheduled — or the risk the user explicitly accepted>

Phasing: <phase boundaries — each phase complete within its scope and shipping to the integration branch on its own, with a brief per later phase; throwaway STV only when the hypothesis itself is in doubt, with what it must demonstrate — or "single phase">

Failure-of-success: <how this could fail despite shipping correctly>

Open Questions: <unresolved items; each either becomes an accepted assumption or blocks recommendation>

Not applicable: <sections that genuinely don't apply, each with a one-clause rationale — e.g. "Phasing (single-phase, two-day change); Timeline constraints (none stated)">

Recommendation: Proceed | Reduce Uncertainty | Continue Discovery | Reject
Rationale: <why this recommendation, traced to the items above>
```

Keep the Summary tight: a section that doesn't apply goes on the **Not applicable** line with its rationale, once — not as a retained heading with "n/a" under it. Every line the reader sees should be content; n/a chains train the reader to skim, and a skimmed Summary defeats its purpose.

## Kill criteria — when to recommend Reject

The AI must be willing to recommend Reject. Reject is a valid, desirable outcome — not a failure of the workflow. Trigger conditions:

- No stakeholder can be identified.
- No measurable success metric exists.
- No meaningful decision is improved (Decision Quality Test returns nothing).
- Business impact is negligible.
- Estimated cost exceeds plausible value.
- The problem is insufficiently evidenced AND no plausible uncertainty-reduction path exists (no interview subject available, no manual workflow possible, no ticket history to mine). If a cheap learning step *does* exist, recommend **Reduce Uncertainty**, not Reject.
- A simpler solution already exists.
- The effort conflicts with higher-priority work and cannot be sequenced after it.
- The problem statement is actually a solution statement, and no underlying problem can be surfaced.

When recommending Reject, the AI should still write the Discovery Summary — with a Status that reflects reality: Complete if every section was answered, Partial otherwise. A rejection frequently happens precisely because sections could not be filled; do not inflate the Status to Complete. Then write a short ADR with `Status: Rejected (Discovery)` (the compressed form described under "ADR Status options" in `phases/adr.md`) so the decision and its rationale are durable and searchable.

## Pre-gate self-audit

Run this checklist immediately before presenting the Decision Gate. Answer each item honestly; a "no" means fix the Summary before presenting it, not after.

1. **Sources are real.** Every Evidence entry names a file, command, document, or quoted statement consulted this session. Nothing was classified from memory or plausibility. Spot-check: re-open the sources behind the two most load-bearing claims and confirm each source actually supports the claim as written — naming a real source for an invented claim is still invention.
2. **No manufactured content.** No checklist section was filled with plausible generic text. Anything not evidenced says UNKNOWN and appears under Open Questions. Filler test: if a sentence could appear unchanged in any project's Discovery Summary, it is filler — cut it or make it concrete.
3. **Confidence is counted, not felt.** The Problem Confidence rating follows mechanically from the Evidence classes per the rules above.
4. **No solutioning happened.** Discovery did not sketch architecture, components, or schemas. If it did, strip them and say so.
5. **The recommendation follows the evidence, not the user's preference.** If the honest recommendation is Reduce Uncertainty or Reject, recommend it.

## Decision Gate

Discovery ends with an explicit gate, not a drift into the next phase:

```
Discovery → Decision Gate → { Proceed | Reduce Uncertainty | Continue Discovery | Reject }
```

- **Proceed** — Summary is complete, Problem Confidence is High (or Medium with explicit user acceptance of the risk), and value clearly outweighs cost. "Complete" means every section has an answer, an explicit "none", or a spot on the Not applicable roll-up line with rationale — a terse Compressed Discovery summary (see Off-ramps in `SKILL.md`) meets this bar; blank sections do not. Apply the **"Is an ADR required?"** check (in `SKILL.md`). If yes, hand off to Phase 2 (ADR), then Phase 3 (Spec). If no, hand off directly to Phase 3 (Spec) with the Discovery Summary embedded as the spec's Background section.
- **Reduce Uncertainty** — Problem Confidence is Low/Medium *and* a cheap learning step exists (interview, pilot, manual run, ticket mining, dogfooding, temporary report). Name the step, get user buy-in, run it (or schedule it), then resume Discovery with the new evidence. This is the right outcome when **we don't have the info yet** and can cheaply generate it.
- **Continue Discovery** — gaps remain in what is already in front of us — stakeholder list, constraints, opportunity cost, success metrics. No new evidence-gathering needed yet, just deeper questioning of available info. This is the right outcome when **we have the info but haven't interrogated it hard enough**.
- **Reject** — kill criteria met, or value does not justify cost, or no plausible uncertainty-reduction path exists for an insufficiently evidenced problem. Write a Rejected-Discovery ADR and stop.

**Reduce Uncertainty vs Continue Discovery — sharp distinction:**
- Continue Discovery = "ask harder about what we already have."
- Reduce Uncertainty = "go produce new evidence cheaply."

The AI must:
1. Present the Discovery Summary.
2. State a recommendation with rationale.
3. Request explicit user authorization before advancing, reducing uncertainty, continuing, or rejecting.

Do not silently advance.

## Escalation rules

Actively challenge the request when:
- A solution is proposed without a problem statement.
- Success metrics are missing or vague.
- Stakeholders are unclear ("the users" is not a stakeholder).
- No meaningful decision is being improved.
- Business impact is negligible.
- Load-bearing claims are all Assumed, or Problem Confidence is rated High without supporting Measured/Observed evidence.
- A cheap uncertainty-reduction step exists but is being skipped in favor of jumping to design.
- The requested solution appears inconsistent with the stated intent.
- Opportunity cost is unaccounted for.

Behave like a senior engineer, architect, or product lead. Prefer discovering the correct problem — and being willing to say no — over rapidly generating documentation.
