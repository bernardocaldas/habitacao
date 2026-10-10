import { fmtM } from '../sim/sim';
import type { L, Lang, Project, Stage } from '../sim/types';

export { fmtM };

const S = (pt: string, en: string): L => ({ pt, en });

export const STAGE: Record<Stage, L> = {
  pip: S('Informação prévia', 'Prior information'),
  plano: S('Plano de pormenor', 'Detailed plan'),
  arq: S('Arquitetura', 'Architecture'),
  cp: S('Comunicação prévia', 'Prior notice'),
  discussao: S('Discussão pública', 'Public consultation'),
  camara: S('Câmara', 'Câmara vote'),
  esp: S('Especialidades', 'Engineering'),
  alvara: S('Alvará', 'Permit'),
  fin: S('Financiamento', 'Financing'),
  obra: S('Em obra', 'Building'),
  done: S('Concluído', 'Finished'),
  dead: S('Abandonado', 'Dead'),
  sold: S('Vendido', 'Sold'),
};

export function stageClass(p: Project): string {
  if (p.stage === 'done') return 'done';
  if (p.stage === 'dead' || p.stage === 'sold') return 'wait';
  if (p.stage === 'obra') return 'build';
  if (p.stage === 'fin') return 'bad';
  return 'review';
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function num(n: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    .format(n)
    .replace('-', '−');
}

export const eurM2 = (n: number, lang: Lang) => (lang === 'pt' ? `${num(n, lang)} €/m²` : `€${num(n, lang)}/m²`);

export function months(lo: number, hi: number, lang: Lang): string {
  if (lo === hi) return lang === 'pt' ? `${lo} ${lo === 1 ? 'mês' : 'meses'}` : `${lo} mo`;
  return lang === 'pt' ? `${lo}–${hi} meses` : `${lo}–${hi} mo`;
}
