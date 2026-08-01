---
name: code-review-checklist
description: Machine-optimized review spec for multi-model adversarial review. Stable check IDs, applicability routing, capability tiers, severity model, compact/full variants. Security design review first.
---

# Code Review Spec v2

---

## Overview

### Review phases (strict order)

| Phase | Focus | Min tier |
|-------|-------|----------|
| P0 | Security design | reasoning |
| P1 | Security implementation | all |
| P2 | Correctness | all (code models excel) |
| P3 | Type safety | all |
| P4 | Architecture | varies per check |
| P5 | Schema/migrations | all |
| P6 | Accessibility | varies per check |
| P7 | Dependencies | orchestrator |

### Severity

| Level | Blocks commit? |
|-------|----------------|
| S0 CRITICAL | Yes |
| S1 IMPORTANT | Usually |
| S2 MINOR | No |

### Capability tiers

Checks are tagged with the minimum model tier required to evaluate them.

| Tier | Who | Can do |
|------|-----|--------|
| `all` | Any reviewer | Pattern matching, syntax, logic tracing from diff |
| `reasoning` | Current frontier models — discover via HydraMCP `list_models` (e.g. Gemini 2.5 Pro, GPT-5.x, Claude) | Multi-step reasoning, OWASP knowledge, architecture judgment |
| `repo` | Claude Code agents | Browse repo beyond diff, verify file existence, read related code |
| `orch` | Orchestrating agent only | Run npm/git commands, read PR description, invoke tools |

### Applicability tags

Each check has tags. Evaluate a check only if at least one of its tags matches the change. Checks with no tag apply to all reviews.

| Tag | Matches when files match |
|-----|--------------------------|
| `auth` | `apps/api/src/ez/endpoints/auth*`, `apps/api/src/ez/middleware/**`, `**/session*`, `**/preAuthRouting*`, `**/middleware/auth*`, `apps/mcp-server/src/auth*`, `apps/mcp-server/src/httpAuth*`, `apps/mcp-server/src/permissions*` |
| `input` | `apps/api/src/ez/**`, `**/endpoint*`, `**/route*`, `apps/mcp-server/src/tools/**`, `apps/mcp-server/src/inputSchema*` |
| `mcp` | `apps/mcp-server/**` |
| `data-exposure` | API response serialization, DTO files |
| `ssrf` | Server-side fetch/redirect/webhook logic |
| `db-core` | `packages/db/**`, `postgres_schema_updates/**` |
| `db-callsite` | DB query callsites (`packages/api-lib/**`, `apps/api/**`, etc.) + diff keywords (`db.selectFrom(`, `sql\``, etc.) |
| `ui` | `apps/web/src/**/*.tsx`, `packages/ui/**`, `**/*.css`, `**/*.scss` |
| `deps` | `**/package.json` |
| `docs` | `docs/decisions/**`, `docs/specs/**` |
| `api` | `apps/api/**` |

**Mixed-type changes:** Include the union of all matching phases. Each phase included once.

---

## Compact Checklist

For reviewer prompts. Each line = one check. Emit findings using check IDs per the output schema.

### P0: Security Design

- **SD-TRUST** For each client-sent field, what if attacker sends arbitrary values?
  - SD-TRUST-AUTH `auth`: Auth/session decisions (lifetime, privileges, roles)
  - SD-TRUST-BIZ `input`: Business logic (prices, quantities, limits)
  - SD-TRUST-FETCH `ssrf`: Server-side actions (URLs, paths, redirects)
  - SD-TRUST-SHAPE `input` `db-core` `db-callsite`: Data shape (fields spread into DB, sort/filter params)
- **SD-OWASP** Which OWASP categories does this change touch?
  - SD-OWASP-AUTHN `auth` `reasoning`: Credential storage, brute-force protection, recovery, MFA
  - SD-OWASP-SESS `auth` `reasoning`: Server-controlled lifetime, cookie flags, idle vs absolute timeout, rotation on privilege change
  - SD-OWASP-AUTHZ `auth`: Deny-by-default, server-side enforcement, no IDOR by design
  - SD-OWASP-DATA `data-exposure`: Return only needed fields, tenant/ownership filters on bulk
  - SD-OWASP-SSRF `ssrf`: Allowlist URLs, reject private IPs, non-HTTPS, unexpected ports
  - SD-OWASP-MASS `input`: Flag if request body fields reach DB/constructor without explicit allowlist
  - SD-OWASP-CRYPTO `auth` `reasoning`: 128+ bit tokens, approved hashing (bcrypt/scrypt/argon2), no Math.random() for security
  - SD-OWASP-RATE `input`: Rate limits on unauthed resource creation, concurrency controls on expensive ops
- **SD-THREAT** `reasoning`: Flag if change widens attack surface with no documented mitigation
- **SD-DEPTH** `reasoning`: Flag if single control failure has unbounded impact

### P1: Security Implementation

- **SI-SECRET**: No hardcoded secrets/keys/tokens/credentials in source or tests
- **SI-LOG**: No logging of sensitive headers, tokens, or PII
- **SI-AUTHZ** `auth` `api` `mcp`: Auth middleware applied to route; endpoint checks authorization. MCP tools: declare permissions[] enforced via shared hasPermission; auth-required by default.
- **SI-VALID** `input` `api` `mcp`: Validation schema exists, applied before handler logic (e.g. Zod). MCP tools: inputSchema constrains every accepted arg.
- **SI-SQL** `db-core` `db-callsite`: No user string interpolation in SQL. Bind with sql.val(). sql.ref() for trusted static identifiers only. Dynamic identifiers from allowlist.
- **SI-XSS** `ui`: No dangerouslySetInnerHTML without DOMPurify, no eval(), no javascript: in href/src
- **SI-ZOD**: No z.any()/z.unknown() without downstream narrowing
- **SI-ERR** `api` `mcp`: Error responses don't leak stack traces, file paths, or internal schema. MCP: auth-time codes are operator-only (stderr); per-call errors use the structured McpToolError payload.
- **MCP-ORG-SCOPE** `mcp` `reasoning`: Tool handlers scope org data by context.organizationId or a validated org arg. Tools accepting organizationId declare requiresOrgMatch. Handlers without it must not accept org args and must handle null bound org (global-admin cross-org keys) explicitly — never default to unscoped queries. **S0**
- **MCP-READONLY** `mcp` `reasoning`: Write-effect tools declare access: 'write' (dispatcher read-only gate). No DB writes or side effects in access: 'read' handlers. **S0**

### P2: Correctness

- **COR-LOGIC**: Trace each conditional branch. Flag incorrect output for valid input, wrong comparison operators (=== vs ==), inverted conditions, off-by-one in loop bounds.
- **COR-EDGE**: Flag unhandled null/undefined, empty array/string, boundary values, concurrent access.
- **COR-ASYNC**: Flag race conditions, unhandled promise rejections, broken error propagation in async chains.
- **COR-DATA**: Flag type mismatches, lossy numeric conversions, timezone/locale errors.

### P3: TypeScript

- **TS-ANY**: No `any`. Use explicit types, generics, or z.infer<>. If unavoidable, comment why and narrow.
- **TS-ASSERT**: No `as Foo` without preceding type guard
- **TS-IGNORE**: No @ts-ignore/@ts-expect-error without explanatory comment
- **TS-BRAND**: Branded ID types (ProjectId, UserId) where expected, not raw string/number
- **TS-INFER**: Zod schemas via z.infer<typeof schema>, not hand-written parallel interfaces
- **TS-IMPORT**: `import type` for type-only imports
- **TS-PROMISE**: No floating promises. Explicit `void` for fire-and-forget. Promise.all for independent concurrent ops. (Dedup: if same target as COR-ASYNC, consolidate here.)
- **TS-CATCH**: Error in catch typed `unknown`, narrowed before access
- **TS-REACT** `ui`: children: ReactNode, refs: explicit generic, context: explicit type

### P4: Architecture

- **ARCH-LAYER** `api`: Business logic in api-lib, not endpoint handlers. Handlers: parse -> api-lib -> respond.
- **ARCH-DB** `db-core` `db-callsite`: No Kysely or direct DB imports outside `db` package
- **ARCH-CRUD** `db-core` `repo`: DB ops follow named-object pattern with CRUD methods grouped by related tables
- **ARCH-QKEY** `ui` `repo`: Query keys use factory in lib/queryKeys.ts, not hardcoded string arrays
- **ARCH-QOPT** `ui` `repo`: Query definitions use queryOptions() factory, not inline queryKey/queryFn
- **ARCH-HOOK** `ui`: No useEffect + useState for async data. Use useQuery/useMutation.
- **ARCH-CACHE** `ui` `repo`: Cache invalidation explicit and scoped, not blanket invalidateQueries
- **ARCH-ROUTE** `api`: All API routes use express-zod-api (apps/api/src/ez/endpoints/)
- **ARCH-CSV** `api`: CSV endpoints server-side only
- **ARCH-IMPORT**: Cross-package imports flow inward: apps/* -> packages/*, never reverse
- **ARCH-DELETE** `ui` `repo`: Delete mutations use mutationKey: ['delete', resourceType, id]

### P5: Schema Changes `db-core`

Skip if diff contains no changes to `packages/db/tests/postgres/schema.sql`, `packages/db/tests/postgres/views/`, or `postgres_schema_updates/`.

- **SCH-EQUIV**: All migrations in order on empty DB must produce schema.sql. **S0**
- **SCH-DROP**: Removed from schema.sql? Verify migration drops it. Schema-only change = deploys won't converge. **S0**
- **SCH-RENAME-TBL**: Table renamed? Rename {old}_pkey -> {new}_pkey and all FK constraints. Postgres doesn't do this implicitly. **S0**
- **SCH-RENAME-COL**: Column renamed + referenced in view? Drop/recreate views. CREATE OR REPLACE VIEW can't rename columns. **S0**
- **SCH-ADD-COL**: Column added to table with views? Drop/recreate views that should expose it. **S0**
- **SCH-ENUM**: Use ALTER TYPE ADD VALUE IF NOT EXISTS. No rebuild via CREATE TYPE _old_version. **S0**
- **SCH-VIEW-SYNC** `repo`: Migration rebuilds a view? tests/postgres/views/*.sql must match. **S0**
- **SCH-THREE-FILE** `repo`: Migration file present? schema.sql + view files must also be changed. **S0**
- **SCH-IDX-FK** `repo`: FK columns must have indexes — Postgres does NOT auto-create them. Flag FK constraints or join-predicate columns without a CREATE INDEX in schema.sql. **S1**
- **SCH-VIEW-JOIN** `repo`: View JOIN predicate columns must have index coverage. Cross-reference ON/USING columns against CREATE INDEX statements. **S1**
- **SCH-VIEW-LATERAL** `repo`: LATERAL subqueries must drive from the most selective table outward. Flag high-cardinality outer tables with no restrictive filter. **S0**
- **SCH-NAMING**: Files match YYYY/YYYY_MM_DD_description.sql. Runner sorts lexicographically. **S1**
- **SCH-CONSOLIDATE**: Minimize migration file count per PR. Consolidate related DDL into one file; splits only justified by transactional constraints (ALTER TYPE ADD VALUE must commit before use; CREATE INDEX CONCURRENTLY outside a tx). When split IS justified, filename alphabetical order must match dependency order -- the runner sorts lexicographically and same-date files break ties on the description. E.g. `2026_05_26_mcp_required_columns_check.sql` sorts before `2026_05_26_mcp_user_api_key.sql`, so a CHECK in the former that references a column added by the latter fails on a fresh DB. Consolidate, rename, or bump the date. **S0**
- **SCH-PR** `orch`: PR description includes destructive SQL and INSERT INTO _schema_migrations per file. **S1**

### P6: Accessibility `ui`

Skip if diff contains no `.tsx`, `.css`, `.scss` files and no changes to `packages/ui/` or `apps/web/src/`.

Pattern checks (all models):
- **A11Y-NAME**: Every interactive element has discoverable name. IconButton -> aria-label. Input -> label/aria-label.
- **A11Y-DECO**: Meaningful images: alt text. Decorative icons: aria-hidden="true". Standalone SVG: role="img" + aria-label.
- **A11Y-KB**: onMouseOver/onMouseOut -> onFocus/onBlur. Click on non-button/link -> role + tabIndex + onKeyDown.
- **A11Y-LIVE**: Async content areas: aria-live="polite" for dynamic regions. Spinner or visually-hidden text.
- **A11Y-GROUP**: Related icon+text: group semantically or mark icon aria-hidden.

Judgment checks (reasoning models):
- **A11Y-COLOR** `reasoning`: No color-only state differentiation. Require secondary cue.
- **A11Y-CONTRAST** `reasoning`: Text 4.5:1 normal, 3:1 large. Check hardcoded colors, dark backgrounds, overlays, third-party containers.
- **A11Y-NONTEXT** `reasoning`: UI controls and meaningful graphics 3:1 contrast.
- **A11Y-TRAP** `reasoning`: Modals trap focus while open, return on close. Escape dismisses popovers/tooltips.
- **A11Y-FOCUS** `reasoning`: No suppressed outline/ring. Custom focus meets 3:1.
- **A11Y-TIMING** `reasoning`: Auto-dismiss >=5s or user-controllable.
- **A11Y-3P-CSS** `reasoning`: Third-party containers lose app CSS vars. Hardcode tokens.
- **A11Y-3P-KB** `reasoning`: Disabled native KB shortcuts? Alternative KB path exists.

### P7: Dependencies `orch`

Orchestrator handles. Reviewers: flag new dependencies seen in diff. Orchestrator verifies details.

- **DEP-LIST** `orch`: List each new dependency + declared version for human review.
- **DEP-AGE** `orch`: npm info -- flag versions <1 month old as supply chain risk.
- **DEP-LATEST** `orch`: Note latest available version alongside added version.

### Process

- **PROC-ADR**: ADR approval is a PR-level property, not a document property — a non-author's approval of the PR that carries the ADR into the repo's default branch is the approval, covering the ADR and its companion spec together. That approval is enforced by the repo's merge gate (branch protection / merge queue), not by this review: never flag a PR for not-yet-approved status, and never require any approval record inside the ADR document (there is no Consensus section). What this check enforces from the diff: (1) a newly added ADR must not contain a Consensus or sign-off section — that means it was written from an outdated template (pre-existing ADRs are historical records; do not flag them); (2) decisions involving significant pricing changes or adjustments to customer obligations must be flagged as a business-impacting decision requiring sign-off before implementation (customer-visible or expensive-to-reverse alone does not trigger this).

---

## Full Checklist

Authoritative reference. When compact and full diverge, full governs. Organized identically to compact -- use this for edge cases, reasoning, and context that the compact version omits.

### P0: Security Design Review

Evaluate design before implementation.

#### SD-TRUST: Trust Boundaries

For every field the client sends, the server must not let that value control security-sensitive behavior without server-side policy enforcement.

| Sub-check | Domain | Examples |
|-----------|--------|----------|
| SD-TRUST-AUTH | Auth/session | Session lifetime, privilege level, role assignment |
| SD-TRUST-BIZ | Business logic | Prices, quantities, discounts, feature flags, resource limits |
| SD-TRUST-FETCH | Server-side actions | URLs fetched, file paths, email recipients, redirect targets |
| SD-TRUST-SHAPE | Data shape | Fields spread into DB updates, filter/sort params mapped to columns |

#### SD-OWASP: OWASP Alignment

Identify which OWASP categories the change touches, check relevant guidelines. Not limited to auth -- any change handling user input, exposing data, or integrating externally.

**SD-OWASP-AUTHN (ASVS V2)** `auth` `reasoning`
- Credential storage uses approved algorithms
- Brute-force/credential-stuffing protection
- Secure recovery flows, MFA where appropriate

**SD-OWASP-SESS (ASVS V3)** `auth` `reasoning`
- Server-controlled lifetime, cookie flags (httpOnly, secure, SameSite)
- Idle timeout distinct from absolute timeout, rotation on privilege change
- "Remember me": separate persistent token issuing short-lived sessions, not extended maxAge

**SD-OWASP-AUTHZ (ASVS V4)** `auth`
- Deny-by-default, server-side enforcement, no client-only gates, no IDOR by design

**SD-OWASP-DATA (ASVS V8, API Top 10)** `data-exposure`
- Return only needed fields, no hashes/internal IDs/PII unless required
- Bulk endpoints: tenant/ownership filters prevent cross-user data exposure

**SD-OWASP-SSRF** `ssrf`
- Server-fetched URLs validated against allowlist
- Reject private/internal IPs, non-HTTPS, unexpected ports

**SD-OWASP-MASS** `input`
- Request bodies not spread into DB/constructors without explicit allowlist
- Use Zod .pick()/.omit() or destructuring. Test: can client set role/isAdmin/orgId/price?

**SD-OWASP-CRYPTO (ASVS V6)** `auth` `reasoning`
- Tokens: 128+ bits entropy. Passwords: bcrypt/scrypt/argon2. Token hashing: SHA-256+.
- No Math.random() for security values. No secrets in API responses.

**SD-OWASP-RATE (API Top 10)** `input`
- Unauthed endpoints creating resources: rate limited
- Authed endpoints with expensive ops: concurrency/rate controls

**References:** [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [OWASP Top 10](https://owasp.org/www-project-top-ten/), [API Security Top 10](https://owasp.org/www-project-api-security/), [Session Mgmt Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Auth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

#### SD-THREAT `reasoning`

Flag if the change introduces or widens an attack surface with no documented mitigation. The reviewer should identify the specific attack vector and the missing/inadequate control. Examples: SSRF via user-supplied webhook URL, price manipulation via unvalidated discount, data exfiltration via broad API response, resource exhaustion via unbounded batch.

#### SD-DEPTH `reasoning`

Flag if a single security control failure (cookie stolen, XSS, MITM, allowlist bypassed, rate limit evaded) has unbounded impact. Identify the single-point-of-failure control.

---

### P1: Security Implementation

| Check | Rule | Tags |
|-------|------|------|
| SI-SECRET | No hardcoded secrets/keys/tokens/credentials in source or tests | -- |
| SI-LOG | No logging of sensitive headers, tokens, or PII | -- |
| SI-AUTHZ | Auth middleware applied to route. Endpoint checks authorization (not just authentication). MCP tools: declare `permissions: [...]` enforced via the shared hasPermission; tools are auth-required by default. | `auth` `api` `mcp` |
| SI-VALID | Validation schema exists, applied before handler logic (e.g. Zod). (Subsumes old ARCH-ZOD.) MCP tools: inputSchema must constrain every accepted arg — no permissive bare object schema on tools that take args. | `input` `api` `mcp` |
| SI-SQL | No user string interpolation in SQL. sql.val() for values, sql.ref() for trusted static identifiers only, allowlist for dynamic identifiers. | `db-core` `db-callsite` |
| SI-XSS | No dangerouslySetInnerHTML without DOMPurify. No eval(). No javascript: in href/src. | `ui` |
| SI-ZOD | No z.any()/z.unknown() without downstream narrowing | -- |
| SI-ERR | Error responses don't leak stack traces, file paths, or internal schema. MCP: auth-time error codes are operator-only (stderr), never delivered over the protocol; per-call errors use the structured McpToolError payload with generic messages. | `api` `mcp` |
| MCP-ORG-SCOPE | Every tool handler touching org-scoped data scopes queries by `context.organizationId` (bound key) or a validated org argument. Tools accepting `organizationId` declare `requiresOrgMatch` (dispatcher rejects mismatches for non-global-admins). Handlers without `requiresOrgMatch` must not accept org args and must explicitly handle a null bound org (global-admin cross-org keys) — never default to unscoped queries. | `mcp` (reasoning) |
| MCP-READONLY | Tools with write effects declare `access: 'write'` so the dispatcher's read-only gate blocks read-only keys. No DB writes or side effects inside `access: 'read'` handlers. | `mcp` (reasoning) |

---

### P2: Correctness

For code-focused models: trace each branch in the diff. For reasoning models: also consider interactions with code outside the diff.

| Check | What to look for |
|-------|-----------------|
| COR-LOGIC | Incorrect output for valid input, wrong operators (=== vs ==), inverted conditions, off-by-one in loops, unreachable branches |
| COR-EDGE | Unhandled null/undefined, empty array/string as input, boundary values (0, MAX_SAFE_INTEGER, empty string), concurrent access to shared state |
| COR-ASYNC | Race conditions, unhandled promise rejections, broken error propagation in async chains, missing await |
| COR-DATA | Type mismatches across boundaries, lossy numeric conversions (float->int), timezone/locale handling errors |

---

### P3: TypeScript

| Check | Rule | Tags |
|-------|------|------|
| TS-ANY | No `any`. Use explicit types, generics, z.infer<>. If unavoidable, comment why and narrow. | -- |
| TS-ASSERT | No `as Foo` without preceding type guard | -- |
| TS-IGNORE | No @ts-ignore/@ts-expect-error without explanatory comment | -- |
| TS-BRAND | Branded ID types (ProjectId, UserId) where expected, not raw string/number | -- |
| TS-INFER | Zod schemas via z.infer<typeof schema>, not parallel hand-written interfaces | -- |
| TS-IMPORT | `import type` for type-only imports | -- |
| TS-PROMISE | No floating promises. `void` for fire-and-forget. Promise.all for independent ops. **Dedup:** same target as COR-ASYNC -> consolidate here. | -- |
| TS-CATCH | Error in catch typed `unknown`, narrowed before access | -- |
| TS-REACT | children: ReactNode, refs: explicit generic, context: explicit type | `ui` |

---

### P4: Architecture

| Check | Rule | Tags |
|-------|------|------|
| ARCH-LAYER | Business logic in api-lib, not handlers. Handlers: parse -> api-lib -> respond. | `api` |
| ARCH-DB | No Kysely or direct DB imports outside `db` package | `db-core` `db-callsite` |
| ARCH-CRUD | DB ops follow named-object pattern, CRUD grouped by related tables (per db/CLAUDE.md) | `db-core` `repo` |
| ARCH-QKEY | Query keys use factory in lib/queryKeys.ts, not hardcoded arrays | `ui` `repo` |
| ARCH-QOPT | Query definitions use queryOptions(), not inline queryKey/queryFn | `ui` `repo` |
| ARCH-HOOK | No useEffect+useState for async data. Use useQuery/useMutation. | `ui` |
| ARCH-CACHE | Cache invalidation explicit and scoped, not blanket invalidateQueries | `ui` `repo` |
| ARCH-ROUTE | All API routes use express-zod-api (apps/api/src/ez/endpoints/) | `api` |
| ARCH-CSV | CSV endpoints server-side only | `api` |
| ARCH-IMPORT | Cross-package imports: apps/* -> packages/*, never reverse | -- |
| ARCH-DELETE | Delete mutations: mutationKey ['delete', resourceType, id] for DataTable row dimming | `ui` `repo` |

---

### P5: Schema Changes `db-core`

**Skip if** diff has no changes to `packages/db/tests/postgres/schema.sql`, `packages/db/tests/postgres/views/`, or `postgres_schema_updates/`.

**SCH-EQUIV:** All migrations in order on empty DB must produce schema.sql state. This is the governing principle; all other SCH checks derive from it.

| Check | Trigger | Rule | Sev |
|-------|---------|------|-----|
| SCH-DROP | Item removed from schema.sql | Verify migration drops it. Schema-only removal = deploys won't converge. | S0 |
| SCH-RENAME-TBL | Table renamed | Migration renames {old}_pkey -> {new}_pkey (ALTER INDEX) and all FK constraints. Postgres does not do this implicitly. | S0 |
| SCH-RENAME-COL | Column renamed, referenced in view | Drop and recreate affected views. CREATE OR REPLACE VIEW cannot rename/reorder columns. | S0 |
| SCH-ADD-COL | Column added, table has column-enumerating views | Drop/recreate views that should expose the new column. | S0 |
| SCH-ENUM | Enum value added | ALTER TYPE foo ADD VALUE IF NOT EXISTS 'bar'. No rebuild via CREATE TYPE _old_version. | S0 |
| SCH-VIEW-SYNC `repo` | Migration rebuilds a view | The matching `tests/postgres/views/*.sql` file must be updated to the same definition. | S0 |
| SCH-THREE-FILE `repo` | Migration file added | The companion `schema.sql` (and view files, if views are touched) must also change in the same PR. | S0 |
| SCH-IDX-FK `repo` | FK constraint or join column added | FK columns must have indexes — Postgres does NOT auto-create them. Flag any FK constraint or column used as a join predicate without a corresponding CREATE INDEX in schema.sql. | S1 |
| SCH-VIEW-JOIN `repo` | View definition added/changed | View JOIN predicate columns must have index coverage. Cross-reference ON/USING columns in view definitions against CREATE INDEX statements in schema.sql. Missing index on a join column = seq scan under load. | S1 |
| SCH-VIEW-LATERAL `repo` | LATERAL subquery in view/query | LATERAL subqueries must drive from the most selective (filtered/indexed) table outward. Flag if the outer/driving table is high-cardinality with no restrictive WHERE filter — reversed join order causes N-per-row subquery execution. | S0 |
| SCH-NAMING | Migration file added | Must match YYYY/YYYY_MM_DD_description.sql. Lexicographic sort order. | S1 |
| SCH-CONSOLIDATE | PR adds 2+ migration files | Minimize file count -- consolidate related DDL into one file. Splits are only justified by transactional constraints (`ALTER TYPE ADD VALUE` must commit before reference; `CREATE INDEX CONCURRENTLY` outside a tx). When a split IS justified, alphabetical filename order must match dependency order (runner sorts lexicographically; same-date files break ties on the description suffix). E.g. `2026_05_26_mcp_required_columns_check.sql` sorts BEFORE `2026_05_26_mcp_user_api_key.sql`, so a CHECK in the former that references a column added by the latter fails on a fresh DB. Consolidate, rename, or bump the date on the dependent file. | S0 |
| SCH-PR | PR with migrations | `orch` PR description includes destructive SQL + INSERT INTO _schema_migrations per file. | S1 |

---

### P6: Accessibility (WCAG 2.1 AA) `ui`

**Skip if** diff has no `.tsx`, `.css`, `.scss` files and no changes under `packages/ui/` or `apps/web/src/`.

**Pattern checks** (all models -- look for missing attributes):

| Check | Rule | WCAG |
|-------|------|------|
| A11Y-NAME | Interactive elements need discoverable name. IconButton -> aria-label. Input -> label/aria-label. | 4.1.2 |
| A11Y-DECO | Meaningful images: alt. Decorative icons: aria-hidden="true". Standalone SVG: role="img" + aria-label. | 1.1.1 |
| A11Y-KB | onMouseOver/Out -> onFocus/Blur. Click on non-button/link -> role + tabIndex + onKeyDown. | 2.1.1 |
| A11Y-LIVE | Dynamic content regions: aria-live="polite". Loading states: Spinner or visually-hidden text. | -- |
| A11Y-GROUP | Icon+text pairs: group semantically or mark icon aria-hidden. | -- |

**Judgment checks** (reasoning models -- require visual/UX reasoning):

| Check | Rule | WCAG |
|-------|------|------|
| A11Y-COLOR | No color-only state differentiation. Require secondary cue (shape, icon, text, border). | 1.4.1 |
| A11Y-CONTRAST | Text: 4.5:1 normal, 3:1 large (>=18px / >=14px bold). Check hardcoded hex/rgba. | 1.4.3 |
| A11Y-NONTEXT | Controls/graphics: 3:1 against adjacent colors. | 1.4.11 |
| A11Y-TRAP | Modals: trap focus, return on close. Popovers/tooltips: Escape to dismiss. | 2.1.2 |
| A11Y-FOCUS | No suppressed outline/ring. Custom focus: 3:1. | 2.4.7 |
| A11Y-TIMING | Auto-dismiss >=5s or user-controllable. | 2.2.1 |
| A11Y-3P-CSS | Third-party containers lose CSS vars. Hardcode tokens. | -- |
| A11Y-3P-KB | Disabled native KB shortcuts? Alternative path must exist. | -- |

---

### P7: Dependencies `orch`

Reviewers: flag new dependencies visible in diff. Orchestrator runs verification.

| Check | Action | Who |
|-------|--------|-----|
| DEP-LIST | List each new dependency + declared version for human review | orch |
| DEP-AGE | `npm info <pkg>@<ver> time` -- flag if <1 month old | orch |
| DEP-LATEST | Note latest version alongside added version | orch |

---

### Process

| Check | Rule |
|-------|------|
| PROC-ADR | ADR approval is a PR-level property (non-author approval of the PR carrying the ADR into the default branch, covering ADR + companion spec), enforced by the merge gate — never flag not-yet-approved status and never require an in-document approval record; there is no Consensus section. Diff-enforceable checks: flag a newly added ADR still containing a Consensus/sign-off section (outdated template; pre-existing ADRs are historical, don't flag); significant pricing changes or adjustments to customer obligations must be flagged as a business-impacting decision requiring sign-off before implementation (customer-visible or expensive-to-reverse alone does not trigger this). |

---

## Applicability Heuristics

Quick-reference for the orchestrator. Include the union of listed phases.

| Change type | Phases | Emphasize |
|-------------|--------|-----------|
| Auth/session | P0, P1, P2, P3 | SD-TRUST-AUTH, SD-OWASP-AUTHN/SESS/AUTHZ/CRYPTO, SI-AUTHZ |
| Endpoint/input validation | P0 (TRUST, MASS, RATE), P1, P2, P3, P4 | SI-VALID, SI-SQL, SD-OWASP-MASS, ARCH-LAYER |
| DB/schema/migration | P0 (TRUST-SHAPE, DATA), P1 (SI-SQL), P2, P3, P4 (DB, CRUD), P5 | SCH-EQUIV, SCH-DROP, SI-SQL |
| React/UI | P1 (SI-XSS), P2, P3, P4 (HOOK, CACHE, QKEY, QOPT), P6 | A11Y-KB, A11Y-NAME, SI-XSS |
| API response/serialization | P0 (DATA), P1 (SI-ERR), P2, P3 | SD-OWASP-DATA, SI-ERR |
| Server-side URL/webhook | P0 (SSRF, TRUST-FETCH), P1, P2 | SD-OWASP-SSRF, SD-TRUST-FETCH |
| MCP server/tool | P0, P1, P2, P3, P4 | MCP-ORG-SCOPE, MCP-READONLY, SD-OWASP-DATA, SD-TRUST-SHAPE, SI-AUTHZ, SI-VALID, SD-OWASP-RATE |
| Dependencies | P7 | DEP-AGE |
| Docs/spec/ADR | PROC-ADR, plus code checks for embedded code | Use adversarial-review document mode. If the doc contains code/SQL, also apply the relevant code checks (SI-SQL, SCH-*) per that mode. |

---

## Severity Model

**S0 CRITICAL** -- blocks commit:
- Design-level security flaw (SD-* without mitigation)
- SQL injection (SI-SQL), XSS (SI-XSS), hardcoded secrets (SI-SECRET)
- Missing authorization on protected endpoint (SI-AUTHZ)
- Cross-tenant data exposure via MCP tool (MCP-ORG-SCOPE), write effects reachable by read-only keys (MCP-READONLY)
- Schema migration breaking cumulative equivalence (SCH-*)
- Data loss or corruption risk

**S1 IMPORTANT** -- usually blocks:
- Missing input validation (SI-VALID), type unsafety causing runtime errors (TS-ANY/ASSERT/CATCH)
- Floating promises swallowing errors (TS-PROMISE), logic bugs (COR-*)
- Architecture violations creating coupling (ARCH-IMPORT/DB/LAYER)
- A11Y barriers for keyboard users (A11Y-KB/TRAP)
- Supply chain risk (DEP-AGE)

**S2 MINOR** -- non-blocking:
- Style, naming, missing `import type` (TS-IMPORT), non-optimal but functional patterns

---

## Output Schema

### Minimal schema (code-focused models)

```json
{
  "check_id": "SI-SQL",
  "severity": "S0",
  "title": "SQL injection via string interpolation",
  "target": "apps/api/src/ez/endpoints/readings.ts:42"
}
```

### Full schema (reasoning models)

| Field | Required | Description |
|-------|----------|-------------|
| check_id | always | Stable ID from this spec |
| severity | always | S0 / S1 / S2 |
| title | always | One-line summary |
| target | always | file:line or component name |
| evidence | S0/S1 | What was found (2-3 sentences max) |
| suggested_fix | S0/S1 | How to fix |
| attack_scenario | S0 security | Specific attack vector |
| owasp_ref | if applicable | e.g. "ASVS V5.3.4" |
| phase | optional | P0-P7 |
| confidence | optional | high / medium / low |
| related_checks | optional | Cross-references, e.g. ["SD-TRUST-SHAPE"] |

### Consolidation rules

1. Same `check_id` + `target` from multiple reviewers = one finding. Merge evidence, keep max severity.
2. Same `check_id`, different `target` = distinct findings.
3. S0 from any reviewer is never downgraded.
4. Drop low-confidence S2 findings from a single reviewer unless they cite a concrete code location.

---

## Token-Efficiency Notes

**Reviewer prompts:** Use compact checklist. Route by applicability -- a UI-only change skips P0 auth/SSRF, P5, P7. Include diff inline. Omit OWASP reference URLs. Don't repeat checklist in consolidation prompt.

**Reviewer output:** JSON array of findings, no prose. Silence = pass. Cap evidence to 2-3 sentences. Use check IDs, not descriptions.

**Consolidation:** Deduplicate by check_id + target. Max severity wins. Final output = deduplicated list grouped by severity, not per-reviewer breakdown.

---

## What Was Merged, Removed, or Reframed

**Merged:** ARCH-ZOD into SI-VALID. IDOR overlap between SD-OWASP-AUTHZ and SI-AUTHZ clarified (design vs applied middleware). "Secrets in logs" removed from SD-OWASP-CRYPTO (SI-LOG owns logging).

**Removed:** Prose that restated rules. Duplicate "design before implementation" instruction (now structural via phase ordering). OWASP URLs from compact version.

**Reframed:** Flat sections -> ordered phases. Prose -> tables. Applicability now explicit with glob patterns and capability tiers. Severity centralized instead of scattered "flag as CRITICAL." SD-THREAT changed from "enumerate 3 scenarios" to "flag unmitigated attack surface widening." DEP-* and SCH-PR moved to orchestrator-only. A11Y split into pattern checks (all models) and judgment checks (reasoning). ARCH checks tagged by capability (repo-access vs diff-only). COR checks given concrete patterns instead of abstract categories. Output schema split into minimal (4 fields) and full (11 fields) by model tier.

---

## Rationale

The original checklist was ~2,500 tokens of prose repeated across 4+ reviewers per round. This redesign cuts the reviewer-facing content to ~1,200 tokens (compact) and enables applicability routing that drops it further to 400-800 tokens for single-domain changes. Stable check IDs make dedup a group-by operation instead of semantic matching. Capability tiers prevent small models from hallucinating on checks they can't evaluate. Two output schema tiers ensure structured output from all models regardless of capability.
