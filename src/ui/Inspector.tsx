// The right-hand column: a site and the proposal you could file there, a project and where
// it stands, or, with nothing selected, the city.
import { useMemo, useState } from 'react';
import { FREGUESIAS } from '../data/freguesias';
import { BLOCS } from '../data/politics';
import { AL_COUNTS, PROVENANCE_LABEL, lisboaPriceM2, rawPrice } from '../data/precos';
import { SITES_BY_ID } from '../data/sites';
import { econAt, keepsBuilding } from '../sim/econ';
import { forecastProject, forecastProposal, type Forecast } from '../sim/forecast';
import { heatFor, heatLevel } from '../sim/heat';
import { mandateAt, rulesAt, councilAt } from '../sim/rules';
import {
  abandonProject, affOptions, defaultProgram, exitOk, financingPf, floorsFor, isLive, meetResidents, meetingCost,
  normalise, preview, routeStages, saleValue, schemesFor, sellProject, usesTeam, fileProject,
} from '../sim/sim';
import { yearFrac, fmtMonth } from '../sim/time';
import type { Exit, GameState, Program, Project, Scheme, Site } from '../sim/types';
import { STAGE, eurM2, fmtM, months, num, pct, stageClass } from './format';
import { useT } from './i18n';
import { kindLabel } from './Lists';
import type { Game } from './useGame';

// ── Shared bits ──────────────────────────────────────────────────────────────────────────

function Meters({ viz, hab }: { viz: number; hab: number }) {
  const { lang } = useT();
  const lv = (h: number) => {
    const l = heatLevel(h);
    return lang === 'pt' ? { calmo: 'calmos', atento: 'atentos', zangado: 'zangados', furioso: 'furiosos' }[l] : { calmo: 'calm', atento: 'watching', zangado: 'angry', furioso: 'furious' }[l];
  };
  const row = (label: string, h: number, color: string) => (
    <div className="hab-meter">
      <span>{label}</span>
      <span className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, h)}%`, background: color }} /></span>
      <span className="lvl">{lv(h)}</span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {row(lang === 'pt' ? 'Moradores e património' : 'Residents and heritage', viz, 'var(--color-coral)')}
      {row(lang === 'pt' ? 'Direito à habitação' : 'Housing movement', hab, 'var(--color-periwinkle)')}
    </div>
  );
}

function ForecastBlock({ f, lang, from }: { f: Forecast | null; lang: 'pt' | 'en'; from: 'now' | 'filing' }) {
  if (!f) return null;
  const rng = (x?: [number, number, number]) => (x ? months(x[0], x[2], lang) : '—');
  return (
    <div className="hab-block">
      <h3>{lang === 'pt' ? 'Previsão do jogo' : 'The game’s forecast'}</h3>
      <div className="hab-odds">
        <div className="hab-odd">
          <span>{lang === 'pt' ? 'Chega a ter licença' : 'Gets a licence'}</span>
          <span className="bar"><span style={{ width: pct(f.pLicence) }} /></span>
          <span className="p">{pct(f.pLicence)}</span>
        </div>
      </div>
      <dl className="hab-kv" style={{ marginTop: 8 }}>
        <dt>{lang === 'pt' ? 'Licença em' : 'Licence in'}</dt>
        <dd>{rng(f.licence)}</dd>
        <dt>{lang === 'pt' ? 'Chaves em' : 'Keys in'}</dt>
        <dd>{rng(f.keys)}</dd>
      </dl>
      <p className="hab-note" style={{ marginTop: 6 }}>
        {lang === 'pt'
          ? `Intervalo de 80% em ${f.runs} simulações ${from === 'now' ? 'a partir de hoje' : 'a partir da entrega'}, com as regras e os preços de hoje. Não conta com as leis que ainda não chegaram.`
          : `80% interval over ${f.runs} simulations ${from === 'now' ? 'from today' : 'from filing'}, with today’s rules and prices. It cannot see laws that have not arrived yet.`}
      </p>
    </div>
  );
}

function ProForma({ pf, lang, mine }: { pf: ReturnType<typeof financingPf>; lang: 'pt' | 'en'; mine: number }) {
  const rows: [string, number][] = [
    [lang === 'pt' ? 'Vendas e rendas' : 'Sales and rents', pf.revenueM],
    [lang === 'pt' ? 'Construção' : 'Construction', -pf.hardM - pf.softM],
    ['IVA', -pf.ivaM],
    [lang === 'pt' ? 'Taxas municipais' : 'City fees', -pf.feesM],
    [lang === 'pt' ? 'Terreno' : 'Land', -pf.landM],
    [lang === 'pt' ? 'Juros da obra' : 'Construction interest', -pf.interestM],
  ];
  if (pf.sunkM) rows.push([lang === 'pt' ? 'Já gasto' : 'Already spent', -pf.sunkM]);
  if (pf.grantM) rows.splice(1, 0, [lang === 'pt' ? 'Apoio PRR' : 'Recovery-plan grant', pf.grantM]);
  return (
    <table className="hab-pf">
      <tbody>
        {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmtM(v, lang)}</td></tr>)}
        <tr className="total"><td>{lang === 'pt' ? 'Lucro' : 'Profit'}</td><td>{fmtM(pf.profitM, lang)}</td></tr>
        <tr><td>{lang === 'pt' ? 'Margem / exigida' : 'Margin / required'}</td><td>{pct(pf.margin)} / {pct(pf.required)}</td></tr>
        <tr><td>{lang === 'pt' ? 'Capital próprio para arrancar' : 'Equity to break ground'}</td><td>{fmtM(pf.equityM * mine, lang)}</td></tr>
      </tbody>
    </table>
  );
}

// ── Site ─────────────────────────────────────────────────────────────────────────────────

export function SiteSheet({ game, site, onFiled }: { game: Game; site: Site; onFiled: (p: Project) => void }) {
  const { t, lang } = useT();
  const s = game.s!;
  const rules = rulesAt(s.month);
  const fr = FREGUESIAS[site.fr];
  const [prog0, setProg] = useState<Program>(() => defaultProgram(site));
  const prog = normalise(site, prog0, rules);
  const pv = useMemo(() => preview(s, site.id, prog), [s, s.month, site.id, prog.scheme, prog.aff, prog.exit, prog.pip, s.cash, s.standing]); // eslint-disable-line react-hooks/exhaustive-deps
  const fc = useMemo(() => (pv.canFile || pv.why ? forecastProposal(s, site.id, prog, 200) : null), [s.month, site.id, prog.scheme, prog.aff, prog.exit, prog.pip]); // eslint-disable-line react-hooks/exhaustive-deps
  const price = rawPrice(site.fr, yearFrac(s.month));
  const schemes = schemesFor(site, rules);
  const set = (p: Partial<Program>) => setProg((x) => ({ ...x, ...p }));
  const mine = site.mega ? 0.15 / site.mega.phases : 1;
  const schemeLabel = (sc: Scheme) => sc === 'base'
    ? (lang === 'pt' ? `O que o plano permite (${site.floors} pisos)` : `What the plan allows (${site.floors} floors)`)
    : sc === 'bonus'
      ? (lang === 'pt' ? `Bónus por renda acessível (${floorsFor(site, 'bonus', rules)} pisos)` : `Affordable-homes bonus (${floorsFor(site, 'bonus', rules)} floors)`)
      : (lang === 'pt' ? `Pedir mais: plano de pormenor (${site.maxFloors} pisos)` : `Ask for more: a detailed plan (${site.maxFloors} floors)`);
  const exitLabel: Record<Exit, string> = lang === 'pt'
    ? { venda: 'Vender', arrendamento: 'Arrendar', al: 'Alojamento local' }
    : { venda: 'Sell', arrendamento: 'Let', al: 'Short lets' };
  const file = () => {
    const p = game.act((st) => fileProject(st, site.id, prog));
    if (p) onFiled(p);
  };
  const al = AL_COUNTS[site.fr];
  return (
    <div className="hab-sheet">
      <div>
        <div className="kicker">{t(kindLabel(site.kind))} · {fr.name}</div>
        <h2>{t(site.name)}</h2>
        <p style={{ marginTop: 6 }}>{t(site.pitch)}</p>
        <p className="hab-note" style={{ marginTop: 6 }}>{t(site.was)}</p>
      </div>
      <dl className="hab-kv">
        <dt>{lang === 'pt' ? 'Lote' : 'Lot'}</dt><dd>{num(site.lot, lang)} m²</dd>
        <dt>{lang === 'pt' ? 'Pisos sem pedir mais' : 'Floors as of right'}</dt><dd>{site.floors}</dd>
        <dt>{lang === 'pt' ? 'O máximo imaginável' : 'The most imaginable'}</dt><dd>{site.maxFloors}</dd>
        <dt>{lang === 'pt' ? 'Altura típica da freguesia' : 'Typical height here'}</dt><dd>{fr.ctx} {lang === 'pt' ? 'pisos' : 'floors'}</dd>
        <dt>{lang === 'pt' ? 'Preço mediano' : 'Median price'} ({Math.floor(yearFrac(s.month))})</dt>
        <dd>{eurM2(price.value, lang)} <span className="muted">· {PROVENANCE_LABEL[price.kind][lang]}</span></dd>
        {al && <><dt>{lang === 'pt' ? 'Alojamento local hoje' : 'Short lets today'}</dt><dd>{num(al.n, lang)} ({num(al.pct, lang, 1)}%)</dd></>}
      </dl>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(site.heritage ?? 0) >= 0.3 && <span className="hab-tag review">{lang === 'pt' ? 'Zona de proteção: parecer do Património' : 'Protection zone: heritage opinion'}</span>}
        {site.tenants && <span className="hab-tag bad">{lang === 'pt' ? `${site.tenants} famílias com contratos antigos` : `${site.tenants} households on old leases`}</span>}
        {site.river && <span className="hab-tag">{lang === 'pt' ? 'Frente ribeirinha' : 'Riverfront'}</span>}
        {site.toxic && <span className="hab-tag bad">{lang === 'pt' ? 'Solo contaminado' : 'Contaminated soil'}</span>}
        {site.plan && <span className="hab-tag done">{lang === 'pt' ? 'Dentro de um plano aprovado' : 'Inside an approved plan'}</span>}
        {site.municipal && <span className="hab-tag done">{site.municipal.scheme === 'coop' ? (lang === 'pt' ? 'Cooperativa: casas a custo' : 'Co-operative: homes at cost') : (lang === 'pt' ? 'Concurso de renda acessível' : 'Affordable-rent tender')}</span>}
        {site.mega && <span className="hab-tag build">{lang === 'pt' ? `${site.mega.phases} fases com um fundo` : `${site.mega.phases} phases with a fund`}</span>}
      </div>

      <div className="hab-block" style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{lang === 'pt' ? 'A tua proposta' : 'Your proposal'}</h3>
        {schemes.length > 1 && (
          <div className="hab-field">
            <span className="label">{lang === 'pt' ? 'Quanto construir' : 'How much to build'}</span>
            <div className="hab-seg" role="group" style={{ display: 'grid' }}>
              {schemes.map((sc) => <button key={sc} aria-pressed={prog.scheme === sc} onClick={() => set({ scheme: sc })} style={{ textAlign: 'left' }}>{schemeLabel(sc)}</button>)}
            </div>
          </div>
        )}
        {affOptions(site).length > 1 && (
          <div className="hab-field">
            <span className="label">{lang === 'pt' ? 'Casas a renda acessível' : 'Affordable homes'}</span>
            <div className="hab-seg" role="group">
              {affOptions(site).map((a) => <button key={a} aria-pressed={prog.aff === a} disabled={prog.scheme === 'bonus' && a < 0.25} onClick={() => set({ aff: a })}>{pct(a)}</button>)}
            </div>
          </div>
        )}
        <div className="hab-field">
          <span className="label">{lang === 'pt' ? 'Depois de pronto' : 'Once finished'}</span>
          <div className="hab-seg" role="group">
            {(['venda', 'arrendamento', 'al'] as Exit[]).map((x) => {
              const ok = exitOk(site, x, rules);
              return <button key={x} aria-pressed={prog.exit === x} disabled={!ok.ok} title={ok.why ? t(ok.why) : undefined} onClick={() => set({ exit: x })}>{exitLabel[x]}</button>;
            })}
          </div>
          {!exitOk(site, 'al', rules).ok && !site.municipal && <span className="hab-note">{t(exitOk(site, 'al', rules).why)}</span>}
        </div>
        {!site.plan && (
          <label className="hab-check">
            <input type="checkbox" checked={prog.pip} onChange={(e) => set({ pip: e.target.checked })} />
            <span>{lang === 'pt' ? 'Pedir informação prévia primeiro (PIP): mais meses, menos surpresas' : 'Ask for prior information first (PIP): more months, fewer surprises'}</span>
          </label>
        )}
      </div>

      <div className="hab-block">
        <h3>{lang === 'pt' ? 'O que sai daqui' : 'What you get'}</h3>
        <p style={{ fontWeight: 700, fontSize: 16 }} className="num">
          {lang === 'pt' ? `${pv.units} casas, ${prog.floors} pisos` : `${pv.units} homes, ${prog.floors} floors`}
          {pv.affUnits > 0 && <span className="muted" style={{ fontWeight: 600 }}> · {pv.affUnits} {lang === 'pt' ? 'a renda acessível' : 'affordable'}</span>}
        </p>
      </div>

      <div className="hab-block">
        <h3>{lang === 'pt' ? 'O caminho' : 'The road'}</h3>
        <ul className="hab-steps">
          {pv.steps.map((st) => (
            <li key={st.key}><span className="dot" /><span>{t(st.label)}</span><span className="m">{months(st.lo, st.hi, lang)}</span></li>
          ))}
        </ul>
        {pv.camaraP != null && (
          <div className="hab-odds" style={{ marginTop: 10 }}>
            <div className="hab-odd">
              <span>{lang === 'pt' ? 'Aprovação na Câmara hoje' : 'Câmara approval today'}</span>
              <span className="bar"><span style={{ width: pct(pv.camaraP) }} /></span>
              <span className="p">{pct(pv.camaraP)}</span>
            </div>
          </div>
        )}
      </div>

      <ForecastBlock f={fc} lang={lang} from="filing" />

      <div className="hab-block">
        <h3>{lang === 'pt' ? 'Quem se vai opor' : 'Who will object'}</h3>
        <Meters viz={pv.heat.viz} hab={pv.heat.hab} />
      </div>

      <div className="hab-block">
        <h3>{lang === 'pt' ? 'As contas, com os preços de hoje' : 'The numbers, at today’s prices'}</h3>
        <ProForma pf={pv.pf} lang={lang} mine={mine} />
        <div className={`hab-verdict ${pv.pf.pencils ? 'good' : 'bad'}`} style={{ marginTop: 8 }}>
          {pv.pf.pencils
            ? (lang === 'pt' ? 'Hoje, um banco financiava isto.' : 'Today, a bank would lend on this.')
            : (lang === 'pt' ? 'Hoje, as contas não fecham. Pode mudar até lá.' : 'Today, the numbers do not work. That may change by then.')}
        </div>
        {keepsBuilding(site) && <p className="hab-note" style={{ marginTop: 6 }}>{lang === 'pt' ? 'Reabilitação em área de reabilitação urbana: IVA a 6%.' : 'Rehabilitation inside an urban rehabilitation area: 6% VAT.'}</p>}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <button className="hab-btn primary" disabled={!pv.canFile} onClick={file}>
          {lang === 'pt' ? `Assinar contrato-promessa · sinal de ${fmtM(pv.depositM, 'pt')}` : `Sign the promissory contract · ${fmtM(pv.depositM, 'en')} deposit`}
        </button>
        {pv.why && <p className="hab-note">{t(pv.why)}</p>}
        <p className="hab-note">{lang === 'pt' ? 'O sinal fixa o preço do terreno durante 24 meses; o resto paga-se na primeira pedra.' : 'The deposit fixes the land price for 24 months; the rest is paid at groundbreaking.'}</p>
      </div>
    </div>
  );
}

// ── Project ──────────────────────────────────────────────────────────────────────────────

export function ProjectSheet({ game, p, openDecision }: { game: Game; p: Project; openDecision: () => void }) {
  const { t, lang } = useT();
  const s = game.s!;
  const site = SITES_BY_ID[p.site];
  const fr = FREGUESIAS[site.fr];
  const rules = rulesAt(s.month);
  const live = isLive(p);
  const pending = s.decisions.some((d) => d.project === p.id);
  const h = heatFor(site, p.prog, p.units, s.standing, p.mult);
  const fc = useMemo(() => (live && p.stage !== 'obra' ? forecastProject(s, p, 160) : null), [s.month, p.id, p.stage, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const pf = live && p.stage !== 'obra' ? financingPf(s, p) : null;
  const stages = routeStages(p, rules);
  const doneSet = new Set(p.hist.map((x) => x.stage));
  const mine = site.mega ? 0.15 * (p.partner ? 0.4 : 1) : p.partner ? 0.4 : 1;
  const exitLabel = { venda: lang === 'pt' ? 'para vender' : 'for sale', arrendamento: lang === 'pt' ? 'para arrendar' : 'to let', al: lang === 'pt' ? 'alojamento local' : 'short lets' }[p.prog.exit];
  const logs = s.log.filter((l) => l.project === p.id).slice(-10).reverse();
  return (
    <div className="hab-sheet">
      <div>
        <div className="kicker"><span className={`hab-tag ${stageClass(p)}`}>{t(STAGE[p.stage])}</span> · {fr.name}</div>
        <h2 style={{ marginTop: 6 }}>{t(site.name)}</h2>
        <p className="num" style={{ marginTop: 6, fontWeight: 600 }}>
          {p.units} {lang === 'pt' ? 'casas' : 'homes'} · {p.prog.floors} {lang === 'pt' ? 'pisos' : 'floors'}{p.affUnits ? ` · ${p.affUnits} ${lang === 'pt' ? 'a renda acessível' : 'affordable'}` : ''} · {exitLabel}
        </p>
        {site.mega && <p className="hab-note">{lang === 'pt' ? `Fase ${p.phase + 1} de ${site.mega.phases}; ${p.built} casas entregues.` : `Phase ${p.phase + 1} of ${site.mega.phases}; ${p.built} homes delivered.`}</p>}
      </div>
      {pending && (
        <button className="hab-btn primary" onClick={openDecision}>{lang === 'pt' ? 'Há uma decisão à tua espera' : 'A decision is waiting for you'}</button>
      )}
      {live && (
        <div className="hab-block">
          <h3>{lang === 'pt' ? 'Onde está' : 'Where it stands'}</h3>
          <ul className="hab-steps">
            {stages.map((st) => {
              const now = p.stage === st;
              const done = !now && (doneSet.has(st) || stages.indexOf(st) < stages.indexOf(p.stage));
              return (
                <li key={st} className={now ? 'now' : done ? 'done' : ''}>
                  <span className="dot" />
                  <span>{t(STAGE[st])}</span>
                  <span className="m">{now && p.stage !== 'fin' ? (lang === 'pt' ? `faltam ~${Math.max(1, p.left)} meses` : `~${Math.max(1, p.left)} mo left`) : now ? (lang === 'pt' ? 'à espera' : 'waiting') : ''}</span>
                </li>
              );
            })}
          </ul>
          {p.suit && <div className="hab-verdict bad" style={{ marginTop: 8 }}>{lang === 'pt' ? `Em tribunal: decisão em ~${p.suit.left} meses${p.suit.suspends ? '; providência cautelar em vigor' : ''}.` : `In court: ruling in ~${p.suit.left} months${p.suit.suspends ? '; injunction in force' : ''}.`}</div>}
          {p.tacit && <p className="hab-note" style={{ marginTop: 6 }}>{lang === 'pt' ? 'Licença por deferimento tácito.' : 'Licence by tacit approval.'}</p>}
        </div>
      )}
      <ForecastBlock f={fc} lang={lang} from="now" />
      {live && usesTeam(p) && (
        <div className="hab-block">
          <h3>{lang === 'pt' ? 'Quem se opõe' : 'Who objects'}</h3>
          <Meters viz={h.viz} hab={h.hab} />
        </div>
      )}
      {pf && (
        <div className="hab-block">
          <h3>{lang === 'pt' ? 'As contas, hoje' : 'The numbers, today'}</h3>
          <ProForma pf={pf} lang={lang} mine={mine} />
          <div className={`hab-verdict ${pf.pencils ? 'good' : p.stage === 'fin' ? 'bad' : 'caveat'}`} style={{ marginTop: 8 }}>
            {pf.pencils
              ? (lang === 'pt' ? 'Se fosse hoje, o banco financiava.' : 'If it were today, the bank would lend.')
              : p.stage === 'fin'
                ? (lang === 'pt' ? 'As contas não fecham: o banco não financia.' : 'The numbers do not work: the bank will not lend.')
                : (lang === 'pt' ? 'Se fosse hoje, não fechava. O que conta é o dia da primeira pedra.' : 'If it were today, it would not work. What counts is the day you break ground.')}
          </div>
        </div>
      )}
      {live && p.stage !== 'obra' && (
        <div className="hab-actions">
          {usesTeam(p) && (
            <button className="hab-btn small" disabled={p.meetings >= 2 || s.cash < meetingCost(p)} onClick={() => game.act((st) => meetResidents(st, p.id))}>
              {lang === 'pt' ? `Sessão com moradores (${fmtM(meetingCost(p), 'pt')})` : `Residents’ session (${fmtM(meetingCost(p), 'en')})`}
            </button>
          )}
          <button className="hab-btn small" onClick={() => game.act((st) => sellProject(st, p.id))}>
            {lang === 'pt' ? `Vender (${fmtM(saleValue(s, p), 'pt')})` : `Sell (${fmtM(saleValue(s, p), 'en')})`}
          </button>
          <button className="hab-btn small text" onClick={() => game.act((st) => abandonProject(st, p.id))}>{lang === 'pt' ? 'Desistir' : 'Walk away'}</button>
        </div>
      )}
      {logs.length > 0 && (
        <div className="hab-block">
          <h3>{lang === 'pt' ? 'O processo' : 'The file'}</h3>
          <ul className="hab-list" style={{ gap: 4, fontSize: 13 }}>
            {logs.map((l, i) => <li key={i}><span className="muted num">{fmtMonth(l.m, lang)}</span> · {t(l.text).replace(`${t(site.name)}: `, '')}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── The city, when nothing is selected ───────────────────────────────────────────────────

export function CityOverview({ s }: { s: GameState }) {
  const { lang } = useT();
  const md = mandateAt(s.month);
  const seats = councilAt(s.month);
  const r = rulesAt(s.month);
  const e = econAt(s.month);
  const y = yearFrac(s.month);
  const avgKeys = s.stats.monthsToKeys.length ? s.stats.monthsToKeys.reduce((a, b) => a + b, 0) / s.stats.monthsToKeys.length : null;
  return (
    <div className="hab-sheet">
      <div>
        <div className="kicker">{lang === 'pt' ? 'Lisboa, hoje' : 'Lisbon, today'}</div>
        <h2>{lang === 'pt' ? 'Escolhe um terreno no mapa' : 'Pick a site on the map'}</h2>
        <p className="muted" style={{ marginTop: 6 }}>{lang === 'pt' ? 'Os quadrados com uma cruz estão disponíveis. Clica para desenhar uma proposta e ver o caminho, as probabilidades e as contas.' : 'Squares with a cross are available. Click one to draft a proposal and see the road, the odds and the numbers.'}</p>
      </div>
      <div className="hab-block">
        <h3>{lang === 'pt' ? 'Câmara Municipal' : 'City council'}</h3>
        <p style={{ fontWeight: 600 }}>{md.mayor} · {BLOCS[md.mayorBloc].name}</p>
        <div style={{ display: 'flex', gap: 3, margin: '8px 0', flexWrap: 'wrap' }} role="img" aria-label={Object.entries(md.seats).map(([b, n]) => `${BLOCS[b].name} ${n}`).join(', ')}>
          {seats.map((x, i) => <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: BLOCS[x.bloc].color, display: 'inline-block' }} />)}
        </div>
        <p className="hab-note">{lang === 'pt' ? md.note.pt : md.note.en}</p>
      </div>
      <div className="hab-block">
        <h3>{lang === 'pt' ? 'Regras em vigor' : 'Rules in force'}</h3>
        <dl className="hab-kv">
          <dt>{lang === 'pt' ? 'Licenciamento' : 'Licensing'}</dt>
          <dd>{r.simplex ? (lang === 'pt' ? 'Simplex: prazos e deferimento tácito' : 'Simplex: deadlines, tacit approval') : (lang === 'pt' ? 'regime antigo, com alvará' : 'old regime, with a permit')}</dd>
          <dt>{lang === 'pt' ? 'Alojamento local' : 'Short lets'}</dt>
          <dd>{r.alFrozen ? (lang === 'pt' ? 'congelado no país' : 'frozen nationwide') : r.alClosed.length ? (lang === 'pt' ? `fechado em ${r.alClosed.length} freguesias` : `closed in ${r.alClosed.length} parishes`) : (lang === 'pt' ? 'aberto' : 'open')}</dd>
          <dt>{lang === 'pt' ? 'IVA na construção nova' : 'VAT on new build'}</dt>
          <dd>{pct(r.ivaNew)}</dd>
          <dt>{lang === 'pt' ? 'Terrenos municipais' : 'City land'}</dt>
          <dd>{r.tenders === 'pra' ? (lang === 'pt' ? 'concursos de renda acessível' : 'affordable-rent tenders') : r.tenders === 'coop' ? (lang === 'pt' ? 'para cooperativas' : 'for co-operatives') : (lang === 'pt' ? 'nenhum em oferta' : 'none on offer')}</dd>
          <dt>{lang === 'pt' ? 'Apoio por casa acessível' : 'Grant per affordable home'}</dt>
          <dd>{r.prrK > 0 ? fmtM(r.prrK / 1000, lang) : '—'}</dd>
        </dl>
      </div>
      <div className="hab-block">
        <h3>{lang === 'pt' ? 'Mercado' : 'Market'}</h3>
        <dl className="hab-kv">
          <dt>{lang === 'pt' ? 'Preço mediano em Lisboa' : 'Lisbon median price'}</dt><dd>{eurM2(lisboaPriceM2(y), lang)}</dd>
          <dt>Euribor 12M</dt><dd>{num(e.euribor, lang, 2)}%</dd>
          <dt>{lang === 'pt' ? 'Custos de construção vs 2015' : 'Building costs vs 2015'}</dt><dd>+{pct(e.cost - 1)}</dd>
        </dl>
      </div>
      <div className="hab-block">
        <h3>{lang === 'pt' ? 'O teu registo' : 'Your record'}</h3>
        <dl className="hab-kv">
          <dt>{lang === 'pt' ? 'Casas entregues' : 'Homes delivered'}</dt><dd>{num(s.stats.homes, lang)}</dd>
          <dt>{lang === 'pt' ? 'A renda acessível' : 'Affordable'}</dt><dd>{num(s.stats.aff, lang)}</dd>
          <dt>{lang === 'pt' ? 'Alojamento local' : 'Short lets'}</dt><dd>{num(s.stats.al, lang)}</dd>
          <dt>{lang === 'pt' ? 'Projetos abandonados' : 'Projects abandoned'}</dt><dd>{s.stats.killed}</dd>
          <dt>{lang === 'pt' ? 'Processos em tribunal' : 'Court cases'}</dt><dd>{s.stats.lawsuits}</dd>
          <dt>{lang === 'pt' ? 'Do contrato às chaves' : 'Contract to keys'}</dt><dd>{avgKeys != null ? (lang === 'pt' ? `${Math.round(avgKeys)} meses` : `${Math.round(avgKeys)} months`) : '—'}</dd>
        </dl>
      </div>
    </div>
  );
}
