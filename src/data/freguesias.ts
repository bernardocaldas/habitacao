// Lisbon's 24 parishes (since the 2012 reform), with CAOP 2021 codes.
//
// pop / households : Censos 2021 (INE, CC BY 4.0), as published by estimador.pt's synthetic
//                    population v1.0.3 (census_population, generated_households).
// ctx              : typical existing height in floors.
// viz / hab        : strength of residents' and heritage campaigns (viz) and of the
//                    right-to-housing movement (hab), 0..1.
// heritage         : share of the parish under heritage protection, 0..1.
//
// ctx, viz, hab and heritage are editorial judgements for game balance, not published
// statistics; the Rulebook says so.
import type { Freguesia } from '../sim/types';

export const FREGUESIAS: Record<string, Freguesia> = {
  '110601': { code: '110601', name: 'Ajuda', ctx: 3, viz: 0.5, hab: 0.5, heritage: 0.45, pop: 14306, households: 6566 },
  '110602': { code: '110602', name: 'Alcântara', ctx: 4, viz: 0.35, hab: 0.55, heritage: 0.2, river: true, pop: 13850, households: 6678 },
  '110607': { code: '110607', name: 'Beato', ctx: 4, viz: 0.3, hab: 0.6, heritage: 0.2, river: true, pop: 12183, households: 5719 },
  '110608': { code: '110608', name: 'Benfica', ctx: 7, viz: 0.5, hab: 0.4, heritage: 0.05, pop: 35362, households: 16507 },
  '110610': { code: '110610', name: 'Campolide', ctx: 6, viz: 0.4, hab: 0.5, heritage: 0.15, pop: 14787, households: 6658 },
  '110611': { code: '110611', name: 'Carnide', ctx: 5, viz: 0.5, hab: 0.4, heritage: 0.1, pop: 18028, households: 7443 },
  '110618': { code: '110618', name: 'Lumiar', ctx: 7, viz: 0.45, hab: 0.35, heritage: 0.05, pop: 46334, households: 19574 },
  '110621': { code: '110621', name: 'Marvila', ctx: 4, viz: 0.2, hab: 0.75, heritage: 0.15, river: true, pop: 35479, households: 14142 },
  '110633': { code: '110633', name: 'Olivais', ctx: 5, viz: 0.45, hab: 0.5, heritage: 0.05, pop: 32179, households: 14000 },
  '110639': { code: '110639', name: 'São Domingos de Benfica', ctx: 8, viz: 0.55, hab: 0.3, heritage: 0.1, pop: 34076, households: 15884 },
  '110654': { code: '110654', name: 'Alvalade', ctx: 5, viz: 0.8, hab: 0.3, heritage: 0.35, pop: 33309, households: 14826 },
  '110655': { code: '110655', name: 'Areeiro', ctx: 7, viz: 0.6, hab: 0.3, heritage: 0.25, pop: 21160, households: 9471 },
  '110656': { code: '110656', name: 'Arroios', ctx: 5, viz: 0.4, hab: 0.7, heritage: 0.35, pop: 33302, households: 15086 },
  '110657': { code: '110657', name: 'Avenidas Novas', ctx: 7, viz: 0.45, hab: 0.3, heritage: 0.2, pop: 23261, households: 10470 },
  '110658': { code: '110658', name: 'Belém', ctx: 3, viz: 0.85, hab: 0.2, heritage: 0.6, river: true, pop: 16546, households: 7169 },
  '110659': { code: '110659', name: 'Campo de Ourique', ctx: 5, viz: 0.85, hab: 0.3, heritage: 0.4, pop: 22140, households: 10384 },
  '110660': { code: '110660', name: 'Estrela', ctx: 4, viz: 0.8, hab: 0.45, heritage: 0.7, river: true, pop: 20267, households: 9248 },
  '110661': { code: '110661', name: 'Misericórdia', ctx: 4, viz: 0.6, hab: 0.75, heritage: 0.85, centro: true, river: true, pop: 9658, households: 4872 },
  '110662': { code: '110662', name: 'Parque das Nações', ctx: 9, viz: 0.55, hab: 0.15, heritage: 0, river: true, pop: 22382, households: 9027 },
  '110663': { code: '110663', name: 'Penha de França', ctx: 5, viz: 0.4, hab: 0.6, heritage: 0.2, pop: 28475, households: 13260 },
  '110664': { code: '110664', name: 'Santa Clara', ctx: 5, viz: 0.25, hab: 0.6, heritage: 0, pop: 23645, households: 9219 },
  '110665': { code: '110665', name: 'Santa Maria Maior', ctx: 4, viz: 0.6, hab: 0.8, heritage: 0.95, centro: true, river: true, pop: 10051, households: 4586 },
  '110666': { code: '110666', name: 'Santo António', ctx: 5, viz: 0.7, hab: 0.4, heritage: 0.7, centro: true, pop: 11060, households: 5183 },
  '110667': { code: '110667', name: 'São Vicente', ctx: 4, viz: 0.55, hab: 0.75, heritage: 0.8, centro: true, river: true, pop: 13956, households: 6934 },
};

export const FREGUESIA_CODES = Object.keys(FREGUESIAS);
