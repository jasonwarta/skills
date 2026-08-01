// ---- Spec shape (mirrors config.json) ----

export interface Phase {
  id: string
  name: string
  order: number
  /** Glob patterns -- phase only active if at least one changed file matches */
  gate?: string[]
}

export interface Tier {
  id: string
  level: number
  models: string
  can: string
}

export interface Severity {
  id: string
  label: string
  blocks: boolean
}

export interface Tag {
  id: string
  globs: string[]
  diff_keywords?: string[]
}

export interface Check {
  id: string
  phase: string
  rule: string
  kind?: 'meta' | 'orch' | 'review'
  parent?: string
  severity_default?: string
  tags?: string[]
  tier?: string
  dedup_with?: string
}

export interface RoutingRule {
  tag: string
  phases: string[]
  emphasize: string[]
}

export interface OutputSpec {
  minimal: { required: string[] }
  full: {
    required: string[]
    required_s0_s1: string[]
    optional: string[]
  }
  consolidation: {
    dedup_key: string[]
    severity_rule: string
    s0_downgrade: boolean
    drop_s2: { when: string; unless: string }
    dedup_with_rule: string
  }
  severity_override: string
}

export interface HighRiskCombo {
  tags: string[]
  note: string
  emphasize: string[]
}

export interface RunnerHints {
  high_risk_combos: HighRiskCombo[]
}

export interface ReviewSpec {
  version: string
  defaults: { kind: string; tier: string }
  phases: Phase[]
  tiers: Tier[]
  severities: Severity[]
  tags: Tag[]
  checks: Check[]
  routing: RoutingRule[]
  output: OutputSpec
  runner_hints?: RunnerHints
}

// ---- Runtime types ----

export type ModelTier = 'all' | 'reasoning' | 'repo'

/** Minimal finding -- what code-focused models emit */
export interface MinimalFinding {
  check_id: string
  severity: string
  title: string
  target: string
}

/** Full finding -- what reasoning models emit */
export interface FullFinding extends MinimalFinding {
  evidence?: string
  suggested_fix?: string
  attack_scenario?: string
  owasp_ref?: string
  phase?: string
  confidence?: 'high' | 'medium' | 'low'
  related_checks?: string[]
}

export type Finding = MinimalFinding | FullFinding

/** Finding tagged with the reviewer that produced it. Models don't emit this;
 *  the orchestrator adds the reviewer ID before passing to mergeFindings. */
export interface AttributedFinding extends FullFinding {
  reviewer: string
}

/** Post-consolidation finding */
export interface ConsolidatedFinding {
  check_id: string
  severity: string
  title: string
  target: string
  evidence?: string
  suggested_fix?: string
  attack_scenario?: string
  owasp_ref?: string
  phase?: string
  confidence?: 'high' | 'medium' | 'low'
  related_checks?: string[]
  /** How many reviewers flagged this (check_id + target) */
  reviewer_count: number
}
