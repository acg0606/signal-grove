import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, MAX_CONNECTION, REPLAY_SCHEMA, canonicalReceipt, createSession, fingerprintReceipt, missingAction, previewIntents, resolveTurn, runGuidedReplay, verifyReplayProof } from '../core.mjs';

test('new session is deterministic and honestly local', () => {
  assert.deepEqual(createSession('abc'), createSession('abc'));
  assert.equal(createSession('abc').status, 'IN_PROGRESS');
});

test('seed validation fails closed', () => {
  assert.throws(() => createSession('x'), /between 3 and 80/);
  assert.throws(() => createSession(123), /between 3 and 80/);
});

test('companion intents are deterministic per seed and round', () => {
  const state = createSession('test-seed');
  assert.deepEqual(previewIntents(state), previewIntents(state));
  assert.equal(previewIntents(state).length, 2);
});

test('missingAction supplies an uncovered role', () => {
  assert.equal(missingAction(['listen', 'build']), 'invite');
  assert.ok(ACTIONS.some(({ id }) => id === missingAction(['listen', 'listen'])));
});

test('full spectrum scores above shared rhythm and echo loop', () => {
  const state = createSession('signal-grove-demo');
  const intents = previewIntents(state);
  const full = resolveTurn(state, missingAction(intents));
  const pair = resolveTurn(state, intents[0]);
  const repeatedSignalState = full;
  const repeatedIntents = previewIntents(repeatedSignalState);
  assert.equal(new Set(repeatedIntents).size, 1, 'the plan must expose a repeated-signal decision');
  const shared = resolveTurn(repeatedSignalState, missingAction(repeatedIntents));
  const echo = resolveTurn(repeatedSignalState, repeatedIntents[0]);
  assert.ok(full.history[0].connectionDelta > pair.history[0].connectionDelta);
  assert.ok(shared.history[1].connectionDelta > echo.history[1].connectionDelta);
  assert.equal(full.history[0].pattern, 'FULL_SPECTRUM');
  assert.equal(shared.history[1].pattern, 'SHARED_RHYTHM');
  assert.equal(echo.history[1].pattern, 'ECHO_LOOP');
});

test('unknown actions and post-completion moves are rejected', () => {
  assert.throws(() => resolveTurn(createSession(), 'pay'), /Unknown action/);
  const complete = runGuidedReplay();
  assert.throws(() => resolveTurn(complete, 'listen'), /already complete/);
});

test('guided replay reaches the strongest outcome in exactly four rounds', () => {
  const result = runGuidedReplay('signal-grove-demo');
  assert.equal(result.round, 4);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.outcome, 'COMMONS_AWAKE');
  assert.equal(result.connection, MAX_CONNECTION);
  assert.deepEqual(result.history.map(({ pattern }) => pattern), ['FULL_SPECTRUM', 'SHARED_RHYTHM', 'FULL_SPECTRUM', 'FULL_SPECTRUM']);
});

test('all three outcome bands are reachable', () => {
  const awake = runGuidedReplay('signal-grove-demo');
  let fragile = createSession('signal-grove-demo');
  while (fragile.status !== 'COMPLETE') fragile = resolveTurn(fragile, previewIntents(fragile)[0]);
  let forming = createSession('signal-grove-demo');
  while (forming.status !== 'COMPLETE') forming = resolveTurn(forming, 'listen');
  assert.equal(awake.outcome, 'COMMONS_AWAKE');
  assert.equal(fragile.outcome, 'CIRCLE_NEEDS_CARE');
  assert.equal(fragile.connection, 27);
  assert.equal(forming.outcome, 'COMMONS_FORMING');
});

test('receipt is blocked until completion', () => {
  assert.throws(() => canonicalReceipt(createSession()), /only be generated/);
});

test('receipt embeds truth labels and deterministic SHA-256', async () => {
  const receipt = canonicalReceipt(runGuidedReplay('receipt-seed'));
  assert.equal(receipt.schema, REPLAY_SCHEMA);
  assert.equal(receipt.mode, 'DEMO_REPLAY');
  assert.equal(receipt.integrationStatus, 'NOT_CONNECTED');
  assert.equal(receipt.externalConnections, false);
  const first = await fingerprintReceipt(receipt);
  const second = await fingerprintReceipt(receipt);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test('receipt rejects a forged complete state', () => {
  const forged = { ...createSession('forged-seed'), round: 4, status: 'COMPLETE', outcome: 'COMMONS_AWAKE', connection: 999, history: [] };
  assert.throws(() => canonicalReceipt(forged), /counters are inconsistent|semantic reconstruction/);
});

test('proof verification accepts valid evidence and rejects semantic tampering even when rehashed', async () => {
  const receipt = canonicalReceipt(runGuidedReplay('proof-seed'));
  const proof = { ...receipt, fingerprint: await fingerprintReceipt(receipt) };
  assert.deepEqual(await verifyReplayProof(proof), { valid: true, reason: 'VERIFIED', fingerprint: proof.fingerprint });

  const alteredReceipt = { ...receipt, connection: receipt.connection + 1 };
  const rehashed = { ...alteredReceipt, fingerprint: await fingerprintReceipt(alteredReceipt) };
  assert.deepEqual(await verifyReplayProof(rehashed), { valid: false, reason: 'REPLAY_SEMANTICS_INVALID' });
  assert.deepEqual(await verifyReplayProof({ ...proof, fingerprint: '0'.repeat(64) }), { valid: false, reason: 'FINGERPRINT_MISMATCH' });
});

test('different replay choices alter the evidence fingerprint', async () => {
  const guided = canonicalReceipt(runGuidedReplay('fingerprint-seed'));
  let alternate = createSession('fingerprint-seed');
  while (alternate.status !== 'COMPLETE') alternate = resolveTurn(alternate, 'listen');
  assert.notEqual(await fingerprintReceipt(guided), await fingerprintReceipt(canonicalReceipt(alternate)));
});
