# Source Audit — deadlineAi

Reviewed 4 November 2026 against source commit `0bdf9dd53286eaeb45f8e1590143a6d8c64b49ed`. This is a focused code/documentation review and selected local validation, not a penetration test or an exhaustive vulnerability scan. Application files and credentials were not changed. Secret values are intentionally omitted.

## Severity summary

| Critical | High | Medium | Low |
|---:|---:|---:|---:|
| 0 | 1 | 2 | 2 |

Critical: direct resource/identity boundary failure. High: serious exposure or a core reproducibility blocker. Medium: correctness, validation, or deployment issue. Low: maintenance or coverage gap. Static findings describe potential impact; only explicitly listed runtime checks were executed.

## Findings

### 1. High — AI POST routes have no server-side identity validation or per-user rate limits

- **Affected file:** [server.ts](<server.ts>)
- **Evidence:** AI POST routes have no server-side identity validation or per-user rate limits.
- **Potential impact:** Public callers can consume the server’s paid provider quota without signing in.
- **Recommended correction:** Verify Firebase ID tokens, validate ownership where applicable, and enforce request quotas.

### 2. Medium — Provider failures can become HTTP 200 programmatic fallback responses

- **Affected file:** [server.ts](<server.ts>)
- **Evidence:** Provider failures can become HTTP 200 programmatic fallback responses.
- **Potential impact:** Clients may mistake fallback text/estimates for successful model inference.
- **Recommended correction:** Preserve explicit fallback status through the UI and test unavailable-provider behavior.

### 3. Medium — Project/notification update rules check the existing owner but do not require the new userId to remain unchanged

- **Affected file:** [firestore.rules](<firestore.rules>)
- **Evidence:** Project/notification update rules check the existing owner but do not require the new userId to remain unchanged.
- **Potential impact:** An owner can reassign ownership, potentially injecting records into another user’s scope.
- **Recommended correction:** Require request.resource.data.userId to equal the authenticated UID on updates and validate allowed fields.

### 4. Low — The displayed model label differs from server model identifiers

- **Affected file:** [src/components/SettingsView.tsx](<src/components/SettingsView.tsx>)
- **Evidence:** The displayed model label differs from server model identifiers.
- **Potential impact:** Users receive inaccurate implementation information.
- **Recommended correction:** Derive the label from the actual configured model.

### 5. Low — No automated test script is defined

- **Affected file:** [package.json](<package.json>)
- **Evidence:** No automated test script is defined.
- **Potential impact:** Risk/fallback and rule changes lack regression coverage.
- **Recommended correction:** Add server, Firebase rule, and planning workflow tests.

## Validation evidence

`npm ci`, `npm run build`, and `npm run lint` passed. Signed-in Firebase and successful Gemini inference were not verified; no provider credential is configured. HTTP GET / returned 200 and expected page content; POST /api/analyze-task with empty input returned expected 400 JSON

## Review scope and limits

Reviewed tracked application source, entry points, manifests/configuration, routes and data models where present, existing documentation, and available test definitions. Generated dependencies and binary artifacts were inventoried rather than treated as authored application logic. Provider calls, cloud deployment, and external data/model claims remain unverified unless explicitly listed above. No secret was rotated and no migration was run against a user database.

## Priorities

Address Critical and High findings before public deployment. Then add regression tests for the affected boundary or workflow, fix Medium issues, and resolve Low maintenance findings. All application corrections require a separate reviewed coding change.
