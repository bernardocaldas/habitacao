// The press. What you do leaves a trail: evictions, short lets, a former councillor on the
// payroll, a garden offered the week of a vote, a licence obtained by the city's silence.
// Each month a newspaper may pick one of those up. A story costs standing, angers the groups
// it touches, and, while it runs, makes councillors keep their distance from the project
// (see votes.ts). How you answer decides how long it runs, and whether the public prosecutor
// gets interested.
//
// The papers are invented, and so is every story: they are about your invented company.
// Two real moments raise the press's appetite for speculation stories: the Robles case of
// July 2018 and the first Casa para Viver march of April 2023 (both in the dated timeline).
// So do the months before a local election.
import { FREGUESIAS } from '../data/freguesias';
import { PRE_ELECTION } from '../data/politics';
import { SITES_BY_ID } from '../data/sites';
import { heatFor } from './heat';
import { chance, rand, randInt } from './rng';
import { cutFloors, decide, isLive, log, news, projectById, reprogram, usesTeam } from './sim';
import { monthOf } from './time';
import { nextElection } from './votes';
import type { Decision, GameState, L, Option, Project } from './types';

const T = (pt: string, en: string): L => ({ pt, en });
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Invented outlets. Any likeness to a real paper is unintended. */
export const PAPERS = { diario: 'Diário do Largo', semanario: 'O Varandim', digital: 'Folha da Colina' } as const;

type Topic = 'especulacao' | 'favores' | 'cidade';

interface StoryDef {
  kind: string;
  topic: Topic;
  paper: keyof typeof PAPERS;
  sev: number;
  /** Monthly chance before the press's appetite; 0 when the story does not apply. */
  rate: (s: GameState, p: Project) => number;
  head: (s: GameState, p: Project) => L;
  lede: (s: GameState, p: Project) => L;
  options: (s: GameState, p: Project) => Option[];
}

const site = (p: Project) => SITES_BY_ID[p.site];
const fr = (p: Project) => FREGUESIAS[site(p).fr];
const nm = (p: Project) => site(p).name;
const fighting = (p: Project) => usesTeam(p);
const heat = (s: GameState, p: Project) => heatFor(site(p), p.prog, p.units, s.standing, p.mult);
const since = (s: GameState, p: Project, key: string) => s.month - (p.vars[key] ?? s.month);

const CALAR: Option = { key: 'calar', label: T('Não comentar', 'No comment'), hint: T('A história corre o seu curso.', 'The story runs its course.') };

export const STORIES: StoryDef[] = [
  {
    kind: 'despejo', topic: 'especulacao', paper: 'diario', sev: 1,
    rate: (s, p) => (p.once.evicted && since(s, p, 'evictedM') <= 24 ? 0.14 : 0),
    head: (_s, p) => T(`${fr(p).name}: os inquilinos de um prédio contam como tiveram de sair`, `${fr(p).name}: a building’s tenants tell how they were made to leave`),
    lede: (_s, p) => {
      const n = site(p).tenants ?? 0;
      const why = p.prog.exit === 'al' ? T('pôr os apartamentos em alojamento local', 'turn the flats into short lets') : p.prog.exit === 'arrendamento' ? T('arrendá-los a preços de mercado', 'let them at market rents') : T('vender os apartamentos renovados', 'sell the renovated flats');
      return T(`${n} famílias viviam no prédio com contratos antigos, algumas há décadas. A promotora quer ${why.pt}.`, `${n} households lived in the building on old leases, some for decades. The developer wants to ${why.en}.`);
    },
    options: (_s, p) => [
      { key: 'realojar', label: T('Realojar as famílias no bairro', 'Rehouse the families in the neighbourhood'), costM: round2((site(p).tenants ?? 0) * 0.05), hint: T('A história perde força e o movimento pela habitação acalma.', 'The story loses steam and the housing movement cools.') },
      { key: 'lei', label: T('Responder que tudo cumpre a lei', 'Say it was all within the law'), hint: T('Metade das vezes, há uma segunda notícia.', 'Half the time, a second story follows.') },
      CALAR,
    ],
  },
  {
    kind: 'consultor', topic: 'favores', paper: 'semanario', sev: 1.2,
    rate: (_s, p) => (p.once.consultor && isLive(p) ? 0.06 : 0),
    head: (_s, p) => T(`Antigo vereador trabalha para promotora com projeto em ${fr(p).name}`, `Former councillor works for a developer with a project in ${fr(p).name}`),
    lede: () => T('Sentou-se na Câmara que agora decide o projeto. A oposição pede explicações e fala em “porta giratória”.', 'They sat on the council that now decides the project. The opposition wants answers and talks of a “revolving door”.'),
    options: () => [
      { key: 'dispensar', label: T('Dispensar o consultor e publicar o contrato', 'Let the consultant go and publish the contract'), hint: T('Perdes essa ajuda; o caso arrefece.', 'You lose that help; the story cools.') },
      { key: 'negar', label: T('Negar qualquer favor', 'Deny any favour'), hint: T('Se aparecerem mais documentos, o Ministério Público pode abrir inquérito.', 'If more documents surface, the prosecutor may open an inquiry.') },
      CALAR,
    ],
  },
  {
    kind: 'favores', topic: 'favores', paper: 'semanario', sev: 0.8,
    rate: (s, p) => (p.once.cash && since(s, p, 'cashM') <= 18 ? 0.07 : 0),
    head: (_s, p) => T(`${fr(p).name}: promotora oferece obra ao bairro e o projeto passa na Câmara`, `${fr(p).name}: a developer offers the neighbourhood a facility, and its project passes`),
    lede: () => T('A oposição fala em troca de favores; a promotora diz que são cedências previstas na lei.', 'The opposition talks of trading favours; the developer says these are concessions the law provides for.'),
    options: () => [
      { key: 'publicar', label: T('Publicar o acordo e o parecer jurídico', 'Publish the agreement and the legal opinion'), costM: 0.02, hint: T('Transparência: a história perde força.', 'Transparency: the story loses steam.') },
      CALAR,
    ],
  },
  {
    kind: 'tacito', topic: 'favores', paper: 'semanario', sev: 0.7,
    rate: (_s, p) => (p.tacit ? 0.06 : 0),
    head: (_s, p) => T(`Licença pelo silêncio: projeto em ${fr(p).name} avança sem decisão da Câmara`, `Licensed by silence: a project in ${fr(p).name} goes ahead without a decision`),
    lede: () => T('O Simplex Urbanístico permite-o desde março de 2024. A oposição quer que a Câmara conteste a licença.', 'The Simplex reform has allowed it since March 2024. The opposition wants the city to contest the licence.'),
    options: (_s, p) => [
      { key: 'explicar', label: T('Explicar que é o que a lei prevê', 'Explain that this is what the law provides'), hint: T('A história passa; alguns vereadores não esquecem.', 'The story passes; some councillors do not forget.') },
      { key: 'pedir', label: T('Pedir à Câmara uma decisão expressa', 'Ask the city for a formal decision'), hint: usesTeam(p) ? T('Mais 3 meses, mas o banco e a Câmara ficam tranquilos.', '3 more months, but the bank and the city relax.') : T('O banco e a Câmara ficam tranquilos.', 'The bank and the city relax.') },
    ],
  },
  {
    kind: 'al', topic: 'especulacao', paper: 'diario', sev: 0.6,
    rate: (_s, p) => (p.prog.exit === 'al' && fr(p).hab >= 0.5 ? 0.03 : 0),
    head: (_s, p) => T(`Mais um prédio inteiro para turistas em ${fr(p).name}`, `Another whole building for tourists in ${fr(p).name}`),
    lede: (_s, p) => T(`${p.units} apartamentos em alojamento local, no mesmo prédio. Os moradores dizem que o bairro se esvazia.`, `${p.units} flats as short lets, in one building. Residents say the neighbourhood is emptying.`),
    options: (_s, p) => [
      { key: 'desistir', label: T('Desistir do alojamento local e vender as casas', 'Drop the short lets and sell the homes'), disabled: p.stage === 'obra', hint: p.stage === 'obra' ? T('Em obra, as contas já estão fechadas.', 'Under construction, the deal is already closed.') : T('Menos receita; a reputação sobe.', 'Less revenue; your standing rises.') },
      { key: 'manter', label: T('Manter: é legal', 'Keep them: it is legal'), hint: T('Os partidos de esquerda não esquecem.', 'The left-wing parties do not forget.') },
    ],
  },
  {
    kind: 'luxo', topic: 'especulacao', paper: 'digital', sev: 0.5,
    rate: (s, p) => {
      if (p.prog.exit !== 'venda' || p.prog.aff > 0 || p.units < 10 || fr(p).hab < 0.55) return 0;
      return s.month < monthOf(2023, 10) ? 0.025 : 0.015;
    },
    head: (s, p) => s.month < monthOf(2023, 10)
      ? T(`Vistos gold: apartamentos em ${fr(p).name} vendem-se antes de existirem`, `Golden visas: flats in ${fr(p).name} sell before they exist`)
      : T(`Casas de luxo em ${fr(p).name}: quem as vai comprar?`, `Luxury homes in ${fr(p).name}: who will buy them?`),
    lede: (s) => s.month < monthOf(2023, 10)
      ? T('Compradores de fora da União Europeia investem mais de 500 mil euros e ganham autorização de residência.', 'Buyers from outside the EU invest over €500,000 and get a residence permit.')
      : T('O projeto não tem uma única casa a renda acessível.', 'The project has not a single affordable home.'),
    options: (_s, p) => [
      { key: 'acessivel', label: T('Pôr 25% das casas a renda acessível', 'Make 25% of the homes affordable'), disabled: !usesTeam(p), hint: usesTeam(p) ? T('Menos receita; a história perde força.', 'Less revenue; the story loses steam.') : T('Já não dá para mudar o projeto.', 'Too late to change the project.') },
      CALAR,
    ],
  },
  {
    kind: 'altura', topic: 'cidade', paper: 'diario', sev: 0.6,
    rate: (s, p) => (fighting(p) && heat(s, p).over >= 0.5 ? 0.025 : 0),
    head: (_s, p) => T(`Prédio de ${p.prog.floors} pisos em ${fr(p).name} divide os moradores`, `A ${p.prog.floors}-storey building splits ${fr(p).name}`),
    lede: (_s, p) => T(`À volta, os prédios têm ${fr(p).ctx} pisos. A associação de moradores fala num “mamarracho”.`, `The buildings around it have ${fr(p).ctx} floors. The residents’ association calls it an “eyesore”.`),
    options: (_s, p) => [
      { key: 'cortar', label: T('Cortar um piso', 'Lose a floor'), disabled: !usesTeam(p) || p.prog.floors <= fr(p).ctx, hint: T('Menos casas; os moradores acalmam.', 'Fewer homes; the residents calm down.') },
      { key: 'defender', label: T('Publicar imagens e defender o projeto', 'Publish renderings and defend the project'), costM: 0.02, hint: T('Ou convence, ou piora.', 'Either it persuades, or it backfires.') },
    ],
  },
  {
    kind: 'patrimonio', topic: 'cidade', paper: 'digital', sev: 0.7,
    rate: (_s, p) => {
      if (p.once.arch && p.stage === 'obra') return 0.08;
      return fighting(p) && (site(p).heritage ?? 0) >= 0.5 && p.prog.floors > site(p).floors ? 0.02 : 0;
    },
    head: (_s, p) => p.once.arch
      ? T(`Vestígios arqueológicos numa obra em ${fr(p).name}: os trabalhos continuam?`, `Archaeological remains on a site in ${fr(p).name}: do the works go on?`)
      : T(`${p.prog.floors} pisos numa zona de proteção em ${fr(p).name}: o que diz o Património?`, `${p.prog.floors} floors in a protection zone in ${fr(p).name}: what does the heritage authority say?`),
    lede: (_s, p) => p.once.arch
      ? T('Os arqueólogos pedem mais tempo; a promotora quer avançar.', 'The archaeologists want more time; the developer wants to press on.')
      : T('Um grupo de cidadãos pede a suspensão do processo.', 'A citizens’ group wants the process suspended.'),
    options: (_s, p) => [
      { key: 'parecer', label: p.once.arch ? T('Dar mais tempo aos arqueólogos', 'Give the archaeologists more time') : T('Pedir um parecer independente', 'Commission an independent opinion'), costM: 0.05, hint: T('Mais 1 mês; os críticos acalmam.', '1 more month; the critics calm down.') },
      CALAR,
    ],
  },
];

const BY_KIND: Record<string, StoryDef> = Object.fromEntries(STORIES.map((d) => [d.kind, d]));

/** How hungry the press is this month for each kind of story, and why. */
export function appetite(month: number): { k: Record<Topic, number>; why: L[] } {
  const k: Record<Topic, number> = { especulacao: 1, favores: 1, cidade: 1 };
  const why: L[] = [];
  const e = nextElection(month);
  if (e && e.months <= PRE_ELECTION) {
    for (const t of Object.keys(k) as Topic[]) k[t] *= 1.4;
    why.push(T('Eleições à porta: os jornais procuram histórias sobre a Câmara.', 'Elections near: the papers look for stories about City Hall.'));
  }
  if (month >= monthOf(2018, 8) && month < monthOf(2019, 8)) {
    k.especulacao *= 1.6;
    why.push(T('Depois do caso Robles (julho de 2018), a imprensa anda atenta à especulação no centro.', 'After the Robles case (July 2018), the press is watching speculation in the centre.'));
  }
  if (month >= monthOf(2023, 4) && month < monthOf(2024, 4)) {
    k.especulacao *= 1.3;
    why.push(T('O movimento Casa para Viver põe a habitação nas primeiras páginas.', 'The Casa para Viver movement puts housing on the front pages.'));
  }
  return { k, why };
}

/** Each month, at most one story, and none for a few months after the last one. */
export function pressMonth(s: GameState) {
  if (s.month < s.press.next) return;
  const { k } = appetite(s.month);
  const mood = 1.2 - s.standing / 250;
  const cands: { p: Project; d: StoryDef; r: number }[] = [];
  for (const p of s.projects) {
    if (!isLive(p) || (p.story && p.story.until > s.month)) continue;
    for (const d of STORIES) {
      if (p.once[`story_${d.kind}`]) continue;
      const r = d.rate(s, p) * k[d.topic] * mood;
      if (r > 0) cands.push({ p, d, r });
    }
  }
  if (!cands.length) return;
  const none = cands.reduce((a, c) => a * (1 - c.r), 1);
  if (!chance(s.rng, 1 - none)) return;
  let u = rand(s.rng) * cands.reduce((a, c) => a + c.r, 0);
  const hit = cands.find((c) => (u -= c.r) <= 0) ?? cands[cands.length - 1];
  breakStory(s, hit.p, hit.d);
}

function breakStory(s: GameState, p: Project, d: StoryDef) {
  const paper = PAPERS[d.paper];
  const head = d.head(s, p);
  const lede = d.lede(s, p);
  p.once[`story_${d.kind}`] = true;
  p.story = { kind: d.kind, m: s.month, until: s.month + randInt(s.rng, 6, 10), sev: d.sev };
  s.press.next = s.month + randInt(s.rng, 4, 7);
  s.stats.stories++;
  s.standing = clamp(s.standing - Math.round(3 * d.sev), 0, 100);
  news(s, { head, body: lede, real: false, project: p.id, paper });
  decide(s, {
    kind: `story:${d.kind}`, project: p.id, tone: 'bad',
    title: T('Estás nas notícias', 'You are in the news'),
    press: { paper, head, lede },
    lines: [T('Enquanto a história correr, os vereadores mantêm distância do projeto. Como respondes?', 'While the story runs, councillors keep their distance from the project. How do you answer?')],
    options: d.options(s, p),
  });
}

/** A follow-up: the story runs longer and hurts more. */
function secondStory(s: GameState, p: Project, head: L) {
  if (!p.story) return;
  p.story.until = Math.max(p.story.until, s.month + 6);
  p.story.sev += 0.3;
  s.standing = clamp(s.standing - 4, 0, 100);
  const kind = BY_KIND[p.story.kind];
  news(s, { head, real: false, project: p.id, paper: kind ? PAPERS[kind.paper] : undefined });
}

/** Cools a story: it fades sooner and weighs less. */
function soften(s: GameState, p: Project, f = 0.4) {
  if (!p.story) return;
  p.story.sev *= f;
  p.story.until = Math.min(p.story.until, s.month + 3);
}

export function openInquiry(s: GameState, p: Project) {
  if (p.inquiry) return;
  p.inquiry = { left: randInt(s.rng, 12, 24) };
  s.stats.inquiries++;
  news(s, { head: T(`Ministério Público abre inquérito a projeto em ${fr(p).name}`, `Prosecutor opens an inquiry into a project in ${fr(p).name}`), real: false, project: p.id, paper: PAPERS.semanario });
  log(s, T(`${nm(p).pt}: o Ministério Público abriu um inquérito. O banco espera pelo arquivamento.`, `${nm(p).en}: the prosecutor opened an inquiry. The bank waits for it to be closed.`), p.id, 'bad');
}

/** Called monthly for a project under inquiry. */
export function stepInquiry(s: GameState, p: Project) {
  if (!p.inquiry) return;
  p.inquiry.left--;
  if (p.inquiry.left > 0) return;
  p.inquiry = undefined;
  if (chance(s.rng, 0.8)) {
    s.standing = clamp(s.standing + 2, 0, 100);
    log(s, T(`${nm(p).pt}: o inquérito foi arquivado.`, `${nm(p).en}: the inquiry was closed with no charges.`), p.id, 'good');
    return;
  }
  s.cash -= 0.3;
  s.standing = clamp(s.standing - 8, 0, 100);
  news(s, { head: T(`Acusação no caso do projeto em ${fr(p).name}`, `Charges brought in the ${fr(p).name} project case`), real: false, project: p.id, paper: PAPERS.semanario });
  log(s, T(`${nm(p).pt}: há acusação. Advogados e uma coima: 300 mil euros.`, `${nm(p).en}: charges brought. Lawyers and a fine: €300,000.`), p.id, 'bad');
}

const up = (s: GameState, n: number) => { s.standing = clamp(s.standing + n, 0, 100); };

export function resolveStory(s: GameState, d: Decision, key: string) {
  const p = d.project != null ? projectById(s, d.project) : undefined;
  if (!p) return;
  const kind = d.kind.slice('story:'.length);
  const r = s.rng;
  if (key === 'calar') {
    up(s, -3);
    if (BY_KIND[kind]?.topic === 'cidade') p.mult.viz *= 1.12; else p.mult.hab *= 1.12;
    if (kind === 'consultor' && chance(r, 0.2)) openInquiry(s, p);
    if (kind === 'favores' && chance(r, 0.12)) openInquiry(s, p);
    return;
  }
  switch (kind) {
    case 'despejo':
      if (key === 'realojar') { soften(s, p); p.mult.hab *= 0.8; up(s, 2); }
      else if (chance(r, 0.5)) secondStory(s, p, T(`${fr(p).name}: mais inquilinos contam como saíram`, `${fr(p).name}: more tenants tell how they left`));
      else up(s, -2);
      return;
    case 'consultor':
      if (key === 'dispensar') { p.once.consultor = false; soften(s, p); up(s, -1); if (chance(r, 0.05)) openInquiry(s, p); }
      else if (chance(r, 0.3)) { secondStory(s, p, T('Os emails do antigo vereador que trabalha para a promotora', 'The emails of the former councillor working for the developer')); openInquiry(s, p); }
      else up(s, -3);
      return;
    case 'favores':
      soften(s, p, 0.5); up(s, -1);
      if (chance(r, 0.03)) openInquiry(s, p);
      return;
    case 'tacito':
      if (key === 'pedir') { p.tacit = false; soften(s, p, 0.3); up(s, 1); if (usesTeam(p)) p.left += 3; }
      else up(s, -1);
      return;
    case 'al':
      if (key === 'desistir') { reprogram(s, p, { ...p.prog, exit: 'venda' }); soften(s, p, 0.3); p.mult.hab *= 0.8; up(s, 2); }
      else { up(s, -3); p.mult.hab *= 1.15; }
      return;
    case 'luxo':
      if (key === 'acessivel') { reprogram(s, p, { ...p.prog, aff: 0.25 }); soften(s, p, 0.3); p.mult.hab *= 0.85; up(s, 2); }
      return;
    case 'altura':
      if (key === 'cortar') { cutFloors(s, p, p.prog.floors - 1); soften(s, p); p.mult.viz *= 0.85; up(s, 1); }
      else if (chance(r, 0.5)) { p.mult.viz *= 0.9; up(s, 1); }
      else { p.mult.viz *= 1.15; up(s, -2); }
      return;
    case 'patrimonio':
      soften(s, p); p.mult.viz *= 0.85; p.left += 1;
      return;
  }
}

export const storyKind = (p: Project) => (p.story ? BY_KIND[p.story.kind] : undefined);
export const paperOf = (p: Project) => { const d = storyKind(p); return d ? PAPERS[d.paper] : undefined; };
