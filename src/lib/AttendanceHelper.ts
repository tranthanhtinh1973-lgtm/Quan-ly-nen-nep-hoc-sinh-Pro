/**
 * Attendance Helper Utilities according to Request 9 & 10
 *
 * Rules:
 * - Nghỉ phép cả ngày: SPCP
 * - Buổi sáng: SP; Buổi chiều: CP
 * - Không phép cả ngày: SKCK
 * - Buổi sáng: SK; Buổi chiều: CK
 * - Sáng có phép chiều không phép: SPCK
 * - Sáng không phép chiều có phép: SKCP
 * - Bỏ tiết: e.g. C124 (chiều bỏ tiết 1,2,4), S12 C34 (sáng bỏ tiết 1,2, chiều bỏ tiết 3,4), S34 CK (sáng bỏ tiết 3,4, chiều không phép), SK C34 (sáng không phép, chiều bỏ tiết 3,4)
 */

export interface AttendanceDetail {
  morningType?: 'SP' | 'SK' | null;
  afternoonType?: 'CP' | 'CK' | null;
  morningPeriods?: (string | number)[]; // e.g. ['S1', 'S2'] or [1, 2]
  afternoonPeriods?: (string | number)[]; // e.g. ['C1', 'C2', 'C4'] or [1, 2, 4]
}

export const ATTENDANCE_DESCRIPTIONS: Record<string, string> = {
  'SPCP': 'Nghỉ phép cả ngày',
  'SP': 'Nghỉ có phép buổi sáng',
  'CP': 'Nghỉ có phép buổi chiều',
  'SKCK': 'Nghỉ không phép cả ngày',
  'SK': 'Nghỉ không phép buổi sáng',
  'CK': 'Nghỉ không phép buổi chiều',
  'SPCK': 'Sáng có phép, Chiều không phép',
  'SKCP': 'Sáng không phép, Chiều có phép',
  'P': 'Nghỉ có phép',
  'KP': 'Nghỉ không phép',
  'BT_SANG': 'Trốn/Bỏ tiết Sáng',
  'BT_CHIEU': 'Trốn/Bỏ tiết Chiều'
};

/**
 * Normalizes legacy codes to the new standard format
 */
export function normalizeAttendanceCode(code: string): string {
  if (!code) return '';
  if (code === 'P') return 'SPCP';
  if (code === 'KP') return 'SKCK';
  if (code === 'BT_SANG') return 'S12';
  if (code === 'BT_CHIEU') return 'C12';
  return code;
}

/**
 * Parses attendance code into structured morning/afternoon detail
 */
export function parseAttendanceCode(code: string): AttendanceDetail {
  if (!code || code === 'DU_TIET' || code === 'Đủ tiết') {
    return { morningType: null, afternoonType: null, morningPeriods: [], afternoonPeriods: [] };
  }

  const clean = code.trim();
  let morningType: 'SP' | 'SK' | null = null;
  let afternoonType: 'CP' | 'CK' | null = null;

  if (/\bSP\b|SP/.test(clean)) morningType = 'SP';
  else if (/\bSK\b|SK/.test(clean)) morningType = 'SK';

  if (/\bCP\b|CP/.test(clean)) afternoonType = 'CP';
  else if (/\bCK\b|CK/.test(clean)) afternoonType = 'CK';

  const morningPeriods: string[] = [];
  const sMatches = clean.matchAll(/S(?![PK])(\d+)/gi);
  for (const m of sMatches) {
    const digits = m[1].split('');
    digits.forEach(d => morningPeriods.push(`S${d}`));
  }

  const afternoonPeriods: string[] = [];
  const cMatches = clean.matchAll(/C(?![PK])(\d+)/gi);
  for (const m of cMatches) {
    const digits = m[1].split('');
    digits.forEach(d => afternoonPeriods.push(`C${d}`));
  }

  return { morningType, afternoonType, morningPeriods, afternoonPeriods };
}

/**
 * Formats attendance code from morning/afternoon types and periods with clean spacing
 */
export function formatAttendanceCode(detail: AttendanceDetail): string {
  const { morningType, afternoonType, morningPeriods = [], afternoonPeriods = [] } = detail;

  const mDigits = Array.from(new Set(
    morningPeriods
      .map(p => String(p).replace(/\D/g, ''))
      .filter(Boolean)
      .flatMap(str => str.split(''))
      .map(Number)
  )).sort((a, b) => a - b);

  const aDigits = Array.from(new Set(
    afternoonPeriods
      .map(p => String(p).replace(/\D/g, ''))
      .filter(Boolean)
      .flatMap(str => str.split(''))
      .map(Number)
  )).sort((a, b) => a - b);

  if (morningType === 'SP' && afternoonType === 'CP') return 'SPCP';
  if (morningType === 'SK' && afternoonType === 'CK') return 'SKCK';
  if (morningType === 'SP' && afternoonType === 'CK') return 'SPCK';
  if (morningType === 'SK' && afternoonType === 'CP') return 'SKCP';

  let mStr = '';
  if (morningType === 'SP') mStr = 'SP';
  else if (morningType === 'SK') mStr = 'SK';
  else if (mDigits.length > 0) mStr = 'S' + mDigits.join('');

  let aStr = '';
  if (afternoonType === 'CP') aStr = 'CP';
  else if (afternoonType === 'CK') aStr = 'CK';
  else if (aDigits.length > 0) aStr = 'C' + aDigits.join('');

  return [mStr, aStr].filter(Boolean).join(' ');
}

/**
 * Merges multiple attendance codes into a single formatted code (e.g. ['S34', 'CK'] => 'S34 CK')
 */
export function mergeAttendanceCodes(codes: (string | undefined | null)[]): string {
  const validCodes = codes.filter((c): c is string => Boolean(c) && c !== 'DU_TIET' && c !== 'Đủ tiết');
  if (validCodes.length === 0) return 'DU_TIET';

  let morningType: 'SP' | 'SK' | null = null;
  let afternoonType: 'CP' | 'CK' | null = null;
  const morningPeriodsSet = new Set<string>();
  const afternoonPeriodsSet = new Set<string>();

  for (const rawCode of validCodes) {
    const normalized = normalizeAttendanceCode(rawCode);
    const detail = parseAttendanceCode(normalized);

    if (detail.morningType) morningType = detail.morningType;
    if (detail.afternoonType) afternoonType = detail.afternoonType;
    detail.morningPeriods?.forEach(p => morningPeriodsSet.add(String(p)));
    detail.afternoonPeriods?.forEach(p => afternoonPeriodsSet.add(String(p)));
  }

  const result = formatAttendanceCode({
    morningType,
    afternoonType,
    morningPeriods: Array.from(morningPeriodsSet),
    afternoonPeriods: Array.from(afternoonPeriodsSet)
  });

  return result || 'DU_TIET';
}

/**
 * Analyzes attendance code to count total P (có phép), KP (không phép), and Tiet (bỏ tiết)
 */
export function analyzeAttendanceCode(code: string) {
  let countP = 0;
  let countK = 0;
  let countTiet = 0;

  if (!code || code === 'Đủ tiết' || code === 'DU_TIET') {
    return { countP, countK, countTiet };
  }

  const clean = code.trim();
  const compact = clean.replace(/\s+/g, '');

  if (compact === 'SPCP') {
    countP += 2;
  } else if (compact === 'SKCK') {
    countK += 2;
  } else if (compact === 'SPCK') {
    countP += 1;
    countK += 1;
  } else if (compact === 'SKCP') {
    countK += 1;
    countP += 1;
  } else {
    if (clean.includes('SP')) countP += 1;
    if (clean.includes('SK')) countK += 1;
    if (clean.includes('CP')) countP += 1;
    if (clean.includes('CK')) countK += 1;
    if (clean === 'P') countP += 1;
    if (clean === 'KP') countK += 1;
  }

  const sMatches = clean.matchAll(/S(?![PK])(\d+)/gi);
  for (const m of sMatches) {
    countTiet += m[1].length;
  }

  const cMatches = clean.matchAll(/C(?![PK])(\d+)/gi);
  for (const m of cMatches) {
    countTiet += m[1].length;
  }

  return { countP, countK, countTiet };
}
