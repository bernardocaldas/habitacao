// Who sits in the Câmara Municipal de Lisboa: the 17-member executive that votes on the
// projects that need it (allotments, plans, exceptions, municipal land, the big ones).
//
// Seats per list are the official results of each local election (CNE / SGMAI). How a party
// weighs a project in the game (lean, aff, al, evict, local) is an editorial simplification
// for play, not a measurement of anyone's record; the Rulebook says so.
//
// The rule is real (Lei 75/2013 and the Câmara's standing orders): a proposal passes with
// more votes in favour than against; abstentions do not count, and on a tie the mayor's
// casting vote decides. The mayor also sets the agenda: a proposal the executive does not
// want never reaches the table.

export interface Bloc {
  key: string;
  /** Party or list name as it appears in roll calls. */
  name: string;
  color: string; // estimador.pt party colours where they exist
  /** Toward approving private projects, -1..1, before the project's own merits. */
  lean: number;
  /** How much the affordable share moves this group (per 100% affordable, against a 25% expectation). */
  aff: number;
  /** Penalty for short lets, and for emptying a building of its tenants. */
  al: number;
  evict: number;
  /** How much the neighbours' and heritage groups' anger moves this group. */
  local: number;
}

export interface Mandate {
  from: [number, number]; // year, month the executive took office
  mayor: string;
  mayorBloc: string;
  /** Councillor with the planning portfolio (Urbanismo), from the dated timeline. */
  urbanismo: string;
  seats: Record<string, number>;
  note: { pt: string; en: string };
}

export const BLOCS: Record<string, Bloc> = {
  ps13: { key: 'ps13', name: 'PS', color: '#E57373', lean: 0.55, aff: 0.4, al: 0.1, evict: 0.3, local: 0.4 },
  psd13: { key: 'psd13', name: 'PSD/CDS/MPT', color: '#FF8C00', lean: 0.3, aff: 0.1, al: 0, evict: 0.1, local: 0.5 },
  cdu: { key: 'cdu', name: 'CDU', color: '#E41A1C', lean: -0.5, aff: 1.4, al: 0.6, evict: 0.9, local: 0.5 },
  ps17: { key: 'ps17', name: 'PS', color: '#E57373', lean: 0.55, aff: 0.6, al: 0.25, evict: 0.4, local: 0.4 },
  cds17: { key: 'cds17', name: 'CDS', color: '#4A6FA5', lean: 0.3, aff: 0.1, al: 0, evict: 0.1, local: 0.6 },
  psd17: { key: 'psd17', name: 'PSD', color: '#FF8C00', lean: 0.3, aff: 0.1, al: 0, evict: 0.1, local: 0.5 },
  be17: { key: 'be17', name: 'BE', color: '#1d1d1b', lean: -0.35, aff: 1.3, al: 0.8, evict: 1, local: 0.4 },
  nt: { key: 'nt', name: 'Novos Tempos', color: '#FF8C00', lean: 0.6, aff: 0.3, al: 0.05, evict: 0.2, local: 0.4 },
  pl: { key: 'pl', name: 'Mais Lisboa (PS/L)', color: '#E57373', lean: 0.05, aff: 1, al: 0.5, evict: 0.6, local: 0.5 },
  be: { key: 'be', name: 'BE', color: '#1d1d1b', lean: -0.4, aff: 1.3, al: 0.8, evict: 1, local: 0.4 },
  ptl: { key: 'ptl', name: 'PSD/CDS/IL', color: '#FF8C00', lean: 0.6, aff: 0.3, al: 0.05, evict: 0.2, local: 0.4 },
  ps25: { key: 'ps25', name: 'PS', color: '#E57373', lean: 0.05, aff: 1, al: 0.5, evict: 0.6, local: 0.5 },
  l25: { key: 'l25', name: 'Livre', color: '#5FB35F', lean: -0.25, aff: 1.2, al: 0.7, evict: 0.8, local: 0.6 },
  be25: { key: 'be25', name: 'BE', color: '#1d1d1b', lean: -0.4, aff: 1.3, al: 0.8, evict: 1, local: 0.4 },
  ch: { key: 'ch', name: 'Chega', color: '#377EB8', lean: 0.1, aff: 0.2, al: 0, evict: 0.1, local: 0.8 },
};

// The first executive is the one elected in 2013. António Costa left in April 2015 and
// Fernando Medina took over the same executive (same seats). From 2025 the six councillors
// of Viver Lisboa (PS/L/BE/PAN) are counted by party, as the roll calls report them
// (4 PS, 1 Livre, 1 BE; the 2026 budget vote).
export const MANDATES: Mandate[] = [
  {
    from: [2013, 10],
    mayor: 'António Costa',
    mayorBloc: 'ps13',
    urbanismo: 'Manuel Salgado',
    seats: { ps13: 11, psd13: 4, cdu: 2 },
    note: { pt: 'Maioria absoluta do PS (eleições de 2013).', en: 'PS absolute majority (2013 election).' },
  },
  {
    from: [2015, 4],
    mayor: 'Fernando Medina',
    mayorBloc: 'ps13',
    urbanismo: 'Manuel Salgado',
    seats: { ps13: 11, psd13: 4, cdu: 2 },
    note: { pt: 'Fernando Medina substitui António Costa; a composição eleita em 2013 mantém-se.', en: 'Fernando Medina replaces António Costa; the executive elected in 2013 stays.' },
  },
  {
    from: [2017, 10],
    mayor: 'Fernando Medina',
    mayorBloc: 'ps17',
    urbanismo: 'Manuel Salgado',
    seats: { ps17: 8, cds17: 4, psd17: 2, cdu: 2, be17: 1 },
    note: { pt: 'O PS perde a maioria e governa com um acordo com o BE.', en: 'PS loses its majority and governs with an agreement with BE.' },
  },
  {
    from: [2019, 10],
    mayor: 'Fernando Medina',
    mayorBloc: 'ps17',
    urbanismo: 'Ricardo Veludo',
    seats: { ps17: 8, cds17: 4, psd17: 2, cdu: 2, be17: 1 },
    note: { pt: 'Manuel Salgado sai do Urbanismo; Ricardo Veludo sucede-lhe.', en: 'Manuel Salgado leaves the planning portfolio; Ricardo Veludo succeeds him.' },
  },
  {
    from: [2021, 10],
    mayor: 'Carlos Moedas',
    mayorBloc: 'nt',
    urbanismo: 'Joana Almeida',
    seats: { nt: 7, pl: 7, cdu: 2, be: 1 },
    note: { pt: 'Moedas ganha sem maioria: 7 de 17 vereadores.', en: 'Moedas wins without a majority: 7 of 17 councillors.' },
  },
  {
    from: [2025, 11],
    mayor: 'Carlos Moedas',
    mayorBloc: 'ptl',
    urbanismo: 'Vasco Moreira Rato',
    seats: { ptl: 8, ps25: 4, ch: 2, l25: 1, be25: 1, cdu: 1 },
    note: { pt: 'Moedas reeleito com 8 de 17 vereadores, ainda sem maioria; o Chega vota com a coligação nas matérias principais.', en: 'Moedas re-elected with 8 of 17 councillors, still without a majority; Chega votes with the coalition on the main matters.' },
  },
];

/** Local elections inside the game (the last one ends it). */
export const ELECTIONS: [number, number][] = [[2017, 10], [2021, 9], [2025, 10], [2029, 10]];

/** Months before an election when the executive keeps contested projects off the agenda. */
export const PRE_ELECTION = 6;
/** Months after a new executive takes office before it schedules planning votes. */
export const NEW_EXECUTIVE = 2;

/** Standing arrangements that move a group toward the executive, from the dated timeline. */
export const AGREEMENTS: { bloc: string; from: [number, number]; until?: [number, number]; w: number; label: { pt: string; en: string } }[] = [
  { bloc: 'be17', from: [2017, 11], until: [2021, 10], w: 0.45, label: { pt: 'acordo de governação com o PS', en: 'governing agreement with PS' } },
  { bloc: 'ch', from: [2025, 11], w: 0.45, label: { pt: 'vota com a coligação nas matérias principais', en: 'votes with the coalition on the main matters' } },
];
