// Market series the game interpolates month by month. Values after the last published
// month are a scenario, not a forecast, and the game labels them so.
//
// EURIBOR  : 12-month Euribor, monthly average, %, at anchor months (EMMI / Banco de Portugal).
// COST     : INE's index of construction costs of new housing (materials and labour), 2015 = 1.
// AL       : value of a home run as a short let relative to selling it, editorial: the
//            2016-19 boom, the 2020-21 collapse, the recovery.
// AFF_RENT : capped "renda acessível" rent, €/m²/month, editorial, after the city's
//            Programa Renda Acessível price tables.

export type Anchor = [year: number, month: number, value: number];

export const EURIBOR: Anchor[] = [
  [2015, 1, 0.3],
  [2016, 1, 0.04],
  [2017, 1, -0.1],
  [2018, 1, -0.19],
  [2019, 1, -0.12],
  [2020, 1, -0.25],
  [2021, 1, -0.5],
  [2022, 1, -0.48],
  [2022, 7, 0.99],
  [2023, 1, 3.34],
  [2023, 10, 4.16],
  [2024, 1, 3.61],
  [2024, 7, 3.53],
  [2025, 1, 2.52],
  [2025, 7, 2.08],
  [2026, 1, 2.35],
  [2026, 5, 2.7],
  [2026, 9, 3.05],
  // scenario
  [2027, 6, 3.0],
  [2030, 1, 2.7],
];
// Monthly anchors chosen to match the ECB's annual averages of the 12-month Euribor
// (0.168 in 2015 ... 3.869 in 2023, 3.274 in 2024, 2.222 in 2025) and the January to
// September 2026 average of 2.715 (src/data/fontes/ine.json, source ecb_euribor).
export const EURIBOR_LAST_DATA: [number, number] = [2026, 9];

// INE 0011748, annual average, base 2015 = 1 (85.30 = 1); 2026 is January-August.
export const COST: Anchor[] = [
  [2015, 7, 1.0],
  [2016, 7, 1.0121],
  [2017, 7, 1.0304],
  [2018, 7, 1.0538],
  [2019, 7, 1.0784],
  [2020, 7, 1.1006],
  [2021, 7, 1.1723],
  [2022, 7, 1.3149],
  [2023, 7, 1.366],
  [2024, 7, 1.4116],
  [2025, 7, 1.4683],
  [2026, 5, 1.5495],
  // scenario: +4% a year
  [2030, 1, 1.79],
];

export const AL: Anchor[] = [
  [2015, 1, 1.15],
  [2016, 7, 1.3],
  [2018, 7, 1.35],
  [2019, 12, 1.25],
  [2020, 4, 0.7],
  [2021, 6, 0.75],
  [2022, 6, 1.05],
  [2023, 6, 1.15],
  [2030, 1, 1.15],
];

export const AFF_RENT: Anchor[] = [
  [2015, 1, 6.5],
  [2019, 1, 8],
  [2023, 1, 9],
  [2026, 1, 10],
  [2030, 1, 10.8],
];

/** Linear interpolation between anchors; flat before the first and after the last. */
export function at(series: Anchor[], month: number): number {
  const t = (y: number, m: number) => (y - 2015) * 12 + (m - 1);
  if (month <= t(series[0][0], series[0][1])) return series[0][2];
  for (let i = 1; i < series.length; i++) {
    const [y, m, v] = series[i];
    const b = t(y, m);
    if (month <= b) {
      const [y0, m0, v0] = series[i - 1];
      const a = t(y0, m0);
      return v0 + ((v - v0) * (month - a)) / (b - a);
    }
  }
  return series[series.length - 1][2];
}
