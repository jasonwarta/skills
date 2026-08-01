# Review Checklist

Output: JSON array of findings. Per finding: `check_id`, `severity` (S0/S1/S2), `title`, `target` (file:line). S0/S1 require `evidence` + `suggested_fix`. Silence = pass. No prose.

S0 = blocks commit. S1 = usually blocks. S2 = non-blocking.

## P0: Security Design

**SD-TRUST** Client field -> attacker sends arbitrary value -> worst case?
- SD-TRUST-AUTH `auth` Auth/session decisions (lifetime, privileges, roles)
- SD-TRUST-BIZ `input` Business logic (prices, quantities, limits)
- SD-TRUST-FETCH `ssrf` Server actions (URLs, paths, redirects)
- SD-TRUST-SHAPE `input` `db-core` `db-callsite` Data shape (spread into DB, sort/filter params)

**SD-OWASP** Which OWASP categories does this change touch?
- SD-OWASP-AUTHN `auth` Credential storage, brute-force protection, recovery, MFA
- SD-OWASP-SESS `auth` Server-controlled lifetime, cookie flags, idle vs absolute timeout, rotation on privilege change
- SD-OWASP-AUTHZ `auth` Deny-by-default, server-side enforcement, no IDOR by design
- SD-OWASP-DATA `data-exposure` Return only needed fields, tenant/ownership filters on bulk
- SD-OWASP-SSRF `ssrf` Allowlist URLs, reject private IPs/non-HTTPS/unexpected ports
- SD-OWASP-MASS `input` Flag if request body reaches DB/constructor without explicit field allowlist
- SD-OWASP-CRYPTO `auth` 128+ bit tokens, bcrypt/scrypt/argon2, no Math.random() for security
- SD-OWASP-RATE `input` Rate limits on unauthed resource creation, concurrency on expensive ops

**SD-THREAT** Flag if change widens attack surface with no documented mitigation
**SD-DEPTH** Flag if single control failure has unbounded impact

## P1: Security Implementation

- **SI-SECRET** No hardcoded secrets/keys/tokens/credentials
- **SI-LOG** No logging sensitive headers, tokens, PII
- **SI-AUTHZ** `auth` `api` `mcp` Auth middleware applied; endpoint checks authorization. MCP tools: permissions[] via shared hasPermission.
- **SI-VALID** `input` `api` `mcp` Validation schema applied before handler (e.g. Zod). MCP tools: inputSchema constrains every arg.
- **SI-SQL** `db-core` `db-callsite` No user string interpolation. sql.val() for values, sql.ref() trusted static only, allowlist for dynamic identifiers.
- **SI-XSS** `ui` No dangerouslySetInnerHTML without DOMPurify, no eval(), no javascript: hrefs
- **SI-ZOD** No z.any()/z.unknown() without downstream narrowing
- **SI-ERR** `api` `mcp` Errors don't leak stack traces, paths, internal schema. MCP: auth-time codes operator-only; per-call via McpToolError payload.
- **MCP-ORG-SCOPE** `mcp` `reasoning` Tool queries scoped by context.organizationId or validated org arg. organizationId arg -> requiresOrgMatch. Null bound org handled explicitly, never unscoped. **S0**
- **MCP-READONLY** `mcp` `reasoning` Write effects -> access: 'write'. No writes in access: 'read' handlers. **S0**

## P2: Correctness

- **COR-LOGIC** Trace branches. Wrong operators, inverted conditions, off-by-one, unreachable code.
- **COR-EDGE** Unhandled null/undefined, empty array/string, boundary values, concurrent access.
- **COR-ASYNC** Race conditions, unhandled rejections, broken async error propagation, missing await.
- **COR-DATA** Type mismatches across boundaries, lossy conversions, timezone errors.

## P3: TypeScript

- **TS-ANY** No `any`. Use explicit types/generics/z.infer<>. Comment if unavoidable, narrow immediately.
- **TS-ASSERT** No `as Foo` without type guard
- **TS-IGNORE** No @ts-ignore/@ts-expect-error without comment
- **TS-BRAND** Branded IDs (ProjectId, UserId) not raw string/number
- **TS-INFER** z.infer<typeof schema> not parallel interfaces
- **TS-IMPORT** `import type` for type-only
- **TS-PROMISE** No floating promises. void for fire-and-forget. Promise.all for independent ops.
- **TS-CATCH** catch error typed unknown, narrowed before access
- **TS-REACT** `ui` children: ReactNode, refs: explicit generic, context: explicit type

## P4: Architecture

- **ARCH-LAYER** `api` Logic in api-lib not handlers. Handlers: parse -> api-lib -> respond.
- **ARCH-DB** `db-core` `db-callsite` No Kysely/direct DB imports outside db package
- **ARCH-CRUD** `db-core` `repo` Named-object pattern, CRUD grouped by related tables
- **ARCH-QKEY** `ui` `repo` Query keys from lib/queryKeys.ts factory, not hardcoded
- **ARCH-QOPT** `ui` `repo` queryOptions() factory, not inline queryKey/queryFn
- **ARCH-HOOK** `ui` No useEffect+useState for async. Use useQuery/useMutation.
- **ARCH-CACHE** `ui` `repo` Invalidation explicit+scoped, not blanket invalidateQueries
- **ARCH-ROUTE** `api` express-zod-api (apps/api/src/ez/endpoints/)
- **ARCH-CSV** `api` CSV endpoints server-side only
- **ARCH-IMPORT** apps/* -> packages/* only, never reverse
- **ARCH-DELETE** `ui` `repo` mutationKey: ['delete', resourceType, id]

## P5: Schema `db-core`

Skip if no changes to schema.sql, tests/postgres/views/, or postgres_schema_updates/.

- **SCH-EQUIV** Migrations in order on empty DB = schema.sql state **S0**
- **SCH-DROP** Removed from schema.sql? Migration must drop it. **S0**
- **SCH-RENAME-TBL** Renamed table? Also rename _pkey + FK constraints. Postgres won't. **S0**
- **SCH-RENAME-COL** Renamed column in view? Drop/recreate views. **S0**
- **SCH-ADD-COL** Added column, table has views? Drop/recreate. **S0**
- **SCH-ENUM** ALTER TYPE ADD VALUE IF NOT EXISTS. No CREATE TYPE rebuild. **S0**
- **SCH-VIEW-SYNC** `repo` Migration rebuilds view? tests/postgres/views/*.sql must match. **S0**
- **SCH-THREE-FILE** `repo` Migration file present? schema.sql + view files must also change. **S0**
- **SCH-IDX-FK** `repo` FK columns need indexes. Postgres won't auto-create. **S1**
- **SCH-VIEW-JOIN** `repo` View JOIN predicate columns need index coverage. **S1**
- **SCH-VIEW-LATERAL** `repo` LATERAL drives from most selective table outward. **S0**
- **SCH-NAMING** YYYY/YYYY_MM_DD_description.sql **S1**
- **SCH-CONSOLIDATE** Minimize migration file count. Consolidate related DDL into one file; splits only justified by tx constraints (ALTER TYPE ADD VALUE must commit first; CREATE INDEX CONCURRENTLY no-tx). When split, filename alphabetical order MUST match dependency order -- same-date files sort on description suffix, so `..._a_check.sql` runs before `..._b_create.sql`. Consolidate, rename, or bump date. **S0**

## P6: Accessibility `ui`

Skip if no .tsx/.css/.scss changes.

Pattern checks:
- **A11Y-NAME** Interactive elements: discoverable name. IconButton->aria-label. Input->label.
- **A11Y-DECO** Meaningful img: alt. Decorative: aria-hidden. Standalone SVG: role="img"+aria-label.
- **A11Y-KB** Mouse handlers -> focus equivalents. Non-button click -> role+tabIndex+onKeyDown.
- **A11Y-LIVE** Dynamic regions: aria-live="polite". Loading: Spinner or visually-hidden text.
- **A11Y-GROUP** Icon+text: group or mark icon aria-hidden.

Judgment checks `reasoning`:
- **A11Y-COLOR** No color-only differentiation. Secondary cue required.
- **A11Y-CONTRAST** Text 4.5:1 / 3:1 large. Check hardcoded colors.
- **A11Y-NONTEXT** Controls/graphics 3:1.
- **A11Y-TRAP** Modal focus trap+return. Escape dismisses popover/tooltip.
- **A11Y-FOCUS** No suppressed outline. Custom focus 3:1.
- **A11Y-TIMING** Auto-dismiss >=5s or user-controllable.
- **A11Y-3P-CSS** Third-party containers: hardcode color tokens.
- **A11Y-3P-KB** Disabled native KB shortcuts? Alt path required.

## Process

- **PROC-ADR** ADR approval is a PR-level property (non-author approval of the PR carrying the ADR into the default branch, covering ADR + companion spec), enforced by the merge gate — never flag not-yet-approved status; no in-document approval record, no Consensus section. Diff-enforceable: flag newly added ADRs still containing a Consensus/sign-off section (outdated template; pre-existing ADRs are historical, don't flag); significant pricing changes or adjusted customer obligations must be flagged as a business-impacting decision requiring sign-off before implementation (customer-visible or expensive-to-reverse alone doesn't trigger this).
- **PROC-DEFER** (orch, runs every review) Every explicitly deferred item in a spec/ADR/PR-description needs a linked tracking issue. Scan prose for "deferred", "out of scope (for now)", "follow-up", "later", "future work", "not in this PR", "do this later", "revisit", "TBD". Flag any with no linked GitHub issue (#NNN/URL); verify present links are open via `gh issue view`. Do NOT flag inline `// TODO` / `// FIXME` code comments.
