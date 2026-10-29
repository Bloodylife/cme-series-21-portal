# Security and operating limits

This is an informal university batch poll. It does not guarantee anonymity, independently verified identities, tamper resistance, or secret ballots.

## Controls in the delivered code

- Every private read and write validates the student's eligible ID, individual code, and active status.
- GET/JSONP contains only approved proposals and aggregate totals. Credentials in GET are rejected. Callback syntax is constrained to the frontend's generated names.
- Credentials are sent in HTTPS POST bodies and held only in page memory. They are never persisted to localStorage/sessionStorage by this version. Old starter session keys are removed on startup. Password-manager behavior is controlled separately by the user's browser.
- Private POST success requires readable server JSON. Write responses must match the request identifier; vote responses must confirm the selected proposal. No `no-cors` or fire-and-forget success path exists.
- Read/write operations use the Apps Script lock. Vote assignment is idempotent, changes replace the existing selection, and withdrawal is explicit. Reads deduplicate older duplicate rows; writes repair that student's duplicates.
- Proposal IDs are request UUIDs, which prevent duplicate records on retries. Same-student duplicate names and more than five pending submissions are blocked.
- Field type, length, category, status, and proposal eligibility checks happen server-side. User text is HTML-escaped in the browser and escaped against spreadsheet formula interpretation before storage.
- Setup validates schemas, backs up existing private tabs before roster changes, preserves credentials and active statuses, and fails on ambiguous data rather than clearing it.
- No HTTP operation can approve proposals, change eligibility, or close the poll. Administrative control is through trusted Google Sheet/project editors.

## Remaining limitations

- Spreadsheet editors can read access codes and individual votes, approve proposals, alter the roster, and change results. Script owners can modify the implementation. Limit editor access and maintain separate private backups.
- Approved proposer names and proposal contents are public. The form discloses this. Do not approve submissions containing private contact information.
- Access codes are readable in the private Sheet to support individual distribution. Shared or stolen codes can be used by whoever possesses them. Codes are not proof of real-world identity.
- Ten failed authentication attempts per student trigger a best-effort 15-minute cache throttle. Google can evict cache entries. Attackers can temporarily lock out a known ID, consume quotas, or flood the public endpoint; this is not a comprehensive denial-of-service defense.
- Locks protect API operations, not manual spreadsheet edits or other scripts. Google service quotas and execution limits still apply. Actual concurrent production behavior remains to be verified.
- A response can fail after a write succeeds. The site preserves confirmed state and reports uncertainty; users must refresh. Distinct concurrent vote choices resolve in server processing order, not necessarily click order.
- Public JSONP executes a script from the configured endpoint. Only use your trusted deployment URL. This transport must never be extended to private state. Google Fonts is an optional external font request; system fonts remain available if it fails.
- Direct cross-origin POST compatibility depends on the actual Google deployment and browser. Passing local tests does not certify the production transport.
- There is no immutable audit log, automatic schedule, independently verifiable ballot receipt, encrypted ballot store, or certified election process.

Never commit real student records, code lists, OAuth tokens, cookies, or Sheet exports. The repository should contain source and synthetic tests only. Review configuration and the complete staged files before any public publication.
