// Who sits in the Câmara Municipal de Lisboa: the 17-member executive that votes on the
// projects that need it (allotments, plans, exceptions, municipal land).
//
// Seats per list are the official results of each local election (CNE / SGMAI). How each
// list votes on a project in the game (lean, aff, al, evict) is an editorial simplification
// for play, not a measurement of anyone's record; the Rulebook says so.

export interface Bloc {
  key: string;
  name: string;
  color: string; // estimador.pt party colours where they exist
  /** Toward approving private projects, -1..1, before the project's own merits. */
  lean: number;
  /** How much a higher affordable share moves this list (per 100% affordable). */
  aff: number;
  /** Penalty for short lets, and for emptying a building of its tenants. */
  al: number;
  evict: number;
}

export interface Mandate {
  from: [number, number]; // year, month the executive took office
  mayor: string;
  mayorBloc: string;
  seats: Record<string, number>;
  note: { pt: string; en: string };
}

export const BLOCS: Record<string, Bloc> = {
  ps13: { key: 'ps13', name: 'PS', color: '#e91e63', lean: 0.7, aff: 0.4, al: 0.1, evict: 0.3 },
  psd13: { key: 'psd13', name: 'PSD/CDS/MPT', color: '#ff6f00', lean: 0.15, aff: 0.1, al: 0, evict: 0.1 },
  cdu: { key: 'cdu', name: 'CDU', color: '#f44336', lean: -0.45, aff: 1.4, al: 0.6, evict: 0.9 },
  ps17: { key: 'ps17', name: 'PS', color: '#e91e63', lean: 0.65, aff: 0.6, al: 0.25, evict: 0.4 },
  cds17: { key: 'cds17', name: 'CDS', color: '#5c6bc0', lean: 0.2, aff: 0.1, al: 0, evict: 0.1 },
  psd17: { key: 'psd17', name: 'PSD', color: '#ff6f00', lean: 0.2, aff: 0.1, al: 0, evict: 0.1 },
  be17: { key: 'be17', name: 'BE', color: '#9c27b0', lean: 0.05, aff: 1.2, al: 0.7, evict: 1 },
  nt: { key: 'nt', name: 'Novos Tempos', color: '#ff6f00', lean: 0.7, aff: 0.3, al: 0.05, evict: 0.2 },
  pl: { key: 'pl', name: 'Mais Lisboa (PS/L)', color: '#e91e63', lean: -0.05, aff: 1.1, al: 0.5, evict: 0.6 },
  be: { key: 'be', name: 'BE', color: '#9c27b0', lean: -0.35, aff: 1.3, al: 0.8, evict: 1 },
  ptl: { key: 'ptl', name: 'Por ti, Lisboa (PSD/CDS/IL)', color: '#ff6f00', lean: 0.75, aff: 0.3, al: 0.05, evict: 0.2 },
  vl: { key: 'vl', name: 'Viver Lisboa (PS/L/BE/PAN)', color: '#e91e63', lean: -0.1, aff: 1.2, al: 0.6, evict: 0.7 },
  ch: { key: 'ch', name: 'Chega', color: '#1976d2', lean: 0, aff: 0.2, al: 0, evict: 0.2 },
};

// The first executive is the one elected in 2013. António Costa left in April 2015 and
// Fernando Medina took over the same executive (same seats).
export const MANDATES: Mandate[] = [
  {
    from: [2013, 10],
    mayor: 'António Costa',
    mayorBloc: 'ps13',
    seats: { ps13: 11, psd13: 4, cdu: 2 },
    note: { pt: 'Maioria absoluta do PS (eleições de 2013).', en: 'PS absolute majority (2013 election).' },
  },
  {
    from: [2015, 4],
    mayor: 'Fernando Medina',
    mayorBloc: 'ps13',
    seats: { ps13: 11, psd13: 4, cdu: 2 },
    note: { pt: 'Fernando Medina substitui António Costa; a composição eleita em 2013 mantém-se.', en: 'Fernando Medina replaces António Costa; the executive elected in 2013 stays.' },
  },
  {
    from: [2017, 10],
    mayor: 'Fernando Medina',
    mayorBloc: 'ps17',
    seats: { ps17: 8, cds17: 4, psd17: 2, cdu: 2, be17: 1 },
    note: { pt: 'O PS perde a maioria e governa com um acordo com o BE.', en: 'PS loses its majority and governs with an agreement with BE.' },
  },
  {
    from: [2021, 10],
    mayor: 'Carlos Moedas',
    mayorBloc: 'nt',
    seats: { nt: 7, pl: 7, cdu: 2, be: 1 },
    note: { pt: 'Moedas ganha sem maioria: 7 de 17 vereadores.', en: 'Moedas wins without a majority: 7 of 17 councillors.' },
  },
  {
    from: [2025, 10],
    mayor: 'Carlos Moedas',
    mayorBloc: 'ptl',
    seats: { ptl: 8, vl: 6, ch: 2, cdu: 1 },
    note: { pt: 'Moedas reeleito com 8 de 17 vereadores, ainda sem maioria.', en: 'Moedas re-elected with 8 of 17 councillors, still without a majority.' },
  },
];
