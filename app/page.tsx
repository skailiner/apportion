'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  saveInputs,
  openInputs,
  FILE_LIMIT,
  comparisonSummary,
  comparisonBrief,
} from '@/lib/consumer';
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
  type Workspace,
  type DraftGroup,
} from '@/lib/workspace';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  METHODS,
  METHOD_INFO,
  PRESETS,
  SOURCES,
  SCOPE,
  initialState,
  allocate,
  configure,
  newGroup,
  scanHouseSizes,
  fractionValue,
  readState,
  exportJSON,
  exportCSV,
  type State,
} from '@/lib/apportion';

const number = (value: number) =>
  value.toLocaleString('en', { maximumFractionDigits: 3 });
const signed = (value: number) => (value > 0 ? '+' : '') + number(value);
type BrowserTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ToolDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: BrowserTool,
      options: { signal: AbortSignal },
    ) => void | Promise<void>;
  };
};

export default function Home() {
  const [work, setWork] = useState<Workspace>(() => workspace(initialState()));
  const current = useRef(work);
  const { state, draft, houseDraft, busy } = work;
  const [pending, setPending] = useState<{
    state: State;
    ticket: number;
    label: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [traceIndex, setTraceIndex] = useState(0);
  const result = useMemo(() => allocate(state), [state]);
  const comparisons = useMemo(
    () => METHODS.map((method) => allocate({ ...state, method }, false)),
    [state],
  );
  const next = useMemo(
    () =>
      state.house < 200
        ? allocate({ ...state, house: state.house + 1 }, false)
        : null,
    [state],
  );
  const events = useMemo(
    () => scanHouseSizes(state.groups, state.method),
    [state.groups, state.method],
  );
  const losses = next
    ? result.rows.filter((g, i) => next.rows[i].seats < g.seats)
    : [];
  const info = METHOD_INFO[state.method];
  const dirty = isDirty(work);
  const summary = useMemo(() => comparisonSummary(state), [state]);
  const scale = Math.max(
    1,
    ...result.rows.flatMap((g) => [g.seats, fractionValue(g.quota)]),
  );
  const trace = result.trace[Math.min(traceIndex, result.trace.length - 1)];

  function commit(nextWork: Workspace) {
    if (current.current.state !== nextWork.state) setTraceIndex(0);
    current.current = nextWork;
    setWork(nextWork);
    setError('');
  }
  function run(action: () => void) {
    try {
      action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not complete that action.',
      );
    }
  }
  function setDraft(value: DraftGroup[]) {
    run(() => commit(editDraft(current.current, { draft: value })));
  }
  function setHouseDraft(value: string) {
    run(() => commit(editDraft(current.current, { houseDraft: value })));
  }
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (current.current.epoch > 0) event.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  useEffect(() => {
    const context = (document as ToolDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const schema = {
      type: 'object',
      properties: {
        house: { type: 'integer', minimum: 1, maximum: 200 },
        method: { type: 'string', enum: [...METHODS] },
        groups: {
          type: 'array',
          minItems: 2,
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string', minLength: 1, maxLength: 40 },
              weight: { type: 'integer', minimum: 1, maximum: 1000000000 },
              priority: { type: 'integer', minimum: 1, maximum: 12 },
            },
            required: ['id', 'name', 'weight', 'priority'],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    };
    const tools: BrowserTool[] = [
      {
        name: 'configure_apportion',
        description:
          'Apply a seat total, allocation method, or complete group list to this local allocation lab. Rejects changes while unfinished form edits or a file/dialog are pending; makes no external request.',
        inputSchema: schema,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          const candidate = changeApplied(current.current, input);
          flushSync(() => {
            commit(candidate);
            setMessage('Allocation updated.');
          });
          return readState(candidate.state);
        },
      },
      {
        name: 'read_apportion',
        description:
          'Read the applied configuration, exact quotas, allocations, cutoff ties and next-seat losses. Does not include unapplied form edits.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input) ||
            Object.keys(input).length
          )
            throw new Error('This read takes an empty object.');
          return {
            ...readState(current.current.state),
            workspace: {
              hasUnappliedDraft: isDirty(current.current),
              interactionPending: current.current.busy,
            },
          };
        },
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* The ordinary interface remains usable. */
      }
    return () => lifecycle.abort();
  }, []);
  function applyInputs(event: { preventDefault: () => void }) {
    event.preventDefault();
    run(() => {
      commit(applyDraft(current.current));
      setMessage('Inputs applied. Results and scan are current.');
    });
  }
  function moveHouse(house: number) {
    run(() => {
      commit(changeApplied(current.current, { house }));
      setMessage('Now allocating ' + house + ' places.');
    });
  }
  function preset(id: string) {
    const p = PRESETS.find((p) => p.id === id)!;
    run(() => {
      const candidate = configure(current.current.state, {
        house: p.house,
        method: p.method,
        groups: p.weights.map((weight, i) => ({
          id: String.fromCharCode(65 + i),
          name: 'Group ' + String.fromCharCode(65 + i),
          weight,
          priority: i + 1,
        })),
      });
      const nextWork = beginReplacement(current.current);
      commit(nextWork);
      setPending({
        state: candidate,
        ticket: nextWork.epoch,
        label: 'Load synthetic example: ' + p.name,
      });
    });
  }
  function addGroup() {
    if (draft.length >= 12) return;
    const group = newGroup(draft);
    setDraft([...draft, { ...group, weight: String(group.weight) }]);
  }
  function download(kind: 'json' | 'csv' | 'inputs' | 'brief') {
    run(() => {
      assertReady(current.current);
      const applied = current.current.state;
      const body =
        kind === 'json'
          ? exportJSON(applied)
          : kind === 'csv'
            ? exportCSV(applied)
            : kind === 'inputs'
              ? saveInputs(applied)
              : comparisonBrief(applied);
      const extension =
        kind === 'brief' ? 'txt' : kind === 'inputs' ? 'json' : kind;
      const url = URL.createObjectURL(
        new Blob([body], {
          type:
            extension === 'json'
              ? 'application/json'
              : extension === 'csv'
                ? 'text/csv;charset=utf-8'
                : 'text/plain;charset=utf-8',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download =
        'apportion-' +
        kind +
        '-' +
        applied.house +
        '-' +
        applied.method +
        '.' +
        extension;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        'Downloaded the applied allocation as ' + kind.toUpperCase() + '.',
      );
    });
  }
  async function openFile(file: File | undefined) {
    if (!file) return;
    let ticket: number | undefined;
    try {
      const reading = beginReplacement(current.current);
      ticket = reading.epoch;
      commit(reading);
      setMessage(
        'Reading input file locally. Your current allocation is unchanged.',
      );
      if (file.size > FILE_LIMIT)
        throw new Error('Use a JSON file of 1 MiB or smaller.');
      const candidate = openInputs(await file.text());
      if (!current.current.busy || current.current.epoch !== ticket)
        throw new Error('Inputs changed while the file opened. Try again.');
      setPending({ state: candidate, ticket, label: 'Open saved allocation' });
    } catch (e) {
      if (
        ticket !== undefined &&
        current.current.busy &&
        current.current.epoch === ticket
      )
        commit(finishReplacement(current.current, ticket));
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  function cancelReplacement() {
    if (!pending) return;
    run(() => {
      commit(finishReplacement(current.current, pending.ticket));
      setPending(null);
      setMessage('Replacement cancelled. Current inputs preserved.');
    });
  }
  return (
    <>
      <a href="#lab" className="skip">
        Skip to allocation lab
      </a>
      <header className="masthead">
        <div className="wordmark">APPORTION</div>
        <div className="edition">LIMITED PLACES · EXPLAINABLE CHOICES</div>
      </header>
      <div className="intro">
        <h1>Who gets the next seat?</h1>
        <p>
          Sharing workshop places, club seats or another limited pool? Enter
          your groups, compare three proportional rules and take a clear brief
          to the discussion. The numbers explain trade-offs; your group decides.
        </p>
        <ol className="journey">
          <li>Agree what the weights mean.</li>
          <li>Apply your groups and available places.</li>
          <li>Compare, discuss and save your inputs.</li>
        </ol>
        <output className="consumer-status" aria-live="polite">
          {message || 'Your inputs stay in this tab. Save them before leaving.'}
        </output>
      </div>
      <main id="lab" className="lab">
        <aside className="panel inputs">
          <form onSubmit={applyInputs} noValidate>
            <fieldset className="input-fieldset" disabled={busy}>
              <label htmlFor="seats" className="eyebrow">
                Available places · 1–200
              </label>
              <div className="seat-control">
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Remove one seat from applied total"
                  disabled={state.house <= 1 || dirty || busy}
                  onClick={() => moveHouse(state.house - 1)}
                >
                  −
                </Button>
                <input
                  id="seats"
                  className="seat-number"
                  inputMode="numeric"
                  value={houseDraft}
                  onChange={(e) => setHouseDraft(e.target.value)}
                  aria-describedby="input-hint"
                />
                <Button
                  type="button"
                  aria-label="Add one seat to applied total"
                  disabled={state.house >= 200 || dirty || busy}
                  onClick={() => moveHouse(state.house + 1)}
                >
                  +
                </Button>
              </div>
              <div className="section-heading">
                <h2>Group weights</h2>
                <span className="eyebrow">{draft.length} / 12</span>
              </div>
              <p className="demo-note" id="input-hint">
                A weight is the size or count you want each group’s share to
                follow, such as members or requests. Use one agreed basis for
                every group: positive whole numbers up to 1 billion. This model
                does not assess need. Weights set proportions, not capacity
                limits: a group can receive more places than its weight.
              </p>
              <div className="group-editor">
                {draft.map((g) => (
                  <div className="edit-row" key={g.id}>
                    <span
                      className="group-id"
                      title={'Fixed tie priority ' + g.priority}
                    >
                      {g.id}
                    </span>
                    <div className="edit-fields">
                      <label>
                        <span className="sr-only">Name for group {g.id}</span>
                        <input
                          className="name-input"
                          maxLength={40}
                          value={g.name}
                          onChange={(e) =>
                            setDraft(
                              draft.map((x) =>
                                x.id === g.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span className="sr-only">Weight for group {g.id}</span>
                        <input
                          className="weight-input"
                          inputMode="numeric"
                          value={g.weight}
                          onChange={(e) =>
                            setDraft(
                              draft.map((x) =>
                                x.id === g.id
                                  ? { ...x, weight: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="remove"
                      disabled={draft.length <= 2}
                      aria-label={'Remove group ' + g.id + ' from inputs'}
                      onClick={() =>
                        setDraft(draft.filter((x) => x.id !== g.id))
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <div className="input-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={draft.length >= 12}
                  onClick={addGroup}
                >
                  + Group
                </Button>
                <Button type="submit">Apply inputs</Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!dirty || busy}
                  onClick={() =>
                    run(() => {
                      commit(discardDraft(current.current));
                      setMessage(
                        'Unapplied edits discarded. Applied inputs are unchanged.',
                      );
                    })
                  }
                >
                  Discard unapplied edits
                </Button>
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {dirty && (
                <p className="pending">
                  Unapplied edits. Results use the last applied inputs. Apply or
                  discard these edits before switching rules, examples or
                  totals, opening a file, or downloading.
                </p>
              )}
              <p className="fine">
                Exact ties favor the lower fixed priority:{' '}
                {state.groups
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map((g) => g.id)
                  .join(' → ')}
                . Renaming a group does not change it.
              </p>
            </fieldset>
          </form>
          <div className="save-controls">
            <Button
              variant="outline"
              disabled={dirty || busy}
              onClick={() => download('inputs')}
            >
              Save inputs
            </Button>
            <Button
              variant="outline"
              disabled={dirty || busy}
              onClick={() => fileInput.current?.click()}
            >
              Open saved inputs
            </Button>
            <input
              hidden
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              aria-label="Open APPORTION inputs or legacy report"
              onChange={(event) => void openFile(event.target.files?.[0])}
            />
            <p className="fine">
              Nothing is autosaved. Save inputs keeps the applied groups, exact
              priorities and rule. Opening recalculates every result and asks
              before replacing your current work.
            </p>
          </div>
          <details className="examples">
            <summary>Load a synthetic example</summary>
            <div>
              {PRESETS.map((p) => (
                <Button
                  type="button"
                  variant="outline"
                  key={p.id}
                  disabled={dirty || busy}
                  onClick={() => preset(p.id)}
                >
                  {p.name}
                </Button>
              ))}
            </div>
            <p className="fine">
              Loading an example asks before replacing applied inputs. Save your
              own inputs first if you want to keep them.
            </p>
          </details>
        </aside>
        <section className="panel result" aria-label="Applied allocation">
          <div className="result-heading">
            <div>
              <div className="eyebrow">Applied allocation</div>
              <h2>{info.name}</h2>
            </div>
            <div className="total">
              {state.house} / {state.house} seats
            </div>
          </div>
          <RadioGroup
            className="methods"
            value={state.method}
            disabled={dirty || busy}
            onValueChange={(value) => {
              run(() => {
                commit(changeApplied(current.current, { method: value }));
                setMessage('Method changed.');
              });
            }}
            aria-label="Allocation method"
          >
            {METHODS.map((method) => (
              <label
                htmlFor={'method-' + method}
                key={method}
                className={
                  'method ' + (state.method === method ? 'selected' : '')
                }
              >
                <RadioGroupItem id={'method-' + method} value={method} />
                <span>
                  <strong>{METHOD_INFO[method].name}</strong>
                  <small>{METHOD_INFO[method].short}</small>
                </span>
              </label>
            ))}
          </RadioGroup>
          <div className="plot-legend">
            <span>
              <i className="legend-bar" /> Whole seats awarded
            </span>
            <span>
              <i className="legend-line" /> Ideal fractional quota
            </span>
          </div>
          <div
            className="allocation-plot"
            style={{
              gridTemplateColumns:
                'repeat(' + result.rows.length + ',minmax(56px,1fr))',
            }}
          >
            {result.rows.map((g) => (
              <div className="allocation-column" key={g.id}>
                <svg viewBox="0 0 60 220" aria-hidden="true">
                  <line x1="0" x2="60" y1="208" y2="208" stroke="#bbc8df" />
                  <rect
                    x="10"
                    y={208 - (g.seats / scale) * 195}
                    width="40"
                    height={(g.seats / scale) * 195}
                    fill="#1742d4"
                  />
                  <line
                    x1="3"
                    x2="57"
                    y1={208 - (fractionValue(g.quota) / scale) * 195}
                    y2={208 - (fractionValue(g.quota) / scale) * 195}
                    stroke="#0e1b32"
                    strokeWidth="3"
                    strokeDasharray="5 3"
                  />
                </svg>
                <strong className="seat-count">{g.seats}</strong>
                <span className="group-label">
                  {g.id} · {g.name}
                </span>
                <span className="quota-label">
                  Quota ≈ {number(fractionValue(g.quota))}
                </span>
              </div>
            ))}
          </div>
          <div className={'insight' + (losses.length ? ' loss' : '')}>
            <div className="section-heading">
              <strong>
                {next
                  ? state.house + ' → ' + (state.house + 1) + ' seats'
                  : 'At the 200-seat limit'}
              </strong>
              {next && (
                <Button
                  variant="outline"
                  disabled={dirty || busy}
                  onClick={() => moveHouse(state.house + 1)}
                >
                  Add one seat →
                </Button>
              )}
            </div>
            <p>
              {!next
                ? 'Reduce the total to continue exploring adjacent allocations.'
                : losses.length
                  ? losses.map((g) => g.id + ' · ' + g.name).join(' and ') +
                    ' lose a seat as the pool grows. The next allocation is recomputed from the same weights.'
                  : 'No group loses a seat at this next step.'}
            </p>
            {state.method === 'hamilton' && losses.length > 0 && (
              <p className="fine">
                This is a house-size paradox. Changing the pool changes both
                whole quotas and remainder rankings.
              </p>
            )}
          </div>
          <div className="tie-note">
            <strong>
              {result.cutoffTie.length
                ? 'A tie affects the final allocation.'
                : 'No tie crosses the last-seat cutoff.'}
            </strong>
            {result.cutoffTie.length > 0 && (
              <span>
                {' '}
                Groups {result.cutoffTie.join(', ')} are tied at the cutoff; the
                fixed priority selects among them.
              </span>
            )}
            <p className="fine">
              Earlier equal priorities may change award order without changing
              the final totals. Inspect the trace below.
            </p>
          </div>
        </section>
        <section className="panel wide" aria-labelledby="compare-heading">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Same inputs. Different rules.</div>
              <h2 id="compare-heading">Compare the allocations</h2>
            </div>
            <div className="download-actions">
              <Button
                disabled={dirty || busy}
                onClick={() => download('brief')}
              >
                Download discussion brief
              </Button>
              <Button
                variant="outline"
                disabled={dirty || busy}
                onClick={() => download('csv')}
              >
                Download CSV
              </Button>
              <Button
                variant="outline"
                disabled={dirty || busy}
                onClick={() => download('json')}
              >
                Evidence JSON + trace
              </Button>
            </div>
          </div>
          <div className="comparison-summary">
            <h3>
              {summary.changed.length
                ? `${summary.changed.length} groups receive different totals across the rules`
                : 'All three rules give the same totals for these inputs'}
            </h3>
            <p>
              This compares the same weights, number of places and tie
              priorities. Agreement here does not mean the rules always agree.
            </p>
            {summary.changed.length > 0 && (
              <ul>
                {summary.changed.map((g) => (
                  <li key={g.id}>
                    <strong>
                      {g.name} [{g.id}]
                    </strong>
                    :{' '}
                    {METHODS.map(
                      (m) => `${METHOD_INFO[m].name} ${g.counts[m]}`,
                    ).join(' · ')}
                    . Range {g.min}–{g.max} places.
                  </li>
                ))}
              </ul>
            )}
            <p className="fine">
              Use the brief to discuss the differences, then record your group’s
              chosen rule and rationale separately. It is not a decision made on
              your behalf.
            </p>
          </div>
          <Table>
            <TableCaption>
              Quota = {state.house} × group weight /{' '}
              {number(result.totalWeight)}. Decimals are rounded only for
              display; allocation comparisons use exact integer arithmetic.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Weight share</TableHead>
                <TableHead>Exact quota</TableHead>
                {METHODS.map((m) => (
                  <TableHead key={m}>{METHOD_INFO[m].name}</TableHead>
                ))}
                <TableHead>Selected rule vs quota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((g, i) => (
                <TableRow key={g.id}>
                  <TableCell className="wrap-cell">
                    <strong>
                      {g.id} · {g.name}
                    </strong>
                  </TableCell>
                  <TableCell>{number(g.weightShare * 100)}%</TableCell>
                  <TableCell>
                    <span className="fraction">
                      {g.quota.numerator} / {g.quota.denominator}
                    </span>
                    <small>
                      ≈ {number(fractionValue(g.quota))} · bounds {g.lowerQuota}
                      –{g.upperQuota}
                    </small>
                  </TableCell>
                  {comparisons.map((r) => (
                    <TableCell
                      key={r.method}
                      className={
                        r.method === state.method ? 'selected-cell' : ''
                      }
                    >
                      <strong>{r.rows[i].seats}</strong>
                      <small>
                        {number(r.rows[i].seatShare * 100)}% of seats
                      </small>
                    </TableCell>
                  ))}
                  <TableCell>
                    <strong
                      className={g.quotaStatus !== 'within' ? 'violation' : ''}
                    >
                      {signed(fractionValue(g.deviation))} seats
                    </strong>
                    <small>
                      {g.quotaStatus === 'within'
                        ? 'Within lower/upper quota'
                        : g.quotaStatus === 'above'
                          ? 'Above upper quota'
                          : 'Below lower quota'}
                    </small>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section className="panel wide scan" aria-labelledby="scan-heading">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Hold weights and priorities fixed</div>
              <h2 id="scan-heading">Where does adding a seat cause a loss?</h2>
            </div>
            <span className="scan-count">{events.length} transitions</span>
          </div>
          <p className="fine">
            Checks every adjacent total from 1 → 2 through 199 → 200 using{' '}
            {info.name}. Selecting a transition applies its starting total; it
            does not apply unfinished group edits.
          </p>
          {events.length ? (
            <div className="scan-grid">
              {events.map((event) => (
                <Button
                  variant="outline"
                  key={event.from}
                  disabled={dirty || busy}
                  onClick={() => moveHouse(event.from)}
                  aria-label={
                    event.from +
                    ' to ' +
                    event.to +
                    ' seats: ' +
                    event.losses
                      .map((g) => g.id + ' loses ' + (g.before - g.after))
                      .join(', ')
                  }
                >
                  <strong>
                    {event.from} → {event.to}
                  </strong>
                  <span>
                    {event.losses
                      .map((g) => g.id + ' −' + (g.before - g.after))
                      .join(', ')}
                  </span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="scan-empty">
              {state.method === 'hamilton'
                ? 'No losses for these weights within 1–200 seats. Other weights or seat totals can behave differently.'
                : 'No losses in this range. For sequential divisor rules, increasing the total extends the same award sequence when weights and tie priority stay fixed.'}
            </p>
          )}
        </section>
        <section className="panel wide" aria-labelledby="trace-heading">
          <div className="eyebrow">Show the arithmetic</div>
          <h2 id="trace-heading">
            {state.method === 'hamilton'
              ? 'Whole quotas, then remainder seats'
              : 'One award at a time'}
          </h2>
          <p className="formula">{info.formula}</p>
          <p>{info.explanation}</p>
          {state.method === 'hamilton' ? (
            <details className="trace-details">
              <summary>
                Inspect whole quotas and all {result.trace.length} remainder
                ranks
              </summary>
              <p className="fine">
                Whole-quota seats:{' '}
                {result.baseAllocation
                  .map((g) => g.id + ' = ' + g.seats)
                  .join(' · ')}
                . “Extra” means one of the remaining seats, not a sequential
                allocation across changing house sizes.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Exact remainder</TableHead>
                    <TableHead>Extra seat</TableHead>
                    <TableHead>Equal remainder groups</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.trace.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.step}</TableCell>
                      <TableCell>{t.id}</TableCell>
                      <TableCell className="fraction">
                        {t.numerator} / {t.denominator}
                      </TableCell>
                      <TableCell>{t.awarded ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        {t.tied.length > 1 ? t.tied.join(', ') : 'None'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          ) : (
            <details className="trace-details">
              <summary>Inspect all {state.house} sequential awards</summary>
              <div className="trace-navigation">
                <Button
                  variant="outline"
                  disabled={traceIndex <= 0}
                  onClick={() => setTraceIndex(Math.max(0, traceIndex - 1))}
                >
                  ← Previous
                </Button>
                <strong>
                  Seat {trace.step} of {state.house}
                </strong>
                <Button
                  variant="outline"
                  disabled={traceIndex >= result.trace.length - 1}
                  onClick={() =>
                    setTraceIndex(
                      Math.min(result.trace.length - 1, traceIndex + 1),
                    )
                  }
                >
                  Next →
                </Button>
              </div>
              <p>
                <strong>{trace.id} wins</strong> with priority {trace.numerator}{' '}
                / {trace.denominator}.
                {trace.tied.length > 1
                  ? ' Exact tie among ' +
                    trace.tied.join(', ') +
                    ': lower fixed priority wins.'
                  : ' No equal highest priority.'}
              </p>
              <Table>
                <TableCaption>
                  Candidate priorities immediately before awarding seat{' '}
                  {trace.step}. Fractions, not rounded decimals, determine the
                  ranking.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Exact priority</TableHead>
                    <TableHead>Approximate</TableHead>
                    <TableHead>Fixed tie priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trace.candidates.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <strong>
                          {c.id}
                          {c.id === trace.id ? ' · winner' : ''}
                        </strong>
                      </TableCell>
                      <TableCell className="fraction">
                        {c.numerator} / {c.denominator}
                      </TableCell>
                      <TableCell>
                        {number(Number(c.numerator) / Number(c.denominator))}
                      </TableCell>
                      <TableCell>{c.priority}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <details className="award-list">
                <summary>Full award order</summary>
                <p className="fraction">
                  {result.trace.map((t) => t.step + ':' + t.id).join(' · ')}
                </p>
              </details>
            </details>
          )}
        </section>
        <section
          className="panel wide context"
          aria-labelledby="limits-heading"
        >
          <div>
            <h2 id="limits-heading">What the numbers do not decide</h2>
            <p>
              Proportionality is one principle, not a complete definition of
              fairness. Group weights do not express need, rights or the quality
              of representation.
            </p>
            <p>
              Lower and upper quotas are the ideal share rounded down and up.
              They coincide when the quota is already a whole number. Hamilton
              stays between these bounds; divisor rules can exceed them. A
              rule’s behavior is a tradeoff to examine, not a verdict.
            </p>
            <p className="fine">{SCOPE}</p>
          </div>
          <div>
            <h3>Primary sources</h3>
            <ul>
              {SOURCES.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="fine">
              Reviewed 8 September 2026. The lab uses the core formulas, not
              each jurisdiction’s complete election rules. The fixed tie
              convention is ours.
            </p>
          </div>
        </section>
      </main>
      <footer>
        APPORTION / exact comparisons, inspectable choices. No account, paid API
        or backend upload required. Nothing is autosaved. Save inputs to reopen
        the calculation; the discussion brief is for sharing, not recovery.
      </footer>
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) cancelReplacement();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the applied allocation with{' '}
              {pending?.state.groups.length} groups and {pending?.state.house}{' '}
              places using {pending && METHOD_INFO[pending.state.method].name}.
              Every result is recalculated. Save your current inputs first if
              you need to keep them; there is no undo or automatic saving.
              Cancel keeps the current allocation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current allocation</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(() => {
                  if (!pending) return;
                  commit(
                    finishReplacement(
                      current.current,
                      pending.ticket,
                      pending.state,
                    ),
                  );
                  setPending(null);
                  setMessage(
                    'Inputs replaced and results recalculated. Save inputs to keep this version.',
                  );
                })
              }
            >
              Replace and recalculate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
