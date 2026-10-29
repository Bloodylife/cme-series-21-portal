(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const API = String(window.CME21_CONFIG?.API_URL || '').trim();
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(API);
  let state = { proposals: [], myVote: null, myPendingProposals: [], authenticated: false, votingOpen: true };
  let credentials = null; // Memory only. Never place credentials in URLs or browser storage.
  let loaded = false, busy = false, refreshing = false, epoch = 0, toastTimer, modalReturn;
  let selected = new Set(), proposalAttempt = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count = value => Math.max(0, Number(value) || 0);
  const uid = () => crypto.randomUUID();
  // Remove credentials left behind by the previous starter version.
  try { sessionStorage.removeItem('cme21.studentCode.session.v1'); sessionStorage.removeItem('cme21.accessCode.session.v1'); } catch (_) {}

  function message(id, text, error = false) {
    const el = $(id); el.textContent = text; el.hidden = !text; el.classList.toggle('error', error);
  }
  function toast(text, error = false) {
    $('toastText').textContent = text; $('toast').hidden = false;
    $('toast').classList.toggle('error', error); $('toast').querySelector('.toast-mark').textContent = error ? '!' : '✓';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000);
  }
  function connection(label, detail, good = false) {
    $('connectionLabel').textContent = label; $('lastUpdated').textContent = detail;
    $('connectionBadge').classList.toggle('offline', !good);
  }
  function publicState() {
    return new Promise((resolve, reject) => {
      const name = 'cme21_' + uid().replaceAll('-', '');
      const script = document.createElement('script');
      const cleanup = () => { clearTimeout(timer); script.remove(); delete window[name]; };
      const timer = setTimeout(() => { cleanup(); reject(new Error('The service took too long to respond. Please refresh in a moment.')); }, 20000);
      window[name] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('Unable to connect. Check your connection and try Refresh.')); };
      script.src = API + '?action=state&callback=' + name; // Public information only.
      script.referrerPolicy = 'no-referrer'; document.head.append(script);
    });
  }
  async function privateRequest(payload, auth = credentials) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      // text/plain avoids a CORS preflight; follow ContentService's response redirect.
      // Never use no-cors: an opaque response cannot prove that a write succeeded.
      const response = await fetch(API, {
        method: 'POST', mode: 'cors', redirect: 'follow', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ ...payload, ...auth }), signal: controller.signal
      });
      if (!response.ok) throw new Error('The voting service returned an error.');
      const result = await response.json();
      if (!result || result.ok !== true) {
        const error = new Error(result?.error || 'The request was not accepted.'); error.code = result?.code; throw error;
      }
      if (!result.state || !Array.isArray(result.state.proposals) || !result.state.authenticated) throw new Error('The service response could not be verified.');
      if (payload.requestId && result.requestId !== payload.requestId) throw new Error('The request confirmation did not match.');
      return result.state;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('No confirmation received. A change may have reached the service. Refresh to check your selection before retrying.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function apply(next) {
    state = next; loaded = true;
    selected = new Set([...selected].filter(id => state.proposals.some(p => p.id === id)));
    connection(state.votingOpen ? 'CONNECTED' : 'VOTING CLOSED', 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), true);
    message('proposalError', ''); render();
  }
  async function refresh() {
    if (!configured || busy || refreshing) return false;
    refreshing = true; const version = epoch;
    $('refreshBtn').disabled = true; $('proposalGrid').setAttribute('aria-busy', 'true');
    if (!loaded) connection('CONNECTING', 'Loading the shortlist…');
    try {
      const next = credentials ? await privateRequest({ action: 'state' }) : await publicState();
      if (version !== epoch) return false;
      if (!next?.ok || !Array.isArray(next.proposals)) throw new Error(next?.error || 'The service response could not be read.');
      apply(next); return true;
    } catch (error) {
      if (version !== epoch) return false;
      if (error.code === 'AUTH') signOut(false);
      connection('OFFLINE', loaded ? 'Showing last confirmed results' : 'Connection unavailable');
      message('proposalError', error.message, true); render(); return false;
    } finally { refreshing = false; $('refreshBtn').disabled = !configured || busy; $('proposalGrid').setAttribute('aria-busy', 'false'); }
  }
  function modal(id) {
    modalReturn = document.activeElement; $(id).hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('main').inert = true; document.querySelector('header').inert = true; document.querySelector('footer').inert = true; $('compareBar').inert = true;
    const target = id === 'loginModal' ? $('studentCode') : $('closeCompareBtn'); target.focus();
  }
  function closeModal(id) {
    $(id).hidden = true; document.body.classList.remove('modal-open');
    document.querySelector('main').inert = false; document.querySelector('header').inert = false; document.querySelector('footer').inert = false; $('compareBar').inert = false;
    if (id === 'loginModal') $('accessCode').value = '';
    if (modalReturn?.isConnected) modalReturn.focus();
  }
  function openLogin() {
    if (!configured) return toast('Student access will open when the organizers connect the voting service.', true);
    message('loginMessage', ''); modal('loginModal');
  }
  function signOut(notify = true) {
    credentials = null; epoch++; state = { ...state, authenticated: false, myVote: null, myPendingProposals: [] };
    $('loginForm').reset(); proposalAttempt = null; render();
    if (notify) toast('Signed out. Your saved vote stays in the shared results.');
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['loginBtn','submitProposalBtn','headerAccountBtn','footerAccountBtn','withdrawBtn']) $(id).disabled = value || (!configured && id === 'submitProposalBtn');
    $('refreshBtn').disabled = value || refreshing || !configured;
    document.querySelectorAll('[data-vote]').forEach(el => { el.disabled = value || !state.votingOpen || el.dataset.vote === state.myVote; });
  }
  function comparisonControls() {
    $('compareBar').hidden = selected.size === 0; $('compareCount').textContent = selected.size;
    $('compareBtn').disabled = selected.size < 2;
    document.querySelectorAll('[data-compare]').forEach(input => { input.checked = selected.has(input.dataset.compare); input.disabled = !input.checked && selected.size === 3; });
  }
  function render() {
    const proposals = state.proposals || [], total = proposals.reduce((sum,p) => sum + count(p.votes), 0);
    const current = proposals.find(p => p.id === state.myVote);
    $('statProposals').textContent = loaded ? proposals.length : '—'; $('statVotes').textContent = loaded ? total : '—';
    $('participationNote').textContent = loaded ? total + ' of ' + (state.eligibleCount ?? 59) + ' eligible students' : 'Shared results, across every device';
    $('statMyVote').textContent = state.authenticated ? (current ? '01' : '00') : '—';
    $('myVoteNote').textContent = state.authenticated ? (current?.proposedName || 'Your choice is still open') : 'Sign in to see your selection';
    $('headerAccountBtn').textContent = credentials ? 'Sign out · ' + credentials.studentCode : 'Student access';
    $('footerAccountBtn').textContent = credentials ? 'Sign out' : 'Student access';
    $('currentVotePanel').hidden = !current || !state.authenticated;
    $('currentVoteName').textContent = current?.proposedName || '';
    $('currentVotePanel').querySelector('p').textContent = state.votingOpen ? 'Select another name at any time while voting is open.' : 'Voting is closed. Your choice is recorded.';
    $('withdrawBtn').hidden = !state.votingOpen;
    const term = $('searchInput').value.trim().toLocaleLowerCase(), category = $('categoryFilter').value;
    const visible = proposals.filter(p => (!category || p.category === category) && [p.proposedName,p.meaning,p.tagline].some(v => String(v || '').toLocaleLowerCase().includes(term)));
    const sort = $('sortSelect').value;
    visible.sort((a,b) => sort === 'name' ? a.proposedName.localeCompare(b.proposedName) : sort === 'newest' ? (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) : count(b.votes) - count(a.votes) || a.proposedName.localeCompare(b.proposedName));
    $('resultCount').textContent = loaded ? visible.length + ' of ' + proposals.length + ' approved proposals' : 'The next chapter starts with an idea.';
    if (!visible.length) {
      const title = !configured ? 'A shared identity is taking shape.' : !loaded ? 'Waiting for the shortlist' : proposals.length ? 'No names match just yet.' : 'The first idea could be yours.';
      const copy = !configured ? 'The portal is ready for its shared voting service. Once connected, approved names and confirmed results will appear here.' : !loaded ? 'Use Refresh to try connecting again. Results will only appear after the service confirms them.' : proposals.length ? 'Try a different keyword or explore all categories.' : 'Submit a name with a meaning that brings us together. Approved proposals will appear here.';
      $('proposalGrid').innerHTML = '<div class="empty-state"><div class="empty-symbol" aria-hidden="true">◇</div><h3>' + title + '</h3><p>' + copy + '</p>' + (loaded && proposals.length ? '<button class="button button-outline" id="resetFilters" type="button">Clear filters</button>' : '<a class="button button-outline" href="#submit">Explore the proposal form ↗</a>') + '</div>';
      $('resetFilters')?.addEventListener('click', () => { $('searchInput').value = ''; $('categoryFilter').value = ''; render(); $('searchInput').focus(); });
    } else {
      $('proposalGrid').innerHTML = visible.map(p => {
        const chosen = state.authenticated && state.myVote === p.id, percent = total ? Math.round(count(p.votes) / total * 100) : 0;
        return '<article class="proposal-card ' + (chosen ? 'selected' : '') + '"><div class="card-top"><span class="category-pill">' + esc(p.category) + '</span><span class="vote-count">' + (chosen ? '✓ YOUR CHOICE' : 'CME ’21') + '</span></div><h3>' + esc(p.proposedName) + '</h3>' + (p.tagline ? '<p class="proposal-tagline">“' + esc(p.tagline) + '”</p>' : '') + '<p class="proposal-meaning" tabindex="0" aria-label="Proposal meaning">' + esc(p.meaning) + '</p><div class="card-bottom"><div class="vote-details"><span>' + count(p.votes) + (count(p.votes) === 1 ? ' vote' : ' votes') + '</span><span>' + percent + '% of votes</span></div><div class="vote-meter" aria-hidden="true"><span style="width:' + percent + '%"></span></div><div class="card-footer"><span class="proposer">' + (p.proposerName ? 'Proposed by ' + esc(p.proposerName) : 'CME Series ’21') + '</span><div class="card-actions"><label class="compare-toggle"><input type="checkbox" data-compare="' + esc(p.id) + '" aria-label="Compare ' + esc(p.proposedName) + '"> Compare</label><button type="button" class="vote-button ' + (chosen ? 'is-selected' : '') + '" data-vote="' + esc(p.id) + '" aria-pressed="' + chosen + '">' + (chosen ? '✓ Your vote' : state.votingOpen ? 'Choose this name ↗' : 'Voting closed') + '</button></div></div></div></article>';
      }).join('');
    }
    const pending = state.myPendingProposals || [];
    $('mySubmissions').hidden = !state.authenticated || !pending.length;
    $('pendingList').innerHTML = pending.map(p => '<article class="pending-item"><div><h3>' + esc(p.proposedName) + '</h3><p>' + esc(p.meaning) + '</p></div><span class="pending-badge">Pending review</span></article>').join('');
    comparisonControls(); setBusy(busy);
  }
  async function vote(proposalId) {
    if (busy || refreshing || !state.votingOpen) return;
    if (!credentials) return openLogin();
    if (proposalId && proposalId === state.myVote) return;
    epoch++; setBusy(true); message('proposalError', '');
    try {
      const next = await privateRequest({ action: proposalId ? 'vote' : 'withdraw', proposalId, requestId: uid() });
      if ((next.myVote || null) !== (proposalId || null)) throw new Error('The service did not confirm this selection. Please refresh.');
      apply(next); toast(proposalId ? 'Your choice is saved. Every voice counts.' : 'Your vote has been withdrawn.');
    } catch (error) { if (error.code === 'AUTH') signOut(false); message('proposalError', error.message, true); toast(error.message, true); }
    finally { setBusy(false); }
  }
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !configured) return;
    const auth = { studentCode: $('studentCode').value.trim(), accessCode: $('accessCode').value.trim().toUpperCase() };
    epoch++; setBusy(true); $('loginBtn').textContent = 'Verifying…'; message('loginMessage', '');
    try {
      const next = await privateRequest({ action: 'state' }, auth);
      credentials = auth; apply(next); closeModal('loginModal'); toast('Welcome back. Your voice belongs here.');
    } catch (error) { message('loginMessage', error.message, true); }
    finally { setBusy(false); $('loginBtn').textContent = 'Verify & continue →'; }
  });
  $('proposalForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || refreshing) return;
    if (!credentials) { message('proposalFormMessage', 'Sign in first, then submit your idea. Your form will stay here.'); return openLogin(); }
    const fields = Object.fromEntries([...new FormData(event.target)].map(([k,v]) => [k,String(v).trim()]));
    const fingerprint = JSON.stringify(fields);
    if (!proposalAttempt || proposalAttempt.fingerprint !== fingerprint) proposalAttempt = { fingerprint, requestId: uid() };
    epoch++; setBusy(true); $('submitProposalBtn').textContent = 'Submitting…'; message('proposalFormMessage','');
    try {
      const next = await privateRequest({ action: 'proposal', ...fields, requestId: proposalAttempt.requestId });
      apply(next); event.target.reset(); proposalAttempt = null; $('meaningCount').textContent = '0 / 1500';
      message('proposalFormMessage', 'Your idea is saved and awaiting review. Thank you for helping shape our identity.'); toast('Proposal submitted for review.');
    } catch (error) { if (error.code === 'AUTH') signOut(false); message('proposalFormMessage', error.message, true); }
    finally { setBusy(false); $('submitProposalBtn').textContent = 'Submit for review ↗'; }
  });
  for (const id of ['headerAccountBtn','footerAccountBtn']) $(id).addEventListener('click', () => credentials ? signOut() : openLogin());
  $('refreshBtn').addEventListener('click', async () => { if (await refresh()) toast('Shared results are up to date.'); });
  $('withdrawBtn').addEventListener('click', () => vote(''));
  for (const id of ['searchInput','categoryFilter','sortSelect']) $(id).addEventListener(id === 'searchInput' ? 'input' : 'change', render);
  $('meaning').addEventListener('input', () => { $('meaningCount').textContent = $('meaning').value.length + ' / 1500'; });
  $('proposalGrid').addEventListener('click', event => { const button = event.target.closest('[data-vote]'); if (button) vote(button.dataset.vote); });
  $('proposalGrid').addEventListener('change', event => {
    const input = event.target.closest('[data-compare]'); if (!input) return;
    if (input.checked && selected.size < 3) selected.add(input.dataset.compare); else selected.delete(input.dataset.compare);
    comparisonControls();
  });
  $('clearCompareBtn').addEventListener('click', () => { selected.clear(); comparisonControls(); });
  $('compareBtn').addEventListener('click', () => {
    const items = state.proposals.filter(p => selected.has(p.id)); if (items.length < 2) return;
    $('compareGrid').style.setProperty('--columns', items.length);
    $('compareGrid').innerHTML = items.map(p => '<article><span class="category-pill">' + esc(p.category) + '</span><h3>' + esc(p.proposedName) + '</h3><h4>Tagline</h4><p>' + esc(p.tagline || 'No tagline provided') + '</p><h4>Meaning & rationale</h4><p>' + esc(p.meaning) + '</p><h4>Shared support</h4><p>' + count(p.votes) + ' votes</p></article>').join(''); modal('compareModal');
  });
  for (const [id,close] of [['loginModal','closeLoginBtn'],['compareModal','closeCompareBtn']]) {
    $(close).addEventListener('click', () => closeModal(id));
    $(id).addEventListener('click', event => { if (event.target === $(id)) closeModal(id); });
  }
  document.addEventListener('keydown', event => {
    const current = ['loginModal','compareModal'].find(id => !$(id).hidden); if (!current) return;
    if (event.key === 'Escape') closeModal(current);
    if (event.key === 'Tab') {
      const focusable = [...$(current).querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => connection('OFFLINE', 'Reconnect to get the latest results'));
  $('setupNotice').hidden = configured;
  if (!configured) connection('NOT CONNECTED', 'Awaiting organizer setup');
  render(); if (configured) refresh();
  setInterval(() => { if (!document.hidden && $('compareModal').hidden && $('loginModal').hidden) refresh(); }, 30000);
})();
