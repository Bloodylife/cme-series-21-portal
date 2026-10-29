# CME Series ’21 — our shared identity

Enhanced proposal and voting website for Ceramic & Metallurgical Engineering, RUET.

**Delivery status: project files prepared; not deployed.** No GitHub repository, Google Sheet, account setting, or live vote was changed. `config.js` intentionally has an empty API URL. The website shows an honest setup state until a real service is connected. There are no example proposals or simulated vote totals in the website.

## What changed

- Refined cream, navy, and copper identity, custom crystalline artwork, and responsive navigation.
- Search names, meanings, and taglines; filter categories; sort by support, name, or date.
- Compare two or three proposals side by side, including full meanings.
- See shared participation, the current choice, and private pending submissions.
- Explicit vote assignment and withdrawal: repeated clicks cannot toggle a vote away.
- Password-style access-code field; credentials stay in page memory, never URLs or storage.
- Accessible labels, keyboard focus handling, modal focus trapping, visible feedback, reduced-motion support, and mobile-sized inputs.
- Backend checks for eligibility, active status, approval, lengths, supported categories, duplicate proposals, and formula injection.
- Script locking around reads and writes; duplicate old vote rows count once and are repaired for that voter on the next write.
- Careful roster initialization with schema checks, private backup tabs before changes, and credential preservation.

## Open locally

Double-click `index.html` to inspect the unconfigured design. For a local HTTP preview with Node.js installed, open a terminal in this folder and run:

```sh
node preview.cjs
```

Open the address printed by the command. Stop it with Ctrl+C. No package installation or build is required. The preview serves only the four website files and never simulates a database.

Run local backend tests with:

```sh
node --test tests/backend.test.cjs
```

Tests run the actual Apps Script source using simulated Google services. They do not access Google or establish production compatibility. See `VERIFICATION.md` for results and remaining checks.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Static website |
| `config.js` | Actual deployed Apps Script `/exec` URL goes here |
| `apps-script/Code.gs` | Authentication, shared state, submissions, voting, roster setup |
| `apps-script/appsscript.json` | V8 runtime, Dhaka timezone, Sheets permission |
| `SETUP_A_TO_Z.md` | Deployment and administrator guide |
| `SECURITY.md` | Privacy, security controls, and operational limitations |
| `VERIFICATION.md` | What passed locally and what remains unverified |
| `tests/` | Dependency-free backend regression tests with generated test data |

## Architecture

GitHub Pages serves the static frontend. Google Apps Script accesses a private Google Sheet containing Students, Proposals, and Votes. Only approved proposals and aggregate totals are publicly readable. Authenticated student operations use POST bodies; success requires a readable, matching server response.

The eligible range is 2106001–2106060, excluding 2106045: exactly 59 students. New names are blank and accounts active. Newly generated access codes are 20 characters; existing valid codes are preserved. Reloading a page requires sign-in again; confirmed votes remain on the server.

Follow `SETUP_A_TO_Z.md` before enabling real voting. This is an informal poll, not an anonymous or certified election system.
