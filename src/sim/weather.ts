// Political weather: the things that happen to a developer in Lisbon that are nobody's law.
// A card comes up every 7 to 11 months (sooner when the city has turned on you), each with
// its own cool-down and a test for whether it makes sense right now.
import { FREGUESIAS } from '../data/freguesias';
import { SITES_BY_ID } from '../data/sites';
import { heatFor } from './heat';
import { chance, pick, randInt } from './rng';
import { decide, isLive, log, saleValue, sellProject, usesTeam, projectById } from './sim';
import type { Decision, GameState, L, Project } from './types';

const T = (pt: string, en: string): L => ({ pt, en });
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

interface Card {
  key: string;
  every: number;
  pick: (s: GameState) => Project | null | true;
  play: (s: GameState, p: Project | null) => void;
}

const heat = (s: GameState, p: Project) => heatFor(SITES_BY_ID[p.site], p.prog, p.units, s.standing, p.mult);
const fighting = (p: Project) => ['pip', 'plano', 'arq', 'cp', 'discussao', 'camara'].includes(p.stage);
const nm = (p: Project) => SITES_BY_ID[p.site].name;
const frn = (p: Project) => FREGUESIAS[SITES_BY_ID[p.site].fr].name;

function pickWhere(s: GameState, f: (p: Project) => boolean): Project | null {
  const xs = s.projects.filter((p) => isLive(p) && f(p));
  return xs.length ? pick(s.rng, xs) : null;
}

const CARDS: Card[] = [
  {
    key: 'junta', every: 24,
    pick: (s) => pickWhere(s, (p) => fighting(p) && heat(s, p).opp >= 30),
    play: (s, p) => decide(s, {
      kind: 'card:junta', project: p!.id, tone: 'neutral',
      title: T(`O presidente da junta de ${frn(p!)} quer falar contigo`, `The ${frn(p!)} parish council president wants a word`),
      lines: [T(`Sobre ${nm(p!).pt}. Não tem voto na Câmara, mas tem os moradores do lado dele.`, `About ${nm(p!).en}. No vote at the Câmara, but the residents are on his side.`)],
      options: [
        { key: 'reunir', label: T('Marcar reunião e ouvir', 'Meet and listen'), hint: T('Mais 2 meses; a oposição acalma.', '2 more months; opposition cools.') },
        { key: 'recusar', label: T('Estás demasiado ocupado', 'You are too busy'), hint: T('Pode correr mal.', 'May go badly.') },
        { key: 'consultor', label: T('Contratar um antigo vereador como consultor', 'Hire a former councillor as consultant'), costM: 0.15 },
      ],
    }),
  },
  {
    key: 'abaixo', every: 30,
    pick: (s) => pickWhere(s, (p) => fighting(p) && heat(s, p).viz >= 30),
    play: (s, p) => decide(s, {
      kind: 'card:abaixo', project: p!.id, tone: 'bad',
      title: T('Abaixo-assinado contra o “mamarracho”', 'Petition against the “eyesore”'),
      lines: [
        T(`Mil assinaturas contra ${nm(p!).pt}. Dizem que o prédio “não respeita a escala do bairro”.`, `A thousand signatures against ${nm(p!).en}. They say the building “ignores the scale of the neighbourhood”.`),
      ],
      options: [
        { key: 'reunir', label: T('Sessão pública com os moradores', 'Public session with residents'), hint: T('Mais 1 mês.', '1 more month.') },
        { key: 'renders', label: T('Publicar imagens do projeto', 'Publish renderings'), costM: 0.03, hint: T('Ou convence, ou piora.', 'Either it persuades, or it backfires.') },
        { key: 'ignorar', label: T('Ignorar', 'Ignore it') },
      ],
    }),
  },
  {
    key: 'inquilinos', every: 30,
    pick: (s) => pickWhere(s, (p) => (fighting(p) || p.stage === 'esp') && heat(s, p).hab >= 30),
    play: (s, p) => decide(s, {
      kind: 'card:inquilinos', project: p!.id, tone: 'neutral',
      title: T('Um movimento pelo direito à habitação marca uma concentração', 'A right-to-housing group calls a rally'),
      lines: [T(`À porta de ${nm(p!).pt}: “casas para quem cá vive”.`, `Outside ${nm(p!).en}: “homes for the people who live here”.`)],
      options: [
        { key: 'reunir', label: T('Receber os organizadores', 'Meet the organisers'), hint: T('Mais 1 mês.', '1 more month.') },
        { key: 'compromisso', label: T('Comprometer-te: nada de alojamento local', 'Pledge: no short lets'), hint: p!.prog.exit === 'al' ? T('Passas a vender as casas.', 'You switch to selling the homes.') : T('Já não era o plano.', 'It was not the plan anyway.') },
        { key: 'ignorar', label: T('Ignorar', 'Ignore it') },
      ],
    }),
  },
  {
    key: 'sil', every: 36,
    pick: (s) => (s.projects.some(isLive) ? true : null),
    play: (s) => decide(s, {
      kind: 'card:sil', tone: 'neutral',
      title: T('Convite para o salão imobiliário', 'Invitation to the property fair'),
      lines: [T('Um stand na feira do setor: investidores, bancos, a imprensa da especialidade.', 'A stand at the trade fair: investors, banks, the trade press.')],
      options: [
        { key: 'stand', label: T('Montar um stand', 'Take a stand'), costM: 0.05 },
        { key: 'declinar', label: T('Declinar', 'Decline') },
      ],
    }),
  },
  {
    key: 'fundo', every: 30,
    pick: (s) => pickWhere(s, (p) => p.licensed != null && (p.stage === 'fin' || p.stage === 'esp' || p.stage === 'alvara') && !SITES_BY_ID[p.site].mega),
    play: (s, p) => {
      const v = Math.round(saleValue(s, p!) * 1.25 * 100) / 100;
      decide(s, {
        kind: 'card:fundo', project: p!.id, tone: 'neutral', data: { v },
        title: T('Um fundo estrangeiro quer comprar a tua licença', 'A foreign fund wants to buy your licence'),
        lines: [T(`Oferece ${v.toFixed(2).replace('.', ',')} M€ por ${nm(p!).pt}. As casas construídas por eles não contam para ti.`, `It offers €${v.toFixed(2)}M for ${nm(p!).en}. Homes they build do not count for you.`)],
        options: [
          { key: 'vender', label: T('Vender', 'Sell') },
          { key: 'recusar', label: T('Recusar', 'Decline') },
        ],
      });
    },
  },
  {
    key: 'tecnico', every: 28,
    pick: (s) => pickWhere(s, (p) => p.stage === 'arq'),
    play: (s, p) => {
      p!.left += 2;
      decide(s, {
        kind: 'card:tecnico', project: p!.id, tone: 'bad',
        title: T('O técnico do teu processo está de baixa', 'Your case officer is on sick leave'),
        lines: [T(`O processo de ${nm(p!).pt} espera por quem o herde. Mais 2 meses.`, `The ${nm(p!).en} file waits for someone to inherit it. 2 more months.`)],
        real: T('A falta de técnicos nos serviços de urbanismo é uma das razões mais citadas para a demora dos licenciamentos.', 'Staff shortages in planning departments are among the most cited reasons for slow licensing.'),
        options: [{ key: 'ok', label: T('Paciência', 'Patience') }],
      });
    },
  },
  {
    key: 'jornal', every: 26,
    pick: (s) => (s.projects.filter(isLive).length >= 2 ? true : null),
    play: (s) => decide(s, {
      kind: 'card:jornal', tone: 'neutral',
      title: T('Um jornal prepara uma reportagem sobre ti', 'A newspaper is writing about you'),
      lines: [T('Quer saber quem são os teus investidores e quanto vão custar as casas.', 'It wants to know who your investors are and what the homes will cost.')],
      options: [
        { key: 'responder', label: T('Dar uma entrevista', 'Give an interview'), hint: T('Pode correr bem ou mal.', 'Could go either way.') },
        { key: 'visita', label: T('Convidar para uma visita à obra', 'Invite them on a site visit'), costM: 0.02 },
        { key: 'calar', label: T('Sem comentários', 'No comment') },
      ],
    }),
  },
  {
    key: 'ruido', every: 24,
    pick: (s) => pickWhere(s, (p) => p.stage === 'obra'),
    play: (s, p) => decide(s, {
      kind: 'card:ruido', project: p!.id, tone: 'bad',
      title: T('Os vizinhos queixam-se do barulho da obra', 'Neighbours complain about construction noise'),
      lines: [T(`Em ${frn(p!)}, às sete da manhã de um sábado.`, `In ${frn(p!)}, at seven on a Saturday morning.`)],
      options: [
        { key: 'horario', label: T('Respeitar horários mais curtos', 'Keep shorter hours'), hint: T('A obra demora mais 1 mês.', 'Works take 1 more month.') },
        { key: 'ignorar', label: T('A obra não pode parar', 'The works cannot stop'), hint: T('Arriscas um embargo.', 'You risk a stop order.') },
      ],
    }),
  },
];

export function politicalWeather(s: GameState) {
  if (s.month < s.weather.next) return;
  const ready = CARDS.filter((c) => s.month - (s.weather.last[c.key] ?? -999) >= c.every);
  const options: { c: Card; p: Project | null }[] = [];
  for (const c of ready) {
    const p = c.pick(s);
    if (p) options.push({ c, p: p === true ? null : p });
  }
  if (!options.length) {
    s.weather.next = s.month + randInt(s.rng, 2, 4);
    return;
  }
  const { c, p } = pick(s.rng, options);
  s.weather.last[c.key] = s.month;
  s.weather.next = s.month + (s.standing < 30 ? randInt(s.rng, 5, 8) : randInt(s.rng, 7, 11));
  c.play(s, p);
}

export function resolveCard(s: GameState, d: Decision, key: string) {
  const p = d.project != null ? projectById(s, d.project) : undefined;
  const up = (n: number) => { s.standing = clamp(s.standing + n, 0, 100); };
  switch (d.kind) {
    case 'card:junta':
      if (!p) return;
      if (key === 'reunir') { if (usesTeam(p)) p.left += 2; p.mult.viz *= 0.85; up(2); }
      else if (key === 'recusar') { up(-3); if (chance(s.rng, 0.5) && usesTeam(p)) p.left += 2; }
      else { up(-1); p.mult.viz *= 0.95; p.mult.hab *= 0.95; }
      return;
    case 'card:abaixo':
      if (!p) return;
      if (key === 'reunir') { if (usesTeam(p)) p.left += 1; p.mult.viz *= 0.85; up(2); }
      else if (key === 'renders') p.mult.viz *= chance(s.rng, 0.5) ? 0.85 : 1.05;
      else { p.mult.viz *= 1.15; up(-2); }
      return;
    case 'card:inquilinos':
      if (!p) return;
      if (key === 'reunir') { if (usesTeam(p)) p.left += 1; p.mult.hab *= 0.85; up(2); }
      else if (key === 'compromisso') { if (p.prog.exit === 'al') p.prog = { ...p.prog, exit: 'venda' }; p.mult.hab *= 0.7; up(3); }
      else { p.mult.hab *= 1.15; up(-2); }
      return;
    case 'card:sil':
      if (key === 'stand') up(2);
      else if (chance(s.rng, 0.4)) up(-1);
      return;
    case 'card:fundo':
      if (p && key === 'vender') {
        const v = Number(d.data?.v ?? 0);
        const before = s.cash;
        if (sellProject(s, p.id)) s.cash = before + v;
      }
      return;
    case 'card:jornal':
      if (key === 'responder') up(chance(s.rng, 0.5) ? 2 : -1);
      else if (key === 'visita') up(1);
      else up(-1);
      return;
    case 'card:ruido':
      if (!p) return;
      if (key === 'horario') { p.left += 1; up(2); }
      else {
        up(-2);
        if (chance(s.rng, 0.2)) { p.left += randInt(s.rng, 1, 2); log(s, { pt: `${nm(p).pt}: embargo temporário por ruído.`, en: `${nm(p).en}: temporary stop order for noise.` }, p.id, 'bad'); }
      }
      return;
  }
}
