import { FREGUESIAS } from '../data/freguesias';
import { SITES, SITES_BY_ID } from '../data/sites';
import { unitsOf } from '../sim/econ';
import { MAX_TEAMS, TEAM_COST, hireTeam, isLive, siteState, teamsBusy } from '../sim/sim';
import { fmtSpan } from '../sim/time';
import type { GameState, Project } from '../sim/types';
import { STAGE, fmtM, stageClass } from './format';
import { useT } from './i18n';
import type { Game } from './useGame';

const KIND: Record<string, { pt: string; en: string }> = {
  lote: { pt: 'Construção nova', en: 'New build' },
  reab: { pt: 'Reabilitação', en: 'Rehabilitation' },
  armazem: { pt: 'Antiga indústria', en: 'Former industry' },
  escritorio: { pt: 'Conversão', en: 'Conversion' },
  municipal: { pt: 'Terreno municipal', en: 'City land' },
  grande: { pt: 'Bairro inteiro', en: 'Whole district' },
};
export const kindLabel = (k: string) => KIND[k];

export function ProjectsList({ s, selected, onSelect }: { s: GameState; selected?: number; onSelect: (p: Project) => void }) {
  const { t, s: str, lang } = useT();
  const pending = new Set(s.decisions.map((d) => d.project));
  const live = s.projects.filter(isLive);
  const closed = s.projects.filter((p) => !isLive(p));
  if (!s.projects.length) return <p className="muted" style={{ fontSize: 13 }}>{str('noProjects')}</p>;
  const item = (p: Project) => {
    const site = SITES_BY_ID[p.site];
    const total = p.inStage + Math.max(0, p.left);
    return (
      <li key={p.id}>
        <button className={`hab-item${pending.has(p.id) ? ' alert' : ''}`} aria-current={selected === p.id} onClick={() => onSelect(p)}>
          <span className="hab-item-title">{t(site.name)}</span>
          <span className="hab-item-meta">
            <span className={`hab-tag ${stageClass(p)}`}>{t(STAGE[p.stage])}</span>
            <span>{FREGUESIAS[site.fr].name}</span>
            <span className="num">{p.units} {lang === 'pt' ? 'casas' : 'homes'} · {p.prog.floors} {lang === 'pt' ? 'pisos' : 'floors'}</span>
          </span>
          {isLive(p) && p.stage !== 'fin' && total > 0 && (
            <span className="hab-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (p.inStage / total) * 100)}%` }} /></span>
          )}
          {pending.has(p.id) && <span className="hab-item-meta" style={{ color: 'var(--color-red-700)', fontWeight: 700 }}>{str('decisionWaiting')}</span>}
          {p.suit && <span className="hab-item-meta"><span className="hab-tag bad">{lang === 'pt' ? 'Em tribunal' : 'In court'}</span></span>}
        </button>
      </li>
    );
  };
  return (
    <>
      <ul className="hab-list">{live.map(item)}</ul>
      {closed.length > 0 && (
        <>
          <h3 className="kicker hab-group-title">{str('closed')}</h3>
          <ul className="hab-list">{closed.slice().reverse().map(item)}</ul>
        </>
      )}
    </>
  );
}

export function SitesList({ s, selected, onSelect }: { s: GameState; selected?: string; onSelect: (id: string) => void }) {
  const { t, s: str, lang } = useT();
  const open = SITES.filter((x) => siteState(s, x) === 'open');
  if (!open.length) return <p className="muted" style={{ fontSize: 13 }}>{str('noSites')}</p>;
  return (
    <ul className="hab-list">
      {open.map((site) => (
        <li key={site.id}>
          <button className="hab-item" aria-current={selected === site.id} onClick={() => onSelect(site.id)}>
            <span className="hab-item-title">{t(site.name)}</span>
            <span className="hab-item-meta">
              <span className="hab-tag">{t(kindLabel(site.kind))}</span>
              <span>{FREGUESIAS[site.fr].name}</span>
              <span className="num">{unitsOf(site, site.floors)} {lang === 'pt' ? 'casas' : 'homes'}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TeamsFoot({ game }: { game: Game }) {
  const { lang } = useT();
  const s = game.s!;
  const busy = teamsBusy(s);
  const can = s.teams < MAX_TEAMS && s.cash >= TEAM_COST;
  return (
    <div className="hab-panel-foot">
      <span>
        <strong>{lang === 'pt' ? 'Equipas' : 'Teams'}</strong> {busy}/{s.teams} {lang === 'pt' ? 'ocupadas' : 'busy'}
      </span>
      <button className="hab-btn small" disabled={!can} onClick={() => game.act(hireTeam)} title={lang === 'pt' ? `Uma equipa custa ${fmtM(TEAM_COST, 'pt')} e 25 mil € por mês` : `A team costs ${fmtM(TEAM_COST, 'en')} plus €25K a month`}>
        {lang === 'pt' ? `Contratar · ${fmtM(TEAM_COST, 'pt')}` : `Hire · ${fmtM(TEAM_COST, 'en')}`}
      </button>
    </div>
  );
}

export { fmtSpan };
