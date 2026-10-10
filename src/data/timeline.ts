// What the law is, month by month. The dated events are research (src/data/fontes/
// cronologia.json: every item has a source and a confidence rating); this file adds what each
// event does in the game. rulesAt() folds the `set` diffs in date order, so a law that
// arrives on a real date changes the game on that date.
import cronologia from './fontes/cronologia.json';
import type { L, Rules } from '../sim/types';

export interface TimelineEvent {
  y: number;
  m: number;
  category: string;
  head: L;
  body?: Partial<L>;
  /** What changes for the player, one or two lines. */
  game?: L[];
  set?: Partial<Rules>;
  /** Months added to every project still in review. */
  pause?: number;
  source?: string;
  confidence?: string;
  /** Front page: the paper opens and, by default, the clock waits. */
  major?: boolean;
  /** After today's date: a scenario, labelled as such. */
  spec?: boolean;
}

export const RULE_DEFAULTS: Rules = {
  plan: 1,
  asks: 0.07,
  simplex: false,
  alvara: true,
  alClosed: [],
  alFrozen: false,
  ivaNew: 0.23,
  ivaReab: 0.06,
  affBonus: 2,
  tenders: 'none',
  prrK: 0,
  prrDeadline: 0,
  labour: 1,
  fees: 1,
  tenantShield: 0.3,
  convFree: false,
};

// Parishes, by CAOP code.
const F = {
  ajuda: '110601', alcantara: '110602', beato: '110607', campolide: '110610', alvalade: '110654',
  areeiro: '110655', arroios: '110656', avenidas: '110657', belem: '110658', ourique: '110659',
  estrela: '110660', misericordia: '110661', nacoes: '110662', penha: '110663', smm: '110665',
  santoantonio: '110666', svicente: '110667',
};
const ALL = ['110601', '110602', '110607', '110608', '110610', '110611', '110618', '110621', '110633', '110639', '110654', '110655', '110656', '110657', '110658', '110659', '110660', '110661', '110662', '110663', '110664', '110665', '110666', '110667'];
const AL_2022 = [F.ajuda, F.alcantara, F.areeiro, F.arroios, F.avenidas, F.belem, F.ourique, F.estrela, F.misericordia, F.nacoes, F.penha, F.smm, F.santoantonio, F.svicente];
const PRR_DEADLINE = (2026 - 2015) * 12 + 7; // August 2026

const T = (pt: string, en: string): L => ({ pt, en });

/** Game effects, keyed by "date|category" of the researched event. */
const EFFECTS: Record<string, Omit<Partial<TimelineEvent>, 'y' | 'm' | 'head' | 'category'>> = {
  '2015-04-06|politics': { major: true, game: [T('Fernando Medina preside à Câmara; o PS mantém 11 dos 17 vereadores.', 'Fernando Medina chairs the Câmara; PS keeps 11 of the 17 councillors.')] },
  '2017-06-19|programme': {
    major: true, set: { tenders: 'pra' },
    game: [T('Terrenos municipais passam a ir a concurso para renda acessível: o terreno é cedido, as rendas são fixadas pela Câmara.', 'City land now goes out to tender for affordable rent: the land is granted, the rents are set by the city.')],
  },
  '2017-10-01|politics': { major: true, game: [T('A partir de outubro, o PS tem 8 dos 17 vereadores: os projetos que vão a votos precisam de outros apoios.', 'From October, PS holds 8 of 17 seats: projects that go to a vote need other support.')] },
  '2018-07-17|law': { set: { tenantShield: 0.45 }, game: [T('Despejar inquilinos idosos ou com deficiência fica mais difícil.', 'Evicting elderly or disabled tenants gets harder.')] },
  '2018-11-09|al': {
    major: true, set: { alClosed: [F.smm, F.misericordia, F.estrela] },
    game: [T('Deixa de ser possível registar alojamento local em Santa Maria Maior, Misericórdia e Estrela (no jogo, a freguesia inteira).', 'New short lets can no longer be registered in Santa Maria Maior, Misericórdia and Estrela (in the game, the whole parish).')],
  },
  '2019-02-12|law': { major: true, set: { tenantShield: 0.6 }, game: [T('Esvaziar um prédio para obras fica mais caro e mais arriscado em tribunal.', 'Emptying a building for works becomes costlier and riskier in court.')] },
  '2019-11-05|al': {
    set: { alClosed: [F.smm, F.misericordia, F.estrela, F.santoantonio, F.arroios, F.avenidas, F.svicente] },
    game: [T('Zonas de contenção absoluta: sem novo alojamento local no centro histórico, na Colina de Santana e nas avenidas (no jogo, as freguesias inteiras).', 'Absolute containment zones: no new short lets in the historic centre, Colina de Santana and the avenues (in the game, whole parishes).')],
  },
  '2020-04-06|law': { major: true, pause: 2, game: [T('A pandemia abranda os serviços: cada processo em apreciação ganha 2 meses.', 'The pandemic slows the city’s services: every file in review gains 2 months.')] },
  '2021-07|programme': {
    major: true, set: { prrK: 40, prrDeadline: PRR_DEADLINE },
    game: [T('Até agosto de 2026, cada casa a renda acessível que acabe a tempo recebe 40 mil euros (simplificação dos apoios do PRR).', 'Until August 2026, each affordable home finished in time brings €40,000 (a simplification of the recovery-plan funding).')],
  },
  '2021-09-26|politics': { major: true, game: [T('Carlos Moedas toma posse em outubro com 7 dos 17 vereadores: a oposição tem maioria.', 'Carlos Moedas takes office in October with 7 of 17 councillors: the opposition has a majority.')] },
  '2022-04-15|al': {
    major: true, set: { alClosed: AL_2022 },
    game: [T('Novos registos de alojamento local suspensos em 14 freguesias.', 'New short-let registrations suspended in 14 parishes.')],
  },
  '2022-07-27|market': { major: true, game: [T('Os juros sobem: os bancos exigem mais margem e a renda acessível deixa de fechar contas sem ajuda.', 'Rates rise: banks want bigger margins, and affordable rent stops adding up without help.')] },
  '2022-10|al': { set: { alClosed: [...AL_2022, F.campolide] }, game: [T('Campolide junta-se às freguesias sem novos registos.', 'Campolide joins the parishes closed to new registrations.')] },
  '2022-12-14|programme': { set: { tenders: 'none' }, game: [T('A Câmara deixa de pôr terrenos a concurso para renda acessível.', 'The city stops tendering land for affordable rent.')] },
  '2023-06-02|al': { set: { alClosed: [...AL_2022, F.campolide, F.beato] }, game: [T('O Beato fecha a novos registos: 16 freguesias.', 'Beato closes to new registrations: 16 parishes.')] },
  '2023-10-07|law': {
    major: true, set: { alFrozen: true },
    game: [T('Novos registos de alojamento local congelados em quase todo o país.', 'New short-let registrations frozen in almost all of the country.'), T('Acabam os vistos gold por compra de casa.', 'Golden visas for home purchases end.')],
  },
  '2024-02|programme': { set: { tenders: 'coop' }, game: [T('Terrenos municipais passam a ser cedidos a cooperativas: casas a preço de custo para os cooperantes.', 'City land is now granted to co-operatives: homes at cost for their members.')] },
  '2024-03-04|law': {
    major: true, set: { simplex: true, alvara: false, asks: 0.05, plan: 0.85, convFree: true },
    game: [
      T('Para processos novos: se a Câmara não decidir no prazo, podes invocar o deferimento tácito, e só pode pedir elementos uma vez.', 'For new files: if the city misses its deadline you may claim tacit approval, and it may ask for documents only once.'),
      T('Acaba o alvará: o recibo das taxas basta. Converter escritórios em habitação deixa de precisar de licença.', 'The permit (alvará) goes: the fee receipt is enough. Turning offices into homes no longer needs a licence.'),
    ],
  },
  '2024-10-23|al': { set: { alFrozen: false }, game: [T('O congelamento nacional acaba; cada município decide.', 'The national freeze ends; each municipality decides.')] },
  '2024-11-05|al': { major: true, set: { alClosed: ALL }, game: [T('Nenhuma freguesia de Lisboa aceita novos registos de alojamento local.', 'No Lisbon parish accepts new short-let registrations.')] },
  '2025-09-25|tax': { major: true, game: [T('Anunciado o IVA a 6% na construção de habitação; ainda não está em vigor.', 'Six per cent VAT on building homes is announced; it is not yet in force.')] },
  '2025-10-12|politics': { major: true, game: [T('O novo executivo toma posse em novembro: Moedas com 8 de 17, ainda sem maioria.', 'The new executive takes office in November: Moedas with 8 of 17, still short of a majority.')] },
  '2025-12-02|al': {
    major: true, set: { alClosed: [F.smm, F.misericordia, F.santoantonio, F.svicente, F.arroios, F.estrela] },
    game: [T('Acaba a suspensão geral: só as seis freguesias com mais de 10% de alojamento local ficam fechadas.', 'The citywide freeze ends: only the six parishes above 10% short lets stay closed.')],
  },
  '2026-04-06|al': { set: { alClosed: [F.smm, F.misericordia, F.santoantonio] }, game: [T('Só Santa Maria Maior, Misericórdia e Santo António continuam fechadas a novos registos.', 'Only Santa Maria Maior, Misericórdia and Santo António stay closed to new registrations.')] },
  '2026-05-20|tax': { major: true, game: [T('A partir de julho de 2026, a construção de casas para venda ou arrendamento paga 6% de IVA em vez de 23%.', 'From July 2026, building homes for sale or rent pays 6% VAT instead of 23%.')] },
  '2026-09-07|programme': { set: { prrK: 0 }, game: [T('Fechou a janela do PRR: acabam os apoios por casa a renda acessível.', 'The recovery-plan window has closed: no more grants per affordable home.')] },
  '2026-10-01|law': { major: true, set: { plan: 0.8, asks: 0.04 }, game: [T('A comunicação prévia passa a declaração de responsabilidade: menos verificação, prazos mais curtos.', 'Prior notice becomes a self-declaration: less checking, shorter waits.')] },
};

/** Effects dated after the event that announced them. */
const EXTRA: TimelineEvent[] = [
  {
    y: 2026, m: 7, category: 'tax', set: { ivaNew: 0.06 },
    head: T('IVA a 6% na construção de habitação entra em vigor', '6% VAT on housing construction takes effect'),
    game: [T('As obras de habitação pagam 6% de IVA (casas até 660 982 euros ou rendas até 2300 euros por mês).', 'Housing works pay 6% VAT (homes up to €660,982 or rents up to €2,300 a month).')],
    source: 'https://observador.pt/2026/05/20/pacote-fiscal-da-habitacao-ja-publicado-em-diario-da-republica-iva-da-construcao-a-6-valido-para-obras-iniciadas-desde-setembro-de-2025/',
    confidence: 'high',
  },
  {
    y: 2029, m: 9, category: 'politics', spec: true, major: true,
    head: T('Lisboa vai a votos em outubro', 'Lisbon goes to the polls in October'),
    game: [T('Fim do jogo: o fundo faz a última revisão.', 'End of the game: the fund makes its last review.')],
  },
];

interface Raw { date: string; category: string; title_pt: string; title_en: string; summary_en?: string; summary_pt?: string; source?: string; confidence?: string }

export const TIMELINE: TimelineEvent[] = [
  ...(cronologia as Raw[]).map((e) => {
    const [y, m] = e.date.split('-').map(Number);
    const fx = EFFECTS[`${e.date}|${e.category}`] ?? {};
    return {
      y, m, category: e.category,
      head: { pt: e.title_pt, en: e.title_en },
      body: { pt: e.summary_pt, en: e.summary_en },
      source: e.source, confidence: e.confidence,
      ...fx,
    } as TimelineEvent;
  }),
  ...EXTRA,
].sort((a, b) => a.y - b.y || a.m - b.m);

/** Keys of EFFECTS that matched no researched event (tests use this). */
export const UNMATCHED_EFFECTS = Object.keys(EFFECTS).filter((k) => !(cronologia as Raw[]).some((e) => `${e.date}|${e.category}` === k));
