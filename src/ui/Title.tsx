import { useState } from 'react';
import { DIFFICULTY } from '../sim/goals';
import type { Difficulty, GameState, Lang } from '../sim/types';
import { fmtMonth } from '../sim/time';
import { useT } from './i18n';

export function Title({ saved, onStart, onResume, lang, setLang }: {
  saved: GameState | null;
  onStart: (d: Difficulty) => void;
  onResume: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const { s: str, t } = useT();
  const [d, setD] = useState<Difficulty>('normal');
  return (
    <main className="hab-title" id="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="kicker">estimador.pt · {lang === 'pt' ? 'Habitação' : 'Housing'}</span>
        <button className="hab-btn small" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}>{lang === 'pt' ? 'EN, English' : 'PT, Português'}</button>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <h1>{str('title')}</h1>
        <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{str('question')}</p>
        <p className="lede">{str('lede')}</p>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="kicker">{str('difficulty')}</span>
        <div className="hab-choices" role="group" aria-label={str('difficulty')}>
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((k) => (
            <button key={k} className="hab-choice" aria-pressed={d === k} onClick={() => setD(k)}>
              <b>{t(DIFFICULTY[k].label)}</b>
              <span className="muted" style={{ fontSize: 13 }}>{t(DIFFICULTY[k].blurb)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="hab-actions">
        <button className="hab-btn primary" onClick={() => onStart(d)}>{str('start')}</button>
        {saved && (
          <button className="hab-btn" onClick={onResume}>
            {str('continue')} · {fmtMonth(saved.month, lang)}
          </button>
        )}
      </div>
      <div className="hab-fine">
        <p>{str('honesty')}</p>
        <p>
          {lang === 'pt'
            ? 'Inspirado em Discretionary Review, o simulador de habitação de São Francisco de Oliver Sin '
            : 'Inspired by Discretionary Review, Oliver Sin’s San Francisco housing simulator '}
          (<a href="https://housing.over.pizza/" target="_blank" rel="noreferrer">housing.over.pizza</a>).
          {lang === 'pt' ? ' Código, regras e textos deste jogo são originais.' : ' This game’s code, rules and text are original.'}
        </p>
        <p>
          {lang === 'pt'
            ? 'Dados: INE (preços, rendas, custos de construção, Censos 2021), BCE (Euribor), Turismo de Portugal (alojamento local), DGT (CAOP 2021), resultados eleitorais autárquicos e uma cronologia de 129 acontecimentos com fonte.'
            : 'Data: INE (prices, rents, construction costs, 2021 Census), ECB (Euribor), Turismo de Portugal (short lets), DGT (CAOP 2021), local election results and a timeline of 129 sourced events.'}
        </p>
        <p>{lang === 'pt' ? 'O jogo guarda o progresso apenas neste navegador.' : 'The game saves progress in this browser only.'}</p>
      </div>
    </main>
  );
}
