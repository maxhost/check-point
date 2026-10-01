/**
 * Static country data for the enroll phone selector (spec 0028, amendment
 * 2026-08-14b). Owner decision: a bundled, near-immutable ~250-row list — no
 * runtime API nor DB table (they add latency and failure modes without gain).
 *
 * Each row is a compact tuple `[iso2, dial, nameEs]`:
 *  - iso2:   ISO 3166-1 alpha-2 (uppercase); drives the derived flag emoji.
 *  - dial:   E.164 country calling code, digits only (no '+').
 *  - nameEs: Spanish display name.
 *
 * Client-safe: no server-only imports. Logic lives in `./countries`.
 */
export type CountryTuple = readonly [
  iso2: string,
  dial: string,
  nameEs: string,
];

// prettier-ignore
export const COUNTRY_DATA: readonly CountryTuple[] = [
  ["AF","93","Afganistán"], ["AL","355","Albania"], ["DE","49","Alemania"], ["AD","376","Andorra"],
  ["AO","244","Angola"], ["AI","1264","Anguila"], ["AQ","672","Antártida"], ["AG","1268","Antigua y Barbuda"],
  ["SA","966","Arabia Saudita"], ["DZ","213","Argelia"], ["AR","54","Argentina"], ["AM","374","Armenia"],
  ["AW","297","Aruba"], ["AU","61","Australia"], ["AT","43","Austria"], ["AZ","994","Azerbaiyán"],
  ["BS","1242","Bahamas"], ["BD","880","Bangladés"], ["BB","1246","Barbados"], ["BH","973","Baréin"],
  ["BE","32","Bélgica"], ["BZ","501","Belice"], ["BJ","229","Benín"], ["BM","1441","Bermudas"],
  ["BY","375","Bielorrusia"], ["BO","591","Bolivia"], ["BA","387","Bosnia y Herzegovina"], ["BW","267","Botsuana"],
  ["BR","55","Brasil"], ["BN","673","Brunéi"], ["BG","359","Bulgaria"], ["BF","226","Burkina Faso"],
  ["BI","257","Burundi"], ["BT","975","Bután"], ["CV","238","Cabo Verde"], ["KH","855","Camboya"],
  ["CM","237","Camerún"], ["CA","1","Canadá"], ["QA","974","Catar"], ["TD","235","Chad"],
  ["CL","56","Chile"], ["CN","86","China"], ["CY","357","Chipre"], ["VA","379","Ciudad del Vaticano"],
  ["CO","57","Colombia"], ["KM","269","Comoras"], ["CG","242","Congo"], ["CD","243","Congo (RD)"],
  ["KP","850","Corea del Norte"], ["KR","82","Corea del Sur"], ["CI","225","Costa de Marfil"], ["CR","506","Costa Rica"],
  ["HR","385","Croacia"], ["CU","53","Cuba"], ["CW","599","Curazao"], ["DK","45","Dinamarca"],
  ["DM","1767","Dominica"], ["EC","593","Ecuador"], ["EG","20","Egipto"], ["SV","503","El Salvador"],
  ["AE","971","Emiratos Árabes Unidos"], ["ER","291","Eritrea"], ["SK","421","Eslovaquia"], ["SI","386","Eslovenia"],
  ["ES","34","España"], ["US","1","Estados Unidos"], ["EE","372","Estonia"], ["SZ","268","Esuatini"],
  ["ET","251","Etiopía"], ["PH","63","Filipinas"], ["FI","358","Finlandia"], ["FJ","679","Fiyi"],
  ["FR","33","Francia"], ["GA","241","Gabón"], ["GM","220","Gambia"], ["GE","995","Georgia"],
  ["GH","233","Ghana"], ["GI","350","Gibraltar"], ["GD","1473","Granada"], ["GR","30","Grecia"],
  ["GL","299","Groenlandia"], ["GP","590","Guadalupe"], ["GU","1671","Guam"], ["GT","502","Guatemala"],
  ["GF","594","Guayana Francesa"], ["GG","44","Guernsey"], ["GN","224","Guinea"], ["GQ","240","Guinea Ecuatorial"],
  ["GW","245","Guinea-Bisáu"], ["GY","592","Guyana"], ["HT","509","Haití"], ["HN","504","Honduras"],
  ["HK","852","Hong Kong"], ["HU","36","Hungría"], ["IN","91","India"], ["ID","62","Indonesia"],
  ["IQ","964","Irak"], ["IR","98","Irán"], ["IE","353","Irlanda"], ["BV","47","Isla Bouvet"],
  ["IM","44","Isla de Man"], ["CX","61","Isla de Navidad"], ["IS","354","Islandia"], ["KY","1345","Islas Caimán"],
  ["CC","61","Islas Cocos"], ["CK","682","Islas Cook"], ["FO","298","Islas Feroe"], ["FK","500","Islas Malvinas"],
  ["MP","1670","Islas Marianas del Norte"], ["MH","692","Islas Marshall"], ["SB","677","Islas Salomón"], ["TC","1649","Islas Turcas y Caicos"],
  ["VG","1284","Islas Vírgenes Británicas"], ["VI","1340","Islas Vírgenes de EE. UU."], ["IL","972","Israel"], ["IT","39","Italia"],
  ["JM","1876","Jamaica"], ["JP","81","Japón"], ["JE","44","Jersey"], ["JO","962","Jordania"],
  ["KZ","7","Kazajistán"], ["KE","254","Kenia"], ["KG","996","Kirguistán"], ["KI","686","Kiribati"],
  ["KW","965","Kuwait"], ["LA","856","Laos"], ["LS","266","Lesoto"], ["LV","371","Letonia"],
  ["LB","961","Líbano"], ["LR","231","Liberia"], ["LY","218","Libia"], ["LI","423","Liechtenstein"],
  ["LT","370","Lituania"], ["LU","352","Luxemburgo"], ["MO","853","Macao"], ["MK","389","Macedonia del Norte"],
  ["MG","261","Madagascar"], ["MY","60","Malasia"], ["MW","265","Malaui"], ["MV","960","Maldivas"],
  ["ML","223","Malí"], ["MT","356","Malta"], ["MA","212","Marruecos"], ["MQ","596","Martinica"],
  ["MU","230","Mauricio"], ["MR","222","Mauritania"], ["YT","262","Mayotte"], ["MX","52","México"],
  ["FM","691","Micronesia"], ["MD","373","Moldavia"], ["MC","377","Mónaco"], ["MN","976","Mongolia"],
  ["ME","382","Montenegro"], ["MS","1664","Montserrat"], ["MZ","258","Mozambique"], ["MM","95","Myanmar"],
  ["NA","264","Namibia"], ["NR","674","Nauru"], ["NP","977","Nepal"], ["NI","505","Nicaragua"],
  ["NE","227","Níger"], ["NG","234","Nigeria"], ["NU","683","Niue"], ["NO","47","Noruega"],
  ["NC","687","Nueva Caledonia"], ["NZ","64","Nueva Zelanda"], ["OM","968","Omán"], ["NL","31","Países Bajos"],
  ["PK","92","Pakistán"], ["PW","680","Palaos"], ["PS","970","Palestina"], ["PA","507","Panamá"],
  ["PG","675","Papúa Nueva Guinea"], ["PY","595","Paraguay"], ["PE","51","Perú"], ["PF","689","Polinesia Francesa"],
  ["PL","48","Polonia"], ["PT","351","Portugal"], ["PR","1787","Puerto Rico"], ["GB","44","Reino Unido"],
  ["CF","236","República Centroafricana"], ["CZ","420","República Checa"], ["DO","1809","República Dominicana"], ["RE","262","Reunión"],
  ["RW","250","Ruanda"], ["RO","40","Rumanía"], ["RU","7","Rusia"], ["WS","685","Samoa"],
  ["AS","1684","Samoa Americana"], ["BL","590","San Bartolomé"], ["KN","1869","San Cristóbal y Nieves"], ["SM","378","San Marino"],
  ["MF","590","San Martín"], ["PM","508","San Pedro y Miquelón"], ["VC","1784","San Vicente y las Granadinas"], ["SH","290","Santa Elena"],
  ["LC","1758","Santa Lucía"], ["ST","239","Santo Tomé y Príncipe"], ["SN","221","Senegal"], ["RS","381","Serbia"],
  ["SC","248","Seychelles"], ["SL","232","Sierra Leona"], ["SG","65","Singapur"], ["SX","1721","Sint Maarten"],
  ["SY","963","Siria"], ["SO","252","Somalia"], ["LK","94","Sri Lanka"], ["ZA","27","Sudáfrica"],
  ["SD","249","Sudán"], ["SS","211","Sudán del Sur"], ["SE","46","Suecia"], ["CH","41","Suiza"],
  ["SR","597","Surinam"], ["TH","66","Tailandia"], ["TW","886","Taiwán"], ["TZ","255","Tanzania"],
  ["TJ","992","Tayikistán"], ["TF","262","Territorios Australes Franceses"], ["TL","670","Timor Oriental"], ["TG","228","Togo"],
  ["TK","690","Tokelau"], ["TO","676","Tonga"], ["TT","1868","Trinidad y Tobago"], ["TN","216","Túnez"],
  ["TM","993","Turkmenistán"], ["TR","90","Turquía"], ["TV","688","Tuvalu"], ["UA","380","Ucrania"],
  ["UG","256","Uganda"], ["UY","598","Uruguay"], ["UZ","998","Uzbekistán"], ["VU","678","Vanuatu"],
  ["VE","58","Venezuela"], ["VN","84","Vietnam"], ["WF","681","Wallis y Futuna"], ["YE","967","Yemen"],
  ["DJ","253","Yibuti"], ["ZM","260","Zambia"], ["ZW","263","Zimbabue"],
];
