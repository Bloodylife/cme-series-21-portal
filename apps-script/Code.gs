/** CME '21: private Sheets database, public aggregate reads, authenticated POSTs.
 * Run setupDatabase manually. No administrative actions are exposed over HTTP.
 * Set the Script Property VOTING_OPEN to false to close voting (default: open).
 */
const SHEET_ID = '11PftKzutnaiXYoCSYJdC6CkZYPcUK-xtBoqHzNVWAGM';
const HEADERS = {
  Students: ['studentCode', 'name', 'accessCode', 'active'],
  Proposals: ['id', 'proposedName', 'tagline', 'meaning', 'category', 'proposerName', 'studentId', 'status', 'createdAt'],
  Votes: ['studentCode', 'proposalId', 'updatedAt']
};
const CATEGORIES = ['Materials science', 'Bangla / cultural', 'Values & identity', 'Nature & science', 'Other'];
function eligibleIds_() { return Array.from({length: 60}, (_, i) => String(2106001 + i)).filter(id => id !== '2106045'); }
function text_(value) { return value == null ? '' : String(value); }
function active_(value) { return value === true || text_(value).toUpperCase() === 'TRUE'; }
function fail_(message, code) { const error = new Error(message); error.publicCode = code || 'VALIDATION'; throw error; }
function json_(data, callback) {
  const body = JSON.stringify(data).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(callback ? callback + '(' + body + ');' : body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
function error_(err) { return { ok: false, code: err.publicCode || 'SERVER', error: err.publicCode ? err.message : 'The voting service is unavailable. Ask an organizer to check its configuration.' }; }
function schema_(sheet, name) {
  if (!sheet || sheet.getLastRow() === 0) throw new Error('Missing schema: ' + name);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (header.length !== HEADERS[name].length || !HEADERS[name].every((h,i) => header[i] === h)) throw new Error('Schema mismatch: ' + name);
}
function sheet_(name) { const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); schema_(sheet, name); return sheet; }
function rows_(name) { return sheet_(name).getDataRange().getValues().slice(1).filter(row => row.some(v => v !== '')); }
function locked_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) fail_('The service is busy. Please try again shortly.', 'BUSY');
  try { return fn(); } finally { lock.releaseLock(); }
}
function votingOpen_() { return PropertiesService.getScriptProperties().getProperty('VOTING_OPEN') !== 'false'; }

/** Idempotent initialization; validates every existing table before making any change.
 * Backups are copied as private tabs in the same spreadsheet before updates.
 * Unexpected IDs, duplicate credentials and unknown layouts require explicit migration.
 */
function setupDatabase() {
  return locked_(() => {
    const ss = SpreadsheetApp.openById(SHEET_ID), ids = eligibleIds_(), students = new Map(), used = new Set();
    Object.keys(HEADERS).forEach(name => {
      const sheet = ss.getSheetByName(name); if (sheet && sheet.getLastRow()) schema_(sheet, name);
    });
    const existing = ss.getSheetByName('Students');
    if (existing && existing.getLastRow()) existing.getDataRange().getValues().slice(1).forEach(row => {
      if (row.every(v => v === '')) return;
      const id = text_(row[0]), code = text_(row[2]).trim().toUpperCase();
      if (!ids.includes(id) || students.has(id)) throw new Error('Unexpected or duplicate student ID. Migrate the roster manually before setup.');
      if (code && (!/^[A-Z0-9]{8,32}$/.test(code) || used.has(code))) throw new Error('Existing credential invalid or duplicated. Resolve only the affected records privately.');
      if (![true,false,'TRUE','FALSE','true','false'].includes(row[3])) throw new Error('Existing active status must be TRUE or FALSE.');
      if (code) used.add(code); students.set(id, row);
    });
    const records = ids.map(id => {
      if (students.has(id) && text_(students.get(id)[2])) return students.get(id);
      let code; do { code = Utilities.getUuid().replace(/-/g, '').slice(0,20).toUpperCase(); } while (used.has(code));
      used.add(code); const old = students.get(id);
      return [id, old ? old[1] : '', code, old ? old[3] : true];
    });
    if (records.length !== 59 || new Set(records.map(r => r[0])).size !== 59) throw new Error('Roster invariant failed.');
    const needsStudents = !existing || existing.getLastRow() !== 60 || records.some((r,i) => JSON.stringify(r) !== JSON.stringify(existing.getRange(i+2,1,1,4).getValues()[0]));
    if (needsStudents) {
      const stamp = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,6);
      Object.keys(HEADERS).forEach(name => { const s = ss.getSheetByName(name); if (s && s.getLastRow()) s.copyTo(ss).setName('Backup-' + name + '-' + stamp); });
    }
    Object.keys(HEADERS).forEach(name => {
      const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      if (!sheet.getLastRow()) sheet.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
    });
    if (needsStudents) {
      const sheet = ss.getSheetByName('Students');
      sheet.getRange(2,1,59,3).setNumberFormat('@');
      sheet.getRange(2,1,59,4).setValues(records.map(row => row.map((v,i) => i < 3 ? cell_(v) : v)));
    }
    SpreadsheetApp.flush();
    return 'Verified 59 unique eligible students; 2106045 excluded. Existing names, statuses, and credentials preserved. Keep all tabs and backups private.';
  });
}
function doGet(e) {
  const p = e && e.parameter || {}, callback = p.callback || '';
  if (callback && !/^cme21_[a-f0-9]{32}$/.test(callback)) return json_({ok:false, error:'Invalid callback.'});
  try {
    if (p.studentCode || p.accessCode) fail_('Private requests must use POST.');
    if (p.action && p.action !== 'state') fail_('Unknown action.');
    return json_(locked_(() => state_('')), callback);
  } catch (err) { return json_(error_(err), callback); }
}
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 12000) fail_('Invalid request size.');
    let p; try { p = JSON.parse(raw); } catch (_) { fail_('Invalid JSON request.'); }
    if (!p || Array.isArray(p) || typeof p !== 'object') fail_('Invalid request.');
    return json_(locked_(() => {
      if (!['state','vote','withdraw','proposal'].includes(p.action)) fail_('Unknown action.');
      const student = authenticate_(p.studentCode, p.accessCode);
      if (p.action !== 'state') {
        if (typeof p.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(p.requestId)) fail_('A valid request identifier is required.');
        if (p.action === 'proposal') proposal_(student, p);
        else {
          if (!votingOpen_()) fail_('Voting is closed.', 'CLOSED');
          vote_(student, p.action === 'withdraw' ? '' : p.proposalId);
        }
        SpreadsheetApp.flush();
      }
      return {ok:true, requestId: p.requestId || null, state: state_(student)};
    }));
  } catch (err) { return json_(error_(err)); }
}
function authenticate_(id, pin) {
  if (typeof id !== 'string' || !eligibleIds_().includes(id) || typeof pin !== 'string' || !/^[A-Za-z0-9]{8,32}$/.test(pin)) fail_('Student ID or access code is incorrect, or the account is inactive.', 'AUTH');
  const cache = CacheService.getScriptCache(), key = 'failed-' + id, attempts = Number(cache.get(key) || 0);
  if (attempts >= 10) fail_('Too many unsuccessful attempts. Try again in 15 minutes or contact an organizer.', 'RATE');
  const students = rows_('Students').filter(row => text_(row[0]) === id);
  if (students.length !== 1 || !active_(students[0][3]) || text_(students[0][2]).trim().toUpperCase() !== pin.toUpperCase()) {
    cache.put(key, String(attempts + 1), 900); fail_('Student ID or access code is incorrect, or the account is inactive.', 'AUTH');
  }
  cache.remove(key); return id;
}
function state_(student) {
  const activeIds = new Set(rows_('Students').filter(r => active_(r[3]) && eligibleIds_().includes(text_(r[0]))).map(r => text_(r[0])));
  const proposals = rows_('Proposals'), approvedIds = new Set(proposals.filter(r => text_(r[7]).toLowerCase() === 'approved').map(r => text_(r[0])));
  const votes = new Map();
  rows_('Votes').forEach(r => { if (activeIds.has(text_(r[0]))) votes.set(text_(r[0]), text_(r[1])); });
  const totals = new Map(); votes.forEach(id => { if (approvedIds.has(id)) totals.set(id, (totals.get(id) || 0) + 1); });
  const publicProposals = [], pending = [];
  proposals.forEach(r => {
    const item = {id:text_(r[0]), proposedName:text_(r[1]), tagline:text_(r[2]), meaning:text_(r[3]), category:text_(r[4]), proposerName:text_(r[5]), createdAt:r[8] instanceof Date ? r[8].toISOString() : text_(r[8]), votes:totals.get(text_(r[0])) || 0};
    if (text_(r[7]).toLowerCase() === 'approved') publicProposals.push(item);
    else if (student && text_(r[6]) === student && text_(r[7]).toLowerCase() === 'pending') pending.push(item);
  });
  return {ok:true, authenticated:!!student, proposals:publicProposals, myVote:student && approvedIds.has(votes.get(student)) ? votes.get(student) : null, myPendingProposals:pending, eligibleCount:activeIds.size, votingOpen:votingOpen_(), updatedAt:new Date().toISOString()};
}
function vote_(student, proposalId) {
  if (typeof proposalId !== 'string' || proposalId.length > 100) fail_('Select a valid proposal.');
  if (proposalId && !rows_('Proposals').some(r => text_(r[0]) === proposalId && text_(r[7]).toLowerCase() === 'approved')) fail_('This proposal is not available for voting.');
  const sheet = sheet_('Votes'), values = sheet.getDataRange().getValues(), matches = [];
  values.slice(1).forEach((row,i) => { if (text_(row[0]) === student) matches.push(i + 2); });
  // Assignment, not toggle: retries for the same selection cannot withdraw a vote.
  if (proposalId) {
    const record = [student, proposalId, new Date()];
    if (matches.length) sheet.getRange(matches[0],1,1,3).setValues([record]); else sheet.appendRow(record);
    matches.slice(1).reverse().forEach(index => sheet.deleteRow(index));
  } else matches.reverse().forEach(index => sheet.deleteRow(index));
}
function field_(p, name, max, required) {
  if (p[name] != null && typeof p[name] !== 'string') fail_('Invalid ' + name + '.');
  const value = text_(p[name]).trim();
  if ((required && !value) || value.length > max) fail_(name + ' is required or exceeds its character limit.');
  return value;
}
// Prevent spreadsheet formulas (including leading control characters) in submitted text.
function cell_(value) { return typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value; }
function proposal_(student, p) {
  const name = field_(p,'proposedName',100,true), tagline = field_(p,'tagline',180,false), meaning = field_(p,'meaning',1500,true), proposer = field_(p,'proposerName',100,true), category = field_(p,'category',100,true);
  if (!CATEGORIES.includes(category)) fail_('Choose a supported category.');
  const rows = rows_('Proposals'), prior = rows.find(r => text_(r[0]) === p.requestId);
  if (prior) { if (text_(prior[6]) !== student) fail_('Request identifier already used.'); return; }
  // Stable request ID deduplicates retries after a timeout; also reject exact content duplicates.
  if (rows.some(r => text_(r[6]) === student && text_(r[1]).toLowerCase() === name.toLowerCase())) fail_('You have already submitted this name. Check your pending proposals.');
  if (rows.filter(r => text_(r[6]) === student && text_(r[7]).toLowerCase() === 'pending').length >= 5) fail_('You already have five proposals awaiting review. Wait for organizer feedback.');
  sheet_('Proposals').appendRow([p.requestId,cell_(name),cell_(tagline),cell_(meaning),category,cell_(proposer),student,'pending',new Date()]);
}
