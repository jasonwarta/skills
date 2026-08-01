import type {
  AttributedFinding,
  Check,
  ConsolidatedFinding,
  ModelTier,
  Phase,
  ReviewSpec,
} from './types'

// ---- Glob matching (vendored -- keeps this skill dependency-free) ----
//
// Supports exactly the syntax used in config.json globs: literal paths,
// `*` (within one path segment), `**/` (zero or more whole segments), and a
// trailing `**` (anything below a directory). Unlike picomatch's default, `*`
// here also matches dotfiles -- acceptable over-matching for tag activation.

function globToRegExp(glob: string): RegExp {
  let re = ''
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:[^/]+/)*' // `**/` -> zero or more whole segments
          i += 3
        } else {
          re += '.*' // trailing `**` -> anything (incl. slashes)
          i += 2
        }
      } else {
        re += '[^/]*' // `*` -> within a single segment
        i += 1
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      re += '\\' + c
      i += 1
    } else {
      re += c
      i += 1
    }
  }
  return new RegExp('^' + re + '$')
}

function createGlobMatcher(globs: string[]): (path: string) => boolean {
  const regexes = globs.map(globToRegExp)
  return (path) => regexes.some((r) => r.test(path))
}

// ---- Tier level lookup (derived from spec) ----

function buildTierLevels(spec: ReviewSpec): Map<string, number> {
  return new Map(spec.tiers.map((t) => [t.id, t.level]))
}

function tierLevel(tier: string, tierLevels: Map<string, number>): number {
  const level = tierLevels.get(tier)
  if (level === undefined) {
    throw new Error(`Unknown tier "${tier}" -- not defined in spec.tiers`)
  }
  return level
}

// ---- Severity ordering (lower index = higher severity) ----

const SEV_ORDER = ['S0', 'S1', 'S2']

function sevIndex(sev: string): number {
  const idx = SEV_ORDER.indexOf(sev)
  return idx === -1 ? SEV_ORDER.length : idx
}

function maxSeverity(a: string, b: string): string {
  return sevIndex(a) <= sevIndex(b) ? a : b
}

// ---- 2. Tag activation ----

export function getActiveTags(
  diffText: string,
  changedFiles: string[],
  spec: ReviewSpec,
): Set<string> {
  const active = new Set<string>()

  // Extract added lines from diff (lines starting with + but not +++)
  const addedLines: string[] = []
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.slice(1)) // strip the leading +
    }
  }
  const addedText = addedLines.join('\n')

  for (const tag of spec.tags) {
    // Check file globs
    const matcher = createGlobMatcher(tag.globs)
    if (changedFiles.some((f) => matcher(f))) {
      active.add(tag.id)
      continue
    }

    // Check diff keywords in added lines only
    if (tag.diff_keywords) {
      for (const kw of tag.diff_keywords) {
        if (addedText.includes(kw)) {
          active.add(tag.id)
          break
        }
      }
    }
  }

  return active
}

// ---- 3. Phase selection ----

export function getActivePhases(
  activeTags: Set<string>,
  changedFiles: string[],
  spec: ReviewSpec,
): Phase[] {
  // Collect phase IDs from routing rules
  const phaseIds = new Set<string>()

  for (const route of spec.routing) {
    if (route.tag === '*' || activeTags.has(route.tag)) {
      for (const pid of route.phases) {
        phaseIds.add(pid)
      }
    }
  }

  // Resolve phases, apply gate as hard filter
  const phases: Phase[] = []

  for (const phase of spec.phases) {
    if (!phaseIds.has(phase.id)) continue

    // Gate check: if phase has gate globs, at least one changed file must match
    if (phase.gate && phase.gate.length > 0) {
      const gateMatcher = createGlobMatcher(phase.gate)
      if (!changedFiles.some((f) => gateMatcher(f))) {
        continue
      }
    }

    phases.push(phase)
  }

  // Sort by spec-defined order to be resilient to JSON reordering
  phases.sort((a, b) => a.order - b.order)
  return phases
}

// ---- 4. Check selection ----

export function getChecksForModel(
  phases: Phase[],
  activeTags: Set<string>,
  modelTier: ModelTier,
  spec: ReviewSpec,
): Check[] {
  const phaseIds = new Set(phases.map((p) => p.id))
  const tiers = buildTierLevels(spec)
  const modelLevel = tierLevel(modelTier, tiers)

  return spec.checks.filter((check) => {
    // Exclude meta and orch kinds
    if (check.kind === 'meta' || check.kind === 'orch') return false

    // Phase must be active
    if (!phaseIds.has(check.phase)) return false

    // Tag matching: empty tags array means always include
    if (check.tags && check.tags.length > 0) {
      if (!check.tags.some((t) => activeTags.has(t))) return false
    }

    // Tier check: model must meet or exceed check's required tier
    const checkTier = check.tier ?? spec.defaults.tier
    const checkLevel = tierLevel(checkTier, tiers)
    if (modelLevel < checkLevel) return false

    return true
  })
}

// ---- 5. Prompt builder ----

// ---- High-risk combo detection ----

export function getActiveHighRiskNotes(
  activeTags: Set<string>,
  spec: ReviewSpec,
): string[] {
  const notes: string[] = []
  for (const combo of spec.runner_hints?.high_risk_combos ?? []) {
    if (combo.tags.every((t) => activeTags.has(t))) {
      notes.push(combo.note)
    }
  }
  return notes
}

// ---- 5. Prompt builder ----

export function buildReviewerPrompt(
  checks: Check[],
  mode: 'minimal' | 'full',
  highRiskNotes?: string[],
): string {
  const lines: string[] = []

  lines.push('# Code Review Instructions')
  lines.push('')
  lines.push(
    'Review the diff below against these checks. Output a JSON array of findings. Silence = pass.',
  )
  lines.push('')

  if (mode === 'minimal') {
    lines.push(
      'Per finding: `check_id`, `severity` (S0/S1/S2), `title`, `target` (file:line).',
    )
  } else {
    lines.push(
      'Per finding: `check_id`, `severity` (S0/S1/S2), `title`, `target` (file:line).',
    )
    lines.push('S0/S1 also require: `evidence`, `suggested_fix`.')
    lines.push(
      'Optional: `attack_scenario`, `owasp_ref`, `phase`, `confidence`, `related_checks`.',
    )
  }

  lines.push('')
  lines.push(
    'S0 = CRITICAL (blocks). S1 = IMPORTANT (usually blocks). S2 = MINOR (non-blocking).',
  )

  if (highRiskNotes && highRiskNotes.length > 0) {
    lines.push('')
    lines.push('## High-Risk Notes')
    lines.push('')
    for (const note of highRiskNotes) {
      lines.push(`- ${note}`)
    }
  }

  lines.push('')
  lines.push('## Checks')
  lines.push('')

  // Group by phase for readability
  const byPhase = new Map<string, Check[]>()
  for (const c of checks) {
    const arr = byPhase.get(c.phase) ?? []
    arr.push(c)
    byPhase.set(c.phase, arr)
  }

  for (const [phaseId, phaseChecks] of byPhase) {
    lines.push(`### ${phaseId}`)
    lines.push('')
    for (const c of phaseChecks) {
      const sev = c.severity_default ? ` [default ${c.severity_default}]` : ''
      lines.push(`- **${c.id}**${sev}: ${c.rule}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---- 6. Merge findings ----

export function mergeFindings(
  findings: AttributedFinding[],
  spec: ReviewSpec,
): ConsolidatedFinding[] {
  // Build dedup_with lookup: check_id -> declaring check_id
  const dedupMap = new Map<string, string>()
  for (const check of spec.checks) {
    if (check.dedup_with) {
      // Map the aliased ID to the canonical (declaring) ID. Findings already
      // keyed by the canonical ID skip this lookup and group correctly on their own.
      dedupMap.set(check.dedup_with, check.id)
    }
  }

  // Group by (check_id + target), handling dedup_with merges
  const groups = new Map<
    string,
    ConsolidatedFinding & { _reviewers: Set<string> }
  >()

  for (const f of findings) {
    // Determine the canonical check_id for grouping
    let canonicalId = f.check_id

    // If this finding's check_id is the "other" side of a dedup_with pair,
    // merge into the declaring check
    if (dedupMap.has(f.check_id)) {
      canonicalId = dedupMap.get(f.check_id)!
    }

    const key = `${canonicalId}::${f.target}`
    const existing = groups.get(key)

    if (!existing) {
      groups.set(key, {
        check_id: canonicalId,
        severity: f.severity,
        title: f.title,
        target: f.target,
        evidence: f.evidence,
        suggested_fix: f.suggested_fix,
        attack_scenario: f.attack_scenario,
        owasp_ref: f.owasp_ref,
        phase: f.phase,
        confidence: f.confidence,
        related_checks: f.related_checks,
        reviewer_count: 1,
        _reviewers: new Set([f.reviewer]),
      })
    } else {
      // Merge: max severity wins
      existing.severity = maxSeverity(existing.severity, f.severity)

      // Track unique reviewers
      existing._reviewers.add(f.reviewer)
      existing.reviewer_count = existing._reviewers.size

      // Merge evidence
      if (f.evidence) {
        existing.evidence = existing.evidence
          ? `${existing.evidence}\n---\n${f.evidence}`
          : f.evidence
      }

      // Merge suggested_fix
      if (f.suggested_fix) {
        existing.suggested_fix = existing.suggested_fix
          ? `${existing.suggested_fix}\n---\n${f.suggested_fix}`
          : f.suggested_fix
      }
    }
  }

  let results = Array.from(groups.values()).map(
    // Strip internal _reviewers set from output
    ({ _reviewers, ...rest }) => rest,
  )

  // Drop S2 if single reviewer AND no line number in target
  results = results.filter((f) => {
    if (f.severity !== 'S2') return true
    if (f.reviewer_count > 1) return true
    // Keep if target has a line reference (:15, :15:3, :15-20) at the end or
    // followed by a separator + notes (":15, unused import", ":10: msg").
    // Anchored enough that path segments like "lib/v3:2024.ts" don't count
    // (a dot directly after the digits is not a separator).
    if (/:\d+(?:[-:]\d+)?(?:[\s,;:].*)?$/.test(f.target)) return true
    return false
  })

  // Sort by severity: S0 -> S1 -> S2
  results.sort((a, b) => sevIndex(a.severity) - sevIndex(b.severity))

  return results
}

// ---- 7. Orchestrator ----

export interface RunReviewEngineInput {
  diffText: string
  changedFiles: string[]
  modelTier: ModelTier
  spec: ReviewSpec
}

export interface RunReviewEngineResult {
  activeTags: Set<string>
  activePhases: Phase[]
  checks: Check[]
  highRiskNotes: string[]
  prompt: string
  /** Stub: model output would go here. Currently returns empty array. */
  rawFindings: AttributedFinding[]
  consolidated: ConsolidatedFinding[]
}

export function runReviewEngine(
  input: RunReviewEngineInput,
): RunReviewEngineResult {
  const { diffText, changedFiles, modelTier, spec } = input

  // 1-2. Tag activation
  const activeTags = getActiveTags(diffText, changedFiles, spec)

  // 3. Phase selection
  const activePhases = getActivePhases(activeTags, changedFiles, spec)

  // 4. Check selection
  const checks = getChecksForModel(activePhases, activeTags, modelTier, spec)

  // 5. Detect high-risk combos and build prompt
  const highRiskNotes = getActiveHighRiskNotes(activeTags, spec)
  const mode = modelTier === 'all' ? 'minimal' : 'full'
  const prompt = buildReviewerPrompt(checks, mode, highRiskNotes)

  // 6. Stub model output (no actual model call)
  const rawFindings: AttributedFinding[] = []

  // 7. Merge findings
  const consolidated = mergeFindings(rawFindings, spec)

  return {
    activeTags,
    activePhases,
    checks,
    highRiskNotes,
    prompt,
    rawFindings,
    consolidated,
  }
}
