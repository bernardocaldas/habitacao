// Every modal: decisions, the newspaper, the rulebook, the Câmara, the log, help, the end.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FREGUESIAS } from '../data/freguesias';
import { BLOCS, MANDATES } from '../data/politics';
import { LAST_DATA, SCENARIO, lisboaPriceM2 } from '../data/precos';
import { SITES_BY_ID } from '../data/sites';
import { TIMELINE } from '../data/timeline';
import { econAt } from '../sim/econ';
import { DIFFICULTY, REVIEWS, targetOf } from '../sim/goals';
import { councilAt, mandateAt } from '../sim/rules';
import { END_MONTH, fmtMonth, fmtMonthLong, monthOf } from '../sim/time';
import type { Decision, GameState, NewsItem } from '../sim/types';
import { fmtM, num, pct } from './format';
import { STRINGS, useT } from './i18n';

export function Dialog({ title, onClose, children, wide, tone, label }: { title?: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; tone?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, a, [tabindex="0"]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="hab-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div ref={ref} className={`hab-dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {(title || onClose) && (
          <div className={`hab-dialog-head tone-${tone ?? 'neutral'}`}>
            <h2>{title}</h2>
            {onClose && <button className="hab-btn icon" onClick={onClose} aria-label={STRINGS.close.pt === 'Fechar' ? 'Fechar / Close' : 'Close'}>✕</button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Decisions ────────────────────────────────────────────────────────────────────────────

export function DecisionDialog({ s, d, onChoose }: { s: GameState; d: Decision; onChoose: (key: string) => void }) {
  const { t, s: str, lang } = useT();
  const site = d.project != null ? SITES_BY_ID[s.projects.find((p) => p.id === d.project)?.site ?? ''] : undefined;
  const anyAffordable = d.options.some((o) => !o.disabled && (o.costM ?? 0) <= s.cash);
  return (
    <Dialog label={t(d.title)} tone={d.tone} title={t(d.title)}>
      {site && <div className="kicker" style={{ marginTop: -6 }}>{t(site.name)} · {FREGUESIAS[site.fr].name} · {fmtMonth(s.month, lang)}</div>}
      <div className="lines">{d.lines.map((l, i) => <p key={i}>{t(l)}</p>)}</div>
      {d.vote && <Seats vote={d.vote} />}
      {d.odds && !d.vote && (
        <div className="hab-odds">
          {d.odds.map((o, i) => (
            <div className="hab-odd" key={i}>
              <span>{t(o.label)}</span>
              <span className="bar"><span style={{ width: pct(o.p) }} /></span>
              <span className="p">{pct(o.p)}</span>
            </div>
          ))}
        </div>
      )}
      {d.real && <div className="hab-real"><strong>{str('thisIsReal')}</strong>{t(d.real)}</div>}
      <div className="hab-options">
        {d.options.map((o) => {
          const cant = !!o.disabled || ((o.costM ?? 0) > s.cash && anyAffordable);
          return (
            <button key={o.key} className="hab-option" disabled={cant} onClick={() => onChoose(o.key)}>
              <span className="t">{t(o.label)}</span>
              <span className="c">{o.costM ? fmtM(o.costM, lang) : ''}</span>
              {o.hint && <span className="h">{t(o.hint)}</span>}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

function Seats({ vote }: { vote: NonNullable<Decision['vote']> }) {
  const { lang } = useT();
  const blocs = [...new Set(vote.seats.map((x) => x.bloc))];
  return (
    <div>
      <div className="hab-seats" role="img" aria-label={lang === 'pt' ? `${vote.yes} votos a favor em 17; eram precisos ${vote.need}` : `${vote.yes} votes in favour of 17; ${vote.need} needed`}>
        {vote.seats.map((x, i) => (
          <span key={i} className={`hab-seat${x.yes ? '' : ' no'}`} style={{ background: BLOCS[x.bloc].color, color: x.yes ? '#fff' : BLOCS[x.bloc].color }} title={`${BLOCS[x.bloc].name}: ${pct(x.p)}`}>
            {x.yes ? '✓' : '✕'}
          </span>
        ))}
      </div>
      <div className="hab-seat-probs" aria-hidden="true">{vote.seats.map((x, i) => <span key={i}>{Math.round(x.p * 100)}</span>)}</div>
      <div className="hab-seat-legend">
        {blocs.map((b) => <span key={b}><i style={{ background: BLOCS[b].color }} />{BLOCS[b].name}</span>)}
        <span className="muted">{lang === 'pt' ? 'Números: probabilidade de cada voto a favor, em %.' : 'Numbers: each seat’s chance of a yes, in %.'}</span>
      </div>
    </div>
  );
}

// ── The paper ────────────────────────────────────────────────────────────────────────────

export function PaperDialog({ s, item, onClose }: { s: GameState; item: NewsItem; onClose: () => void }) {
  const { t, s: str, lang } = useT();
  const ev = TIMELINE.find((e) => monthOf(e.y, e.m) === item.m && e.head.pt === item.head.pt);
  const body = item.body?.[lang];
  const briefs = s.news.filter((n) => n !== item && Math.abs(n.m - item.m) <= 1).slice(-4);
  return (
    <Dialog label={t(item.head)} onClose={onClose} wide>
      <div className="hab-paper" style={{ display: 'grid', gap: 12, margin: -4, padding: 4 }}>
        <div className="mast">
          <b>O Parecer</b>
          <span className="muted">{fmtMonthLong(item.m, lang)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`hab-stamp ${ev?.spec ? 'spec' : item.real ? 'real' : 'fic'}`}>{ev?.spec ? str('scenario') : item.real ? str('real') : str('fiction')}</span>
          {ev?.confidence === 'medium' && <span className="hab-note">{lang === 'pt' ? 'confiança média na fonte' : 'medium confidence in the source'}</span>}
        </div>
        <h3 className="head">{t(item.head)}</h3>
        {body && <div className="body"><p>{body}</p></div>}
        {item.game && item.game.length > 0 && (
          <div className="game">
            <strong>{str('whatChanges')}</strong>
            {item.game.map((g, i) => <p key={i}>{t(g)}</p>)}
          </div>
        )}
        {item.source && <p className="hab-note">{str('source')}: <a href={item.source} target="_blank" rel="noreferrer">{new URL(item.source).hostname.replace('www.', '')}</a></p>}
        {briefs.length > 0 && (
          <div className="briefs">
            <strong className="kicker">{str('alsoNews')}</strong>
            {briefs.map((b, i) => <p key={i}><span className={`hab-stamp ${b.real ? 'real' : 'fic'}`} style={{ marginRight: 6 }}>{b.real ? str('real') : str('fiction')}</span>{t(b.head)}</p>)}
          </div>
        )}
      </div>
      <button className="hab-btn primary" onClick={onClose}>{str('continue')}</button>
    </Dialog>
  );
}

// ── Rulebook ─────────────────────────────────────────────────────────────────────────────

export function RulesDialog({ s, onClose }: { s: GameState; onClose: () => void }) {
  const { t, lang } = useT();
  const passed = TIMELINE.filter((e) => (e.set || e.pause) && monthOf(e.y, e.m) <= s.month);
  const ahead = TIMELINE.filter((e) => (e.set || e.pause) && monthOf(e.y, e.m) > s.month).length;
  const P = (pt: string, en: string) => <p>{lang === 'pt' ? pt : en}</p>;
  return (
    <Dialog label={lang === 'pt' ? 'Regras' : 'Rules'} title={lang === 'pt' ? 'Regras do jogo e da cidade' : 'Rules of the game and the city'} onClose={onClose} wide>
      <section style={{ display: 'grid', gap: 8, fontSize: 14 }}>
        <h3 className="kicker">{lang === 'pt' ? 'Como se joga' : 'How to play'}</h3>
        {P('Escolhes um terreno e desenhas um projeto: quantos pisos, quantas casas a renda acessível, se vendes, arrendas ou fazes alojamento local. Assinas um contrato-promessa (o sinal) e o projeto entra no labirinto: informação prévia, arquitetura, pareceres, discussão pública, votação na Câmara, especialidades, alvará. Com licença, só arrancas se o banco aceitar as contas desse dia.',
          'You pick a site and design a project: how many floors, how many affordable homes, whether you sell, let or run short lets. You sign a promissory contract (the deposit) and the project enters the maze: prior information, architecture, expert opinions, public consultation, a Câmara vote, engineering, the permit. With a licence, you only break ground if the bank accepts that day’s numbers.')}
        {P('De dois em dois anos o fundo revê o negócio. Falhar uma meta é um aviso; à terceira (à segunda, no nível mais difícil), o fundo sai.',
          'Every two years the fund reviews the business. Missing a target is a strike; on the third (the second, at the hardest level), the fund leaves.')}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {REVIEWS.map((r) => (
            <li key={r.m} className="num">{fmtMonth(r.m, lang)}: {targetOf(r, s.difficulty)} {r.kind === 'licensed' ? (lang === 'pt' ? 'projeto licenciado' : 'licensed project') : r.kind === 'started' ? (lang === 'pt' ? 'casas em obra' : 'homes started') : (lang === 'pt' ? 'casas construídas' : 'homes built')}</li>
          ))}
        </ul>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h3 className="kicker">{lang === 'pt' ? 'Leis que já mudaram o jogo' : 'Laws that have changed the game so far'}</h3>
        {passed.length === 0 && <p className="muted">{lang === 'pt' ? 'Ainda nenhuma.' : 'None yet.'}</p>}
        <table className="hab-table">
          <tbody>
            {passed.map((e, i) => (
              <tr key={i}>
                <td className="num" style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{fmtMonth(monthOf(e.y, e.m), lang)}</td>
                <td>
                  <strong>{t(e.head)}</strong>
                  {e.game?.map((g, j) => <div key={j} className="muted">{t(g)}</div>)}
                  {e.source && <div><a className="hab-note" href={e.source} target="_blank" rel="noreferrer">{lang === 'pt' ? 'fonte' : 'source'}</a></div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ahead > 0 && <p className="hab-note">{lang === 'pt' ? `Faltam ${ahead} mudanças. Chegam nas datas em que chegaram de verdade.` : `${ahead} changes to come. They arrive on the dates they really did.`}</p>}
      </section>
      <section style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        <h3 className="kicker">{lang === 'pt' ? 'Como o jogo decide' : 'How the game decides'}</h3>
        {P('Preços: medianas do INE por freguesia (venda por m², rendas de novos contratos), suavizadas em três anos para o jogo; depois de 2025, um cenário de +5% ao ano nas vendas e +3% nas rendas. Custos de construção: índice do INE. Euribor: médias do BCE. Uma casa nova vende-se acima da mediana (que inclui casas antigas).',
          'Prices: INE parish medians (sales per m², rents of new leases), smoothed over three years for the game; after 2025, a scenario of +5% a year for sales and +3% for rents. Construction costs: INE’s index. Euribor: ECB averages. A new home sells above the median (which includes old homes).')}
        {P('Terrenos: o vendedor pede o que sobra depois de custos e margem, por isso só ganha quem compra antes de os preços subirem ou constrói mais depressa. O IVA da construção nova é custo (a venda de casas está isenta); a reabilitação paga 6%.',
          'Land: the seller asks for what is left after costs and margin, so you only win by buying before prices rise or by building faster. VAT on new build is a cost (home sales are exempt); rehabilitation pays 6%.')}
        {P('Votos: cada vereador vota a favor com uma probabilidade que depende da lista, da oposição ao projeto, das casas a renda acessível, do alojamento local e dos despejos. As inclinações das listas são uma simplificação do jogo, não uma medição do comportamento de ninguém. O número de lugares de cada lista é o resultado oficial.',
          'Votes: each councillor votes yes with a probability that depends on their list, the opposition to the project, affordable homes, short lets and evictions. The lists’ leanings are a game simplification, not a measurement of anyone’s record. The number of seats per list is the official result.')}
        {P('Oposição: a força dos moradores, do movimento pela habitação e do património em cada freguesia é um juízo editorial. Os terrenos são inventados.',
          'Opposition: the strength of residents, the housing movement and heritage in each parish is an editorial judgement. The sites are invented.')}
      </section>
      <section style={{ display: 'grid', gap: 6, fontSize: 12 }} className="muted">
        <h3 className="kicker">{lang === 'pt' ? 'Fontes' : 'Sources'}</h3>
        <p>INE: {lang === 'pt' ? 'valor mediano das vendas por m² (0010033, 0012255, 0012234), rendas de novos contratos (0009631, 0014698, 0014696), índice de custos de construção de habitação nova (0011748), alojamentos (0012501).' : 'median sale value per m² (0010033, 0012255, 0012234), rents of new leases (0009631, 0014698, 0014696), construction cost index for new housing (0011748), dwellings (0012501).'}</p>
        <p>{lang === 'pt' ? 'BCE: Euribor a 12 meses. Turismo de Portugal: Registo Nacional de Alojamento Local (contagens). Freguesias: CAOP 2021 (DGT, CC BY 4.0) e Censos 2021 (INE, CC BY 4.0), via população sintética do estimador.pt v1.0.3. Cronologia: 129 acontecimentos datados, cada um com fonte (Diário da República, CML, Assembleia Municipal, imprensa).' : 'ECB: 12-month Euribor. Turismo de Portugal: national short-let register (counts). Parishes: CAOP 2021 (DGT, CC BY 4.0) and 2021 Census (INE, CC BY 4.0), via estimador.pt’s synthetic population v1.0.3. Timeline: 129 dated events, each sourced (Diário da República, the city council, the Municipal Assembly, the press).'}</p>
        <p>{lang === 'pt' ? `Dados de preços até ${Math.floor(LAST_DATA.sale)}; cenário depois (+${pct(SCENARIO.sale)} ao ano).` : `Price data to ${Math.floor(LAST_DATA.sale)}; scenario after (+${pct(SCENARIO.sale)} a year).`}</p>
      </section>
    </Dialog>
  );
}

// ── The Câmara and the market ────────────────────────────────────────────────────────────

export function CamaraDialog({ s, onClose }: { s: GameState; onClose: () => void }) {
  const { lang } = useT();
  const md = mandateAt(s.month);
  const seats = councilAt(s.month);
  const years: number[] = [];
  for (let y = 2015; y <= Math.floor(2015 + s.month / 12); y++) years.push(y);
  const lean = (x: number) => (lang === 'pt' ? (x > 0.4 ? 'aprova quase tudo' : x > 0 ? 'inclinado a aprovar' : x > -0.3 ? 'depende do projeto' : 'desconfiado') : x > 0.4 ? 'approves almost anything' : x > 0 ? 'inclined to approve' : x > -0.3 ? 'depends on the project' : 'sceptical');
  return (
    <Dialog label={lang === 'pt' ? 'Câmara' : 'City Hall'} title={lang === 'pt' ? 'Paços do Concelho' : 'City Hall'} onClose={onClose} wide>
      <section style={{ display: 'grid', gap: 8 }}>
        <h3 className="kicker">{lang === 'pt' ? 'O executivo' : 'The executive'}</h3>
        <p><strong>{md.mayor}</strong> · {BLOCS[md.mayorBloc].name}. {lang === 'pt' ? md.note.pt : md.note.en}</p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{seats.map((x, i) => <span key={i} title={BLOCS[x.bloc].name} style={{ width: 18, height: 18, borderRadius: '50%', background: BLOCS[x.bloc].color, display: 'inline-block' }} />)}</div>
        <table className="hab-table">
          <thead><tr><th>{lang === 'pt' ? 'Lista' : 'List'}</th><th className="n">{lang === 'pt' ? 'Lugares' : 'Seats'}</th><th>{lang === 'pt' ? 'No jogo' : 'In the game'}</th><th>{lang === 'pt' ? 'Sensível a' : 'Moved by'}</th></tr></thead>
          <tbody>
            {Object.entries(md.seats).map(([b, n]) => (
              <tr key={b}>
                <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: BLOCS[b].color, marginRight: 6 }} />{BLOCS[b].name}</td>
                <td className="n">{n}</td>
                <td>{lean(BLOCS[b].lean)}</td>
                <td className="muted">{[BLOCS[b].aff >= 1 ? (lang === 'pt' ? 'renda acessível' : 'affordable homes') : '', BLOCS[b].evict >= 0.6 ? (lang === 'pt' ? 'despejos' : 'evictions') : '', BLOCS[b].al >= 0.5 ? (lang === 'pt' ? 'alojamento local' : 'short lets') : ''].filter(Boolean).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hab-note">{lang === 'pt' ? 'Lugares: resultados oficiais. Inclinações: simplificação do jogo.' : 'Seats: official results. Leanings: a game simplification.'}</p>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h3 className="kicker">{lang === 'pt' ? 'Mandatos' : 'Terms'}</h3>
        <table className="hab-table">
          <tbody>
            {MANDATES.map((m, i) => (
              <tr key={i}><td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtMonth(monthOf(Math.max(2015, m.from[0]), m.from[0] < 2015 ? 1 : m.from[1]), lang)}</td><td>{m.mayor}</td><td className="muted">{Object.entries(m.seats).map(([b, n]) => `${BLOCS[b].name} ${n}`).join(' · ')}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h3 className="kicker">{lang === 'pt' ? 'O mercado, ano a ano' : 'The market, year by year'}</h3>
        <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={lang === 'pt' ? 'Tabela do mercado' : 'Market table'}>
          <table className="hab-table">
            <thead><tr><th>{lang === 'pt' ? 'Ano' : 'Year'}</th><th className="n">{lang === 'pt' ? 'Preço mediano (€/m²)' : 'Median price (€/m²)'}</th><th className="n">Euribor 12M</th><th className="n">{lang === 'pt' ? 'Custos (2015 = 100)' : 'Costs (2015 = 100)'}</th></tr></thead>
            <tbody>
              {years.map((y) => {
                const m = Math.min(s.month, monthOf(y, 7));
                const e = econAt(m);
                return <tr key={y}><td className="num">{y}{y > LAST_DATA.sale ? '*' : ''}</td><td className="n">{num(lisboaPriceM2(y + 0.5), lang)}</td><td className="n">{num(e.euribor, lang, 2)}%</td><td className="n">{num(e.cost * 100, lang)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="hab-note">{lang === 'pt' ? '* cenário do jogo, não um dado.' : '* the game’s scenario, not data.'} INE · BCE.</p>
      </section>
    </Dialog>
  );
}

// ── Log ──────────────────────────────────────────────────────────────────────────────────

export function LogDialog({ s, onClose }: { s: GameState; onClose: () => void }) {
  const { t, lang } = useT();
  const [only, setOnly] = useState<'all' | 'news'>('all');
  const rows = only === 'all'
    ? s.log.slice().reverse().map((l) => ({ m: l.m, text: t(l.text), tone: l.tone, real: undefined as boolean | undefined }))
    : s.news.slice().reverse().map((n) => ({ m: n.m, text: t(n.head), tone: 'neutral' as const, real: n.real }));
  return (
    <Dialog label={lang === 'pt' ? 'Registo' : 'Log'} title={lang === 'pt' ? 'Registo' : 'Log'} onClose={onClose} wide>
      <div className="hab-seg" role="group">
        <button aria-pressed={only === 'all'} onClick={() => setOnly('all')}>{lang === 'pt' ? 'Os teus projetos' : 'Your projects'}</button>
        <button aria-pressed={only === 'news'} onClick={() => setOnly('news')}>{lang === 'pt' ? 'Notícias' : 'News'}</button>
      </div>
      <ul className="hab-list" style={{ gap: 6, fontSize: 13 }}>
        {rows.length === 0 && <li className="muted">{lang === 'pt' ? 'Nada ainda.' : 'Nothing yet.'}</li>}
        {rows.slice(0, 300).map((r, i) => (
          <li key={i} style={{ color: r.tone === 'bad' ? 'var(--color-red-700)' : r.tone === 'good' ? 'var(--color-emerald-700)' : undefined }}>
            <span className="muted num">{fmtMonth(r.m, lang)}</span> · {r.real != null && <span className={`hab-stamp ${r.real ? 'real' : 'fic'}`} style={{ marginRight: 6 }}>{r.real ? (lang === 'pt' ? 'Real' : 'Real') : lang === 'pt' ? 'Ficção' : 'Fiction'}</span>}{r.text}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// ── Help ─────────────────────────────────────────────────────────────────────────────────

const TOUR: { pt: [string, string]; en: [string, string] }[] = [
  { pt: ['O objetivo', 'Pôr casas de pé em Lisboa até às autárquicas de 2029. A barra por baixo do relógio mostra a próxima meta do fundo: verde cheio é feito, riscado é garantido, claro é possível.'], en: ['The goal', 'Get homes built in Lisbon by the 2029 local elections. The bar under the clock shows the fund’s next target: solid green is done, striped is sure, pale is possible.'] },
  { pt: ['O mapa', 'Os quadrados com uma cruz são terrenos à venda. Muda a camada para ver preços, população, alojamento local e quem se opõe em cada freguesia.'], en: ['The map', 'Squares with a cross are sites for sale. Switch layers to see prices, population, short lets and who objects in each parish.'] },
  { pt: ['A proposta', 'Escolhe quantos pisos, quantas casas a renda acessível e o que fazes no fim. Antes de assinar vês o caminho, a probabilidade de licença, quanto tempo deve demorar e as contas de hoje.'], en: ['The proposal', 'Choose how many floors, how many affordable homes and what happens at the end. Before signing you see the road, the chance of a licence, how long it should take and today’s numbers.'] },
  { pt: ['O relógio', 'Cada passo é um mês. Espaço para pausa, 1 a 3 para a velocidade, 4 para saltar até à próxima decisão. Quando algo precisa de ti, o relógio para.'], en: ['The clock', 'Each step is a month. Space to pause, 1 to 3 for speed, 4 to skip to the next decision. When something needs you, the clock stops.'] },
  { pt: ['As equipas', 'Cada projeto em licenciamento ocupa uma equipa. Contrata mais quando tiveres dinheiro; projetos em obra ou à espera de financiamento não ocupam equipa.'], en: ['Teams', 'Every project in licensing takes a team. Hire more when you can afford it; projects under construction or waiting for financing do not.'] },
  { pt: ['A história', 'As leis mudam nas datas reais e o jornal explica o que muda para ti. Nas regras está tudo o que o jogo inventa e tudo o que é dado, com fontes.'], en: ['The history', 'Laws change on their real dates and the paper explains what changes for you. The rules say what the game invents and what is data, with sources.'] },
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { lang } = useT();
  const [i, setI] = useState(0);
  const [title, text] = TOUR[i][lang];
  return (
    <Dialog label={title} title={title} onClose={onClose}>
      <p style={{ fontSize: 15 }}>{text}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted num">{i + 1} / {TOUR.length}</span>
        <div className="hab-actions">
          <button className="hab-btn" disabled={i === 0} onClick={() => setI(i - 1)}>{lang === 'pt' ? 'Anterior' : 'Back'}</button>
          {i < TOUR.length - 1
            ? <button className="hab-btn primary" onClick={() => setI(i + 1)}>{lang === 'pt' ? 'Seguinte' : 'Next'}</button>
            : <button className="hab-btn primary" onClick={onClose}>{lang === 'pt' ? 'Começar' : 'Start'}</button>}
        </div>
      </div>
    </Dialog>
  );
}

// ── The end ──────────────────────────────────────────────────────────────────────────────

export function grade(homes: number, fired: boolean) {
  const steps: [number, string][] = [[4000, 'S'], [3000, 'A'], [2300, 'B'], [1500, 'C'], [600, 'D'], [0, 'E']];
  let i = steps.findIndex(([n]) => homes >= n);
  if (fired && i < steps.length - 1) i++;
  return steps[i][1];
}

export function EndDialog({ s, onNew }: { s: GameState; onNew: () => void }) {
  const { lang } = useT();
  const over = s.over!;
  const g = grade(s.stats.homes, over.kind === 'fired' || over.kind === 'broke');
  const head: Record<string, [string, string]> = {
    won: ['Chegaste às autárquicas com as metas cumpridas', 'You reached the elections on target'],
    survived: ['Chegaste às autárquicas, mas o fundo esperava mais', 'You reached the elections, but the fund expected more'],
    fired: ['O fundo retirou-se', 'The fund pulled out'],
    broke: ['Os bancos ficaram com as chaves', 'The banks took the keys'],
  };
  const years = Object.keys(s.stats.byYear).map(Number);
  const y0 = 2015, y1 = Math.max(y0, Math.floor(2015 + Math.min(s.month, END_MONTH) / 12));
  const ys: number[] = [];
  for (let y = y0; y <= y1; y++) ys.push(y);
  const max = Math.max(1, ...ys.map((y) => s.stats.byYear[y] ?? 0));
  const avgKeys = s.stats.monthsToKeys.length ? Math.round(s.stats.monthsToKeys.reduce((a, b) => a + b, 0) / s.stats.monthsToKeys.length) : null;
  const share = lang === 'pt'
    ? `Aguarda parecer · ${DIFFICULTY[s.difficulty].label.pt}: ${num(s.stats.homes, 'pt')} casas em Lisboa (${num(s.stats.aff, 'pt')} a renda acessível), nota ${g}, até ${fmtMonth(over.m, 'pt')}.`
    : `Awaiting opinion · ${DIFFICULTY[s.difficulty].label.en}: ${num(s.stats.homes, 'en')} homes in Lisbon (${num(s.stats.aff, 'en')} affordable), grade ${g}, by ${fmtMonth(over.m, 'en')}.`;
  void years;
  return (
    <Dialog label={head[over.kind][lang === 'pt' ? 0 : 1]} title={head[over.kind][lang === 'pt' ? 0 : 1]} wide>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="hab-grade" aria-label={lang === 'pt' ? `Nota ${g}` : `Grade ${g}`}>{g}</div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700 }} className="num">{num(s.stats.homes, lang)} {lang === 'pt' ? 'casas construídas' : 'homes built'}</p>
          <p className="muted">{fmtMonthLong(over.m, lang)} · {lang === 'pt' ? `${s.review.passed} revisões aprovadas, ${s.review.strikes} avisos` : `${s.review.passed} reviews passed, ${s.review.strikes} strikes`}</p>
        </div>
      </div>
      <table className="hab-table">
        <tbody>
          <tr><td>{lang === 'pt' ? 'A renda acessível' : 'Affordable'}</td><td className="n">{num(s.stats.aff, lang)}</td></tr>
          <tr><td>{lang === 'pt' ? 'Para arrendar' : 'To let'}</td><td className="n">{num(s.stats.rental, lang)}</td></tr>
          <tr><td>{lang === 'pt' ? 'Alojamento local (não contam)' : 'Short lets (do not count)'}</td><td className="n">{num(s.stats.al, lang)}</td></tr>
          <tr><td>{lang === 'pt' ? 'Projetos concluídos / abandonados / vendidos' : 'Projects finished / abandoned / sold'}</td><td className="n">{s.stats.completed} / {s.stats.killed} / {s.stats.sold}</td></tr>
          <tr><td>{lang === 'pt' ? 'Casas perdidas em cortes e desistências' : 'Homes lost to cuts and walk-aways'}</td><td className="n">{num(s.stats.unitsLost, lang)}</td></tr>
          <tr><td>{lang === 'pt' ? 'Pedidos de elementos' : 'Requests for documents'}</td><td className="n">{s.stats.asks}</td></tr>
          <tr><td>{lang === 'pt' ? 'Votações ganhas / perdidas' : 'Votes won / lost'}</td><td className="n">{s.stats.votesWon} / {s.stats.votesLost}</td></tr>
          <tr><td>{lang === 'pt' ? 'Processos em tribunal' : 'Court cases'}</td><td className="n">{s.stats.lawsuits}</td></tr>
          <tr><td>{lang === 'pt' ? 'Tempo médio do contrato às chaves' : 'Average time from contract to keys'}</td><td className="n">{avgKeys != null ? (lang === 'pt' ? `${avgKeys} meses` : `${avgKeys} months`) : '—'}</td></tr>
          <tr><td>{lang === 'pt' ? 'Caixa no fim' : 'Cash at the end'}</td><td className="n">{fmtM(s.cash, lang)}</td></tr>
        </tbody>
      </table>
      <div>
        <h3 className="kicker">{lang === 'pt' ? 'Casas entregues por ano' : 'Homes delivered per year'}</h3>
        <div className="hab-bars" role="img" aria-label={ys.map((y) => `${y}: ${s.stats.byYear[y] ?? 0}`).join(', ')} style={{ marginTop: 8 }}>
          {ys.map((y) => <span key={y} style={{ height: `${((s.stats.byYear[y] ?? 0) / max) * 100}%` }} title={`${y}: ${s.stats.byYear[y] ?? 0}`} />)}
        </div>
        <div className="hab-bars-x">{ys.map((y) => <span key={y}>{String(y).slice(2)}</span>)}</div>
      </div>
      <p className="hab-note">{share}</p>
      <div className="hab-actions">
        <button className="hab-btn primary" onClick={onNew}>{lang === 'pt' ? 'Jogar outra vez' : 'Play again'}</button>
        <button className="hab-btn" onClick={() => navigator.clipboard?.writeText(share).catch(() => undefined)}>{lang === 'pt' ? 'Copiar resultado' : 'Copy result'}</button>
      </div>
    </Dialog>
  );
}

export { pct };
