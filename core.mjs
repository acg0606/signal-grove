export const ACTIONS = Object.freeze([
  Object.freeze({ id: 'listen', label: 'Listen closely', short: 'Listen', glyph: '◌', description: 'Make room for a quieter signal.' }),
  Object.freeze({ id: 'invite', label: 'Invite someone in', short: 'Invite', glyph: '＋', description: 'Open the circle to a new voice.' }),
  Object.freeze({ id: 'build', label: 'Build together', short: 'Build', glyph: '◇', description: 'Turn the group intent into a shared object.' })
]);

export const REPLAY_SCHEMA = 'signal-grove-replay/v2';
export const MAX_ROUNDS = 4;
export const MAX_CONNECTION = 50;

const ACTION_IDS = new Set(ACTIONS.map(({ id }) => id));
const COMPANION_PLANS = Object.freeze([
  Object.freeze([['listen', 'build'], ['invite', 'invite'], ['build', 'invite'], ['listen', 'invite']]),
  Object.freeze([['invite', 'listen'], ['build', 'build'], ['listen', 'build'], ['invite', 'build']]),
  Object.freeze([['build', 'invite'], ['listen', 'listen'], ['invite', 'listen'], ['build', 'listen']])
]);

function seedIndex(seed) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % COMPANION_PLANS.length;
}

export function actionById(id) {
  return ACTIONS.find((action) => action.id === id);
}

export function createSession(seed = 'signal-grove-demo') {
  if (typeof seed !== 'string' || seed.trim().length < 3 || seed.length > 80) {
    throw new TypeError('Seed must be a string between 3 and 80 characters.');
  }
  return Object.freeze({
    seed: seed.trim(),
    round: 0,
    maxRounds: MAX_ROUNDS,
    connection: 0,
    trust: 18,
    momentum: 18,
    history: Object.freeze([]),
    status: 'IN_PROGRESS',
    outcome: null
  });
}

export function previewIntents(session) {
  assertSession(session);
  if (session.status === 'COMPLETE') return Object.freeze([]);
  const plan = COMPANION_PLANS[seedIndex(session.seed)];
  return Object.freeze([...plan[session.round]]);
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function assertSession(session) {
  if (!session || typeof session !== 'object' || !Number.isInteger(session.round) || !Array.isArray(session.history)) {
    throw new TypeError('A valid Signal Grove session is required.');
  }
  if (session.maxRounds !== MAX_ROUNDS || session.round < 0 || session.round > MAX_ROUNDS || session.history.length !== session.round) {
    throw new TypeError('Signal Grove session counters are inconsistent.');
  }
}

export function resolveTurn(session, playerAction) {
  assertSession(session);
  if (session.status === 'COMPLETE') throw new Error('The session is already complete. Restart before choosing another action.');
  if (!ACTION_IDS.has(playerAction)) throw new RangeError(`Unknown action: ${String(playerAction)}`);

  const companions = previewIntents(session);
  const actions = [playerAction, ...companions];
  const unique = new Set(actions).size;
  const counts = Object.fromEntries(ACTIONS.map(({ id }) => [id, actions.filter((action) => action === id).length]));
  let connectionDelta;
  let pattern;
  let message;

  if (unique === 3) {
    connectionDelta = 14;
    pattern = 'FULL_SPECTRUM';
    message = 'Full spectrum: every role had room, so the circle became stronger.';
  } else if (unique === 2) {
    connectionDelta = 8;
    pattern = 'SHARED_RHYTHM';
    message = 'Shared rhythm: the group aligned, but one social need remained uncovered.';
  } else {
    connectionDelta = 3;
    pattern = 'ECHO_LOOP';
    message = 'Echo loop: everyone repeated the same move. The circle needs a different voice.';
  }

  const trustDelta = counts.listen * 2 + (pattern === 'FULL_SPECTRUM' ? 2 : 0);
  const momentumDelta = counts.build * 2 + counts.invite + (pattern === 'FULL_SPECTRUM' ? 2 : 0);
  const nextRound = session.round + 1;
  const connection = clamp(session.connection + connectionDelta);
  const trust = clamp(session.trust + trustDelta);
  const momentum = clamp(session.momentum + momentumDelta);
  const isComplete = nextRound >= session.maxRounds;
  const outcome = isComplete
    ? connection >= 48
      ? 'COMMONS_AWAKE'
      : connection >= 28
        ? 'COMMONS_FORMING'
        : 'CIRCLE_NEEDS_CARE'
    : null;
  const turn = Object.freeze({
    round: nextRound,
    playerAction,
    companionActions: Object.freeze([...companions]),
    pattern,
    connectionDelta,
    trustDelta,
    momentumDelta,
    message
  });

  return Object.freeze({
    ...session,
    round: nextRound,
    connection,
    trust,
    momentum,
    history: Object.freeze([...session.history, turn]),
    status: isComplete ? 'COMPLETE' : 'IN_PROGRESS',
    outcome
  });
}

export function missingAction(intents) {
  if (!Array.isArray(intents) || intents.some((intent) => !ACTION_IDS.has(intent))) {
    throw new TypeError('Companion intents must be an array of known actions.');
  }
  return ACTIONS.find(({ id }) => !intents.includes(id))?.id || ACTIONS[0].id;
}

export function runGuidedReplay(seed = 'signal-grove-demo') {
  let session = createSession(seed);
  while (session.status !== 'COMPLETE') {
    session = resolveTurn(session, missingAction(previewIntents(session)));
  }
  return session;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalReceipt(session) {
  assertSession(session);
  if (session.status !== 'COMPLETE') throw new Error('A receipt can only be generated for a complete replay.');
  const reconstructed = reconstructSession(session.seed, session.history.map(({ playerAction }) => playerAction));
  if (JSON.stringify(stable(reconstructed)) !== JSON.stringify(stable(session))) {
    throw new Error('Replay state failed semantic reconstruction.');
  }
  return stable({
    schema: REPLAY_SCHEMA,
    mode: 'DEMO_REPLAY',
    integrationStatus: 'NOT_CONNECTED',
    externalConnections: false,
    seed: session.seed,
    outcome: session.outcome,
    connection: session.connection,
    trust: session.trust,
    momentum: session.momentum,
    history: session.history
  });
}

export async function fingerprintReceipt(receipt) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(receipt)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function reconstructSession(seed, playerActions) {
  if (!Array.isArray(playerActions) || playerActions.length !== MAX_ROUNDS) {
    throw new TypeError(`A complete replay requires exactly ${MAX_ROUNDS} player actions.`);
  }
  let replay = createSession(seed);
  for (const playerAction of playerActions) replay = resolveTurn(replay, playerAction);
  return replay;
}

export async function verifyReplayProof(proof) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    return Object.freeze({ valid: false, reason: 'PROOF_OBJECT_REQUIRED' });
  }
  const { fingerprint, ...receipt } = proof;
  if (!/^[a-f0-9]{64}$/.test(fingerprint || '')) {
    return Object.freeze({ valid: false, reason: 'FINGERPRINT_INVALID' });
  }
  if (receipt.schema !== REPLAY_SCHEMA || receipt.mode !== 'DEMO_REPLAY' || receipt.integrationStatus !== 'NOT_CONNECTED' || receipt.externalConnections !== false) {
    return Object.freeze({ valid: false, reason: 'TRUTH_BOUNDARY_INVALID' });
  }
  try {
    const reconstructed = reconstructSession(receipt.seed, receipt.history?.map(({ playerAction }) => playerAction));
    const expectedReceipt = canonicalReceipt(reconstructed);
    if (JSON.stringify(stable(expectedReceipt)) !== JSON.stringify(stable(receipt))) {
      return Object.freeze({ valid: false, reason: 'REPLAY_SEMANTICS_INVALID' });
    }
    const expectedFingerprint = await fingerprintReceipt(expectedReceipt);
    if (expectedFingerprint !== fingerprint) {
      return Object.freeze({ valid: false, reason: 'FINGERPRINT_MISMATCH' });
    }
    return Object.freeze({ valid: true, reason: 'VERIFIED', fingerprint: expectedFingerprint });
  } catch {
    return Object.freeze({ valid: false, reason: 'REPLAY_SEMANTICS_INVALID' });
  }
}
