// Interface copy. Data (sites, news, decisions) carries its own { pt, en } pairs; this is the
// chrome. Portuguese addresses the player as "tu"; English is en-GB. Sentence case, no
// exclamation marks.
import { createContext, useContext } from 'react';
import type { L, Lang } from '../sim/types';

export const LangContext = createContext<Lang>('pt');
export const useLang = () => useContext(LangContext);

export function useT() {
  const lang = useLang();
  return {
    lang,
    t: (x: L | undefined) => (x ? x[lang] : ''),
    s: (k: keyof typeof STRINGS) => STRINGS[k][lang],
  };
}

const S = (pt: string, en: string): L => ({ pt, en });

export const STRINGS = {
  title: S('Aguarda parecer', 'Awaiting opinion'),
  subtitle: S('Um simulador de habitação em Lisboa', 'A Lisbon housing simulator'),
  question: S('Quanto tempo demora a construir casas em Lisboa?', 'How long does it take to build homes in Lisbon?'),
  lede: S(
    'És uma pequena promotora com o apoio de um fundo. De janeiro de 2015 às autárquicas de 2029, tenta pôr casas de pé em Lisboa: escolhe terrenos, desenha projetos e atravessa licenciamentos, pareceres, votações na Câmara, tribunais, juros e custos de construção. As leis mudam nas datas em que mudaram de verdade.',
    'You are a small developer backed by a fund. From January 2015 to the 2029 local elections, try to get homes built in Lisbon: pick sites, design projects and make it through licensing, expert opinions, Câmara votes, courts, interest rates and construction costs. The laws change on the dates they really changed.',
  ),
  honesty: S(
    'Os terrenos e as personagens são inventados. As freguesias, as leis, a composição da Câmara e os preços são reais e têm fonte; a forma como o jogo os combina é uma simplificação, explicada nas regras. As probabilidades que vês são as do próprio jogo.',
    'The sites and the characters are invented. The parishes, the laws, the make-up of the Câmara and the prices are real and sourced; how the game combines them is a simplification, explained in the rules. The odds you see are the game’s own.',
  ),
  newGame: S('Novo jogo', 'New game'),
  continue: S('Continuar', 'Continue'),
  start: S('Começar em janeiro de 2015', 'Start in January 2015'),
  difficulty: S('Dificuldade', 'Difficulty'),
  rules: S('Regras', 'Rules'),
  camara: S('Câmara', 'City Hall'),
  log: S('Registo', 'Log'),
  help: S('Ajuda', 'Help'),
  paper: S('Jornal', 'Paper'),
  cash: S('Caixa', 'Cash'),
  built: S('Casas feitas', 'Homes built'),
  building: S('Em obra', 'Building'),
  licensed: S('Licenciadas', 'Licensed'),
  inReview: S('Em apreciação', 'In review'),
  standing: S('Reputação', 'Standing'),
  euribor: S('Euribor', 'Euribor'),
  pause: S('Pausa (espaço)', 'Pause (space)'),
  speed1: S('Normal (1)', 'Normal (1)'),
  speed2: S('Rápido (2)', 'Fast (2)'),
  speed3: S('Mais rápido (3)', 'Faster (3)'),
  speed4: S('Avançar até à próxima decisão (4)', 'Skip to the next decision (4)'),
  yourProjects: S('Os teus projetos', 'Your projects'),
  sites: S('Terrenos', 'Sites'),
  details: S('Detalhe', 'Details'),
  map: S('Mapa', 'Map'),
  teams: S('Equipas', 'Teams'),
  hire: S('Contratar', 'Hire'),
  closed: S('Encerrados', 'Closed'),
  noProjects: S('Ainda não tens projetos. Escolhe um terreno no mapa ou na lista de terrenos.', 'No projects yet. Pick a site on the map or in the site list.'),
  noSites: S('Não há terrenos disponíveis agora. Aparecem outros com o tempo.', 'No sites available right now. Others appear over time.'),
  soon: S('Em breve', 'Coming'),
  layer: S('Camada', 'Layer'),
  names: S('Nomes', 'Names'),
  zoomIn: S('Aproximar', 'Zoom in'),
  zoomOut: S('Afastar', 'Zoom out'),
  reset: S('Repor', 'Reset'),
  read: S('Ler', 'Read'),
  close: S('Fechar', 'Close'),
  real: S('Real', 'Real'),
  fiction: S('Ficção', 'Fiction'),
  scenario: S('Cenário', 'Scenario'),
  whatChanges: S('O que muda para ti', 'What changes for you'),
  thisIsReal: S('Isto é real', 'This is real'),
  source: S('Fonte', 'Source'),
  alsoNews: S('Também nas notícias', 'Also in the news'),
  pauseForNews: S('Parar nas notícias', 'Pause for news'),
  decisionWaiting: S('Há uma decisão à tua espera', 'A decision is waiting for you'),
  teamFree: S('Uma equipa ficou livre', 'A team is free'),
} as const;
