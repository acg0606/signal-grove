import { ACTIONS, MAX_CONNECTION, actionById, canonicalReceipt, createSession, fingerprintReceipt, previewIntents, resolveTurn, runGuidedReplay } from './core.mjs';

const elements = {
  round: document.querySelector('#round-number'),
  status: document.querySelector('#session-status'),
  intentA: document.querySelector('#intent-a'),
  intentB: document.querySelector('#intent-b'),
  connection: document.querySelector('#connection-value'),
  connectionMeter: document.querySelector('#connection-meter'),
  trust: document.querySelector('#trust-value'),
  trustMeter: document.querySelector('#trust-meter'),
  momentum: document.querySelector('#momentum-value'),
  momentumMeter: document.querySelector('#momentum-meter'),
  history: document.querySelector('#history-list'),
  feedback: document.querySelector('#turn-feedback'),
  actions: [...document.querySelectorAll('[data-action]')],
  restart: document.querySelector('#restart'),
  guidedReplay: document.querySelector('#guided-replay'),
  outcome: document.querySelector('#outcome-card'),
  outcomeTitle: document.querySelector('#outcome-title'),
  outcomeCopy: document.querySelector('#outcome-copy'),
  generateProof: document.querySelector('#generate-proof'),
  exportProof: document.querySelector('#export-proof'),
  proofPanel: document.querySelector('#proof-panel'),
  proofFingerprint: document.querySelector('#proof-fingerprint'),
  seedCore: document.querySelector('.seed-core span'),
  toast: document.querySelector('#toast')
};

let session = createSession();
let proof = null;
let toastTimer;

function labelFor(id) {
  return actionById(id)?.short || id;
}

function outcomeContent(outcome) {
  if (outcome === 'COMMONS_AWAKE') return ['The commons is awake.', 'The group covered the complete social spectrum often enough to wake the grove.'];
  if (outcome === 'COMMONS_FORMING') return ['The commons is forming.', 'The group found a rhythm. A more varied set of roles would make the circle stronger.'];
  return ['The circle needs care.', 'The group echoed itself too often. Replay and choose the role your companions are not covering.'];
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2600);
}

function render() {
  const intents = previewIntents(session);
  const displayRound = session.status === 'COMPLETE' ? session.maxRounds : session.round + 1;
  elements.round.textContent = String(displayRound);
  elements.status.textContent = session.status === 'COMPLETE' ? 'REPLAY COMPLETE' : 'IN PROGRESS';
  elements.intentA.textContent = intents[0] ? labelFor(intents[0]) : 'Complete';
  elements.intentB.textContent = intents[1] ? labelFor(intents[1]) : 'Complete';
  elements.connection.textContent = String(session.connection);
  elements.connectionMeter.value = session.connection;
  elements.connectionMeter.max = MAX_CONNECTION;
  elements.connectionMeter.textContent = `${session.connection} of ${MAX_CONNECTION}`;
  elements.connectionMeter.setAttribute('aria-label', `Connection ${session.connection} of ${MAX_CONNECTION}`);
  elements.trust.textContent = String(session.trust);
  elements.trustMeter.value = session.trust;
  elements.trustMeter.textContent = `${session.trust} of 60`;
  elements.trustMeter.setAttribute('aria-label', `Trust ${session.trust} of 60`);
  elements.momentum.textContent = String(session.momentum);
  elements.momentumMeter.value = session.momentum;
  elements.momentumMeter.textContent = `${session.momentum} of 60`;
  elements.momentumMeter.setAttribute('aria-label', `Momentum ${session.momentum} of 60`);
  elements.seedCore.textContent = String(session.connection);

  elements.actions.forEach((button) => { button.disabled = session.status === 'COMPLETE'; });
  if (session.history.length === 0) {
    elements.history.innerHTML = '<li class="empty-history">No moves yet. Your first choice becomes shared memory.</li>';
  } else {
    elements.history.replaceChildren(...session.history.map((turn) => {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = `R${turn.round} · ${turn.pattern.replaceAll('_', ' ')}`;
      item.append(strong, document.createTextNode(` · you chose ${labelFor(turn.playerAction)}`));
      return item;
    }));
  }

  elements.outcome.hidden = session.status !== 'COMPLETE';
  if (session.status === 'COMPLETE') {
    const [title, copy] = outcomeContent(session.outcome);
    elements.outcomeTitle.textContent = title;
    elements.outcomeCopy.textContent = copy;
  }
}

function reset() {
  session = createSession();
  proof = null;
  elements.feedback.textContent = 'Read the two signals, then add the social role the circle is missing.';
  elements.proofPanel.hidden = true;
  elements.exportProof.disabled = true;
  elements.proofFingerprint.textContent = '';
  render();
}

elements.actions.forEach((button) => {
  button.addEventListener('click', () => {
    session = resolveTurn(session, button.dataset.action);
    const lastTurn = session.history.at(-1);
    elements.feedback.textContent = lastTurn.message;
    showToast(`Round ${lastTurn.round}: ${lastTurn.pattern.replaceAll('_', ' ').toLowerCase()}`);
    render();
    if (session.status === 'COMPLETE') elements.outcome.focus();
  });
});

elements.restart.addEventListener('click', reset);
elements.guidedReplay.addEventListener('click', () => {
  session = runGuidedReplay();
  proof = null;
  elements.feedback.textContent = 'Guided replay complete: every move supplied the missing social role.';
  elements.proofPanel.hidden = true;
  elements.exportProof.disabled = true;
  render();
  elements.outcome.focus();
  showToast('Guided replay completed locally');
});

elements.generateProof.addEventListener('click', async () => {
  const receipt = canonicalReceipt(session);
  const fingerprint = await fingerprintReceipt(receipt);
  proof = { ...receipt, fingerprint };
  elements.proofFingerprint.textContent = fingerprint;
  elements.proofPanel.hidden = false;
  elements.exportProof.disabled = false;
  showToast('Local replay proof generated · no external request');
});

elements.exportProof.addEventListener('click', () => {
  if (!proof) return;
  const blob = new Blob([`${JSON.stringify(proof, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'signal-grove-demo-replay.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

render();

// Exposed only for deterministic local browser verification.
window.__SIGNAL_GROVE__ = Object.freeze({ mode: 'DEMO_REPLAY', externalConnections: false, getSession: () => session, actions: ACTIONS });
