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
  standfirst: S('O tempo que leva pôr casas de pé em Lisboa', 'The time it takes to get homes built in Lisbon'),
  lede: S(
    'És uma pequena promotora com o apoio de um fundo. De janeiro de 2015 às autárquicas de 2029, tenta pôr casas de pé em Lisboa: escolhe terrenos, desenha projetos e atravessa licenciamentos, pareceres, votações na Câmara, tribunais, juros e custos de construção. As leis mudam nas datas em que mudaram de verdade.',
    'You are a small developer backed by a fund. From January 2015 to the 2029 local elections, try to get homes built in Lisbon: pick sites, design projects and make it through licensing, expert opinions, Câmara votes, courts, interest rates and construction costs. The laws change on the dates they really changed.',
  ),
  // The page's own title (the tab and link previews), as in index.html.
  docTitle: S('Aguarda parecer: um jogo sobre pôr casas de pé em Lisboa', 'Awaiting opinion: a game about getting homes built in Lisbon'),
  kicker: S('Um jogo · Lisboa, 2015–2029', 'A game · Lisbon, 2015–2029'),
  // Said before Start, in plain words: what is invented, what is real, and which way the
  // rules lean (npm run balance: the dense strategy wins almost every scripted game, the
  // affordable one is mostly fired by the fund).
  gameNoteHead: S('Isto é um jogo.', 'This is a game.'),
  gameNote: S(
    'Os terrenos, as personagens e as notícias sobre a tua empresa são inventados. As leis e as datas em que mudaram são reais, tal como as freguesias, os lugares de cada lista na Câmara e os preços do INE. As regras do jogo são uma simplificação, e os seus pressupostos favorecem a densidade: construir denso compensa quase sempre, e apostar em casas acessíveis raramente chega às metas do fundo.',
    'The sites, the characters and the news about your company are invented. The laws and the dates they changed are real, as are the parishes, each list’s seats on the Câmara and INE’s prices. The game’s rules are a simplification, and their assumptions favour density: building dense almost always pays, and betting on affordable homes rarely meets the fund’s targets.',
  ),
  honesty: S(
    'As regras explicam como o jogo combina os factos e onde estão as fontes. As probabilidades e os intervalos que vês são do próprio jogo, não previsões.',
    'The rules explain how the game combines the facts and where the sources are. The odds and intervals you see are the game’s own, not forecasts.',
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
