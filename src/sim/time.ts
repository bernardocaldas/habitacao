// One tick is one month. Month 0 is January 2015; the game ends with the local elections of
// October 2029, when the next Câmara takes office.
import type { Lang } from './types';

export const START_YEAR = 2015;
export const monthOf = (year: number, mon = 1) => (year - START_YEAR) * 12 + (mon - 1);
export const END_MONTH = monthOf(2029, 10);

export const yearOf = (month: number) => START_YEAR + Math.floor(month / 12);
export const monOf = (month: number) => (month % 12) + 1;
/** Fractional year, for interpolating yearly series. */
export const yearFrac = (month: number) => START_YEAR + month / 12;

const SHORT: Record<Lang, string[]> = {
  pt: ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const LONG: Record<Lang, string[]> = {
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export const fmtMonth = (month: number, lang: Lang) => `${SHORT[lang][month % 12]} ${yearOf(month)}`;
export const fmtMonthLong = (month: number, lang: Lang) =>
  lang === 'pt' ? `${LONG.pt[month % 12]} de ${yearOf(month)}` : `${LONG.en[month % 12]} ${yearOf(month)}`;

/** "1 ano e 3 meses" / "1 yr 3 mo". */
export function fmtSpan(months: number, lang: Lang): string {
  const m = Math.max(0, Math.round(months));
  const y = Math.floor(m / 12), r = m % 12;
  if (lang === 'pt') {
    const ys = y === 1 ? '1 ano' : `${y} anos`;
    const ms = r === 1 ? '1 mês' : `${r} meses`;
    if (!y) return ms;
    return r ? `${ys} e ${ms}` : ys;
  }
  if (!y) return `${r} mo`;
  return r ? `${y} yr ${r} mo` : `${y} yr`;
}
