// The bar across the top: name, clock, the numbers that matter, the menu, and the fund's
// next target with what is done, what is sure and what could still make it.
import { goalStatus, progress } from '../sim/goals';
import { econAt } from '../sim/econ';
import { DIFFICULTY } from '../sim/goals';
import { fmtMonth, fmtMonthLong } from '../sim/time';
import type { GameState, NewsItem } from '../sim/types';
import { fmtM, num } from './format';
import { STRINGS, useT } from './i18n';
import type { Speed } from './useGame';

export type Modal = 'rules' | 'camara' | 'log' | 'help' | 'paper' | 'end' | null;

export function TopBar({ s, speed, setSpeed, openModal, lang, setLang, onQuit }: {
  s: GameState;
  speed: Speed;
  setSpeed: (x: Speed) => void;
  openModal: (m: Modal) => void;
  lang: 'pt' | 'en';
  setLang?: (l: 'pt' | 'en') => void;
  onQuit: () => void;
}) {
  const { s: str } = useT();
  const pr = progress(s);
  const building = s.projects.filter((p) => p.stage === 'obra').reduce((a, p) => a + p.units - p.built, 0);
  const review = s.projects.filter((p) => ['pip', 'plano', 'arq', 'cp', 'discussao', 'camara'].includes(p.stage)).reduce((a, p) => a + p.units, 0);
  const e = econAt(s.month);
  const speeds: { sp: Speed; label: string; title: keyof typeof STRINGS }[] = [
    { sp: 0, label: '❚❚', title: 'pause' },
    { sp: 1, label: '▶', title: 'speed1' },
    { sp: 2, label: '▶▶', title: 'speed2' },
    { sp: 3, label: '▶▶▶', title: 'speed3' },
    { sp: 4, label: '▶❚', title: 'speed4' },
  ];
  return (
    <div className="hab-top-row">
      <div className="hab-brand">
        <span className="hab-brand-title">{str('title')}</span>
        <span className="hab-brand-sub">{str('subtitle')}</span>
      </div>
      <div className="hab-clock">
        <time className="hab-date" aria-live="polite" dateTime={`${2015 + Math.floor(s.month / 12)}-${String((s.month % 12) + 1).padStart(2, '0')}`} title={fmtMonthLong(s.month, lang)}>
          {fmtMonth(s.month, lang)}
        </time>
        <div className="hab-speed" role="group" aria-label={lang === 'pt' ? 'Velocidade' : 'Speed'}>
          {speeds.map((x) => (
            <button key={x.sp} aria-pressed={speed === x.sp} title={str(x.title)} aria-label={str(x.title)} onClick={() => setSpeed(x.sp)}>{x.label}</button>
          ))}
        </div>
      </div>
      <div className="hab-stats">
        <Stat label={str('cash')} value={fmtM(s.cash, lang)} bad={s.cash < 0} />
        <Stat label={str('built')} value={num(pr.built, lang)} />
        <Stat label={str('building')} value={num(building, lang)} />
        <Stat label={str('inReview')} value={num(review, lang)} />
        <Stat label={str('standing')} value={`${Math.round(s.standing)}`} bad={s.standing < 30} />
        <Stat label="Euribor" value={`${num(e.euribor, lang, 2)}%`} extra />
      </div>
      <nav className="hab-menu" aria-label={lang === 'pt' ? 'Menu do jogo' : 'Game menu'}>
        <button className="hab-btn" onClick={() => openModal('rules')}>{str('rules')}</button>
        <button className="hab-btn" onClick={() => openModal('camara')}>{str('camara')}</button>
        <button className="hab-btn" onClick={() => openModal('log')}>{str('log')}</button>
        <button className="hab-btn" onClick={() => openModal('help')} aria-label={str('help')}>?</button>
        {setLang && <button className="hab-btn" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')} aria-label={lang === 'pt' ? 'English' : 'Português'}>{lang === 'pt' ? 'EN' : 'PT'}</button>}
        <button className="hab-btn" onClick={onQuit} aria-label={str('newGame')}><span className="label-long">{str('newGame')}</span><span className="label-short">{lang === 'pt' ? 'Novo' : 'New'}</span></button>
      </nav>
    </div>
  );
}

function Stat({ label, value, bad, extra }: { label: string; value: string; bad?: boolean; extra?: boolean }) {
  return (
    <div className={`hab-stat${extra ? ' extra' : ''}`}>
      <span className="label">{label}</span>
      <span className={`value${bad ? ' bad' : ''}`}>{value}</span>
    </div>
  );
}

export function GoalBar({ s }: { s: GameState }) {
  const { lang } = useT();
  const g = goalStatus(s);
  if (!g) return null;
  const max = DIFFICULTY[s.difficulty].strikes;
  const scale = Math.max(g.need * 1.15, g.have + g.sure, 1);
  const w = (x: number) => `${Math.min(100, (x / scale) * 100)}%`;
  const what = g.review.kind === 'licensed'
    ? (lang === 'pt' ? `${g.need} projeto licenciado` : `${g.need} licensed project`)
    : g.review.kind === 'started'
      ? (lang === 'pt' ? `${num(g.need, lang)} casas em obra` : `${num(g.need, lang)} homes started`)
      : (lang === 'pt' ? `${num(g.need, lang)} casas construídas` : `${num(g.need, lang)} homes built`);
  const statusLabel: Record<string, [string, string]> = {
    met: ['cumprida', 'met'], ontrack: ['a caminho', 'on track'], risk: ['em risco', 'at risk'], behind: ['atrasada', 'behind'], early: ['a começar', 'early days'],
  };
  return (
    <div className="hab-goal">
      <div className="hab-goal-text">
        {lang === 'pt' ? 'Próxima revisão do fundo' : 'Next fund review'}: <strong>{what}</strong> {lang === 'pt' ? 'até' : 'by'} {fmtMonth(g.review.m, lang)}
      </div>
      <div className="hab-goal-bar" role="img" aria-label={lang === 'pt' ? `Feito ${g.have}, garantido ${g.sure}, possível ${g.maybe}, meta ${g.need}` : `Done ${g.have}, sure ${g.sure}, possible ${g.maybe}, target ${g.need}`}>
        <span className="maybe" style={{ left: 0, width: w(g.have + g.sure + g.maybe) }} />
        <span className="sure" style={{ left: 0, width: w(g.have + g.sure) }} />
        <span className="have" style={{ left: 0, width: w(g.have) }} />
        <span className="target" style={{ left: w(g.need) }} />
      </div>
      <div className="hab-goal-meta">
        <span className={`hab-status ${g.status}`}>{statusLabel[g.status][lang === 'pt' ? 0 : 1]}</span>
        <span className="num">{num(g.have, lang)} / {num(g.need, lang)}</span>
        <span>{g.left > 0 ? (lang === 'pt' ? `faltam ${g.left} meses` : `${g.left} months left`) : ''}</span>
        <span className="hab-strikes" aria-label={lang === 'pt' ? `${s.review.strikes} de ${max} avisos` : `${s.review.strikes} of ${max} strikes`}>
          {Array.from({ length: max }, (_, i) => <i key={i} className={i < s.review.strikes ? 'on' : ''} />)}
        </span>
      </div>
    </div>
  );
}

export function NewsBar({ item, onOpen, pause, setPause }: { item?: NewsItem; onOpen: () => void; pause: boolean; setPause: (v: boolean) => void }) {
  const { t, s: str, lang } = useT();
  return (
    <div className="hab-newsbar">
      <span className="mast">{item?.paper ?? 'O Parecer'}</span>
      {item ? (
        <>
          <span className={`hab-stamp ${item.real ? 'real' : 'fic'}`}>{item.real ? str('real') : str('fiction')}</span>
          <span className="head" title={t(item.head)}>{t(item.head)}</span>
          <button className="hab-btn small" onClick={onOpen}>{str('read')}</button>
        </>
      ) : (
        <span className="head muted">{lang === 'pt' ? 'Sem notícias por agora.' : 'No news yet.'}</span>
      )}
      <label className="hab-check" title={str('pauseForNews')}>
        <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} />
        <span>{lang === 'pt' ? 'Parar' : 'Pause'}</span>
      </label>
    </div>
  );
}
