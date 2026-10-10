// The plots on offer. They are invented: each is an archetype of what comes up for sale in
// its parish (a pombaline building with tenants, a riverside warehouse, an office block
// emptied by remote work), placed inside the right parish but at no real address. The
// parishes, the rules and the prices are real; the plots are not, and the game says so.
//
// lot m², cov share of the lot built on, floors allowed without asking, maxFloors the most
// a plan or exception could give. Units ≈ lot × cov × floors / 95 m².
import type { Site } from '../sim/types';

export const SITES: Site[] = [
  // ── Historic centre: rehabilitation ─────────────────────────────────────────────────────
  {
    id: 'baixa-pombalino', fr: '110665', lon: -9.1385, lat: 38.7105, kind: 'reab',
    name: { pt: 'Prédio pombalino na Baixa', en: 'Pombaline building in the Baixa' },
    was: { pt: 'Cinco pisos devolutos sobre uma loja de recordações.', en: 'Five empty floors above a souvenir shop.' },
    pitch: { pt: 'Estrutura em gaiola, escadas de pedra, vista para a rua. Cada piso pede licença ao passado.', en: 'Timber-cage frame, stone stairs, a street view. Every floor needs the past’s permission.' },
    lot: 300, cov: 1, floors: 5, maxFloors: 6, heritage: 0.9,
  },
  {
    id: 'alfama-inquilinos', fr: '110665', lon: -9.1302, lat: 38.7118, kind: 'reab',
    name: { pt: 'Prédio com inquilinos em Alfama', en: 'Building with tenants in Alfama' },
    was: { pt: 'Quatro pisos; cinco famílias com contratos anteriores a 1990.', en: 'Four floors; five households on leases older than 1990.' },
    pitch: { pt: 'O telhado mete água e as rendas são de outro século. Reabilitar exige decidir o que acontece a quem lá vive.', en: 'The roof leaks and the rents belong to another century. Rehabilitating it means deciding what happens to the people who live there.' },
    lot: 220, cov: 1, floors: 4, maxFloors: 4, heritage: 0.95, tenants: 5,
  },
  {
    id: 'mouraria-quarteirao', fr: '110665', lon: -9.1352, lat: 38.7158, kind: 'reab',
    name: { pt: 'Meio quarteirão na Mouraria', en: 'Half a block in Mouraria' },
    was: { pt: 'Três prédios ligados por pátios, dois deles em ruína.', en: 'Three buildings joined by courtyards, two of them in ruins.' },
    pitch: { pt: 'Escala de bairro, ruas onde não passa uma betoneira. Por baixo pode estar a cidade islâmica.', en: 'Neighbourhood scale, lanes no cement mixer fits down. The Islamic city may lie underneath.' },
    lot: 600, cov: 0.9, floors: 4, maxFloors: 5, heritage: 0.85, tenants: 3,
  },
  {
    id: 'bairro-alto', fr: '110661', lon: -9.1448, lat: 38.7128, kind: 'reab',
    name: { pt: 'Prédio setecentista no Bairro Alto', en: 'Eighteenth-century building in Bairro Alto' },
    was: { pt: 'Um bar no rés-do-chão e três pisos fechados há dez anos.', en: 'A bar on the ground floor and three floors shut for ten years.' },
    pitch: { pt: 'A rua mais procurada pelo alojamento local da cidade. Os vizinhos sabem.', en: 'The street short-let operators want most. The neighbours know it.' },
    lot: 260, cov: 1, floors: 4, maxFloors: 5, heritage: 0.9, tenants: 2,
  },
  {
    id: 'santos-armazem', fr: '110660', lon: -9.1575, lat: 38.7072, kind: 'armazem',
    name: { pt: 'Armazém em Santos', en: 'Warehouse in Santos' },
    was: { pt: 'Armazém de mercadorias do porto, sem uso desde os anos 90.', en: 'A port goods warehouse, unused since the 1990s.' },
    pitch: { pt: 'Junto ao rio e ao comboio. O porto, a Câmara e o Património têm todos uma palavra a dizer.', en: 'By the river and the railway. The port, the Câmara and the heritage authority all have a say.' },
    lot: 1800, cov: 0.6, floors: 4, maxFloors: 6, heritage: 0.4, river: true,
  },
  {
    id: 'graca-convento', fr: '110667', lon: -9.1305, lat: 38.7172, kind: 'reab',
    name: { pt: 'Ala de um antigo convento na Graça', en: 'Wing of a former convent in Graça' },
    was: { pt: 'Ala de um convento do século XVII vendida pelo Estado.', en: 'A seventeenth-century convent wing sold by the state.' },
    pitch: { pt: 'Claustro, azulejos e muitas opiniões sobre o que lhe deve acontecer.', en: 'A cloister, tiles and many opinions on what should happen to it.' },
    lot: 2500, cov: 0.5, floors: 3, maxFloors: 4, heritage: 0.95,
  },
  {
    id: 'principe-real', fr: '110666', lon: -9.1488, lat: 38.7175, kind: 'reab',
    name: { pt: 'Palacete no Príncipe Real', en: 'Townhouse in Príncipe Real' },
    was: { pt: 'Palacete oitocentista dividido em escritórios.', en: 'A nineteenth-century townhouse cut up into offices.' },
    pitch: { pt: 'O metro quadrado mais caro da cidade, num jardim que todos querem proteger.', en: 'The dearest square metre in the city, by a garden everyone wants to protect.' },
    lot: 900, cov: 0.7, floors: 4, maxFloors: 5, heritage: 0.8,
  },
  {
    id: 'colina-hospital', fr: '110656', lon: -9.1405, lat: 38.7208, kind: 'reab', from: [2016, 1],
    name: { pt: 'Antigo hospital na colina', en: 'Former hospital on the hill' },
    was: { pt: 'Hospital fechado, posto à venda pelo Estado.', en: 'A closed hospital, put up for sale by the state.' },
    pitch: { pt: 'Claustros, enfermarias e um debate público sobre o que fazer com os hospitais da colina.', en: 'Cloisters, wards and a public row over what to do with the hill’s hospitals.' },
    lot: 12000, cov: 0.45, floors: 4, maxFloors: 6, heritage: 0.85,
  },
  {
    id: 'lapa-logradouro', fr: '110660', lon: -9.1612, lat: 38.7098, kind: 'lote',
    name: { pt: 'Garagens num logradouro da Lapa', en: 'Garages in a Lapa backyard' },
    was: { pt: 'Garagens de chapa no interior de um quarteirão.', en: 'Tin garages inside a block.' },
    pitch: { pt: 'Embaixadas por perto e vizinhos com advogados.', en: 'Embassies nearby and neighbours with lawyers.' },
    lot: 1200, cov: 0.5, floors: 4, maxFloors: 5, heritage: 0.6,
  },
  {
    id: 'madragoa-inquilinos', fr: '110660', lon: -9.1563, lat: 38.7085, kind: 'reab',
    name: { pt: 'Prédio com lojas na Madragoa', en: 'Building with shops in Madragoa' },
    was: { pt: 'Duas lojas e seis famílias com contratos antigos.', en: 'Two shops and six households on old leases.' },
    pitch: { pt: 'Um bairro de varinas que vê o turismo subir a rua.', en: 'An old fishwives’ quarter watching tourism climb the street.' },
    lot: 350, cov: 1, floors: 4, maxFloors: 5, heritage: 0.8, tenants: 6,
  },

  // ── Central ring ────────────────────────────────────────────────────────────────────────
  {
    id: 'almirante-reis', fr: '110656', lon: -9.1352, lat: 38.7262, kind: 'reab',
    name: { pt: 'Prédio de rendimento na Almirante Reis', en: 'Apartment building on Almirante Reis' },
    was: { pt: 'Seis pisos de 1920; quatro inquilinos antigos.', en: 'Six floors from 1920; four long-standing tenants.' },
    pitch: { pt: 'A avenida mais diversa da cidade, e uma das mais disputadas.', en: 'The city’s most diverse avenue, and one of its most contested.' },
    lot: 500, cov: 0.9, floors: 6, maxFloors: 7, heritage: 0.3, tenants: 4,
  },
  {
    id: 'arroios-garagem', fr: '110656', lon: -9.1398, lat: 38.7335, kind: 'lote',
    name: { pt: 'Garagem de bairro em Arroios', en: 'Neighbourhood garage in Arroios' },
    was: { pt: 'Oficina e garagem de dois pisos.', en: 'A two-storey workshop and garage.' },
    pitch: { pt: 'Metro à porta, escolas perto, nenhum monumento à vista.', en: 'Metro at the door, schools nearby, no monument in sight.' },
    lot: 900, cov: 0.7, floors: 6, maxFloors: 8,
  },
  {
    id: 'penha-quintal', fr: '110663', lon: -9.1252, lat: 38.7292, kind: 'lote',
    name: { pt: 'Quintal com barracões na Penha de França', en: 'Yard with sheds in Penha de França' },
    was: { pt: 'Barracões de uma antiga carpintaria.', en: 'Sheds from an old joinery.' },
    pitch: { pt: 'Encosta com vista para o rio, rodeada de prédios de cinco andares.', en: 'A slope with a river view, ringed by five-storey buildings.' },
    lot: 1600, cov: 0.55, floors: 5, maxFloors: 7,
  },
  {
    id: 'avenidas-escritorios', fr: '110657', lon: -9.1492, lat: 38.7382, kind: 'escritorio', from: [2020, 7],
    name: { pt: 'Escritórios dos anos 80 nas Avenidas Novas', en: '1980s offices in Avenidas Novas' },
    was: { pt: 'Oito pisos de escritórios meio vazios desde o teletrabalho.', en: 'Eight floors of offices, half empty since remote work.' },
    pitch: { pt: 'A estrutura existe; falta mudar o uso e a fachada.', en: 'The frame is there; the use and the façade need changing.' },
    lot: 1400, cov: 0.8, floors: 8, maxFloors: 9,
  },
  {
    id: 'sede-bancaria', fr: '110657', lon: -9.1458, lat: 38.7335, kind: 'escritorio', from: [2021, 7],
    name: { pt: 'Antiga sede bancária', en: 'Former bank headquarters' },
    was: { pt: 'Nove pisos vazios depois de uma fusão.', en: 'Nine floors left empty after a merger.' },
    pitch: { pt: 'Lajes largas, garagem enorme, poucas janelas que abram.', en: 'Deep floor plates, a huge car park, few windows that open.' },
    lot: 2000, cov: 0.7, floors: 9, maxFloors: 10,
  },
  {
    id: 'antiga-feira', fr: '110657', lon: -9.1478, lat: 38.7455, kind: 'grande', from: [2018, 1],
    name: { pt: 'Terreno de uma antiga feira', en: 'Site of an old fairground' },
    was: { pt: 'Vinte anos de terreno vazio no centro da cidade.', en: 'Twenty years of empty land in the middle of the city.' },
    pitch: { pt: 'Um bairro inteiro por fazer. Um fundo entra com o capital e fica com a maior parte do lucro.', en: 'A whole neighbourhood to build. A fund puts up the capital and keeps most of the profit.' },
    lot: 40000, cov: 0.4, floors: 6, maxFloors: 14, mega: { phases: 3, share: 0.3 },
  },
  {
    id: 'areeiro-bomba', fr: '110655', lon: -9.1338, lat: 38.7418, kind: 'lote',
    name: { pt: 'Antigo posto de combustível no Areeiro', en: 'Former petrol station in Areeiro' },
    was: { pt: 'Bombas desativadas e tanques ainda enterrados.', en: 'Disused pumps, tanks still underground.' },
    pitch: { pt: 'Esquina perfeita, solo por descontaminar.', en: 'A perfect corner, soil still to clean up.' },
    lot: 700, cov: 0.6, floors: 7, maxFloors: 8, toxic: true,
  },
  {
    id: 'campo-ourique', fr: '110659', lon: -9.1662, lat: 38.7182, kind: 'lote',
    name: { pt: 'Logradouro em Campo de Ourique', en: 'Backyard plot in Campo de Ourique' },
    was: { pt: 'Armazém de uma drogaria no miolo do quarteirão.', en: 'A hardware store’s warehouse in the middle of the block.' },
    pitch: { pt: 'O bairro mais fiel a si próprio. Cada piso a mais conta.', en: 'The neighbourhood most loyal to itself. Every extra floor counts.' },
    lot: 900, cov: 0.6, floors: 5, maxFloors: 6, heritage: 0.3,
  },
  {
    id: 'campolide-quartel', fr: '110610', lon: -9.1655, lat: 38.7312, kind: 'armazem', from: [2019, 1],
    name: { pt: 'Antigo quartel em Campolide', en: 'Former barracks in Campolide' },
    was: { pt: 'Quartel desativado, posto à venda pelo Ministério da Defesa.', en: 'Disused barracks, put up for sale by the Ministry of Defence.' },
    pitch: { pt: 'Muros altos, árvores antigas e uma parada do tamanho de um bairro.', en: 'High walls, old trees and a parade ground the size of a neighbourhood.' },
    lot: 9000, cov: 0.4, floors: 5, maxFloors: 9, heritage: 0.4,
  },

  // ── North and west ──────────────────────────────────────────────────────────────────────
  {
    id: 'alvalade-moradia', fr: '110654', lon: -9.1432, lat: 38.7538, kind: 'lote',
    name: { pt: 'Moradia com jardim em Alvalade', en: 'House with a garden in Alvalade' },
    was: { pt: 'Moradia dos anos 50, à venda por herdeiros.', en: 'A 1950s house, sold by the heirs.' },
    pitch: { pt: 'O bairro planeado modelo. Os vizinhos conhecem o plano de cor.', en: 'The model planned neighbourhood. The neighbours know the plan by heart.' },
    lot: 800, cov: 0.5, floors: 3, maxFloors: 5, heritage: 0.35,
  },
  {
    id: 'alta-lisboa', fr: '110618', lon: -9.1608, lat: 38.7757, kind: 'lote', plan: true,
    name: { pt: 'Lote vazio na Alta de Lisboa', en: 'Empty lot in Alta de Lisboa' },
    was: { pt: 'Lote infraestruturado à espera há quinze anos.', en: 'A serviced lot waiting for fifteen years.' },
    pitch: { pt: 'Dentro de um plano aprovado: basta comunicar, se ficares dentro das regras.', en: 'Inside an approved plan: a prior notice is enough if you stay within its rules.' },
    lot: 3000, cov: 0.5, floors: 8, maxFloors: 12,
  },
  {
    id: 'telheiras', fr: '110618', lon: -9.1655, lat: 38.7622, kind: 'lote',
    name: { pt: 'Terreno entre prédios em Telheiras', en: 'Plot between blocks in Telheiras' },
    was: { pt: 'Relvado sem dono aparente onde se passeiam cães.', en: 'A lawn with no obvious owner where dogs are walked.' },
    pitch: { pt: 'Toda a gente acha que é um jardim. Não é.', en: 'Everyone thinks it is a park. It is not.' },
    lot: 2000, cov: 0.45, floors: 7, maxFloors: 9,
  },
  {
    id: 'carnide-quinta', fr: '110611', lon: -9.1885, lat: 38.7638, kind: 'lote',
    name: { pt: 'Antiga quinta em Carnide', en: 'Old farm estate in Carnide' },
    was: { pt: 'Casa senhorial em ruína e terreno agrícola abandonado.', en: 'A ruined manor house and abandoned farmland.' },
    pitch: { pt: 'Espaço para muitas casas, se o largo histórico não se opuser.', en: 'Room for many homes, if the historic square does not object.' },
    lot: 6000, cov: 0.35, floors: 4, maxFloors: 7, heritage: 0.3,
  },
  {
    id: 'benfica-fabrica', fr: '110608', lon: -9.2015, lat: 38.7478, kind: 'armazem',
    name: { pt: 'Antiga fábrica em Benfica', en: 'Former factory in Benfica' },
    was: { pt: 'Pavilhões industriais fechados desde 2008.', en: 'Factory sheds shut since 2008.' },
    pitch: { pt: 'Precisa de um loteamento: discussão pública e voto da Câmara.', en: 'It needs an allotment: public consultation and a Câmara vote.' },
    lot: 4000, cov: 0.5, floors: 6, maxFloors: 10,
  },
  {
    id: 'sdb-parque', fr: '110639', lon: -9.1772, lat: 38.7462, kind: 'lote',
    name: { pt: 'Parque de estacionamento em São Domingos de Benfica', en: 'Car park in São Domingos de Benfica' },
    was: { pt: 'Estacionamento de superfície junto a uma avenida.', en: 'A surface car park on an avenue.' },
    pitch: { pt: 'Prédios altos à volta, metro perto. Os carros vão ter de ir para algum lado.', en: 'Tall blocks around, metro nearby. The cars will have to go somewhere.' },
    lot: 1500, cov: 0.6, floors: 8, maxFloors: 12,
  },
  {
    id: 'alcantara-docas', fr: '110602', lon: -9.1772, lat: 38.7045, kind: 'armazem',
    name: { pt: 'Armazéns portuários em Alcântara', en: 'Port warehouses in Alcântara' },
    was: { pt: 'Armazéns de frio e um terminal de camiões.', en: 'Cold stores and a lorry yard.' },
    pitch: { pt: 'Frente ribeirinha, ponte por cima, porto ao lado. Muito potencial, muitos pareceres.', en: 'Riverfront, the bridge overhead, the port next door. Great potential, many opinions to collect.' },
    lot: 8000, cov: 0.5, floors: 5, maxFloors: 12, heritage: 0.2, river: true,
  },
  {
    id: 'alcantara-esquina', fr: '110602', lon: -9.1805, lat: 38.7092, kind: 'lote',
    name: { pt: 'Lote de esquina em Alcântara', en: 'Corner lot in Alcântara' },
    was: { pt: 'Ruína de um prédio que ardeu.', en: 'The shell of a burnt-out building.' },
    pitch: { pt: 'Pequeno, simples, a cinco minutos do comboio.', en: 'Small, simple, five minutes from the train.' },
    lot: 600, cov: 0.7, floors: 5, maxFloors: 6,
  },
  {
    id: 'ajuda-encosta', fr: '110601', lon: -9.1992, lat: 38.7088, kind: 'lote',
    name: { pt: 'Encosta vazia na Ajuda', en: 'Empty slope in Ajuda' },
    was: { pt: 'Terreno em declive com hortas informais.', en: 'A slope with informal vegetable plots.' },
    pitch: { pt: 'Perto do palácio e do jardim botânico: o Património vai querer ver.', en: 'Near the palace and the botanical garden: the heritage authority will want a look.' },
    lot: 2500, cov: 0.45, floors: 4, maxFloors: 5, heritage: 0.5,
  },
  {
    id: 'belem-restelo', fr: '110658', lon: -9.2135, lat: 38.7045, kind: 'lote',
    name: { pt: 'Lote junto ao Restelo', en: 'Lot near Restelo' },
    was: { pt: 'Terreno com muro e um portão fechado.', en: 'A walled plot with a locked gate.' },
    pitch: { pt: 'Moradias à volta e o mosteiro ao fundo. Três pisos já parecem muitos.', en: 'Villas around and the monastery below. Three floors already look like a lot.' },
    lot: 1500, cov: 0.45, floors: 3, maxFloors: 4, heritage: 0.6,
  },

  // ── East ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'marvila-armazens', fr: '110621', lon: -9.1065, lat: 38.7455, kind: 'armazem',
    name: { pt: 'Armazéns de vinho em Marvila', en: 'Wine warehouses in Marvila' },
    was: { pt: 'Armazéns de um antigo negociante de vinhos, alguns ocupados por ateliers.', en: 'An old wine merchant’s warehouses, some used as studios.' },
    pitch: { pt: 'O bairro de que todos falam. Há espaço para centenas de casas.', en: 'The neighbourhood everyone talks about. Room for hundreds of homes.' },
    lot: 10000, cov: 0.5, floors: 5, maxFloors: 12, heritage: 0.25, river: true,
  },
  {
    id: 'marvila-municipal', fr: '110621', lon: -9.1165, lat: 38.7485, kind: 'municipal', municipal: { scheme: 'pra' }, from: [2017, 7],
    name: { pt: 'Terreno municipal em Marvila', en: 'City land in Marvila' },
    was: { pt: 'Terreno da Câmara oferecido em concurso para renda acessível.', en: 'City land offered by tender for affordable rent.' },
    pitch: { pt: 'O terreno não custa nada. As rendas estão fixadas pela Câmara durante décadas.', en: 'The land costs nothing. The rents are set by the city for decades.' },
    lot: 5000, cov: 0.5, floors: 6, maxFloors: 8,
  },
  {
    id: 'fabrica-gas', fr: '110621', lon: -9.1056, lat: 38.7546, kind: 'grande',
    name: { pt: 'Antiga fábrica de gás junto ao Tejo', en: 'Old gasworks on the Tejo' },
    was: { pt: 'Gasómetros desmontados e solo contaminado.', en: 'Dismantled gas holders and contaminated soil.' },
    pitch: { pt: 'O maior terreno da cidade. Descontaminar primeiro, planear depois, construir por fases.', en: 'The biggest site in the city. Clean up first, plan next, build in phases.' },
    lot: 60000, cov: 0.35, floors: 7, maxFloors: 14, river: true, toxic: true, mega: { phases: 4, share: 0.25 },
  },
  {
    id: 'beato-oficinas', fr: '110607', lon: -9.1068, lat: 38.7325, kind: 'armazem',
    name: { pt: 'Antigas oficinas no Beato', en: 'Old workshops in Beato' },
    was: { pt: 'Oficinas ferroviárias com naves de tijolo.', en: 'Railway workshops with brick halls.' },
    pitch: { pt: 'Naves industriais bonitas e um bairro a mudar depressa.', en: 'Handsome industrial halls in a neighbourhood changing fast.' },
    lot: 3500, cov: 0.55, floors: 5, maxFloors: 8, heritage: 0.3, river: true,
  },
  {
    id: 'olivais-lote', fr: '110633', lon: -9.1182, lat: 38.7682, kind: 'lote', plan: true,
    name: { pt: 'Lote expectante nos Olivais', en: 'Waiting lot in Olivais' },
    was: { pt: 'Lote previsto no plano dos anos 60, nunca construído.', en: 'A lot in the 1960s plan, never built.' },
    pitch: { pt: 'Plano aprovado, árvores grandes, vizinhos habituados a prédios.', en: 'Approved plan, big trees, neighbours used to apartment blocks.' },
    lot: 2200, cov: 0.45, floors: 6, maxFloors: 9,
  },
  {
    id: 'parque-nacoes', fr: '110662', lon: -9.0955, lat: 38.7705, kind: 'lote', plan: true,
    name: { pt: 'Último lote no Parque das Nações', en: 'Last lot in Parque das Nações' },
    was: { pt: 'O último lote livre do plano da Expo.', en: 'The last free lot of the Expo plan.' },
    pitch: { pt: 'Plano aprovado, rio à frente, preço à altura.', en: 'Approved plan, the river in front, a price to match.' },
    lot: 2500, cov: 0.5, floors: 10, maxFloors: 16, river: true,
  },
  {
    id: 'ameixoeira-coop', fr: '110664', lon: -9.1522, lat: 38.7878, kind: 'municipal', municipal: { scheme: 'coop' }, from: [2024, 6],
    name: { pt: 'Terreno municipal para cooperativas', en: 'City land for housing co-operatives' },
    was: { pt: 'Terreno da Câmara cedido em direito de superfície a cooperativas.', en: 'City land granted to co-operatives on a surface right.' },
    pitch: { pt: 'Casas a preço de custo para os cooperantes. Tu constróis; o lucro é uma comissão.', en: 'Homes at cost for the members. You build; your profit is a fee.' },
    lot: 6000, cov: 0.4, floors: 5, maxFloors: 7,
  },
  {
    id: 'charneca', fr: '110664', lon: -9.1469, lat: 38.7914, kind: 'lote',
    name: { pt: 'Terreno na Charneca', en: 'Plot in Charneca' },
    was: { pt: 'Terreno vago junto a um bairro municipal.', en: 'A vacant plot next to a council estate.' },
    pitch: { pt: 'O metro quadrado mais barato da cidade; a margem também.', en: 'The cheapest square metre in the city; the margin too.' },
    lot: 3000, cov: 0.45, floors: 5, maxFloors: 7,
  },
  {
    id: 'ajuda-municipal', fr: '110601', lon: -9.1948, lat: 38.7125, kind: 'municipal', municipal: { scheme: 'pra' }, from: [2018, 1],
    name: { pt: 'Terreno municipal na Ajuda', en: 'City land in Ajuda' },
    was: { pt: 'Terreno da Câmara em concurso para renda acessível.', en: 'City land out to tender for affordable rent.' },
    pitch: { pt: 'Terreno cedido, rendas fixadas, prazos apertados.', en: 'Land granted, rents fixed, deadlines tight.' },
    lot: 3000, cov: 0.5, floors: 5, maxFloors: 6, heritage: 0.3,
  },
  {
    id: 'benfica-coop', fr: '110608', lon: -9.1955, lat: 38.7552, kind: 'municipal', municipal: { scheme: 'coop' }, from: [2024, 6],
    name: { pt: 'Terreno municipal para cooperativas em Benfica', en: 'City land for co-operatives in Benfica' },
    was: { pt: 'Antigo estaleiro municipal.', en: 'A former municipal depot.' },
    pitch: { pt: 'Uma cooperativa de jovens famílias procura quem construa.', en: 'A co-operative of young families is looking for a builder.' },
    lot: 4000, cov: 0.45, floors: 5, maxFloors: 6,
  },
];

export const SITES_BY_ID: Record<string, Site> = Object.fromEntries(SITES.map((s) => [s.id, s]));
