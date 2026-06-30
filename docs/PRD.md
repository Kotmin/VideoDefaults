# Product Requirements Document: VideoDefaults

Status: Draft v0.1  
Last updated: 2026-06-30  
Primary target: Mozilla Firefox Desktop WebExtension  
Future targets: Google Chrome, Chromium-based browsers, Microsoft Edge  
Repository strategy: two long-lived branches: `dev` and `main`

---

## 1. Executive Summary

VideoDefaults is a browser extension that preserves user-preferred default video playback settings, starting with YouTube in Firefox. The proof of concept focuses on default playback speed: the extension applies a global default speed of `2.0` to newly loaded YouTube videos, exposes a simple popup GUI with preset buttons (`1`, `1.5`, `2.0`) and a custom speed input, and detects manual user changes without repeatedly overriding them on the currently opened page/card.

The extension must be privacy-preserving, dependency-light, AMO-review-friendly, and designed for future cross-browser expansion through browser, site, and player adapters. The shipped extension core should use plain JavaScript with JSDoc-style typing instead of TypeScript for the MVP, because TypeScript compilation introduces an npm/toolchain supply-chain surface. TypeScript can still be reconsidered later for non-shipped tooling after explicit architecture decision approval.

---

## 2. Research Validation Summary

Research was performed before drafting this PRD. The following current platform constraints shape the product and technical plan:

1. Firefox Manifest V3 still differs from Chromium. Chrome supports `background.service_worker`; Firefox does not support extension background service workers in the same way and supports `background.scripts`/event-page behavior. Cross-browser MV3 manifests can declare both `background.scripts` and `background.service_worker`, but the MVP should avoid a background process unless needed.
2. Mozilla recommends `web-ext` for running, linting, packaging, signing, and publishing add-ons, but `web-ext` is npm-distributed. To reduce supply-chain risk, the MVP CI should use zero-runtime-dependency scripts for core checks and packaging, with `web-ext` introduced only as a pinned, isolated release-validation/signing tool when needed.
3. AMO policies require add-ons to request only necessary permissions, be self-contained, avoid remote executable code, avoid unnecessary files/code, and not harm browser performance or stability.
4. GitHub Actions supports scheduled workflows through cron and manual button-triggered workflows through `workflow_dispatch`. This supports the requested compatibility watcher.
5. GitHub branch protection supports required status checks and linear history. This supports a two-branch `dev`/`main` workflow with direct development pushes to `dev`, protected promotion to `main`, and no merge commits.
6. YouTube API policy risk is reduced by not using YouTube API Services in the extension MVP, not blocking ads, not downloading content, not skipping ads, not hiding YouTube UI, and not injecting remote scripts.
7. Future OpenAI-based issue insight tooling should use sanitized input, strict structured output, schema validation, and human review. This must remain outside the shipped extension.

### Source References

- MDN WebExtensions background manifest reference: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
- Firefox Extension Workshop, web-ext tooling index: https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
- Firefox Extension Workshop, submitting an add-on: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- Firefox Extension Workshop, add-on policies: https://extensionworkshop.com/documentation/publish/add-on-policies/
- Firefox Extension Workshop, add-on policies FAQ: https://extensionworkshop.com/documentation/publish/add-on-policies-faq/
- GitHub Actions workflow syntax: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub REST API issues endpoints: https://docs.github.com/en/rest/issues/issues
- YouTube API Services Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs

---

## 3. Problem Statement

Users who prefer a consistent video playback setup must repeatedly reconfigure playback speed and related settings on YouTube. YouTube may remember some settings inconsistently, browser sessions differ, and site updates can reset or hide user preferences. The user wants a lightweight extension that applies preferred defaults automatically while still respecting manual changes made during the current video/session.

---

## 4. Goals

### MVP / PoC Goals

1. Build a working Firefox-compatible WebExtension named VideoDefaults.
2. Support YouTube playback speed defaults.
3. Apply default speed `2.0` to newly loaded YouTube videos.
4. Provide a simple popup GUI with:
   - preset button `1`
   - preset button `1.5`
   - preset button `2.0`
   - manual numeric speed input
   - detected current speed display
   - manual override status display
5. Use global settings only.
6. Avoid overriding a manual user change on the currently opened YouTube page/card after the user changes speed manually.
7. Gracefully handle pages where the video is unavailable, loading, blocked by consent/cookie prompt, or changed by YouTube SPA navigation.
8. Keep the shipped extension dependency-free.
9. Prepare the repository for AMO publication and future Chromium/Edge adapters.
10. Add CI for lint/check/test/package on `dev`.
11. Define future `main` release CI for signing and publishing.
12. Add a compatibility watcher tool that can run on a cron schedule and via manual GitHub Actions button.

### Post-MVP Goals

1. Captions default: off, while respecting manual user changes.
2. Internal video volume default: 100%, while avoiding surprise loud playback.
3. Leave default language and soundtrack unchanged unless safe APIs are available.
4. Add generic HTML5 video fallback.
5. Add Chrome, Chromium, and Edge builds.
6. Add richer keyboard controls as part of a larger YouTube dashboard plugin.
7. Add site/player adapters for more platforms.
8. Add an optional sanitized issue-insight tool using a small OpenAI model.
9. Add a DOM Snapshot Compressor tool for converting complex pages into terminal-readable metadata lists.

---

## 5. Non-Goals

The MVP must not:

1. Block, skip, hide, or modify ads.
2. Download videos or audio.
3. Use YouTube API Services.
4. Exfiltrate browsing data.
5. Execute remote code.
6. Use external runtime libraries.
7. Inject custom controls over YouTube’s player surface.
8. Click cookie/consent dialogs automatically.
9. Change audio language or soundtrack.
10. Force playback speed repeatedly after the user manually changes it on the current page.
11. Include npm dependencies in the shipped extension.
12. Mention AI assistants, bots, or tool names in git commit messages.

---

## 6. Target Users

### Primary User

A power user who watches YouTube frequently and wants videos to start with preferred defaults, especially `2.0` playback speed.

### Secondary Users

1. Developers who want a clean, inspectable, dependency-light browser extension codebase.
2. Users who want future support for other video websites and Chromium browsers.
3. Maintainers who need compatibility monitoring when YouTube, Firefox, or extension APIs change.

---

## 7. User Stories

### MVP User Stories

1. As a user, I want YouTube videos to start at `2.0` speed so that I do not need to set it manually each time.
2. As a user, I want a popup with `1`, `1.5`, and `2.0` buttons so that I can quickly change my global default speed.
3. As a user, I want to type a custom speed so that I can use a value not represented by preset buttons.
4. As a user, I want the popup to show the currently detected playback speed so that I know what the active video is using.
5. As a user, I want the extension to respect a manual speed change on the current page so that it does not fight me.
6. As a maintainer, I want CI to lint/check/test/package on `dev` so that bad changes are caught early.
7. As a maintainer, I want the compatibility watcher to run on schedule and manually so that compatibility issues do not go unnoticed.

### Future User Stories

1. As a user, I want captions to default off unless I turn them on manually.
2. As a user, I want YouTube’s internal player volume to default to 100% when safe.
3. As a user, I want the same defaults across different video websites.
4. As a maintainer, I want issue insights summarized safely so that compatibility triage is faster.
5. As a developer, I want a DOM Snapshot Compressor so that complex video pages can be analyzed in a readable terminal-sized format.

---

## 8. Product Scope

### MVP Scope

Platform:

- Firefox Desktop.
- Manifest V3-compatible extension structure.
- YouTube only for active playback-speed behavior.
- No external runtime dependencies.

Behavior:

- Apply global default playback speed to detected YouTube video elements.
- Detect YouTube SPA navigation and newly inserted video elements.
- Detect `ratechange` events and mark manual override when the change was not initiated by VideoDefaults.
- Do not reapply the global default after manual override on the same page/card unless the user explicitly uses the popup.
- Reapply default on new video/page context.
- Store settings locally.

GUI:

- Browser action popup.
- Presets: `1`, `1.5`, `2.0`.
- Custom numeric input.
- Current detected speed.
- Status message: active / no video / unavailable / manual override / unsupported page.

CI:

- `dev` branch: syntax check, tests, package artifact.
- `main` branch future: signing and publication.
- Compatibility watcher: scheduled and manual.

### Out of MVP Scope

- Automatic AMO publication.
- Chrome/Edge publication.
- Captions/volume enforcement.
- AI issue-insight automation.
- DOM Snapshot Compressor.
- Complex keyboard dashboard controls.

---

## 9. Functional Requirements

### FR-001: Global Settings Storage

The extension must store global playback settings in browser-local extension storage.

Initial settings schema:

```json
{
  "schemaVersion": 1,
  "defaultSpeed": 2.0,
  "scope": "global",
  "youtubeEnabled": true,
  "captionsMode": "leave",
  "volumeMode": "leave"
}
```

Acceptance criteria:

- Settings survive browser restart.
- Missing settings are initialized with defaults.
- Invalid values are ignored and replaced with safe defaults.
- Storage errors are shown as non-fatal UI status.

---

### FR-002: YouTube Video Detection

The YouTube site adapter must detect the active HTML video element on YouTube watch pages and relevant SPA transitions.

Acceptance criteria:

- Detects a video element after initial page load.
- Detects video replacement after YouTube navigation without full page reload.
- Does not throw when no video exists.
- Does not interact with cookie/consent dialogs.
- Does not rely on a single fragile CSS class when a native video element is available.

---

### FR-003: Default Speed Application

The extension must apply `settings.defaultSpeed` to the active video when the video is first detected for a page/card context.

Acceptance criteria:

- New YouTube video starts with configured default speed.
- Default speed is not applied before a video element exists.
- Speed value is clamped to an approved range.
- Default speed application is debounced to avoid repeated writes.
- The extension records whether the last speed change was extension-initiated.

Recommended MVP range:

- Minimum: `0.25`
- Maximum: `4.0`
- Step: `0.05` for custom input normalization
- Presets: `1`, `1.5`, `2.0`

---

### FR-004: Manual Override Detection

The extension must detect when the user manually changes playback speed and must stop reapplying the global default for the current page/card context.

Acceptance criteria:

- `ratechange` events caused by VideoDefaults do not mark manual override.
- `ratechange` events not caused by VideoDefaults mark manual override.
- Popup displays manual override status.
- User can explicitly apply a new speed from the popup, which updates global default and active video.
- Manual override resets on new video/page context.

---

### FR-005: Popup GUI

The extension must provide a minimal popup GUI.

Required controls:

1. Current page status.
2. Current detected playback speed.
3. Button: `1`.
4. Button: `1.5`.
5. Button: `2.0`.
6. Custom numeric input.
7. Save/apply action.

Acceptance criteria:

- Popup is usable without opening devtools.
- Popup uses no inline JavaScript.
- Popup validates custom input.
- Popup shows clear errors for unsupported pages or no active video.
- Popup remains keyboard-accessible.

---

### FR-006: Messaging

The popup and content script must communicate through WebExtension messaging.

Required messages:

- `GET_PLAYBACK_STATE`
- `SET_DEFAULT_SPEED`
- `APPLY_SPEED_TO_ACTIVE_VIDEO`
- `GET_SETTINGS`
- `SET_SETTINGS`

Acceptance criteria:

- Messages have validated payloads.
- Unknown messages return safe errors.
- Message handlers do not throw unhandled exceptions.
- No page context script injection is required for MVP unless a documented adapter decision approves it.

---

### FR-007: Permissions

The extension must request only permissions needed for MVP.

Expected MVP permissions:

- `storage`
- YouTube host permission, limited to YouTube URL patterns required by the content script

Potentially avoid:

- Broad `<all_urls>` host permission
- `tabs`, unless popup implementation requires it after validation
- `activeTab`, unless explicitly needed
- `scripting`, unless future adapters require it

Acceptance criteria:

- Permissions are documented in `/docs/compliance/permissions.md`.
- Any new permission requires an Architecture Decision Record.
- AMO listing text explains why permissions are needed.

---

### FR-008: Graceful Failure

The extension must fail safely when YouTube changes, when video is absent, or when consent/cookie dialogs block playback.

Acceptance criteria:

- No uncaught exceptions in normal browsing.
- Popup displays a useful state instead of crashing.
- Compatibility watcher can detect repeated compatibility issue reports.
- No automated consent/cookie acceptance is performed.

---

### FR-009: Compatibility Watcher

The repository must include a compatibility watcher tool that can run in CI on schedule and manually.

Purpose:

- Detect signs that VideoDefaults may have lost compatibility with Firefox, YouTube, Manifest V3, AMO policies, or the repository’s release pipeline.
- Inspect open repository issues related to compatibility.
- Produce a machine-readable and human-readable report.
- Optionally create or update a tracking issue when high-risk signals are found.

Inputs:

- Repository open issues via GitHub REST API.
- Labels such as `compatibility`, `firefox`, `youtube`, `mv3`, `amo`, `ci`, `release`, `regression`.
- Optional watchlist file: `/docs/compliance/compatibility-watchlist.json`.
- Optional manually supplied workflow input: `scope`.

Outputs:

- Markdown report artifact.
- JSON report artifact.
- Optional issue comment or tracking issue update.

Run modes:

- Scheduled cron.
- Manual `workflow_dispatch` button.
- Local CLI.

Acceptance criteria:

- Uses least-privilege `GITHUB_TOKEN` permissions.
- Does not require external npm packages.
- Does not send issue data to external services in MVP.
- Clearly separates rule-based checks from future AI insight checks.

Suggested initial checks:

1. Count open issues with compatibility labels.
2. Count issues updated in the last 14 days.
3. Detect untriaged issues with keywords: `broken`, `youtube changed`, `firefox`, `manifest`, `review rejected`, `speed not working`, `player changed`.
4. Fail or warn based on severity thresholds.
5. Print next recommended maintainer action.

---

### FR-010: Future Sanitized Issue Insight Tool

The project may later include an optional AI-assisted issue-insight tool.

Constraints:

- Not part of shipped extension.
- Not part of MVP.
- Must run only in CI or local maintainer tooling.
- Must sanitize and minimize issue data before model calls.
- Must redact secrets, tokens, email addresses, cookies, URLs with query strings, and personal data where possible.
- Must use structured output with schema validation.
- Must never auto-close, auto-label, or auto-publish without deterministic validation and human review.
- Must log what was sent, with sensitive values redacted.
- Must be documented in `/docs/ai` before implementation.

Potential architecture:

- `tools/issue-insights/sanitize.py`
- `tools/issue-insights/validate_output.py`
- `tools/issue-insights/schema.json`
- `tools/issue-insights/run.py`

Possible future model integration:

- Direct HTTPS call using Python standard library to avoid SDK dependency, or official SDK after explicit supply-chain review.
- Structured JSON output validated against local schema.
- LangGraph or similar orchestration only after a separate architecture decision.

---

## 10. Non-Functional Requirements

### NFR-001: Privacy

- No extension telemetry in MVP.
- No network requests from the extension in MVP.
- No collection of browsing history.
- No transfer of URLs, titles, or user settings to external services.
- Settings remain local to the browser.

### NFR-002: Security

- No remote code execution.
- No `eval`.
- No inline scripts in extension pages.
- No external runtime libraries in the shipped extension.
- No broad host permissions.
- No hidden behavior.
- No ad manipulation.
- No automatic clicking of page controls.
- No secret-bearing workflows on untrusted PR contexts.

### NFR-003: Performance

- Avoid tight polling loops.
- Prefer scoped `MutationObserver` with debounce.
- Observe only necessary DOM changes.
- Avoid repeated writes to `video.playbackRate`.
- Cache settings in content script after initial read.
- Keep content script small.
- Background process should be avoided in MVP unless required.

### NFR-004: Maintainability

- Clear adapter boundaries.
- Small modules.
- No unnecessary code comments.
- Decisions documented in `/docs/decisions`.
- Specifications and research notes documented in `/docs/ai` as requested.
- Conventional commits.
- Atomic commits.

### NFR-005: Accessibility

- Popup controls must be keyboard-accessible.
- Inputs must have labels.
- Status updates should be visible as text.
- Captions-related future features must respect user choice and accessibility needs.

---

## 11. Architecture

### 11.1 Recommended MVP Architecture

Use a dependency-free WebExtension with plain JavaScript modules and JSDoc typedefs.

Core principle:

- The extension core must be independent from Firefox-specific APIs where practical.
- Browser-specific logic goes behind adapters.
- Site-specific logic goes behind site adapters.
- User-facing actions go through a facade.

### 11.2 Design Patterns

#### Facade

`VideoDefaultsFacade` exposes simple operations:

- `getSettings()`
- `setDefaultSpeed(speed)`
- `getPlaybackState()`
- `applySpeedToActiveVideo(speed)`

The popup talks to the facade rather than knowing low-level player logic.

#### Adapter

Adapters isolate variability:

- `BrowserAdapter`: storage, runtime messaging, tab messaging.
- `SiteAdapter`: YouTube page detection and SPA context detection.
- `PlayerAdapter`: HTML5 video operations.
- `CompatibilityAdapter`: future cross-browser manifest/build differences.

### 11.3 Proposed Repository Structure

```text
VideoDefaults/
  PRD.md
  manifest.base.json                    # future shared manifest source, if needed
  apps/
    firefox-extension/
      manifest.json
      src/
        content/
          content.js
        popup/
          popup.html
          popup.css
          popup.js
        background/
          background.js                 # optional; avoid in MVP unless needed
        assets/
      README.md
  src/
    core/
      settings.js
      playback-state.js
      speed.js
      validation.js
    facade/
      video-defaults-facade.js
    browser-adapters/
      firefox/
        firefox-storage-adapter.js
        firefox-messaging-adapter.js
      chromium/
        README.md                       # future placeholder only
    site-adapters/
      youtube/
        youtube-site-adapter.js
      generic-html5/
        README.md                       # future placeholder only
    player-adapters/
      html5-video-player-adapter.js
  tests/
    unit/
      speed.test.js
      settings.test.js
      playback-state.test.js
    fixtures/
      youtube-watch-basic.html
      generic-video.html
  tools/
    package-extension/
      package_firefox.py
    compatibility-watch/
      compatibility_watch.py
      watchlist.example.json
    commit-check/
      validate_commit_message.py
    issue-insights/
      README.md                         # future, not MVP
  scripts/
    check.sh
    test.sh
    package-firefox.sh
    install-git-hooks.sh
    git-hooks/
      commit-msg
      pre-push
  docs/
    decisions/
      ADR-0001-firefox-first.md
      ADR-0002-no-runtime-dependencies.md
      ADR-0003-plain-js-core.md
      ADR-0004-two-branch-linear-history.md
      ADR-0005-compatibility-watcher.md
    specs/
      playback-speed-mvp.md
      popup-ui-mvp.md
    ai/
      research-2026-06-30.md
      specification-results.md
      future-issue-insights.md
    release/
      firefox-amo-checklist.md
      versioning.md
    compliance/
      permissions.md
      youtube-policy-posture.md
      privacy.md
      compatibility-watchlist.json
  .github/
    workflows/
      ci-dev.yml
      compatibility-watch.yml
      release-main.yml                  # future
    CODEOWNERS
  .gitignore
  README.md
  CHANGELOG.md
  LICENSE
```

### 11.4 Dependency Policy

MVP shipped extension:

- No external runtime libraries.
- No browser polyfill dependency.
- No bundled third-party code.
- No npm build step for shipped code.

Development tooling:

- Prefer Python standard library scripts.
- Prefer Node built-in runtime checks and `node:test` where Node is used.
- Avoid Husky for MVP because it adds npm dependency surface.
- Provide simple native git hooks under `scripts/git-hooks` and installer script.
- Add `web-ext` only as a future pinned release-validation/signing tool after supply-chain decision.

---

## 12. Playback Behavior Details

### 12.1 Context Model

A context is the active playable YouTube video/page/card detected by the site adapter.

Context identity may use:

- Current URL.
- YouTube video ID from URL where available.
- Active video element identity.
- Navigation timestamp fallback.

### 12.2 Default Application Algorithm

1. Load settings.
2. Detect active video.
3. Determine context ID.
4. If context has no manual override and speed was not already applied, set `video.playbackRate = defaultSpeed`.
5. Record extension-initiated change token.
6. Listen for `ratechange`.
7. If `ratechange` matches extension token, ignore as manual override.
8. If `ratechange` does not match extension token, mark current context as manual override.
9. On new context, clear manual override and apply default again.

### 12.3 Manual Override Rule

The extension must not fight the user. If the user manually changes playback speed using YouTube controls, keyboard shortcuts, browser controls, or another extension, VideoDefaults must detect the new current speed and display it, but must not override it again in the same context.

---

## 13. GUI Requirements

### MVP Popup Layout

Suggested popup content:

```text
VideoDefaults

Current page: YouTube video detected
Current speed: 1.75x
Default speed: 2.00x
State: Manual override active for this video

[1x] [1.5x] [2x]
Custom: [ 2.25 ] [Save & apply]
```

### Validation Rules

- Empty input is invalid.
- Non-number input is invalid.
- Speed below minimum is invalid.
- Speed above maximum is invalid.
- Values normalize to two decimal places for display.

---

## 14. Compatibility Watcher Requirements

### 14.1 Tool Name

Working name: `compatibility-watch`.

### 14.2 CLI Examples

```bash
python3 tools/compatibility-watch/compatibility_watch.py --repo "$GITHUB_REPOSITORY" --mode report
python3 tools/compatibility-watch/compatibility_watch.py --repo "$GITHUB_REPOSITORY" --mode ci --fail-on high
```

### 14.3 GitHub Actions Triggers

The workflow must support:

- Scheduled cron.
- Manual button trigger.

Example workflow event shape:

```yaml
on:
  schedule:
    - cron: "30 6 * * 1-5"
  workflow_dispatch:
    inputs:
      scope:
        description: "Compatibility watch scope"
        required: false
        default: "all"
```

### 14.4 Severity Rules

High severity examples:

- Open issue labeled both `compatibility` and `regression`.
- Open issue containing `YouTube changed` and `speed not working`.
- AMO review rejection issue open.
- Firefox manifest/runtime issue open.
- Three or more recent reports of default speed not applying.

Medium severity examples:

- Single recent YouTube layout issue.
- CI package failure.
- Documentation mismatch.

Low severity examples:

- Future enhancement requests.
- Old inactive compatibility reports.

### 14.5 Report Format

JSON report:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-30T00:00:00Z",
  "repository": "owner/VideoDefaults",
  "overallSeverity": "medium",
  "signals": [],
  "recommendedActions": []
}
```

Markdown report:

- Summary.
- Severity.
- Signals found.
- Linked issues.
- Recommended next actions.
- False-positive notes.

---

## 15. CI/CD Requirements

### 15.1 Branch Model

Long-lived branches:

- `dev`: development branch; pushes allowed.
- `main`: release branch; protected; future signing/publishing only.

Rules:

- No merge commits.
- Linear history required.
- Force pushes disabled except explicit admin recovery.
- `main` updates only from reviewed/promoted `dev` state.
- Prefer rebase or fast-forward promotion.
- Commit messages must follow Conventional Commits.
- Commit messages must not mention AI assistant/tool names.

### 15.2 `dev` CI

Run on:

- Push to `dev`.
- Manual trigger if useful.

Jobs:

1. Checkout.
2. Syntax check JavaScript files.
3. Run unit tests.
4. Validate manifest basics.
5. Validate commit messages for pushed range when possible.
6. Package Firefox extension with deterministic Python zip script.
7. Upload unsigned artifact.

No secrets required.

### 15.3 `main` Release CI: Future

Run on:

- Push to `main`.
- Git tag `v*`.
- Manual release dispatch.

Jobs:

1. Run full CI.
2. Build release artifact.
3. Run AMO validation/signing.
4. Publish to AMO when enabled.
5. Create GitHub release artifact.
6. Update changelog.

Requires future secrets:

- AMO issuer/key.
- AMO secret.

Security constraints:

- Release workflow must not run privileged secrets on untrusted pull request code.
- Third-party actions must be pinned or avoided.
- Workflow files require review.

---

## 16. Commit Strategy

### Conventional Commit Format

```text
<type>(<scope>): <description>
```

Allowed types:

- `feat`
- `fix`
- `docs`
- `test`
- `refactor`
- `chore`
- `ci`
- `build`
- `perf`

Examples:

```text
chore(repo): add firefox extension skeleton
feat(core): add playback speed validation
feat(youtube): apply default speed to active video
feat(popup): add speed preset controls
fix(youtube): preserve manual rate changes per video
ci(dev): package unsigned firefox artifact
chore(git): add commit message validation hook
docs(spec): document playback speed mvp behavior
docs(decisions): record dependency policy
```

Forbidden commit message examples:

```text
feat: generated by claude
fix: update from chatgpt
chore: bot changes
```

### Atomic Commit Guidance

Each commit should:

- Do one logical thing.
- Keep tests passing.
- Avoid mixing docs, behavior, and formatting unless necessary.
- Include related tests when behavior changes.

---

## 17. Testing Strategy

### 17.1 Unit Tests

Use Node built-in `node:test` for pure logic where possible.

Targets:

- Speed validation.
- Settings migration/defaults.
- Manual override state machine.
- Message payload validation.
- Compatibility watcher rules.

### 17.2 Browser Manual Test Checklist

Firefox temporary-install checklist:

1. Load extension temporarily.
2. Open YouTube watch page.
3. Confirm speed becomes `2.0`.
4. Open popup and confirm current speed display.
5. Click `1.5`; confirm active video and global default change.
6. Type custom value; confirm validation and application.
7. Manually change speed in YouTube player; confirm popup detects current speed and manual override state.
8. Navigate to another YouTube video; confirm default applies again.
9. Visit a YouTube page without video; confirm graceful status.
10. Trigger cookie/consent scenario if possible; confirm no crash and no automatic click.

### 17.3 Future Automated Browser Tests

Potential options after MVP:

- Firefox headless smoke tests.
- `web-ext run` based tests.
- Playwright only after explicit dependency decision.
- Local HTML fixture test page for generic HTML5 video.

---

## 18. Packaging Requirements

### MVP Packaging

Use a deterministic Python script:

- Include only extension files.
- Exclude tests, docs, hidden files, source maps, and local artifacts.
- Generate zip under `dist/`.
- Print file list.
- Fail if forbidden files are included.

### Future AMO Packaging

- Use Mozilla-compatible package structure.
- Add signing/publishing only in protected `main` release workflow.
- Provide source code package if any transpilation/minification is introduced.
- Avoid minification unless strongly justified.

---

## 19. Compliance and Policy Posture

### Firefox AMO

The extension must be review-friendly:

- Narrow permissions.
- Self-contained code.
- No remote executable code.
- Clear user-facing description.
- Clear privacy policy.
- No hidden data transmission.
- No obfuscation.
- No unnecessary bundled files.

### YouTube

The MVP must avoid risky behaviors:

- No YouTube API Services usage.
- No ad blocking.
- No ad skipping.
- No video/audio downloads.
- No player UI hiding.
- No overlays on the YouTube player.
- No automated clicks on YouTube UI.
- No autoplay initiation.
- No incentives/rewards for playback.

### Privacy Policy Draft Direction

The privacy policy should say:

- VideoDefaults stores settings locally in the browser.
- VideoDefaults does not collect personal data.
- VideoDefaults does not send browsing history or video data to external servers.
- VideoDefaults does not use analytics or telemetry in MVP.

---

## 20. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---:|---|
| YouTube DOM changes break detection | High | Prefer native `video` element; compatibility watcher; manual fallback status |
| Firefox MV3 behavior differs from Chromium | High | Firefox-first implementation; adapter design; documented manifest decisions |
| AMO rejects due permissions or behavior | High | Minimal permissions; no remote code; no ad manipulation; compliance docs |
| npm supply-chain risk | High | No runtime dependencies; avoid npm in MVP core; Python packaging |
| Extension fights user manual speed changes | Medium | Manual override state machine using `ratechange` source tracking |
| Consent/cookie dialogs block video | Medium | Graceful no-video status; no automatic clicks |
| Volume default surprises user | Medium | Keep volume as post-MVP; require explicit setting and clear UI |
| Captions off hurts accessibility | Medium | Keep as post-MVP; respect manual user changes; clear opt-in |
| Future AI issue tool leaks data | High | Not MVP; sanitize; minimize; validate schema; human review; no auto actions |
| Two-branch workflow causes large dev commits | Medium | Atomic commits; commit hooks; required CI; linear history |

---

## 21. Milestones and Task Breakdown

### Milestone 0: Repository Foundation

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-001 | Create repository skeleton | P0 | Directory structure exists; README explains MVP |
| VD-002 | Add license and basic metadata | P0 | LICENSE and README present |
| VD-003 | Add docs directories | P0 | `/docs/decisions`, `/docs/specs`, `/docs/ai`, `/docs/release`, `/docs/compliance` exist |
| VD-004 | Add ADR for Firefox-first strategy | P0 | ADR documents target browser and future adapters |
| VD-005 | Add ADR for no runtime dependencies | P0 | ADR explains supply-chain tradeoff |
| VD-006 | Add ADR for plain JS core | P0 | ADR explains why TypeScript is deferred |
| VD-007 | Add branch workflow documentation | P0 | `dev`/`main` strategy documented |

### Milestone 1: Core Logic

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-101 | Implement speed validation module | P0 | Unit tests cover valid/invalid/clamped values |
| VD-102 | Implement settings defaults/migration | P0 | Missing/invalid settings handled safely |
| VD-103 | Implement playback state model | P0 | Manual override states tested |
| VD-104 | Implement facade interface | P0 | Popup/content can call stable operations |
| VD-105 | Add message payload validation | P0 | Unknown/invalid messages return safe errors |

### Milestone 2: Firefox Extension MVP

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-201 | Create Firefox manifest | P0 | Manifest loads temporarily in Firefox |
| VD-202 | Add content script registration for YouTube | P0 | Script runs only on required YouTube pages |
| VD-203 | Implement Firefox storage adapter | P0 | Settings persist via extension storage |
| VD-204 | Implement Firefox messaging adapter | P0 | Popup can query content state |
| VD-205 | Add basic extension icons/placeholders | P1 | Extension has non-empty icon assets |

### Milestone 3: YouTube Playback Speed

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-301 | Implement YouTube site adapter | P0 | Detects active video on watch page |
| VD-302 | Implement SPA navigation detection | P0 | New YouTube video context detected |
| VD-303 | Implement HTML5 player adapter | P0 | Can read/write playbackRate |
| VD-304 | Apply default speed once per context | P0 | New video starts at global default |
| VD-305 | Implement manual override detection | P0 | User speed change is respected |
| VD-306 | Add debounce/retry strategy | P0 | No tight polling; no repeated writes |
| VD-307 | Add no-video/blocked status | P1 | Popup can show graceful unavailable state |

### Milestone 4: Popup GUI

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-401 | Create popup HTML/CSS | P0 | Popup renders in Firefox |
| VD-402 | Add preset speed buttons | P0 | `1`, `1.5`, `2.0` update default and active video |
| VD-403 | Add custom speed input | P0 | Valid values save/apply; invalid values show error |
| VD-404 | Display detected current speed | P0 | Popup reflects active video state |
| VD-405 | Display manual override state | P0 | Popup reports manual override correctly |
| VD-406 | Ensure keyboard accessibility | P1 | Controls reachable and usable via keyboard |

### Milestone 5: Tests and Quality Gates

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-501 | Add Node unit test runner | P0 | `scripts/test.sh` passes locally |
| VD-502 | Add syntax checker | P0 | `scripts/check.sh` validates JS syntax |
| VD-503 | Add manifest validation script | P0 | Required manifest fields checked |
| VD-504 | Add manual Firefox test checklist | P0 | Checklist documented in `/docs/specs` or `/docs/release` |
| VD-505 | Add fixture HTML files | P1 | Fixtures support future automated tests |

### Milestone 6: Packaging and CI

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-601 | Add deterministic Python packager | P0 | Produces unsigned Firefox zip artifact |
| VD-602 | Add forbidden-file package check | P0 | Package excludes docs/tests/local files |
| VD-603 | Add `ci-dev.yml` | P0 | Runs check/test/package on `dev` |
| VD-604 | Add artifact upload | P0 | CI exposes unsigned zip |
| VD-605 | Add future `release-main.yml` placeholder | P1 | Documents signing/publishing path without secrets |
| VD-606 | Add workflow security notes | P1 | `.github/workflows` changes require review |

### Milestone 7: Git Workflow and Conventional Commits

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-701 | Add commit message validator script | P0 | Conventional commits validated without npm |
| VD-702 | Add local git hook templates | P1 | Developer can install hooks manually |
| VD-703 | Document atomic commit practice | P1 | Examples included; forbidden AI-tool mentions documented |
| VD-704 | Configure branch protection checklist | P0 | Main/dev rules documented |

### Milestone 8: Compatibility Watcher

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-801 | Add compatibility watcher CLI skeleton | P0 | Runs locally without external packages |
| VD-802 | Add GitHub issues fetcher | P0 | Reads open issues using token/env |
| VD-803 | Add rule-based severity classifier | P0 | Labels/keywords map to severity |
| VD-804 | Add JSON and Markdown reports | P0 | Reports uploaded in CI |
| VD-805 | Add scheduled/manual workflow | P0 | Supports cron and `workflow_dispatch` |
| VD-806 | Add compatibility watchlist doc | P1 | Watchlist stored in `/docs/compliance` |
| VD-807 | Add optional tracking issue update | P2 | Updates one issue with latest report when enabled |

### Milestone 9: AMO Release Readiness

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-901 | Write AMO listing draft | P1 | Summary, description, permissions explanation ready |
| VD-902 | Write privacy policy | P1 | Local-only data behavior documented |
| VD-903 | Add release checklist | P1 | Manual AMO steps documented |
| VD-904 | Add source package policy | P1 | Explains when source submission is required |
| VD-905 | Validate unsigned package manually | P1 | Package loads and works in Firefox |

### Milestone 10: Future Enhancements

| ID | Task | Priority | Acceptance Criteria |
|---|---|---:|---|
| VD-1001 | Research captions-off implementation | P2 | ADR documents safe/non-invasive approach |
| VD-1002 | Research volume default implementation | P2 | ADR addresses user surprise and autoplay safety |
| VD-1003 | Add generic HTML5 adapter | P2 | Works on local fixture page |
| VD-1004 | Add Chromium manifest/build adapter | P2 | Chrome loads local build |
| VD-1005 | Add Edge packaging notes | P3 | Edge publication path documented |
| VD-1006 | Add future issue-insight spec | P3 | Sanitization/schema/human-review flow documented |
| VD-1007 | Add DOM Snapshot Compressor spec | P3 | Defines compressed terminal-readable page metadata format |

---

## 22. Future: DOM Snapshot Compressor

Working concept:

A developer tool that converts complex site structure into a compact, readable, terminal-friendly list of important interactive metadata.

Possible output:

```text
Page: YouTube Watch
1. Video player
   role: video
   state: playing
   src: blob/internal
   controls: play, pause, speed, captions, volume
   use: html5-video-adapter

2. Captions button
   role: button
   label: Subtitles/closed captions
   state: off
   path: stable accessible selector candidate

3. Speed menu
   role: menu
   label: Playback speed
   current: 2x
   use: avoid if html5 playbackRate works
```

Constraints:

- Must not collect sensitive user data by default.
- Must redact visible personal data.
- Must prefer accessibility metadata over brittle CSS paths.
- Must never be shipped as enabled extension behavior without explicit user action.
- Must be documented separately before implementation.

---

## 23. Future: Captions and Volume

### Captions Off

Potential approaches:

1. Native `video.textTracks` where available.
2. YouTube-specific adapter only after research.
3. Avoid synthetic UI clicking unless explicitly approved.

Rules:

- Do not override if user manually turns captions on.
- Consider accessibility impact.
- Clearly expose setting in UI.

### Internal Volume 100%

Potential approaches:

1. Set `video.volume = 1.0` only when user opted in.
2. Do not initiate playback.
3. Do not unmute unexpectedly unless user explicitly configured it.
4. Respect manual volume changes in current context.

Rules:

- Treat volume as higher-surprise than speed.
- Add clear UI and documentation before enabling.

---

## 24. Open Questions

1. Final extension icon and visual identity.
2. Final AMO category.
3. Whether custom speed max should remain `4.0` or be stricter.
4. Whether `storage.sync` should replace `storage.local` after MVP.
5. Whether volume should ever unmute or only set volume when already unmuted.
6. Whether captions off should be default or explicit opt-in due accessibility.
7. Whether future AI issue insights should use direct HTTPS or official SDK.
8. Whether `web-ext` should be introduced as a pinned release dependency or kept manual.

---

## 25. Definition of Done for MVP

The MVP is done when:

1. Firefox extension loads temporarily without errors.
2. YouTube video playback speed defaults to `2.0` on new video context.
3. Popup allows presets `1`, `1.5`, `2.0`.
4. Popup allows custom speed input with validation.
5. Popup displays current detected speed.
6. Manual speed changes are detected and respected for the current context.
7. Settings persist across browser restart.
8. No external runtime libraries are shipped.
9. No network calls are made by the extension.
10. CI on `dev` checks, tests, and packages artifact.
11. Compatibility watcher exists and can run via cron/manual trigger.
12. Permissions and policy posture are documented.
13. Manual Firefox test checklist passes.
14. Docs include architecture decisions and MVP specs.

---

## 26. Recommended Immediate Next Work Order

1. Commit repository skeleton and docs directories.
2. Add ADRs for Firefox-first, no runtime dependencies, plain JavaScript core, and two-branch workflow.
3. Implement core speed validation and tests.
4. Implement Firefox manifest and minimal content script.
5. Implement YouTube video detection and default speed application.
6. Implement manual override state machine.
7. Implement popup GUI.
8. Add package script and `dev` CI.
9. Add compatibility watcher.
10. Prepare AMO release-readiness docs.

