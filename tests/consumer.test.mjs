import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialState,
  validateState,
  exportJSON,
  METHODS,
} from '../lib/apportion.ts';
import {
  FILE_LIMIT,
  saveInputs,
  openInputs,
  comparisonSummary,
  comparisonBrief,
} from '../lib/consumer.ts';
import {
  workspace,
  isDirty,
  assertReady,
  editDraft,
  discardDraft,
  applyDraft,
  changeApplied,
  beginReplacement,
  finishReplacement,
} from '../lib/workspace.ts';

void test('invalid drafts survive every applied mutation and replacement entry point', () => {
  const start = workspace(initialState());
  const draft = editDraft(start, {
    houseDraft: '',
    draft: start.draft.map((g, i) =>
      i ? g : { ...g, name: 'Unfinished', weight: 'not a number' },
    ),
  });
  const before = JSON.stringify(draft);
  for (const patch of [
    { house: 26 },
    { house: 1 },
    { method: 'dhondt' },
    { groups: initialState().groups },
  ])
    assert.throws(() => changeApplied(draft, patch), /Apply or discard/);
  assert.throws(() => beginReplacement(draft), /Apply or discard/);
  assert.throws(() => assertReady(draft), /Apply or discard/);
  assert.throws(() => applyDraft(draft));
  assert.equal(JSON.stringify(draft), before);
  assert.deepEqual(discardDraft(draft).state, start.state);
  assert.equal(isDirty(discardDraft(draft)), false);
  assert.equal(start.houseDraft, '25');
});

void test('draft refs can be replaced synchronously before a tool mutation', () => {
  let current = workspace(initialState());
  current = editDraft(current, { houseDraft: '17' });
  assert.throws(() => changeApplied(current, { method: 'dhondt' }));
  current = applyDraft(current);
  assert.equal(current.state.house, 17);
  assert.equal(isDirty(current), false);
  current = changeApplied(current, { method: 'dhondt' });
  assert.equal(current.state.method, 'dhondt');
});

void test('file/dialog lock blocks edits, tools, exports and another read; cancel is lossless', () => {
  const original = workspace(initialState());
  const reading = beginReplacement(original),
    ticket = reading.epoch;
  for (const action of [
    () => editDraft(reading, { houseDraft: '1' }),
    () => applyDraft(reading),
    () => discardDraft(reading),
    () => changeApplied(reading, { house: 3 }),
    () => beginReplacement(reading),
    () => assertReady(reading),
  ])
    assert.throws(action, /Finish or cancel/);
  assert.throws(() => finishReplacement(reading, ticket + 1), /stale/);
  const cancelled = finishReplacement(reading, ticket);
  assert.deepEqual(cancelled.state, original.state);
  assert.deepEqual(cancelled.draft, original.draft);
  assert.equal(cancelled.busy, false);
  assert.throws(
    () => finishReplacement(cancelled, ticket, { ...initialState(), house: 9 }),
    /stale/,
  );
  const second = beginReplacement(cancelled);
  assert.throws(
    () => finishReplacement(second, ticket, { ...initialState(), house: 9 }),
    /stale/,
  );
  const committed = finishReplacement(second, second.epoch, {
    ...initialState(),
    house: 17,
  });
  assert.equal(committed.state.house, 17);
  assert.equal(committed.busy, false);
  assert.throws(() => finishReplacement(committed, second.epoch), /stale/);
});

void test('input and legacy round-trips preserve identities, row order, priorities and Unicode', () => {
  const state = initialState();
  state.groups = state.groups
    .reverse()
    .map((g, i) => ({ ...g, name: i < 2 ? 'Same name' : `Version ${i} 🌏 é` }));
  for (const method of METHODS) {
    const candidate = { ...state, method };
    assert.deepEqual(openInputs(saveInputs(candidate)), candidate);
    const legacy = JSON.parse(exportJSON(candidate));
    legacy.selected = { falseClaim: 'Everyone gets 999 seats' };
    legacy.comparison = [{ cutoffTie: ['fake'] }];
    const restored = openInputs(JSON.stringify(legacy));
    assert.deepEqual(restored, candidate);
    assert.deepEqual(comparisonSummary(restored), comparisonSummary(candidate));
    assert.ok(!comparisonBrief(restored).includes('999 seats'));
  }
});

void test('maximum valid legacy report fits; malformed and oversized packets reject atomically', () => {
  const state = {
    house: 200,
    method: 'sainte-lague',
    groups: Array.from({ length: 12 }, (_, i) => ({
      id: String.fromCharCode(65 + i),
      name: '字'.repeat(40),
      weight: 1_000_000_000,
      priority: 12 - i,
    })),
  };
  const legacy = exportJSON(state);
  assert.ok(new TextEncoder().encode(legacy).byteLength < FILE_LIMIT);
  assert.deepEqual(openInputs(legacy), state);
  assert.throws(() => openInputs(' '.repeat(FILE_LIMIT + 1)));
  for (const packet of [
    null,
    [],
    {},
    { schema: 'apportion-inputs/v2', configuration: state },
    { schema: 'apportion-inputs/v1', configuration: state, extra: true },
    { schema: 'apportion/v1', modelVersion: '9', configuration: state },
    { schema: 'apportion-inputs/v1', configuration: { ...state, house: 201 } },
  ])
    assert.throws(() => openInputs(JSON.stringify(packet)));
  assert.throws(() => openInputs('{bad'));
  const w = beginReplacement(workspace(initialState())),
    before = JSON.stringify(w);
  assert.throws(() => finishReplacement(w, w.epoch, { ...state, house: 999 }));
  assert.equal(JSON.stringify(w), before);
});

void test('sparse arrays and broken Unicode are rejected without rejecting valid emoji', () => {
  assert.throws(() => validateState({ ...initialState(), groups: Array(2) }));
  for (const name of ['\ud800', '\udfff', 'A\nB']) {
    const state = initialState();
    state.groups[0].name = name;
    assert.throws(() => validateState(state));
  }
  const state = initialState();
  state.groups[0].name = '🌏 é';
  assert.equal(validateState(state).groups[0].name, '🌏 é');
});

void test('comparison identifies precisely changed groups and follows stable IDs after reordering', () => {
  const state = {
    house: 3,
    method: 'dhondt',
    groups: [1, 1, 4].map((weight, i) => ({
      id: String.fromCharCode(65 + i),
      name: 'Same name',
      weight,
      priority: i + 1,
    })),
  };
  const summary = comparisonSummary(state);
  assert.deepEqual(
    summary.changed.map((g) => g.id),
    ['A', 'C'],
  );
  assert.deepEqual(
    summary.groups.map((g) => g.counts.hamilton),
    [1, 0, 2],
  );
  assert.deepEqual(
    summary.groups.map((g) => g.counts.dhondt),
    [0, 0, 3],
  );
  assert.deepEqual(
    summary.groups.map((g) => g.counts['sainte-lague']),
    [1, 0, 2],
  );
  assert.equal(summary.groups[2].quotaStatus, 'above');
  const shuffled = comparisonSummary({
    ...state,
    groups: [...state.groups].reverse(),
  });
  for (const g of summary.groups)
    assert.deepEqual(
      g,
      shuffled.groups.find((x) => x.id === g.id),
    );
  const brief = comparisonBrief(state);
  for (const id of ['A', 'B', 'C'])
    assert.ok(brief.includes(`"Same name" [${id}]`));
  assert.match(brief, /not an editable backup/);
  assert.match(brief, /not capacity or demand limits/);
  assert.match(brief, /rights, eligibility/);
  assert.match(brief, /record the actual group decision/i);
});

void test('cutoff ties and next-pool losses stay distinct, with an explicit maximum range', () => {
  const s = comparisonSummary(initialState());
  assert.deepEqual(s.cutoffTie, []);
  assert.deepEqual(
    s.groups.filter((g) => g.nextSeats < g.counts.hamilton).map((g) => g.id),
    ['D', 'E'],
  );
  const equal = {
    house: 2,
    method: 'hamilton',
    groups: [1, 1, 1].map((weight, i) => ({
      id: String.fromCharCode(65 + i),
      name: 'Group ' + i,
      weight,
      priority: i + 1,
    })),
  };
  assert.deepEqual(comparisonSummary(equal).cutoffTie, ['A', 'B', 'C']);
  assert.match(comparisonBrief(equal), /Selected-rule cutoff tie/);
  assert.equal(comparisonSummary({ ...equal, house: 200 }).nextHouse, null);
  assert.match(
    comparisonBrief({ ...equal, house: 200 }),
    /no next-step result is claimed/,
  );
  assert.match(
    comparisonBrief({ ...equal, house: 3 }),
    /All three rules give the same totals/,
  );
});
