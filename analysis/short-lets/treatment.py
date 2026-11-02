"""The treatment calendar: which Lisbon parishes stopped taking new short-let registrations, when.

Every date and list is from the press reports cited beside it, and from
src/data/fontes/cronologia.json (the game's dated policy events).
"""
from __future__ import annotations

from datetime import date

# Lisbon's suspension of new AL registrations in parishes whose ratio of AL to permanent
# dwellings was 2.5% or more. Approved by the Câmara on 15 Dec 2021 and by the Assembleia
# Municipal on 22 Mar 2022, published in the Boletim Municipal on 14 Apr 2022, in force
# 15 Apr 2022, for six months and renewable.
# https://eco.sapo.pt/2022/03/22/lisboa-aprova-suspensao-de-novos-registos-de-alojamento-local-em-14-freguesias/
# https://www.dn.pt/dinheiro/lisboa-alojamento-local-dispara-382-14777796.html
ANNOUNCED = date(2021, 12, 15)
IN_FORCE = date(2022, 4, 15)

# Ratio (AL / permanent dwellings, %) at the time, as the two articles give it.
FROZEN_APRIL_2022 = {
    "110601": ("Ajuda", 3), "110602": ("Alcântara", 5), "110655": ("Areeiro", 3),
    "110656": ("Arroios", 14), "110657": ("Avenidas Novas", 7), "110658": ("Belém", 4),
    "110659": ("Campo de Ourique", 4), "110660": ("Estrela", 11), "110661": ("Misericórdia", 39),
    "110662": ("Parque das Nações", 4), "110663": ("Penha de França", 4),
    "110665": ("Santa Maria Maior", 52), "110666": ("Santo António", 26), "110667": ("São Vicente", 16),
}

# Later joiners: Campolide with the October 2022 extension, Beato from 2 June 2023.
# https://www.idealista.pt/news/ferias/turismo/2022/10/05/54368-novos-registos-de-alojamento
# https://eco.sapo.pt/2023/06/02/freguesia-lisboeta-do-beato-ultrapassa-racio-de-alojamento-
LATE = {"110610": ("Campolide", date(2022, 10, 15)), "110607": ("Beato", date(2023, 6, 2))}

# Never frozen by the 2022 measure (DN, 17 Apr 2022, lists them as excluded).
NEVER = {
    "110654": "Alvalade", "110608": "Benfica", "110611": "Carnide", "110618": "Lumiar",
    "110621": "Marvila", "110633": "Olivais", "110664": "Santa Clara",
    "110639": "São Domingos de Benfica",
}

# Events that end the clean comparison:
# - Law 56/2023 (Mais Habitação) in force 7 Oct 2023 suspended new AL registrations in the
#   whole country except low-density territories and the autonomous regions, so from then on
#   Lisbon's other parishes and most of the donor pool were frozen too.
# - DL 76/2024 (in force 1 Nov 2024) ended the national suspension; Lisbon froze the whole
#   city from 5 Nov 2024.
# https://diariodarepublica.pt/dr/detalhe/lei/56-2023-222477692
CLEAN_UNTIL = date(2023, 10, 6)

# Earlier containment: the November 2018 suspension and the 2019 RMAL's absolute containment
# zones (Baixa, Avenida da Liberdade/República/Almirante Reis axes, Bairro Alto, Madragoa,
# Castelo, Alfama, Mouraria, Colina de Santana) already covered much of Santa Maria Maior,
# Misericórdia, Santo António and São Vicente. For those four the 2022 measure froze little
# that was not frozen already; the design reports them apart.
# https://eco.sapo.pt/2019/11/07/novas-zonas-de-contencao-do-alojamento-local-em-lisboa-ja-estao-em-vigor-veja-o-mapa/
ALREADY_CONTAINED = {"110661", "110665", "110666", "110667"}


def treated_since(code: str) -> date | None:
    if code in FROZEN_APRIL_2022:
        return IN_FORCE
    if code in LATE:
        return LATE[code][1]
    return None


def exposure(code: str, start: date, end: date) -> float:
    """Share of the days in [start, end] the parish was frozen.

    INE's rent figures are medians over a window of contracts (a calendar year, or the 12
    months to a quarter), so a window is treated in proportion to the days it spent frozen.
    Windows that reach past ``CLEAN_UNTIL`` compare frozen with frozen; the loaders drop
    them (or keep them only in a flagged robustness run)."""
    since = treated_since(code)
    if since is None or since > end:
        return 0.0
    lo = max(start, since)
    return ((end - lo).days + 1) / ((end - start).days + 1)
