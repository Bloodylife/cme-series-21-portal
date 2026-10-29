# Deployment and administrator guide

This delivery is files-only, as requested. The following steps have not been performed against your accounts.

## 1. Prepare the private database

Open the supplied [Google Sheets link](https://docs.google.com/spreadsheets/d/1WmvR5ERYUv1qLQSPTE70kY9IntjxaosM/edit) using the intended owner account. Confirm it exists, you have edit access, and it is a native Google Sheet. Its accessibility and document type were not checked during this files-only task. Do not publish it or change link access to public.

Make a private copy of the entire workbook before initial installation. The initializer also makes private backup tabs before changing an existing roster, but those are not an independent disaster-recovery backup.

Open Extensions → Apps Script. Copy `apps-script/Code.gs`. Show the manifest in Project Settings and copy `apps-script/appsscript.json`. Check `SHEET_ID`. Run `setupDatabase` manually, reviewing Google's normal authorization screen yourself.

Expected tables:

| Tab | Exact columns, in order |
| --- | --- |
| Students | studentCode, name, accessCode, active |
| Proposals | id, proposedName, tagline, meaning, category, proposerName, studentId, status, createdAt |
| Votes | studentCode, proposalId, updatedAt |

Check 59 student rows: 2106001 through 2106060, with 2106045 absent. Names are blank unless already supplied. Accounts start active. Codes must be unique. No credential list is included in this package; real credentials are generated only when setup runs in Google.

Setup validates every existing schema before changing anything. Unexpected IDs, duplicate IDs/codes, invalid active statuses, or unfamiliar columns stop setup without silently deleting them. Migrate conflicting records explicitly after making a private backup. Do not clear genuine records simply to get past validation. Re-running setup preserves existing names, statuses, credentials, proposals, and votes; a fully initialized roster is left unchanged.

Distribute each student's own access code privately. Never send the full credential column to a class group, repository, website, or chat. Existing codes from the starter remain usable if valid and unique.

## 2. Deploy the backend

Deploy → New deployment → Web app. The public frontend needs an endpoint reachable without the visitor's Google session. Use Execute as: Me and access: Anyone only if permitted by your account policies. The Sheet remains private; each protected action still requires student credentials.

Copy the production URL ending in `/exec`. `/dev` is not the production endpoint. Open `/exec?action=state`; the result should contain `ok: true`, `authenticated: false`, public proposals, and no private rows. Never test credentials in a URL.

If the account blocks anonymous deployment, stop here. Do not make the spreadsheet public, bypass Google warnings, or weaken organizational policies.

## 3. Connect the frontend

In `config.js`, set `API_URL` to the actual `/exec` URL. This endpoint is public configuration, not a secret. Do not add access codes or tokens.

## 4. Create the repository and publish

In the intended GitHub account, first check whether `cme-series-21-portal` already exists. Do not overwrite an existing project. Choose repository visibility deliberately; confirm your plan supports GitHub Pages with that visibility.

Upload the contents of this folder so `index.html`, `styles.css`, `app.js`, and `config.js` are at the repository root. Include backend source and documentation if desired; they contain no live student records. Never include Sheet exports, credentials, access tokens, or private backups.

Commit to `main`. In Settings → Pages, select deployment from branch `main`, folder `/(root)`. Wait for a successful deployment. Use the exact HTTPS URL shown by GitHub. Record the final commit SHA and Pages deployment status.

## 5. Required production checks before inviting the class

The following tests must use the actual Pages site and actual Apps Script deployment. Local mock tests do not replace them.

1. Load the Pages URL without signing into Google. Confirm styles/scripts load and approved proposals appear.
2. Sign in using an authorized test student's code, kept private. Confirm the returned state belongs only to that student.
3. Submit a clearly temporary proposal. Confirm its row is `pending`, visible only to its author in the website, and not publicly listed.
4. As a trusted Sheet editor, change only that proposal's status to `approved`. Refresh the site; it should appear.
5. Vote, then choose a different approved proposal. Confirm exactly one row for the student and correct aggregate totals. Clicking the selected button again should do nothing; withdrawal has its own button.
6. Open a different browser/device. Confirm totals match after Refresh or the next 30-second refresh while the page is visible. Re-authenticate to inspect the same student's own vote.
7. Attempt concurrent votes from two tabs. Confirm the last server-processed choice wins and only one vote remains. The script lock serializes API access; manual Sheet edits are outside it.
8. Test incorrect codes, inactive accounts, 2106045, pending/rejected proposals, and oversized fields. None should create a vote.
9. Interrupt the network or block the API response. The page must not display an unconfirmed vote as successful. Reconnect and refresh before deciding whether to retry.
10. Verify cross-origin POST specifically: a successful JSONP/public read is insufficient. In browser Network tools, sign-in and writes must produce readable JSON with `ok: true`, a matching `requestId` for writes, and authoritative `state`. Do not save screenshots or logs containing request bodies and codes.
11. Check on a phone and with keyboard navigation. Delete only the clearly identified temporary proposal and its associated test votes after verification.

### Cross-origin transport

Public reads use a tightly validated JSONP callback and never accept credentials. Private reads and writes use JSON serialized in a `text/plain;charset=UTF-8` POST, which avoids a preflight. Fetch follows ContentService's redirect and requires a readable JSON response. Every write carries a random request identifier echoed by the backend. A response failure never becomes an optimistic success.

This design still requires testing against the real deployment, account policies, redirects, and browser. A network timeout may occur after a write reaches Google. Refresh first; repeated assignment of the same vote is safe. Proposal retries within the same unchanged form reuse their request ID. Exact duplicate names by the same student are also blocked after reload.

If the live response cannot be read because of authentication redirects or CORS, verify the `/exec` URL, deployment access, and current deployed version. Do not switch to `no-cors` or move credentials into JSONP to hide the failure. Do not open voting until an approved alternative or corrected deployment passes the production checks.

## Operating the poll

- **Approve/reject:** trusted editors change `Proposals.status` to `approved` or `rejected`. No public admin API exists. Pending submissions are capped at five per student. Approval makes the proposer name, batch name, tagline, category, and meaning public.
- **Close/reopen voting:** set Script Property `VOTING_OPEN` to `false` to close; set to `true` to reopen. Closed polls still permit browsing and proposals. Votes and withdrawals are blocked server-side.
- **Disable eligibility:** set Students.active to FALSE. That student's votes remain stored but stop counting in public totals. Reactivating the account restores counting if its proposal remains approved.
- **Hide a proposal:** changing its status away from approved removes it and its support from public results without deleting its stored votes. Reapproval restores those counts.
- **Compromised code:** disable the account; privately replace only its code with a unique random code, then re-enable it. All requests recheck credentials and active status.
- **Deploy code changes:** save, then Deploy → Manage deployments → Edit → New version. Keep the deployment URL stable and test from Pages again.
- **Backups:** keep workbook backups and backup tabs private. Restrict editors, and preserve a private record of administrative changes. Do not manually edit the Votes tab while the poll is open.

Official references consulted: [Google web apps](https://developers.google.com/apps-script/guides/web), [Google Content Service](https://developers.google.com/apps-script/guides/content). These document web-app entry points, deployment, response redirects, and the public-only constraints of JSONP; they do not replace testing this deployment's CORS behavior.
