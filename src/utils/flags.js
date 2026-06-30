/**
 * Maps FIFA 3-letter TLA (Three Letter Acronym) codes to ISO 3166-1 alpha-2 codes.
 * This ensures that FlagCDN correctly displays any country's flag.
 */
export const FIFA_TO_ISO_MAP = {
  // A
  AFG: 'af', ALB: 'al', ALG: 'dz', AND: 'ad', ANG: 'ao', AIA: 'ai', ATG: 'ag', ARG: 'ar', ARM: 'am', ARU: 'aw', AUS: 'au', AUT: 'at', AZE: 'az',
  // B
  BAH: 'bs', BHR: 'bh', BAN: 'bd', BRB: 'bb', BLR: 'by', BEL: 'be', BLZ: 'bz', BEN: 'bj', BER: 'bm', BHU: 'bt', BOL: 'bo', BIH: 'ba', BOT: 'bw', BRA: 'br', VGB: 'vg', BRU: 'bn', BUL: 'bg', BFA: 'bf', BDI: 'bi',
  // C
  CAM: 'kh', CMR: 'cm', CAN: 'ca', CPV: 'cv', CAY: 'ky', CTA: 'cf', CHA: 'td', CHI: 'cl', CHN: 'cn', TPE: 'tw', COL: 'co', COM: 'km', CGO: 'cg', COD: 'cd', COK: 'ck', CRC: 'cr', CRO: 'hr', CUB: 'cu', CUW: 'cw', CYP: 'cy', CZE: 'cz',
  // D
  DEN: 'dk', DJI: 'dj', DMA: 'dm', DOM: 'do',
  // E
  ECU: 'ec', EGY: 'eg', SLV: 'sv', ENG: 'gb-eng', EQG: 'gq', ERI: 'er', EST: 'ee', SWZ: 'sz', ETH: 'et',
  // F
  FRO: 'fo', FIJ: 'fj', FIN: 'fi', FRA: 'fr',
  // G
  GAB: 'ga', GAM: 'gm', GEO: 'ge', GER: 'de', GHA: 'gh', GIB: 'gi', GRE: 'gr', GRN: 'gd', GUM: 'gu', GUA: 'gt', GUI: 'gn', GNB: 'gw', GUY: 'gy',
  // H
  HAI: 'ht', HON: 'hn', HKG: 'hk', HUN: 'hu',
  // I
  ISL: 'is', IND: 'in', IDN: 'id', IRN: 'ir', IRQ: 'iq', ISR: 'il', ITA: 'it', CIV: 'ci',
  // J
  JAM: 'jm', JPN: 'jp', JOR: 'jo',
  // K
  KAZ: 'kz', KEN: 'ke', PRK: 'kp', KOR: 'kr', KOS: 'xk', KUW: 'kw', KGZ: 'kg',
  // L
  LAO: 'la', LVA: 'lv', LBN: 'lb', LES: 'ls', LBR: 'lr', LBY: 'ly', LIE: 'li', LTU: 'lt', LUX: 'lu',
  // M
  MAC: 'mo', MAD: 'mg', MWI: 'mw', MAS: 'my', MDV: 'mv', MLI: 'ml', MLT: 'mt', MTN: 'mr', MRI: 'mu', MEX: 'mx', MDA: 'md', MNG: 'mn', MNE: 'me', MAR: 'ma', MOZ: 'mz', MYA: 'mm',
  // N
  NAM: 'na', NEP: 'np', NED: 'nl', NCL: 'nc', NZL: 'nz', NCA: 'ni', NIG: 'ne', NGA: 'ng', MKD: 'mk', NIR: 'gb-nir', NOR: 'no',
  // O
  OMA: 'om',
  // P
  PAK: 'pk', PLE: 'ps', PAN: 'pa', PNG: 'pg', PAR: 'py', PER: 'pe', PHI: 'ph', POL: 'pl', POR: 'pt', PUR: 'pr',
  // Q
  QAT: 'qa',
  // R
  IRL: 'ie', ROU: 'ro', RUS: 'ru', RWA: 'rw',
  // S
  SKN: 'kn', LCA: 'lc', VCT: 'vc', SAM: 'ws', SMR: 'sm', STP: 'st', KSA: 'sa', SCO: 'gb-sct', SEN: 'sn', SRB: 'rs', SEY: 'sc', SLE: 'sl', SGP: 'sg', SVK: 'sk', SVN: 'si', SOL: 'sb', SOM: 'so', RSA: 'za', SSD: 'ss', ESP: 'es', SRI: 'lk', SDN: 'sd', SUR: 'sr', SWE: 'se', SUI: 'ch', SYR: 'sy',
  // T
  TAH: 'pf', TJK: 'tj', TAN: 'tz', THA: 'th', TLS: 'tl', TOG: 'tg', TGA: 'to', TRI: 'tt', TUN: 'tn', TUR: 'tr', TKM: 'tm', TCA: 'tc',
  // U
  UGA: 'ug', UKR: 'ua', UAE: 'ae', USA: 'us', URU: 'uy', URY: 'uy', UZB: 'uz',
  // V
  VAN: 'vu', VEN: 've', VIE: 'vn', VIR: 'vi',
  // W
  WAL: 'gb-wls',
  // Y
  YEM: 'ye',
  // Z
  ZAM: 'zm', ZIM: 'zw'
};

const PLACEHOLDER_STRINGS = ['TBD', 'UNKNOWN', 'UN', 'NA', 'N/A', 'NONE'];

export function isPlaceholderValue(value) {
  if (!value) return true;
  const text = String(value).trim().toUpperCase();
  return PLACEHOLDER_STRINGS.includes(text);
}

export function normalizeTeamName(teamName) {
  if (!teamName) return 'À déterminer';
  const text = String(teamName).trim();
  if (!text || PLACEHOLDER_STRINGS.includes(text.toUpperCase())) return 'À déterminer';
  return text;
}

export function getFlagCode(teamCode) {
  if (!teamCode) return null;

  const tla = String(teamCode).trim().toUpperCase();
  if (!tla || PLACEHOLDER_STRINGS.includes(tla)) return null;
  if (FIFA_TO_ISO_MAP[tla]) {
    return FIFA_TO_ISO_MAP[tla];
  }

  const fallback = tla.slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(fallback) ? fallback : null;
}

const FALLBACK_FLAG_SVG = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2232%22%20height=%2224%22%3E%3Crect%20width=%2232%22%20height=%2224%22%20rx=%224%22%20fill=%22%23f3f4f6%22/%3E%3Cpath%20d=%22M8%208h16v8H8z%22%20fill=%22%23e5e7eb%22/%3E%3Cpath%20d=%22M10%2012c0-1.1.9-2%202-2h8c1.1%200%202%20.9%202%202s-.9%202-2%202H12c-1.1%200-2-.9-2-2z%22%20fill=%22%23d1d5db%22/%3E%3C/svg%3E';
export function getFlagUrl(teamCode) {
  const code = getFlagCode(teamCode);
  return code ? `https://flagcdn.com/${code}.svg` : FALLBACK_FLAG_SVG;
}
