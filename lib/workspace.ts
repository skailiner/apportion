import {
  configure,
  validateState,
  type State,
  type Group,
} from './apportion.ts';
export type DraftGroup = Omit<Group, 'weight'> & { weight: string };
export type Workspace = {
  state: State;
  draft: DraftGroup[];
  houseDraft: string;
  epoch: number;
  busy: boolean;
};
export const toDraft = (groups: Group[]): DraftGroup[] =>
  groups.map((g) => ({ ...g, weight: String(g.weight) }));
export function workspace(state: State, epoch = 0): Workspace {
  const valid = validateState(state);
  return {
    state: valid,
    draft: toDraft(valid.groups),
    houseDraft: String(valid.house),
    epoch,
    busy: false,
  };
}
export function isDirty(w: Workspace): boolean {
  return (
    w.houseDraft !== String(w.state.house) ||
    JSON.stringify(w.draft) !== JSON.stringify(toDraft(w.state.groups))
  );
}
export function assertReady(w: Workspace): void {
  if (w.busy)
    throw new Error(
      'Finish or cancel the open file/dialog before changing inputs.',
    );
  if (isDirty(w))
    throw new Error(
      'Apply or discard your unfinished inputs before changing the calculation.',
    );
}
export function editDraft(
  w: Workspace,
  patch: Partial<Pick<Workspace, 'draft' | 'houseDraft'>>,
): Workspace {
  if (w.busy)
    throw new Error('Finish or cancel the open file/dialog before editing.');
  return { ...w, ...patch, epoch: w.epoch + 1 };
}
export function discardDraft(w: Workspace): Workspace {
  if (w.busy) throw new Error('Finish or cancel the open file/dialog first.');
  return workspace(w.state, w.epoch + 1);
}
export function applyDraft(w: Workspace): Workspace {
  if (w.busy) throw new Error('Finish or cancel the open file/dialog first.');
  if (
    !/^\d+$/.test(w.houseDraft) ||
    w.draft.some((g) => !/^\d+$/.test(g.weight))
  )
    throw new Error(
      'Enter whole numbers without commas. Weights must be positive; places must be 1–200.',
    );
  return workspace(
    configure(w.state, {
      house: Number(w.houseDraft),
      groups: w.draft.map((g) => ({ ...g, weight: Number(g.weight) })),
    }),
    w.epoch + 1,
  );
}
export function changeApplied(w: Workspace, patch: unknown): Workspace {
  assertReady(w);
  return workspace(configure(w.state, patch), w.epoch + 1);
}
export function beginReplacement(w: Workspace): Workspace {
  assertReady(w);
  return { ...w, busy: true, epoch: w.epoch + 1 };
}
export function finishReplacement(
  w: Workspace,
  ticket: number,
  next?: State,
): Workspace {
  if (!w.busy || w.epoch !== ticket)
    throw new Error(
      'This file or confirmation is stale. Open it again; newer work was not changed.',
    );
  return next
    ? workspace(next, w.epoch + 1)
    : { ...w, busy: false, epoch: w.epoch + 1 };
}
