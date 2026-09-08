export const METHODS = ['hamilton', 'dhondt', 'sainte-lague'] as const;
export type Method = (typeof METHODS)[number];
export type Group = {
  id: string;
  name: string;
  weight: number;
  priority: number;
};
export type State = { groups: Group[]; house: number; method: Method };
export const METHOD_INFO: Record<
  Method,
  { name: string; short: string; formula: string; explanation: string }
> = {
  hamilton: {
    name: 'Hamilton',
    short: 'Largest remainder',
    formula: 'quota = seats × weight / total weight',
    explanation:
      'Allocate each whole quota, then give the remaining seats to the largest remainders. Recompute the entire allocation when the seat total changes.',
  },
  dhondt: {
    name: 'D’Hondt / Jefferson',
    short: 'Divisors 1, 2, 3…',
    formula: 'priority = weight / (seats already held + 1)',
    explanation:
      'Start every group at zero. Award one seat to the highest current priority, update that group’s divisor, and repeat until all seats are filled.',
  },
  'sainte-lague': {
    name: 'Sainte-Laguë',
    short: 'Divisors 1, 3, 5…',
    formula: 'priority = weight / (2 × seats already held + 1)',
    explanation:
      'Use the same sequential award process, but with odd divisors. This lab uses the unmodified odd-divisor rule, with no eligibility threshold or minimum seats.',
  },
};
export const SOURCES = [
  {
    title: 'US Census Bureau — Hamilton and Jefferson methods',
    url: 'https://www.census.gov/about/history/historical-censuses-and-surveys/census-programs-surveys/decennial-census/methods.html',
  },
  {
    title: 'European Parliament — Understanding the D’Hondt method (2019)',
    url: 'https://www.europarl.europa.eu/RegData/etudes/BRIE/2019/637966/EPRS_BRI(2019)637966_EN.pdf',
  },
  {
    title: 'New Zealand Electoral Commission — Sainte-Laguë formula',
    url: 'https://www.electionresults.govt.nz/electionresults_2023/statistics/sainte-lague-formula.html',
  },
];
export const SCOPE =
  'Educational proportional-allocation model; not a full election system or a universal fairness score. No thresholds, guaranteed seats, district boundaries, eligibility rules or real-world tie procedures. Inputs stay in this browser unless you download them.';
export const DEMO: Group[] = [1500, 1500, 900, 500, 500, 200].map(
  (weight, i) => ({
    id: String.fromCharCode(65 + i),
    name: 'Group ' + String.fromCharCode(65 + i),
    weight,
    priority: i + 1,
  }),
);
export const PRESETS = [
  {
    id: 'paradox',
    name: 'The extra-seat paradox',
    house: 25,
    method: 'hamilton' as Method,
    weights: [1500, 1500, 900, 500, 500, 200],
  },
  {
    id: 'quota',
    name: 'When a quota is exceeded',
    house: 3,
    method: 'dhondt' as Method,
    weights: [1, 1, 4],
  },
  {
    id: 'equal',
    name: 'Equal weights, too few seats',
    house: 2,
    method: 'sainte-lague' as Method,
    weights: [1, 1, 1],
  },
];
export const initialState = (): State => ({
  groups: DEMO.map((g) => ({ ...g })),
  house: 25,
  method: 'hamilton',
});
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(label + ' must be an object.');
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
) {
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    throw new Error('Unknown ' + label + ' field.');
}
function integer(v: unknown, min: number, max: number, label: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max)
    throw new Error(
      label + ' must be a whole number from ' + min + ' to ' + max + '.',
    );
  return v;
}
export function validateState(input: unknown): State {
  const s = object(input, 'Configuration');
  keys(s, ['groups', 'house', 'method'], 'configuration');
  const house = integer(s.house, 1, 200, 'Seats');
  if (!METHODS.includes(s.method as Method))
    throw new Error('Unknown allocation method.');
  if (!Array.isArray(s.groups) || s.groups.length < 2 || s.groups.length > 12)
    throw new Error('Use 2 to 12 groups.');
  const ids = new Set<string>(),
    priorities = new Set<number>();
  const groups = [...s.groups].map((value, i) => {
    const g = object(value, 'Group ' + (i + 1));
    keys(g, ['id', 'name', 'weight', 'priority'], 'group');
    if (typeof g.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(g.id))
      throw new Error('Group IDs must be short stable identifiers.');
    if (ids.has(g.id)) throw new Error('Group IDs must be unique.');
    ids.add(g.id);
    if (
      typeof g.name !== 'string' ||
      !g.name.trim() ||
      g.name.trim().length > 40 ||
      Array.from(g.name).some(
        (c) =>
          c.codePointAt(0)! < 32 ||
          c.codePointAt(0) === 127 ||
          (c.codePointAt(0)! >= 0xd800 && c.codePointAt(0)! <= 0xdfff),
      )
    )
      throw new Error(
        'Group names need 1 to 40 visible characters without broken Unicode.',
      );
    const priority = integer(g.priority, 1, 12, 'Tie priority');
    if (priorities.has(priority))
      throw new Error('Tie priorities must be unique.');
    priorities.add(priority);
    return {
      id: g.id,
      name: g.name.trim(),
      weight: integer(g.weight, 1, 1_000_000_000, 'Weight for ' + g.name),
      priority,
    };
  });
  return { groups, house, method: s.method as Method };
}
export function configure(current: State, input: unknown): State {
  const patch = object(input, 'Configuration');
  keys(patch, ['house', 'method', 'groups'], 'configuration');
  return validateState({ ...current, ...patch });
}
export function newGroup(groups: Pick<Group, 'id' | 'priority'>[]): Group {
  if (groups.length >= 12)
    throw new Error('The lab supports at most 12 groups.');
  const priority = Array.from({ length: 12 }, (_, i) => i + 1).find(
    (n) => !groups.some((g) => g.priority === n),
  )!;
  const id = Array.from({ length: 12 }, (_, i) =>
    String.fromCharCode(65 + i),
  ).find((id) => !groups.some((g) => g.id === id))!;
  return { id, name: 'Group ' + id, weight: 100, priority };
}
export type Fraction = { numerator: string; denominator: string };
export type AllocationRow = Group & {
  seats: number;
  quota: Fraction;
  lowerQuota: number;
  upperQuota: number;
  deviation: Fraction;
  quotaStatus: 'below' | 'within' | 'above';
  weightShare: number;
  seatShare: number;
};
export type Candidate = {
  id: string;
  priority: number;
  numerator: string;
  denominator: string;
};
export type TraceStep = {
  step: number;
  id: string;
  numerator: string;
  denominator: string;
  tied: string[];
  awarded: boolean;
  candidates: Candidate[];
};
export type Allocation = {
  method: Method;
  house: number;
  totalWeight: number;
  rows: AllocationRow[];
  baseAllocation: { id: string; seats: number }[];
  trace: TraceStep[];
  cutoffTie: string[];
};
function compareFraction(a: Candidate, b: Candidate): number {
  const left = BigInt(a.numerator) * BigInt(b.denominator),
    right = BigInt(b.numerator) * BigInt(a.denominator);
  return left === right ? 0 : left > right ? -1 : 1;
}
function ranked(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) => compareFraction(a, b) || a.priority - b.priority,
  );
}
export function allocate(input: State, includeTrace = true): Allocation {
  const { groups, house, method } = validateState(input);
  const total = groups.reduce((s, g) => s + BigInt(g.weight), 0n);
  const seats = groups.map(() => 0),
    trace: TraceStep[] = [];
  let cutoffTie: string[] = [],
    baseAllocation: { id: string; seats: number }[] = [];
  if (method === 'hamilton') {
    const remainders = groups.map((g, i) => {
      const numerator = BigInt(house) * BigInt(g.weight);
      seats[i] = Number(numerator / total);
      return {
        id: g.id,
        priority: g.priority,
        numerator: (numerator % total).toString(),
        denominator: total.toString(),
      };
    });
    baseAllocation = groups.map((g, i) => ({ id: g.id, seats: seats[i] }));
    const left = house - seats.reduce((s, n) => s + n, 0),
      order = ranked(remainders);
    if (
      left > 0 &&
      left < order.length &&
      compareFraction(order[left - 1], order[left]) === 0
    )
      cutoffTie = order
        .filter((c) => compareFraction(c, order[left - 1]) === 0)
        .map((c) => c.id);
    order.forEach((c, i) => {
      if (i < left) seats[groups.findIndex((g) => g.id === c.id)]++;
      if (includeTrace)
        trace.push({
          step: i + 1,
          id: c.id,
          numerator: c.numerator,
          denominator: c.denominator,
          tied: order
            .filter((v) => compareFraction(c, v) === 0)
            .map((v) => v.id),
          awarded: i < left,
          candidates: [],
        });
    });
  } else {
    baseAllocation = groups.map((g) => ({ id: g.id, seats: 0 }));
    const priorityAt = (g: Group, held: number): Candidate => ({
      id: g.id,
      priority: g.priority,
      numerator: String(g.weight),
      denominator: String(method === 'dhondt' ? held + 1 : 2 * held + 1),
    });
    for (let step = 1; step <= house; step++) {
      const candidates = groups.map((g, i) => priorityAt(g, seats[i]));
      const order = ranked(candidates),
        winner = order[0];
      const tied = order
        .filter((c) => compareFraction(c, winner) === 0)
        .map((c) => c.id);
      seats[groups.findIndex((g) => g.id === winner.id)]++;
      if (step === house && tied.length > 1) {
        cutoffTie = groups
          .filter(
            (g, i) =>
              (seats[i] > 0 &&
                compareFraction(priorityAt(g, seats[i] - 1), winner) === 0) ||
              compareFraction(priorityAt(g, seats[i]), winner) === 0,
          )
          .sort((a, b) => a.priority - b.priority)
          .map((g) => g.id);
      }
      if (includeTrace)
        trace.push({
          step,
          id: winner.id,
          numerator: winner.numerator,
          denominator: winner.denominator,
          tied,
          awarded: true,
          candidates: order,
        });
    }
  }
  const rows = groups.map((g, i): AllocationRow => {
    const numerator = BigInt(house) * BigInt(g.weight),
      lower = Number(numerator / total),
      upper = Number((numerator + total - 1n) / total);
    return {
      ...g,
      seats: seats[i],
      quota: { numerator: numerator.toString(), denominator: total.toString() },
      lowerQuota: lower,
      upperQuota: upper,
      deviation: {
        numerator: (BigInt(seats[i]) * total - numerator).toString(),
        denominator: total.toString(),
      },
      quotaStatus:
        seats[i] < lower ? 'below' : seats[i] > upper ? 'above' : 'within',
      weightShare: g.weight / Number(total),
      seatShare: seats[i] / house,
    };
  });
  return {
    method,
    house,
    totalWeight: Number(total),
    rows,
    baseAllocation,
    trace,
    cutoffTie,
  };
}
export type SeatEvent = {
  from: number;
  to: number;
  losses: { id: string; name: string; before: number; after: number }[];
};
export function scanHouseSizes(groups: Group[], method: Method): SeatEvent[] {
  let previous = allocate({ groups, house: 1, method }, false);
  const events: SeatEvent[] = [];
  for (let house = 2; house <= 200; house++) {
    const next = allocate({ groups, house, method }, false);
    const losses = previous.rows.flatMap((g, i) =>
      next.rows[i].seats < g.seats
        ? [
            {
              id: g.id,
              name: g.name,
              before: g.seats,
              after: next.rows[i].seats,
            },
          ]
        : [],
    );
    if (losses.length) events.push({ from: house - 1, to: house, losses });
    previous = next;
  }
  return events;
}
export function fractionValue(f: Fraction) {
  return Number(f.numerator) / Number(f.denominator);
}
export function hamilton(groups: Group[], house: number) {
  return allocate({ groups, house, method: 'hamilton' }, false).rows;
}
export function readState(state: State) {
  const checked = validateState(state),
    result = allocate(checked, false);
  const next =
    checked.house < 200
      ? allocate({ ...checked, house: checked.house + 1 }, false)
      : null;
  return {
    configuration: checked,
    result,
    nextSeatLosses: next
      ? result.rows
          .filter((g, i) => next.rows[i].seats < g.seats)
          .map((g) => g.id)
      : null,
  };
}
export function exportJSON(state: State): string {
  const checked = validateState(state);
  return JSON.stringify(
    {
      schema: 'apportion/v1',
      modelVersion: '1.0.0',
      configuration: checked,
      selected: allocate(checked),
      comparison: METHODS.map((method) =>
        allocate({ ...checked, method }, false),
      ),
      tieRule:
        'Smaller immutable priority wins an exact tie. This is the lab convention, not a claimed institutional rule.',
      scope: SCOPE,
      sources: SOURCES,
    },
    null,
    2,
  );
}
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function exportCSV(state: State): string {
  const checked = validateState(state),
    results = METHODS.map((method) => allocate({ ...checked, method }, false)),
    selected = results[METHODS.indexOf(checked.method)];
  const lines: (string | number)[][] = [
    [
      'group_id',
      'group_name',
      'tie_priority',
      'weight',
      'total_seats',
      'quota_numerator',
      'quota_denominator',
      'hamilton',
      'dhondt',
      'sainte_lague',
      'selected_method',
      'selected_quota_status',
    ],
  ];
  checked.groups.forEach((g, i) =>
    lines.push([
      g.id,
      g.name,
      g.priority,
      g.weight,
      checked.house,
      selected.rows[i].quota.numerator,
      selected.rows[i].quota.denominator,
      ...results.map((r) => r.rows[i].seats),
      checked.method,
      selected.rows[i].quotaStatus,
    ]),
  );
  return lines.map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
