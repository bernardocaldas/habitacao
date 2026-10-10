// The phone layout: one screen, map first. A slim bar on top (the clock, the money, the next
// target), layer chips, the map, the news line and two buttons at the bottom. Everything
// else (a site, a project, the lists, the menu) opens in a sheet that slides up over the map
// and leaves the clock in view.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE, type ReactNode } from 'react';
import { econAt } from '../sim/econ';
import { DIFFICULTY, goalStatus, progress } from '../sim/goals';
import { fmtMonth, fmtMonthLong } from '../sim/time';
import type { GameState } from '../sim/types';
import { GoalBar, type Modal } from './Chrome';
import { fmtM, num } from './format';
import { useT } from './i18n';
import type { Speed } from './useGame';

/** True below the width where the three-column layout stops fitting. */
export function useCompact(query = '(max-width: 980px)') {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return on;
}

const SPEED_LABEL: Record<1 | 2 | 3, string> = { 1: '1×', 2: '2×', 3: '4×' };

export function CompactTop({ s, speed, setSpeed, onMenu }: {
  s: GameState;
  speed: Speed;
  setSpeed: (x: Speed) => void;
  onMenu: () => void;
}) {
  const { s: str, lang } = useT();
  const last = useRef<1 | 2 | 3>(1);
  if (speed >= 1 && speed <= 3) last.current = speed as 1 | 2 | 3;
  const g = goalStatus(s);
  const statusLabel: Record<string, [string, string]> = {
    met: ['cumprida', 'met'], ontrack: ['a caminho', 'on track'], risk: ['em risco', 'at risk'], behind: ['atrasada', 'behind'], early: ['a começar', 'early days'],
  };
  const what = !g ? '' : g.review.kind === 'licensed'
    ? (lang === 'pt' ? 'licenciado' : 'licensed')
    : g.review.kind === 'started' ? (lang === 'pt' ? 'em obra' : 'started') : (lang === 'pt' ? 'casas' : 'homes');
  const scale = g ? Math.max(g.need * 1.15, g.have + g.sure, 1) : 1;
  const w = (x: number) => `${Math.min(100, (x / scale) * 100)}%`;
  return (
    <>
      <div className="hab-ctop-row">
        <time className="hab-date" aria-live="polite" title={fmtMonthLong(s.month, lang)}>{fmtMonth(s.month, lang)}</time>
        <div className="hab-cclock" role="group" aria-label={lang === 'pt' ? 'Relógio' : 'Clock'}>
          <button className={`play${speed ? ' on' : ''}`} onClick={() => setSpeed(speed ? 0 : last.current)} aria-label={speed ? str('pause') : str('speed1')} aria-pressed={!!speed}>
            {speed ? '❚❚' : '▶'}
          </button>
          <button onClick={() => { const n = ((last.current % 3) + 1) as 1 | 2 | 3; last.current = n; setSpeed(n); }} aria-label={lang === 'pt' ? `Velocidade ${SPEED_LABEL[last.current]}; mudar` : `Speed ${SPEED_LABEL[last.current]}; change`}>
            {SPEED_LABEL[last.current]}
          </button>
          <button onClick={() => setSpeed(4)} aria-pressed={speed === 4} aria-label={str('speed4')} title={str('speed4')}>▶❚</button>
        </div>
        <button className="hab-btn hab-menu-btn" onClick={onMenu} aria-haspopup="dialog">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.8" /></svg>
          <span>{lang === 'pt' ? 'Menu' : 'Menu'}</span>
        </button>
      </div>
      <button className="hab-cstatus" onClick={onMenu} aria-label={lang === 'pt' ? 'Ver o estado do jogo e a meta do fundo' : 'See where you stand and the fund’s target'}>
        <span className={`cash${s.cash < 0 ? ' bad' : ''}`}>{fmtM(s.cash, lang)}</span>
        {g && (
          <>
            <span className="goal">
              <span className="txt">{lang === 'pt' ? 'Meta' : 'Target'} {fmtMonth(g.review.m, lang)}: <b className="num">{num(g.have, lang)}/{num(g.need, lang)}</b> {what}</span>
              <span className="bar" aria-hidden="true">
                <i className="maybe" style={{ width: w(g.have + g.sure + g.maybe) }} />
                <i className="sure" style={{ width: w(g.have + g.sure) }} />
                <i className="have" style={{ width: w(g.have) }} />
                <i className="target" style={{ left: w(g.need) }} />
              </span>
            </span>
            <span className={`hab-status ${g.status}`}>{statusLabel[g.status][lang === 'pt' ? 0 : 1]}</span>
          </>
        )}
      </button>
    </>
  );
}

/** A sheet that slides up from the bottom, half or full height; drag the handle or tap it. */
export function Sheet({ title, kicker, size, setSize, onClose, onHeight, children, label }: {
  title?: ReactNode;
  kicker?: ReactNode;
  size: 'half' | 'full';
  setSize: (s: 'half' | 'full') => void;
  onClose: () => void;
  onHeight?: (px: number) => void;
  children: ReactNode;
  label: string;
}) {
  const { lang } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const [dragH, setDragH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !onHeight) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => { ro.disconnect(); onHeight(0); };
  }, [onHeight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parentH = () => ref.current?.parentElement?.clientHeight ?? window.innerHeight;
  const down = (e: RPE) => {
    drag.current = { y: e.clientY, h: ref.current?.offsetHeight ?? 0, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: RPE) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 6) d.moved = true;
    if (d.moved) setDragH(Math.max(80, Math.min(parentH(), d.h - dy)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { setSize(size === 'half' ? 'full' : 'half'); return; }
    const h = dragH ?? d.h;
    const P = parentH();
    setDragH(null);
    if (h < P * 0.3) onClose();
    else setSize(h > P * 0.72 ? 'full' : 'half');
  };

  return (
    <div
      ref={ref}
      className={`hab-csheet ${size}${dragH != null ? ' dragging' : ''}`}
      style={dragH != null ? { height: dragH } : undefined}
      role="dialog"
      aria-label={label}
    >
      <div className="hab-csheet-head">
        <button
          className="handle"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { drag.current = null; setDragH(null); }}
          aria-label={size === 'half' ? (lang === 'pt' ? 'Expandir' : 'Expand') : (lang === 'pt' ? 'Reduzir' : 'Collapse')}
        >
          <i aria-hidden="true" />
        </button>
        <div className="hab-csheet-title">
          {kicker && <div className="kicker">{kicker}</div>}
          {title && <h2>{title}</h2>}
        </div>
        <button className="hab-btn icon" onClick={onClose} aria-label={lang === 'pt' ? 'Fechar' : 'Close'}>✕</button>
      </div>
      <div className="hab-csheet-body">{children}</div>
    </div>
  );
}

/** The menu: the dialogs, where you stand, and the fund's target. */
export function MenuBody({ s, openModal, onQuit, lang, setLang, children }: {
  s: GameState;
  openModal: (m: Modal) => void;
  onQuit: () => void;
  lang: 'pt' | 'en';
  setLang?: (l: 'pt' | 'en') => void;
  children?: ReactNode;
}) {
  const { s: str } = useT();
  const pr = progress(s);
  const building = s.projects.filter((p) => p.stage === 'obra').reduce((a, p) => a + p.units - p.built, 0);
  const review = s.projects.filter((p) => ['pip', 'plano', 'arq', 'cp', 'discussao', 'camara'].includes(p.stage)).reduce((a, p) => a + p.units, 0);
  const e = econAt(s.month);
  const strikes = DIFFICULTY[s.difficulty].strikes;
  return (
    <div className="hab-sheet">
      <div className="hab-cmenu">
        <button className="hab-btn" onClick={() => openModal('rules')}>{str('rules')}</button>
        <button className="hab-btn" onClick={() => openModal('camara')}>{str('camara')}</button>
        <button className="hab-btn" onClick={() => openModal('log')}>{str('log')}</button>
        <button className="hab-btn" onClick={() => openModal('help')}>{lang === 'pt' ? 'Como se joga' : 'How to play'}</button>
        {setLang && <button className="hab-btn" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}>{lang === 'pt' ? 'EN, English' : 'PT, Português'}</button>}
        <button className="hab-btn" onClick={onQuit}>{str('newGame')}</button>
      </div>
      <div className="hab-block">
        <h3>{lang === 'pt' ? 'A meta do fundo' : 'The fund’s target'}</h3>
        <GoalBar s={s} />
        <p className="hab-note">{lang === 'pt' ? `Avisos: ${s.review.strikes} de ${strikes}.` : `Strikes: ${s.review.strikes} of ${strikes}.`}</p>
      </div>
      <div className="hab-block">
        <h3>{lang === 'pt' ? 'Onde estás' : 'Where you stand'}</h3>
        <dl className="hab-kv">
          <dt>{str('cash')}</dt><dd>{fmtM(s.cash, lang)}</dd>
          <dt>{str('built')}</dt><dd>{num(pr.built, lang)}</dd>
          <dt>{str('building')}</dt><dd>{num(building, lang)}</dd>
          <dt>{str('inReview')}</dt><dd>{num(review, lang)}</dd>
          <dt>{str('standing')}</dt><dd>{Math.round(s.standing)}</dd>
          <dt>Euribor 12M</dt><dd>{num(e.euribor, lang, 2)}%</dd>
        </dl>
      </div>
      {children}
    </div>
  );
}

