import { LogDiscipline, ScoreRule } from '../types';

export const getMonthFromDateStr = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return '';
  const m = parseInt(parts[1], 10);
  return `Tháng ${m}`;
};

export const getMonthlyRating = (score: number): string => {
  if (score >= 85) return 'Tốt';
  if (score >= 70) return 'Khá';
  if (score >= 50) return 'Đạt';
  return 'Chưa đạt';
};

export interface SemesterResult {
  average: number;
  classification: string;
  monthlyScores: number[];
  monthlyRatings: string[];
  downgradeReason?: string;
}

export const evaluateSemesterResult = (
  studentId: string,
  termMonthsList: string[],
  allLogs: LogDiscipline[],
  scoreRules: ScoreRule[] = []
): SemesterResult => {
  const termLogs = (allLogs || []).filter(l => {
    if (l.student_id !== studentId) return false;
    const m = l.term_month || getMonthFromDateStr(l.date);
    return termMonthsList.includes(m);
  });
  
  const monthlyScores = termMonthsList.map(m => {
    const logsForMonth = termLogs.filter(l => (l.term_month === m || getMonthFromDateStr(l.date) === m));
    const minus = logsForMonth.filter(l => l.points < 0).reduce((acc, c) => acc + c.points, 0);
    const plus = logsForMonth.filter(l => l.points > 0).reduce((acc, c) => acc + c.points, 0);
    return Math.max(0, Math.min(100, 100 + minus + plus));
  });
  
  const average = Math.round(monthlyScores.reduce((acc, val) => acc + val, 0) / Math.max(1, termMonthsList.length));
  const monthlyRatings = monthlyScores.map(getMonthlyRating);
  
  const countOf = (rating: string) => monthlyRatings.filter(r => r === rating).length;
  
  const totCount = countOf('Tốt');
  const khaCount = countOf('Khá');
  const datCount = countOf('Đạt');
  const chuaDatCount = countOf('Chưa đạt');
  const totalMonths = Math.max(1, termMonthsList.length);

  // Severe violations check
  // - Deducted 80 points or more (points <= -80)
  // - Deducted 60 to 70 points (points <= -60)
  const severe80Logs = termLogs.filter(l => l.points <= -80);
  const severe60to70Logs = termLogs.filter(l => l.points <= -60);

  const has80orMoreViolation = severe80Logs.length > 0;
  const has60to70Violation = severe60to70Logs.length > 0;

  let classification = 'Đạt';
  let downgradeReason = '';

  // Rule for Tốt: At least 50% Tốt, no Đạt, no Chưa đạt.
  const isTotPotential = (totCount / totalMonths >= 0.5) && (datCount === 0) && (chuaDatCount === 0);
  
  // Rule for Khá: At least 50% Khá or Tốt, no Chưa đạt.
  const isKhaPotential = ((totCount + khaCount) / totalMonths >= 0.5) && (chuaDatCount === 0);
  
  // Rule for Chưa đạt:
  // - Over 50% of months are Chưa đạt, OR
  // - Serious violation resulting in 80 points or more deducted.
  const isChuaDat = (chuaDatCount / totalMonths > 0.5) || has80orMoreViolation;

  if (isChuaDat) {
    classification = 'Chưa đạt';
    if (has80orMoreViolation) {
      const log = severe80Logs[0];
      const rule = (scoreRules || []).find(r => r.code === log.rule_code);
      const ruleName = rule ? `${rule.code} - ${rule.name}` : log.rule_code;
      downgradeReason = `Vi phạm lỗi nghiêm trọng bị trừ ${Math.abs(log.points)} điểm (${ruleName}${log.notes ? ': ' + log.notes : ''}). Mức xếp loại cả học kỳ bị khống chế ở mức Chưa đạt.`;
    }
  } else if (isTotPotential) {
    if (has60to70Violation) {
      classification = 'Đạt';
      const log = severe60to70Logs[0];
      const rule = (scoreRules || []).find(r => r.code === log.rule_code);
      const ruleName = rule ? `${rule.code} - ${rule.name}` : log.rule_code;
      downgradeReason = `Vi phạm lỗi bị trừ ${Math.abs(log.points)} điểm (${ruleName}${log.notes ? ': ' + log.notes : ''}). Đủ tỷ lệ tháng xếp loại Tốt nhưng bị hạ xuống mức Đạt.`;
    } else {
      classification = 'Tốt';
    }
  } else if (isKhaPotential) {
    if (has60to70Violation) {
      classification = 'Đạt';
      const log = severe60to70Logs[0];
      const rule = (scoreRules || []).find(r => r.code === log.rule_code);
      const ruleName = rule ? `${rule.code} - ${rule.name}` : log.rule_code;
      downgradeReason = `Vi phạm lỗi bị trừ ${Math.abs(log.points)} điểm (${ruleName}${log.notes ? ': ' + log.notes : ''}). Đủ tỷ lệ tháng xếp loại Khá nhưng bị hạ xuống mức Đạt.`;
    } else {
      classification = 'Khá';
    }
  } else {
    classification = 'Đạt';
    if (has60to70Violation) {
      const log = severe60to70Logs[0];
      const rule = (scoreRules || []).find(r => r.code === log.rule_code);
      const ruleName = rule ? `${rule.code} - ${rule.name}` : log.rule_code;
      downgradeReason = `Vi phạm lỗi bị trừ ${Math.abs(log.points)} điểm (${ruleName}${log.notes ? ': ' + log.notes : ''}). Khung xếp loại khống chế ở mức Đạt.`;
    }
  }

  return {
    average,
    classification,
    monthlyScores,
    monthlyRatings,
    downgradeReason
  };
};

export const evaluateYearlyResult = (term1Class: string, term2Class: string): string => {
  // 1. Mức Tốt: Học kỳ II đạt mức Tốt, Học kỳ I đạt từ mức Khá trở lên.
  if (term2Class === 'Tốt' && (term1Class === 'Tốt' || term1Class === 'Khá')) {
    return 'Tốt';
  }
  
  // 2. Mức Khá:
  // - Học kỳ II đạt mức Khá, Học kỳ I đạt từ mức Đạt trở lên
  // - Học kỳ II đạt mức Đạt, Học kỳ I đạt mức Tốt
  // - Học kỳ II đạt mức Tốt, Học kỳ I đạt mức Đạt hoặc Chưa đạt
  if (
    (term2Class === 'Khá' && (term1Class === 'Tốt' || term1Class === 'Khá' || term1Class === 'Đạt')) ||
    (term2Class === 'Đạt' && term1Class === 'Tốt') ||
    (term2Class === 'Tốt' && (term1Class === 'Đạt' || term1Class === 'Chưa đạt'))
  ) {
    return 'Khá';
  }
  
  // 3. Mức Đạt:
  // - Học kỳ II đạt mức Đạt, Học kỳ I đạt mức Khá, Đạt hoặc Chưa đạt
  // - Học kỳ II đạt mức Khá, Học kỳ I đạt mức Chưa đạt
  if (
    (term2Class === 'Đạt' && (term1Class === 'Khá' || term1Class === 'Đạt' || term1Class === 'Chưa đạt')) ||
    (term2Class === 'Khá' && term1Class === 'Chưa đạt')
  ) {
    return 'Đạt';
  }
  
  // 4. Mức Chưa đạt: Các trường hợp còn lại
  return 'Chưa đạt';
};
