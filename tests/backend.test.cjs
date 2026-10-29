const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createHarness} = require('./harness.cjs');
function fixture() {
  const h = createHarness(); h.setup();
  const row = h.ss.getSheetByName('Students').data[1];
  h.auth = {studentCode:row[0],accessCode:row[2]};
  h.request = p => h.post({...h.auth,requestId:randomUUID(),...p});
  h.idea = p => h.request({action:'proposal',proposedName:'Test alloy',tagline:'Together',meaning:'A test proposal.',category:'Materials science',proposerName:'Test author',...p});
  h.approve = () => { h.ss.getSheetByName('Proposals').data.slice(1).forEach(r => r[7] = 'approved'); };
  return h;
}
test('59 distinct eligible IDs, excluded ID absent, unique nonempty credentials, no invented names', () => {
  const h = fixture(), rows = h.ss.getSheetByName('Students').data.slice(1);
  assert.equal(rows.length,59); assert.equal(new Set(rows.map(r=>r[0])).size,59);
  assert.equal(new Set(rows.map(r=>r[2])).size,59); assert.ok(rows.every(r=>r[2].length===20 && r[1]==='' && r[3]===true));
  assert.ok(!rows.some(r=>r[0]==='2106045')); assert.equal(rows[0][0],'2106001'); assert.equal(rows.at(-1)[0],'2106060');
});
test('setup preserves valid existing names, credentials, inactive status and records', () => {
  const h = fixture(), row = h.ss.getSheetByName('Students').data[1]; row[1]='Existing name'; row[3]=false;
  const before = JSON.stringify(h.ss.sheets); h.setup(); assert.equal(JSON.stringify(h.ss.sheets),before);
});
test('setup backs up nonempty tables before adding missing roster records', () => {
  const h = fixture(); h.ss.getSheetByName('Students').data.pop(); h.setup();
  assert.ok(h.ss.sheets.some(s=>s.name.startsWith('Backup-Students-'))); assert.equal(h.ss.getSheetByName('Students').data.length,60);
});
test('schema mismatch is rejected before any table is changed', () => {
  const h = fixture(); h.ss.getSheetByName('Students').data[0][0]='wrong'; const before=JSON.stringify(h.ss.sheets);
  assert.throws(()=>h.setup(),/Schema/); assert.equal(JSON.stringify(h.ss.sheets),before);
});
test('duplicate existing student or credential fails without data loss', () => {
  const h = fixture(), rows=h.ss.getSheetByName('Students').data; rows[2][2]=rows[1][2];
  const before=JSON.stringify(rows); assert.throws(()=>h.setup(),/credential/); assert.equal(JSON.stringify(rows),before);
});
test('valid authentication succeeds; wrong, inactive, excluded and oversized credentials fail', () => {
  const h=fixture(); assert.equal(h.request({action:'state'}).state.authenticated,true);
  for (const data of [{accessCode:'WRONGCODE123'},{studentCode:'2106045'},{accessCode:'X'.repeat(33)}]) assert.equal(h.request({action:'state',...data}).ok,false);
  h.ss.getSheetByName('Students').data[1][3]=false; assert.equal(h.request({action:'state'}).code,'AUTH');
});
test('failed authentication attempts are throttled', () => {
  const h=fixture(); for(let i=0;i<10;i++) h.request({action:'state',accessCode:'WRONGCODE123'});
  assert.equal(h.request({action:'state'}).code,'RATE');
});
test('pending proposal is private; approval exposes only allowed public fields', () => {
  const h=fixture(); assert.equal(h.idea().state.myPendingProposals.length,1);
  assert.equal(JSON.parse(h.get().body).proposals.length,0); h.approve();
  const result=JSON.parse(h.get().body); assert.equal(result.proposals.length,1); assert.equal(result.authenticated,false);
  assert.equal(result.myPendingProposals.length,0); assert.equal(result.myVote,null);
  assert.ok(!h.get().body.includes(h.auth.accessCode)); assert.ok(!h.get().body.includes(h.auth.studentCode));
  assert.equal(result.proposals[0].studentId,undefined);
});
test('GET rejects credentials and callback injection; public JSONP works', () => {
  const h=fixture(); assert.equal(JSON.parse(h.get(h.auth).body).ok,false);
  assert.equal(h.get({callback:'alert(1)//'}).type,'json');
  assert.ok(h.get({callback:'cme21_'+'a'.repeat(32)}).body.startsWith('cme21_'));
});
test('pending and rejected proposals cannot receive votes', () => {
  const h=fixture(), id=randomUUID(); h.idea({requestId:id}); assert.equal(h.request({action:'vote',proposalId:id}).ok,false);
  h.ss.getSheetByName('Proposals').data[1][7]='rejected'; assert.equal(h.request({action:'vote',proposalId:id}).ok,false);
});
test('repeat vote is idempotent; change replaces choice; withdrawal is explicit', () => {
  const h=fixture(), a=randomUUID(), b=randomUUID(); h.idea({requestId:a}); h.idea({requestId:b,proposedName:'Test crystal'}); h.approve();
  for(let i=0;i<12;i++) assert.equal(h.request({action:'vote',proposalId:a}).state.myVote,a);
  assert.equal(h.ss.getSheetByName('Votes').data.length,2);
  const changed=h.request({action:'vote',proposalId:b}).state; assert.equal(changed.myVote,b);
  assert.equal(changed.proposals.find(p=>p.id===a).votes,0); assert.equal(changed.proposals.find(p=>p.id===b).votes,1);
  assert.equal(h.request({action:'withdraw'}).state.myVote,null); assert.equal(h.ss.getSheetByName('Votes').data.length,1);
});
test('another client receives authoritative changed totals', () => {
  const h=fixture(), id=randomUUID(); h.idea({requestId:id}); h.approve(); h.request({action:'vote',proposalId:id});
  assert.equal(JSON.parse(h.get().body).proposals[0].votes,1);
});
test('duplicate legacy vote rows count once and are repaired on write', () => {
  const h=fixture(), id=randomUUID(); h.idea({requestId:id}); h.approve();
  const s=h.ss.getSheetByName('Votes'); s.appendRow([h.auth.studentCode,id,new Date()]); s.appendRow([h.auth.studentCode,id,new Date()]);
  assert.equal(JSON.parse(h.get().body).proposals[0].votes,1); h.request({action:'vote',proposalId:id}); assert.equal(s.data.length,2);
});
test('inactive students and unapproved names are excluded from aggregate results', () => {
  const h=fixture(), id=randomUUID(); h.idea({requestId:id}); h.approve(); h.request({action:'vote',proposalId:id});
  h.ss.getSheetByName('Students').data[1][3]=false; assert.equal(JSON.parse(h.get().body).proposals[0].votes,0);
});
test('proposal retry with same request ID creates one record', () => {
  const h=fixture(), id=randomUUID(); h.idea({requestId:id}); h.idea({requestId:id});
  assert.equal(h.ss.getSheetByName('Proposals').data.length,2);
});
test('duplicate names and sixth pending proposal are rejected', () => {
  const h=fixture(); h.idea(); assert.equal(h.idea().ok,false);
  for(let i=1;i<5;i++) assert.equal(h.idea({proposedName:'Test '+i}).ok,true);
  assert.equal(h.idea({proposedName:'Sixth'}).ok,false);
});
test('length limits, categories, malformed JSON and unsupported actions are rejected', () => {
  const h=fixture(); for(const p of [{meaning:'a'.repeat(1501)},{tagline:'a'.repeat(181)},{proposedName:''},{category:'bad'},{proposerName:'a'.repeat(101)},{meaning:{bad:true}}]) assert.equal(h.idea(p).ok,false);
  assert.equal(h.request({action:'approve'}).ok,false);
  assert.equal(JSON.parse(h.context.doPost({postData:{contents:'{bad'}}).body).ok,false);
  assert.equal(h.ss.getSheetByName('Proposals').data.length,1);
});
test('spreadsheet formula strings are escaped before storage', () => {
  const h=fixture(); assert.equal(h.context.cell_('=IMPORTXML("x")'),"'=IMPORTXML(\"x\")");
  assert.equal(h.context.cell_(' \t+1'),"' \t+1"); assert.equal(h.context.cell_('normal'),'normal');
});
test('closed poll rejects writes but still permits reads and proposals', () => {
  const h=fixture(); h.properties.set('VOTING_OPEN','false');
  assert.equal(h.request({action:'vote',proposalId:'x'}).code,'CLOSED'); assert.equal(h.idea().ok,true); assert.equal(JSON.parse(h.get().body).votingOpen,false);
});
test('lock contention returns a retryable error without mutating records', () => {
  const h=fixture(); h.holdLock(true); const before=JSON.stringify(h.ss.sheets);
  assert.equal(h.idea().code,'BUSY'); assert.equal(JSON.stringify(h.ss.sheets),before);
});
test('unexpected backend error never exposes internal records or exception text', () => {
  const h=fixture(); h.ss.getSheetByName('Votes').data[0]=['broken'];
  const result=h.request({action:'state'}); assert.equal(result.code,'SERVER'); assert.ok(!result.error.includes('Schema'));
});
