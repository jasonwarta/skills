/**
 * Example: run the review engine against a mock diff and log results.
 *
 * Usage: npx tsx .claude/skills/code-review-checklist/example.ts
 */
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  getActiveTags,
  getActivePhases,
  getChecksForModel,
  buildReviewerPrompt,
  mergeFindings,
  runReviewEngine,
} from './engine'
import type { AttributedFinding, ReviewSpec } from './types'

// ---- Load spec ----

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const specPath = resolve(__dirname, 'config.json')
const spec: ReviewSpec = JSON.parse(readFileSync(specPath, 'utf-8'))

// ---- Mock diff: API endpoint with SQL interpolation, missing await, missing validation ----

const mockDiff = `
diff --git a/src/api/routes/readings.ts b/src/api/routes/readings.ts
index abc1234..def5678 100644
--- a/src/api/routes/readings.ts
+++ b/src/api/routes/readings.ts
@@ -10,6 +10,15 @@ import { db } from "../db";
+export const getReadings = async (req: Request, res: Response) => {
+  const { projectId, sortBy } = req.body;
+  const results = db.selectFrom("readings")
+    .where("project_id", "=", projectId)
+    .orderBy(sortBy)
+    .select(["id", "value", "created_at", "internal_notes"])
+    .execute();
+  res.json(results);
+};
`

const changedFiles = ['src/api/routes/readings.ts']

// ---- Run individual steps ----

console.log('=== Tag Activation ===')
const activeTags = getActiveTags(mockDiff, changedFiles, spec)
console.log('Active tags:', [...activeTags])

console.log('\n=== Phase Selection ===')
const activePhases = getActivePhases(activeTags, changedFiles, spec)
console.log(
  'Active phases:',
  activePhases.map((p) => `${p.id} (${p.name})`),
)

console.log('\n=== Check Selection (reasoning tier) ===')
const checks = getChecksForModel(activePhases, activeTags, 'reasoning', spec)
console.log(`${checks.length} checks selected:`)
for (const c of checks) {
  console.log(`  ${c.id}: ${c.rule.slice(0, 80)}`)
}

console.log('\n=== Reviewer Prompt (first 40 lines) ===')
const prompt = buildReviewerPrompt(checks, 'full')
const promptLines = prompt.split('\n')
console.log(promptLines.slice(0, 40).join('\n'))
if (promptLines.length > 40) {
  console.log(`  ... (${promptLines.length - 40} more lines)`)
}

// ---- Mock findings from two reviewers ----

console.log('\n=== Merge Findings ===')
const mockFindings: AttributedFinding[] = [
  // Reviewer 1: SQL injection
  {
    reviewer: 'claude-sonnet',
    check_id: 'SI-SQL',
    severity: 'S0',
    title: 'SQL injection via dynamic orderBy',
    target: 'src/api/routes/readings.ts:15',
    evidence:
      'sortBy from req.body passed directly to .orderBy() without allowlist',
    suggested_fix:
      'Create an allowlist of valid column names and validate sortBy against it',
  },
  // Reviewer 1: data exposure
  {
    reviewer: 'claude-sonnet',
    check_id: 'SD-OWASP-DATA',
    severity: 'S1',
    title: 'Internal notes exposed in API response',
    target: 'src/api/routes/readings.ts:16',
    evidence:
      'internal_notes selected and returned via res.json without filtering',
    suggested_fix: 'Remove internal_notes from select or add a DTO layer',
  },
  // Reviewer 2: same SQL injection, different wording
  {
    reviewer: 'gpt-4o',
    check_id: 'SI-SQL',
    severity: 'S0',
    title: 'Unsanitized orderBy clause',
    target: 'src/api/routes/readings.ts:15',
    evidence: 'User-controlled sortBy flows into SQL ORDER BY',
    suggested_fix: 'Validate against column allowlist before using in query',
  },
  // Reviewer 1: flags missing await as COR-ASYNC (db.selectFrom() not awaited)
  {
    reviewer: 'claude-sonnet',
    check_id: 'COR-ASYNC',
    severity: 'S1',
    title: 'db query not awaited -- res.json sends a Promise, not results',
    target: 'src/api/routes/readings.ts:13',
  },
  // Reviewer 2: flags same issue as TS-PROMISE (dedup_with merges into TS-PROMISE)
  {
    reviewer: 'gpt-4o',
    check_id: 'TS-PROMISE',
    severity: 'S1',
    title: 'Floating promise from db.selectFrom().execute()',
    target: 'src/api/routes/readings.ts:13',
  },
  // Reviewer 2: low-confidence S2 without line number (should be dropped)
  {
    reviewer: 'gpt-4o',
    check_id: 'TS-IMPORT',
    severity: 'S2',
    title: 'Could use import type for Request/Response',
    target: 'src/api/routes/readings.ts',
  },
  // Reviewer 1: S2 WITH line number (should be kept even if single reviewer)
  {
    reviewer: 'claude-sonnet',
    check_id: 'TS-IGNORE',
    severity: 'S2',
    title: '@ts-expect-error without explanation',
    target: 'src/api/routes/readings.ts:3',
  },
]

const consolidated = mergeFindings(mockFindings, spec)
console.log(
  `${mockFindings.length} raw findings -> ${consolidated.length} consolidated:`,
)
for (const f of consolidated) {
  console.log(
    `  [${f.severity}] ${f.check_id} @ ${f.target} (${f.reviewer_count} reviewer(s)) -- ${f.title}`,
  )
}

// ---- Full orchestrator run ----

console.log('\n=== Full Orchestrator Run ===')
const result = runReviewEngine({
  diffText: mockDiff,
  changedFiles,
  modelTier: 'reasoning',
  spec,
})
console.log('Tags:', [...result.activeTags])
console.log(
  'Phases:',
  result.activePhases.map((p) => p.id),
)
console.log('Checks:', result.checks.length)
console.log(
  'High-risk notes:',
  result.highRiskNotes.length > 0 ? result.highRiskNotes : '(none)',
)
console.log('Findings (stub):', result.consolidated.length)
