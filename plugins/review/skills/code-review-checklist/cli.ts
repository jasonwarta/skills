/**
 * Code Review Checklist CLI
 *
 * Usage: npx tsx .claude/skills/code-review-checklist/cli.ts <command> [options]
 *
 * Commands:
 *   review   Run a full multi-reviewer code review
 *   plan     Output review plan (tags, phases, checks) as JSON
 *   prompt   Print the reviewer prompt for a given tier
 *   merge    Merge raw findings JSON into consolidated findings
 *
 * Note: The `review` command executes reviewer commands sequentially, not in
 * parallel. This is intentional -- it keeps the implementation simple, avoids
 * interleaved stderr, and is sufficient for CI where wall-clock time is
 * dominated by model inference anyway. For parallel dispatch (e.g., local
 * multi-model via HydraMCP), use the adversarial-review skill which
 * orchestrates concurrent model calls directly.
 */
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  buildReviewerPrompt,
  getActiveHighRiskNotes,
  getActivePhases,
  getActiveTags,
  getChecksForModel,
  mergeFindings,
} from './engine'
import type { AttributedFinding, ModelTier, ReviewSpec } from './types'

// ---- Helpers ----

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function die(msg: string): never {
  process.stderr.write(`error: ${msg}\n`)
  process.exit(1)
}

function log(msg: string): void {
  process.stderr.write(`${msg}\n`)
}

function loadSpec(): ReviewSpec {
  const specPath = resolve(__dirname, 'config.json')
  try {
    return JSON.parse(readFileSync(specPath, 'utf-8'))
  } catch (e) {
    die(`Failed to load spec from ${specPath}: ${e}`)
  }
}

function readDiffFile(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch (e) {
    die(`Failed to read diff file '${path}': ${e}`)
  }
}

function readChangedFiles(
  changedFilePaths: string[],
  changedFilesFile: string | null,
): string[] {
  const files: string[] = [...changedFilePaths]
  if (changedFilesFile) {
    try {
      const content = readFileSync(changedFilesFile, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) files.push(trimmed)
      }
    } catch (e) {
      die(`Failed to read changed-files-file '${changedFilesFile}': ${e}`)
    }
  }
  if (files.length === 0) {
    die(
      'No changed files provided. Use --changed-file or --changed-files-file.',
    )
  }
  return files
}

const VALID_SEVERITIES = new Set(['S0', 'S1', 'S2'])

function validateFindings(arr: unknown[], source: string): AttributedFinding[] {
  const valid: AttributedFinding[] = []
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i]
    if (
      typeof el !== 'object' ||
      el === null ||
      typeof (el as Record<string, unknown>).check_id !== 'string' ||
      typeof (el as Record<string, unknown>).severity !== 'string' ||
      typeof (el as Record<string, unknown>).title !== 'string' ||
      typeof (el as Record<string, unknown>).target !== 'string'
    ) {
      log(
        `Warning: ${source} element [${i}] missing required fields (check_id, severity, title, target), skipping.`,
      )
      continue
    }
    const severity = (el as Record<string, unknown>).severity as string
    if (!VALID_SEVERITIES.has(severity)) {
      log(
        `Warning: ${source} element [${i}] has unknown severity "${severity}", skipping.`,
      )
      continue
    }
    // Ensure reviewer field exists (default to source if missing)
    const finding = el as Record<string, unknown>
    if (typeof finding.reviewer !== 'string' || finding.reviewer === '') {
      finding.reviewer = source
    }
    valid.push(el as AttributedFinding)
  }
  return valid
}

function readFindingsFile(path: string): AttributedFinding[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (e) {
    die(`Failed to read findings file '${path}': ${e}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    die(`Findings file '${path}' is not valid JSON: ${e}`)
  }
  if (!Array.isArray(parsed)) {
    die(`Findings file '${path}' must contain a JSON array.`)
  }
  return validateFindings(parsed, `findings file '${path}'`)
}

function runReviewerCommand(
  command: string,
  prompt: string,
  diffText: string,
): AttributedFinding[] {
  const input = prompt + '\n\n# Diff\n\n```diff\n' + diffText + '\n```\n'
  log(`Running reviewer: ${command}`)
  let stdout: string
  try {
    stdout = execSync(command, {
      input,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'inherit'],
    })
  } catch (e: unknown) {
    let status: number | string = '?'
    let stderr = ''
    if (typeof e === 'object' && e !== null) {
      if (
        'status' in e &&
        typeof (e as Record<string, unknown>).status === 'number'
      ) {
        status = (e as Record<string, unknown>).status as number
      }
      if (
        'stderr' in e &&
        typeof (e as Record<string, unknown>).stderr === 'string'
      ) {
        stderr = (e as Record<string, unknown>).stderr as string
      }
    }
    die(`Reviewer command failed (exit ${status}): ${command}\n${stderr}`)
  }

  // Extract JSON array from stdout -- handle markdown fences
  let jsonStr = stdout.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    die(
      `Reviewer '${command}' did not return valid JSON.\nGot:\n${stdout.slice(0, 500)}`,
    )
  }
  if (!Array.isArray(parsed)) {
    die(`Reviewer '${command}' must return a JSON array. Got: ${typeof parsed}`)
  }
  return validateFindings(parsed, `reviewer '${command}'`)
}

// ---- Arg parsing ----

interface ParsedArgs {
  command: string
  diffFile: string | null
  changedFiles: string[]
  changedFilesFile: string | null
  reviewerAll: string[]
  reviewerReasoning: string[]
  reviewerRepo: string[]
  failOn: string
  json: boolean
  tier: ModelTier | null
  mode: 'minimal' | 'full' | null
  findingsFile: string | null
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2) // skip node + script
  const result: ParsedArgs = {
    command: '',
    diffFile: null,
    changedFiles: [],
    changedFilesFile: null,
    reviewerAll: [],
    reviewerReasoning: [],
    reviewerRepo: [],
    failOn: 'S0',
    json: false,
    tier: null,
    mode: null,
    findingsFile: null,
  }

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage()
    process.exit(args.length === 0 ? 1 : 0)
  }

  result.command = args[0]
  let i = 1

  while (i < args.length) {
    const arg = args[i]
    switch (arg) {
      case '--diff-file':
        result.diffFile = args[++i] ?? die('--diff-file requires a value')
        break
      case '--changed-file':
        result.changedFiles.push(
          args[++i] ?? die('--changed-file requires a value'),
        )
        break
      case '--changed-files-file':
        result.changedFilesFile =
          args[++i] ?? die('--changed-files-file requires a value')
        break
      case '--reviewer-all':
        result.reviewerAll.push(
          args[++i] ?? die('--reviewer-all requires a value'),
        )
        break
      case '--reviewer-reasoning':
        result.reviewerReasoning.push(
          args[++i] ?? die('--reviewer-reasoning requires a value'),
        )
        break
      case '--reviewer-repo':
        result.reviewerRepo.push(
          args[++i] ?? die('--reviewer-repo requires a value'),
        )
        break
      case '--fail-on':
        result.failOn = args[++i] ?? die('--fail-on requires a value')
        if (!['S0', 'S1', 'S2'].includes(result.failOn)) {
          die(`--fail-on must be S0, S1, or S2. Got: ${result.failOn}`)
        }
        break
      case '--json':
        result.json = true
        break
      case '--tier': {
        const v = args[++i] ?? die('--tier requires a value')
        if (!['all', 'reasoning', 'repo'].includes(v)) {
          die(`--tier must be all, reasoning, or repo. Got: ${v}`)
        }
        result.tier = v as ModelTier
        break
      }
      case '--mode': {
        const v = args[++i] ?? die('--mode requires a value')
        if (!['minimal', 'full'].includes(v)) {
          die(`--mode must be minimal or full. Got: ${v}`)
        }
        result.mode = v as 'minimal' | 'full'
        break
      }
      case '--findings-file':
        result.findingsFile =
          args[++i] ?? die('--findings-file requires a value')
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
      // fallthrough impossible -- process.exit is never
      default:
        die(`Unknown option: ${arg}`)
    }
    i++
  }

  return result
}

function printUsage(): void {
  process.stderr.write(`Usage: npx tsx cli.ts <command> [options]

Commands:
  review    Run full multi-reviewer code review
  plan      Output review plan as JSON
  prompt    Print reviewer prompt for a tier
  merge     Merge raw findings into consolidated findings

Common options:
  --diff-file <path>             Path to diff file
  --changed-file <path>          Changed file path (repeatable)
  --changed-files-file <path>    File containing changed file paths (one per line)

review options:
  --reviewer-all <cmd>           Reviewer command for 'all' tier (repeatable)
  --reviewer-reasoning <cmd>     Reviewer command for 'reasoning' tier (repeatable)
  --reviewer-repo <cmd>          Reviewer command for 'repo' tier (repeatable)
  --fail-on S0|S1|S2             Exit non-zero if findings at this severity or above (default: S0)
  --json                         Output JSON instead of human-readable text

prompt options:
  --tier all|reasoning|repo      Which tier prompt to generate
  --mode minimal|full            Output mode (default: minimal for all, full for reasoning/repo)

merge options:
  --findings-file <path>         Path to JSON file with attributed findings array
`)
}

// ---- Commands ----

function cmdPlan(args: ParsedArgs): void {
  if (!args.diffFile) die('plan requires --diff-file')
  const spec = loadSpec()
  const diffText = readDiffFile(args.diffFile)
  const changedFiles = readChangedFiles(
    args.changedFiles,
    args.changedFilesFile,
  )

  const activeTags = getActiveTags(diffText, changedFiles, spec)
  const activePhases = getActivePhases(activeTags, changedFiles, spec)
  const highRiskNotes = getActiveHighRiskNotes(activeTags, spec)

  const checksByTier: Record<
    string,
    { id: string; phase: string; rule: string }[]
  > = {}
  for (const tier of ['all', 'reasoning', 'repo'] as ModelTier[]) {
    const checks = getChecksForModel(activePhases, activeTags, tier, spec)
    checksByTier[tier] = checks.map((c) => ({
      id: c.id,
      phase: c.phase,
      rule: c.rule,
    }))
  }

  const output = {
    activeTags: [...activeTags],
    activePhases: activePhases.map((p) => ({ id: p.id, name: p.name })),
    highRiskNotes,
    checksByTier,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

function cmdPrompt(args: ParsedArgs): void {
  if (!args.diffFile) die('prompt requires --diff-file')
  if (!args.tier) die('prompt requires --tier')
  const spec = loadSpec()
  const diffText = readDiffFile(args.diffFile)
  const changedFiles = readChangedFiles(
    args.changedFiles,
    args.changedFilesFile,
  )

  const activeTags = getActiveTags(diffText, changedFiles, spec)
  const activePhases = getActivePhases(activeTags, changedFiles, spec)
  const highRiskNotes = getActiveHighRiskNotes(activeTags, spec)
  const checks = getChecksForModel(activePhases, activeTags, args.tier, spec)

  const mode = args.mode ?? (args.tier === 'all' ? 'minimal' : 'full')
  const prompt = buildReviewerPrompt(checks, mode, highRiskNotes)

  process.stdout.write(prompt)
}

function cmdMerge(args: ParsedArgs): void {
  if (!args.findingsFile) die('merge requires --findings-file')
  const spec = loadSpec()
  const findings = readFindingsFile(args.findingsFile)
  const consolidated = mergeFindings(findings, spec)
  process.stdout.write(JSON.stringify(consolidated, null, 2) + '\n')
}

function cmdReview(args: ParsedArgs): void {
  const hasReviewers =
    args.reviewerAll.length > 0 ||
    args.reviewerReasoning.length > 0 ||
    args.reviewerRepo.length > 0

  if (!hasReviewers) {
    die(
      'review requires at least one reviewer command.\n' +
        'Use --reviewer-all, --reviewer-reasoning, or --reviewer-repo.',
    )
  }
  if (!args.diffFile) die('review requires --diff-file')

  const spec = loadSpec()
  const diffText = readDiffFile(args.diffFile)
  const changedFiles = readChangedFiles(
    args.changedFiles,
    args.changedFilesFile,
  )

  const activeTags = getActiveTags(diffText, changedFiles, spec)
  const activePhases = getActivePhases(activeTags, changedFiles, spec)
  const highRiskNotes = getActiveHighRiskNotes(activeTags, spec)

  log(`Active tags: ${[...activeTags].join(', ') || '(none)'}`)
  log(`Active phases: ${activePhases.map((p) => p.id).join(', ') || '(none)'}`)
  if (highRiskNotes.length > 0) {
    log(`High-risk notes: ${highRiskNotes.length}`)
  }

  const allFindings: AttributedFinding[] = []
  let reviewerIndex = 0

  // Run each tier's reviewers
  const tiers: { tier: ModelTier; commands: string[] }[] = [
    { tier: 'all', commands: args.reviewerAll },
    { tier: 'reasoning', commands: args.reviewerReasoning },
    { tier: 'repo', commands: args.reviewerRepo },
  ]

  for (const { tier, commands } of tiers) {
    if (commands.length === 0) continue

    const checks = getChecksForModel(activePhases, activeTags, tier, spec)
    if (checks.length === 0) {
      log(
        `Tier '${tier}': 0 checks active, skipping ${commands.length} reviewer(s)`,
      )
      continue
    }

    const mode = tier === 'all' ? 'minimal' : 'full'
    const prompt = buildReviewerPrompt(checks, mode, highRiskNotes)

    log(
      `Tier '${tier}': ${checks.length} checks, ${commands.length} reviewer(s)`,
    )

    for (const cmd of commands) {
      reviewerIndex++
      const reviewerId = `reviewer-${reviewerIndex}:${tier}`
      const findings = runReviewerCommand(cmd, prompt, diffText)
      log(`  ${reviewerId}: ${findings.length} finding(s)`)

      for (const f of findings) {
        allFindings.push({
          ...f,
          reviewer: f.reviewer || reviewerId,
        })
      }
    }
  }

  // Merge
  const consolidated = mergeFindings(allFindings, spec)

  log(
    `\n${allFindings.length} raw finding(s) -> ${consolidated.length} consolidated`,
  )

  // Output
  if (args.json) {
    const output = {
      activeTags: [...activeTags],
      activePhases: activePhases.map((p) => ({ id: p.id, name: p.name })),
      highRiskNotes,
      rawCount: allFindings.length,
      findings: consolidated,
    }
    process.stdout.write(JSON.stringify(output, null, 2) + '\n')
  } else {
    if (consolidated.length === 0) {
      process.stdout.write('No findings.\n')
    } else {
      for (const f of consolidated) {
        const reviewers =
          f.reviewer_count > 1 ? ` (${f.reviewer_count} reviewers)` : ''
        process.stdout.write(
          `[${f.severity}] ${f.check_id} @ ${f.target}${reviewers}\n  ${f.title}\n`,
        )
        if (f.evidence) {
          process.stdout.write(`  Evidence: ${f.evidence.split('\n')[0]}\n`)
        }
        if (f.suggested_fix) {
          process.stdout.write(`  Fix: ${f.suggested_fix.split('\n')[0]}\n`)
        }
        process.stdout.write('\n')
      }
    }
  }

  // Exit code based on --fail-on
  const sevOrder = ['S0', 'S1', 'S2']
  const failThreshold = sevOrder.indexOf(args.failOn)
  const hasBlocker = consolidated.some(
    (f) => sevOrder.indexOf(f.severity) <= failThreshold,
  )

  if (hasBlocker) {
    log(`Findings at ${args.failOn} or above detected. Failing.`)
    process.exit(1)
  }
}

// ---- Main ----

const args = parseArgs(process.argv)

switch (args.command) {
  case 'review':
    cmdReview(args)
    break
  case 'plan':
    cmdPlan(args)
    break
  case 'prompt':
    cmdPrompt(args)
    break
  case 'merge':
    cmdMerge(args)
    break
  default:
    die(`Unknown command: ${args.command}. Use review, plan, prompt, or merge.`)
}
