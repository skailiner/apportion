import {
  METHODS,
  METHOD_INFO,
  SCOPE,
  allocate,
  validateState,
  type State,
  type Method,
} from './apportion.ts';

export const FILE_LIMIT = 1024 * 1024;
export function saveInputs(input: State): string {
  return (
    JSON.stringify(
      { schema: 'apportion-inputs/v1', configuration: validateState(input) },
      null,
      2,
    ) + '\n'
  );
}
export function openInputs(text: string): State {
  if (new TextEncoder().encode(text).byteLength > FILE_LIMIT)
    throw new Error('Use an APPORTION JSON file of 1 MiB or smaller.');
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an APPORTION JSON object.');
  const packet = value as Record<string, unknown>;
  const fields =
    packet.schema === 'apportion-inputs/v1'
      ? ['schema', 'configuration']
      : packet.schema === 'apportion/v1'
        ? [
            'schema',
            'modelVersion',
            'configuration',
            'selected',
            'comparison',
            'tieRule',
            'scope',
            'sources',
          ]
        : null;
  if (!fields || Object.keys(packet).some((k) => !fields.includes(k)))
    throw new Error('Unsupported APPORTION file format or unexpected field.');
  if (packet.schema === 'apportion/v1' && packet.modelVersion !== '1.0.0')
    throw new Error('Unsupported allocation report model version.');
  // Imported outputs, traces and claims are never trusted; recompute locally.
  return validateState(packet.configuration);
}
export function comparisonSummary(input: State) {
  const state = validateState(input);
  const results = METHODS.map((method) =>
    allocate({ ...state, method }, false),
  );
  const selected = results.find((result) => result.method === state.method)!;
  const next =
    state.house < 200
      ? allocate({ ...state, house: state.house + 1 }, false)
      : null;
  const groups = state.groups.map((group) => {
    const counts = Object.fromEntries(
      results.map((result) => [
        result.method,
        result.rows.find((row) => row.id === group.id)!.seats,
      ]),
    ) as Record<Method, number>;
    const row = selected.rows.find((row) => row.id === group.id)!;
    const values = Object.values(counts);
    return {
      ...group,
      counts,
      min: Math.min(...values),
      max: Math.max(...values),
      quota: row.quota,
      quotaStatus: row.quotaStatus,
      nextSeats: next?.rows.find((row) => row.id === group.id)!.seats ?? null,
    };
  });
  return {
    state,
    groups,
    changed: groups.filter((g) => g.min !== g.max),
    cutoffTie: selected.cutoffTie,
    nextHouse: next?.house ?? null,
  };
}
export function comparisonBrief(input: State): string {
  const s = comparisonSummary(input);
  const label = (id: string) => {
    const g = s.groups.find((g) => g.id === id)!;
    return `${JSON.stringify(g.name)} [${g.id}]`;
  };
  const lines = [
    'APPORTION | ALLOCATION DISCUSSION BRIEF',
    `Available places: ${s.state.house}. Selected rule: ${METHOD_INFO[s.state.method].name}.`,
    'These are recalculated results for applied inputs, not a recommendation or an agreement.',
    'Weights set proportions, not capacity or demand limits. A group can receive more places than its weight; caps are not modeled.',
    '',
    'WHAT CHANGES BETWEEN RULES',
    s.changed.length
      ? `${s.changed.length} of ${s.groups.length} groups receive different totals: ${s.changed.map((g) => label(g.id)).join(', ')}.`
      : 'All three rules give the same totals for these inputs. This does not mean the rules always agree.',
    '',
    'GROUP-BY-GROUP COMPARISON',
  ];
  for (const g of s.groups)
    lines.push(
      `${label(g.id)}: weight ${g.weight}; exact quota ${g.quota.numerator}/${g.quota.denominator}; fixed tie priority ${g.priority}.`,
      `  ${METHODS.map((m) => `${METHOD_INFO[m].name}: ${g.counts[m]}`).join(' | ')}. Range: ${g.min}–${g.max}.`,
      `  Selected rule: ${g.quotaStatus === 'within' ? 'within lower/upper quota' : g.quotaStatus === 'above' ? 'above upper quota' : 'below lower quota'}.`,
    );
  lines.push(
    '',
    'TIES AND ONE MORE PLACE',
    s.cutoffTie.length
      ? `Selected-rule cutoff tie: ${s.cutoffTie.map(label).join(', ')}.`
      : 'No selected-rule tie crosses the last-place cutoff.',
  );
  if (s.nextHouse === null)
    lines.push(
      'One more place would exceed this study’s 200-place range; no next-step result is claimed.',
    );
  else {
    lines.push(
      `Holding weights, rule and tie priorities fixed: ${s.state.house} → ${s.nextHouse} places.`,
    );
    const changes = s.groups.filter(
      (g) => g.nextSeats !== g.counts[s.state.method],
    );
    for (const g of changes)
      lines.push(
        `${label(g.id)}: ${g.counts[s.state.method]} → ${g.nextSeats}.`,
      );
  }
  lines.push(
    '',
    'BEFORE THE GROUP DECIDES',
    '1. Agree what the weights represent and whether proportional allocation fits the task.',
    '2. Discuss the rule and tie procedure before choosing an outcome. Smaller fixed priority wins exact ties here; names and row order do not determine priority.',
    '3. Check needs, rights, eligibility and other constraints outside this model. A mathematical allocation does not establish fairness or consent.',
    '4. Record the actual group decision and rationale separately. Keep a Save inputs JSON file if you want to reopen the calculation.',
    SCOPE,
    'This brief is not an editable backup.',
    'https://skailiner-apportion.static.hf.space/index.html',
  );
  return lines.join('\n') + '\n';
}
