import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SITES_BY_ID } from '../data/sites';
import { projectById, resolve } from '../sim/sim';
import type { Lang, Project } from '../sim/types';
import { GoalBar, NewsBar, TopBar, type Modal } from './Chrome';
import { CamaraDialog, DecisionDialog, EndDialog, HelpDialog, LogDialog, PaperDialog, RulesDialog } from './Dialogs';
import { LangContext, STRINGS } from './i18n';
import { CityOverview, ProjectSheet, SiteSheet } from './Inspector';
import { ProjectsList, SitesList, TeamsFoot } from './Lists';
import { LAYERS, MapView, type Layer } from './MapView';
import { Title } from './Title';
import { pref, setPref, useGame, type Speed } from './useGame';

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'pt') return q;
  } catch {
    /* ignore */
  }
  return pref('lang', 'pt') === 'en' ? 'en' : 'pt';
}

/**
 * lang: set by a host page that owns the language (estimador.pt routes /pt and /en); the
 * game then shows no language switch. embedded: the host has its own sticky header,
 * document title and main landmark.
 */
export function App({ lang: hostLang, embedded = false }: { lang?: Lang; embedded?: boolean } = {}) {
  const game = useGame();
  const [ownLang, setLangState] = useState<Lang>(() => hostLang ?? initialLang());
  const lang = hostLang ?? ownLang;
  const [sel, setSel] = useState<{ site?: string; project?: number }>({});
  const [layer, setLayer] = useState<Layer>('mapa');
  const [names, setNames] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<'projects' | 'sites'>('sites');
  const [mobile, setMobile] = useState<'list' | 'details'>('details');
  const [decisionOpen, setDecisionOpen] = useState(true);
  const topRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const s = game.s;

  const setLang = hostLang ? undefined : (l: Lang) => { setLangState(l); setPref('lang', l); };
  useEffect(() => {
    if (embedded) return;
    document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en-GB';
    document.title = `${STRINGS.title[lang]} · estimador.pt`;
  }, [lang, embedded]);

  // The main grid fills what the header leaves.
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => rootRef.current?.style.setProperty('--chrome-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [s != null]); // eslint-disable-line react-hooks/exhaustive-deps

  const decision = s?.decisions[0];
  const showDecision = !!decision && decisionOpen && !modal && game.paper == null;
  useEffect(() => { if (decision) setDecisionOpen(true); }, [decision?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { game.setHold(modal != null); }, [modal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: space pauses, 1-4 set the speed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!s || modal || showDecision || game.paper != null) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); game.setSpeed(game.speed ? 0 : 1); }
      if (['1', '2', '3', '4'].includes(e.key)) game.setSpeed(Number(e.key) as Speed);
      if (e.key === '0') game.setSpeed(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s, modal, showDecision, game]);

  const selectSite = useCallback((id: string) => {
    if (!s) return;
    const pid = s.taken[id];
    const p = pid != null ? projectById(s, pid) : s.projects.filter((x) => x.site === id && x.stage === 'done').at(-1);
    setSel(p ? { project: p.id, site: id } : { site: id });
    setMobile('details');
  }, [s]);
  const selectProject = (p: Project) => { setSel({ project: p.id, site: p.site }); setMobile('details'); };

  if (!s) {
    return (
      <LangContext.Provider value={lang}>
        <div className={`hab${embedded ? ' embedded' : ''}`}>
          <Title saved={game.saved} onStart={(d) => { game.start(d); setModal('help'); setSel({}); }} onResume={() => { game.resume(); setSel({}); }} lang={lang} setLang={setLang} />
        </div>
      </LangContext.Provider>
    );
  }

  const selProject = sel.project != null ? projectById(s, sel.project) : undefined;
  const selSite = !selProject && sel.site ? SITES_BY_ID[sel.site] : undefined;
  const lastNews = s.news.at(-1);

  return (
    <LangContext.Provider value={lang}>
      <div className={`hab${embedded ? ' embedded' : ''}`} ref={rootRef}>
        <a href="#hab-map" className="sr-only">{lang === 'pt' ? 'Saltar para o mapa' : 'Skip to the map'}</a>
        <header className="hab-top" ref={topRef}>
          <TopBar
            s={s}
            speed={game.speed}
            setSpeed={game.setSpeed}
            openModal={setModal}
            lang={lang}
            setLang={setLang}
            onQuit={() => { if (window.confirm(lang === 'pt' ? 'Começar de novo? Perdes este jogo.' : 'Start over? This game will be lost.')) { game.quit(); setSel({}); } }}
          />
          <GoalBar s={s} />
        </header>
        <div className="hab-main">
          <div className="hab-mobile-tabs" role="tablist">
            <button role="tab" aria-selected={mobile === 'list'} onClick={() => setMobile('list')}>{lang === 'pt' ? 'Projetos e terrenos' : 'Projects and sites'}</button>
            <button role="tab" aria-selected={mobile === 'details'} onClick={() => setMobile('details')}>{lang === 'pt' ? 'Detalhe' : 'Details'}</button>
          </div>
          <aside className={`hab-panel left${mobile === 'list' ? ' on' : ''}`} aria-label={lang === 'pt' ? 'Projetos e terrenos' : 'Projects and sites'}>
            <div className="hab-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'projects'} onClick={() => setTab('projects')}>{STRINGS.yourProjects[lang]} ({s.projects.filter((p) => !['done', 'dead', 'sold'].includes(p.stage)).length})</button>
              <button role="tab" aria-selected={tab === 'sites'} onClick={() => setTab('sites')}>{STRINGS.sites[lang]}</button>
            </div>
            <div className="hab-panel-body">
              {tab === 'projects'
                ? <ProjectsList s={s} selected={sel.project} onSelect={selectProject} />
                : <SitesList s={s} selected={sel.site} onSelect={selectSite} />}
            </div>
            <TeamsFoot game={game} />
          </aside>
          <section className="hab-stage" id="hab-map" aria-label={lang === 'pt' ? 'Mapa' : 'Map'}>
            <div className="hab-map-tools">
              <div className="hab-seg" role="group" aria-label={lang === 'pt' ? 'Camada do mapa' : 'Map layer'}>
                {LAYERS.map((l) => <button key={l.key} aria-pressed={layer === l.key} onClick={() => setLayer(l.key)}>{l.label[lang]}</button>)}
              </div>
              <label className="hab-check" style={{ minHeight: 34 }}>
                <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} />
                <span>{STRINGS.names[lang]}</span>
              </label>
            </div>
            <MapView s={s} selected={sel} onSelect={selectSite} layer={layer} names={names} />
            <NewsBar item={lastNews} onOpen={() => lastNews && game.setPaper(s.news.length - 1)} pause={game.pauseForNews} setPause={game.setPauseForNews} />
          </section>
          <aside className={`hab-panel right${mobile === 'details' ? ' on' : ''}`} aria-label={lang === 'pt' ? 'Detalhe' : 'Details'}>
            <div className="hab-panel-body">
              {selProject ? (
                <ProjectSheet key={selProject.id} game={game} p={selProject} openDecision={() => setDecisionOpen(true)} />
              ) : selSite ? (
                <SiteSheet key={selSite.id} game={game} site={selSite} onFiled={(p) => { setSel({ project: p.id, site: p.site }); setTab('projects'); if (!game.speed) game.setSpeed(1); }} />
              ) : (
                <CityOverview s={s} />
              )}
              {(selProject || selSite) && (
                <button className="hab-btn text" style={{ marginTop: 16 }} onClick={() => setSel({})}>{lang === 'pt' ? '← Voltar à cidade' : '← Back to the city'}</button>
              )}
            </div>
          </aside>
        </div>

        {showDecision && decision && (
          <DecisionDialog s={s} d={decision} onChoose={(k) => { game.act((st) => resolve(st, decision.id, k)); if (decision.project != null) setSel({ project: decision.project, site: projectById(s, decision.project)?.site }); }} />
        )}
        {game.paper != null && s.news[game.paper] && <PaperDialog s={s} item={s.news[game.paper]} onClose={() => game.setPaper(null)} />}
        {modal === 'rules' && <RulesDialog s={s} onClose={() => setModal(null)} />}
        {modal === 'camara' && <CamaraDialog s={s} onClose={() => setModal(null)} />}
        {modal === 'log' && <LogDialog s={s} onClose={() => setModal(null)} />}
        {modal === 'help' && <HelpDialog onClose={() => setModal(null)} />}
        {s.over && !s.decisions.length && !modal && game.paper == null && <EndDialog s={s} onNew={() => { game.quit(); setSel({}); }} />}
      </div>
    </LangContext.Provider>
  );
}
