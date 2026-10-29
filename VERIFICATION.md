# Verification and delivery report

Date: 29 October 2026 (Asia/Dhaka).

**Scope:** enhance and prepare project files. No deployment or account modification was requested after clarification. The original ZIP was preserved unchanged; development used a separate extracted copy.

## Completed and verified locally

The actual `Code.gs` source passed **21 automated tests** with simulated SpreadsheetApp, LockService, CacheService, PropertiesService, and ContentService. JavaScript syntax checks passed. The browser preview returned HTTP 200.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Roster count, unique IDs and credentials, range, blank names | PASS | 59 generated test students, 2106001–2106060, 2106045 excluded |
| Existing names, statuses, credentials retained on setup | PASS | Repeat initialization leaves valid tables unchanged |
| Backup before roster changes | PASS | Simulated private backup tabs created before adding missing records |
| Mismatched schemas and duplicate credentials | PASS | Initialization stops without modifying records |
| Correct, incorrect, inactive, excluded, oversized credentials | PASS | Private access permitted or rejected as appropriate |
| Failed-login throttle | PASS | Ten failures cause a rate-limit response; real cache expiry/eviction untested |
| Pending submissions and organizer approval | PASS | Simulated Sheet approval moves the proposal into public results |
| Public/private state separation | PASS | No code, student ID, private vote or pending proposal in public responses |
| GET credentials and callback injection | PASS | Credentials rejected; invalid callbacks not executed |
| Votes for pending/rejected proposals | PASS | Rejected without creating a vote |
| Repeated votes, changed choices, explicit withdrawal | PASS | One active vote; repeated selection never withdraws it |
| Shared totals for another client | PASS | Independent read observes the updated simulated database |
| Old duplicate vote rows | PASS | Count once, repaired by next vote write |
| Inactive-account votes | PASS | Excluded from aggregate results |
| Proposal request retry and duplicate name | PASS | No duplicate persisted proposal |
| Pending-proposal cap and input validation | PASS | Sixth pending proposal, bad categories and oversized fields rejected |
| Spreadsheet formula escaping | PASS | Formula-leading text protected before storage |
| Poll closure | PASS | Vote/withdraw blocked; read and proposals remain available |
| Lock contention | PASS | Busy response without mutation; not a real distributed concurrency test |
| Unexpected server errors | PASS | Generic error response, no internal records or exception details |

## Browser checks

An isolated local QA endpoint ran the real backend source against in-memory test tables. Its page was labeled “LOCAL QA FIXTURE — sample proposals, not real voting results.” This fixture and its sample records are not part of the delivered website or ZIP.

| Browser check | Result |
| --- | --- |
| Actual unconfigured site renders with honest setup state | PASS |
| Desktop visual review | PASS |
| 390px mobile layout and page width | PASS; horizontal overflow corrected |
| Search by tagline and category filtering | PASS |
| Alphabetical proposal sorting | PASS |
| Two-name comparison | PASS |
| Comparison focus loop and Escape dismissal | PASS |
| Student sign-in against local fixture | PASS |
| Vote, change choice, selected button disabled, withdrawal | PASS |
| Proposal saved as pending and absent from public shortlist | PASS |
| HTML/script-like proposal text rendered literally | PASS; no injected img/script elements |
| Test service returns HTTP 503 during vote | PASS; error shown, current vote unchanged, no false success |
| Second independent browser tab sees updated aggregate | PASS; same browser engine, local test database |
| Browser JavaScript error log after normal interactions | PASS; no errors observed |

Saved design previews accompany the project as `CME21-desktop-preview.jpg` and `CME21-mobile-preview.jpg`. They show the actual unconfigured website, not fabricated voting activity.

## Completed but requiring production validation

The Google Apps Script backend, roster setup, cross-origin request handling, and polling are implemented. Local mock tests do not exercise Google's runtime, permission model, cache eviction, service quotas, ContentService redirects/CORS, or Sheet write semantics. The live cross-origin POST path must be tested before the class uses the poll.

## Not performed — intentionally outside the files-only scope

| Item | Status |
| --- | --- |
| GitHub repository URL | Not created or accessed |
| GitHub Pages URL / deployment | Not deployed |
| Final commit SHA | None; local file package, no repository commit |
| Google Sheet access and native document type | Not checked |
| Actual Google Sheet roster count | Not initialized or inspected; 59 verified only in local tests |
| Apps Script deployment URL | None; `API_URL` deliberately empty |
| Google consent / execution permissions | Not requested |
| Live Pages → Apps Script cross-origin sign-in and write | Unverified |
| Two distinct browser engines or physical phone | Unverified; responsive desktop-browser preview checked |
| Real concurrent requests under Google lock and quota behavior | Unverified |
| Cleanup of real test data | Not applicable; no real records created |

Supplied database reference: [Google Sheet](https://docs.google.com/spreadsheets/d/1WmvR5ERYUv1qLQSPTE70kY9IntjxaosM/edit). No claim is made about its availability or current contents.

Complete `SETUP_A_TO_Z.md` when deployment is authorized. Review `SECURITY.md`: this is an informal, organizer-visible poll, not a secret ballot or tamper-proof election.
