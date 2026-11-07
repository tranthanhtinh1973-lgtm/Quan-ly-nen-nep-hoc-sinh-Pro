import { SchoolData, LogDiscipline, Attendance } from '../types';

/**
 * Checks if a rule code relates to attendance or skipping class.
 */
export const isAttendanceRuleCode = (code: string): boolean => {
  if (!code) return false;
  if (code.startsWith('VP_N_') || code.startsWith('VP_BT_')) return true;
  if (['SK', 'SP', 'CK', 'CP', 'SKCK', 'SPCP', 'SPCK', 'SKCP', 'KPT', 'CPT'].includes(code)) return true;
  if (/^[SC]\d+/.test(code) || /^S[KC]?C?\d+/.test(code) || /^[SKCP]{2,4}/.test(code)) return true;
  return false;
};

/**
 * Sanitizes and cleans up orphaned or inconsistent records across LOGS_DISCIPLINE and ATTENDANCE.
 */
export const sanitizeSchoolData = (db: SchoolData): SchoolData => {
  if (!db) return db;

  const validStudentIds = new Set((db.STUDENTS || []).map(s => s.id));

  // 1. Filter out logs for non-existent students
  const cleanLogs = (db.LOGS_DISCIPLINE || []).filter(l => validStudentIds.has(l.student_id));

  // 2. Filter out attendance records for non-existent students or status "DU_TIET"
  const cleanAttendance = (db.ATTENDANCE || []).filter(a => {
    if (!validStudentIds.has(a.student_id)) return false;
    const statusStr = String(a.status || a.attendance?.type || '');
    if (!statusStr || statusStr === 'DU_TIET') return false;
    return true;
  });

  return {
    ...db,
    LOGS_DISCIPLINE: cleanLogs,
    ATTENDANCE: cleanAttendance
  };
};

/**
 * Deletes a discipline log and synchronizes the ATTENDANCE array if applicable.
 */
export const deleteDisciplineLogWithSync = (db: SchoolData, logId: string): SchoolData => {
  const logToDelete = db.LOGS_DISCIPLINE.find(l => l.id === logId);
  if (!logToDelete) return db;

  const updatedLogs = db.LOGS_DISCIPLINE.filter(l => l.id !== logId);

  const studentId = logToDelete.student_id;
  const date = logToDelete.date;

  // Check if there are remaining discipline logs for this student on this date
  const remainingLogs = updatedLogs.filter(l => l.student_id === studentId && l.date === date);

  let updatedAttendance = db.ATTENDANCE;

  // If no remaining discipline logs for this student on this date, or if all remaining are non-attendance,
  // remove the attendance entry for that date
  if (remainingLogs.length === 0) {
    updatedAttendance = db.ATTENDANCE.filter(a => !(a.student_id === studentId && a.date === date));
  } else {
    const hasRemainingAttendanceLog = remainingLogs.some(l => isAttendanceRuleCode(l.rule_code));

    if (!hasRemainingAttendanceLog) {
      updatedAttendance = db.ATTENDANCE.filter(a => !(a.student_id === studentId && a.date === date));
    }
  }

  return sanitizeSchoolData({
    ...db,
    LOGS_DISCIPLINE: updatedLogs,
    ATTENDANCE: updatedAttendance
  });
};

/**
 * Updates a discipline log and synchronizes ATTENDANCE if date or rule changed.
 */
export const editDisciplineLogWithSync = (db: SchoolData, updatedLog: LogDiscipline): SchoolData => {
  const oldLog = db.LOGS_DISCIPLINE.find(l => l.id === updatedLog.id);
  if (!oldLog) return db;

  const updatedLogs = db.LOGS_DISCIPLINE.map(l => l.id === updatedLog.id ? updatedLog : l);

  let updatedAttendance = db.ATTENDANCE;

  // If date changed, remove attendance on old date if no remaining logs
  if (oldLog.date !== updatedLog.date) {
    const remainingOldLogs = updatedLogs.filter(l => l.student_id === oldLog.student_id && l.date === oldLog.date);
    if (remainingOldLogs.length === 0 || !remainingOldLogs.some(l => isAttendanceRuleCode(l.rule_code))) {
      updatedAttendance = updatedAttendance.filter(a => !(a.student_id === oldLog.student_id && a.date === oldLog.date));
    }
  }

  return sanitizeSchoolData({
    ...db,
    LOGS_DISCIPLINE: updatedLogs,
    ATTENDANCE: updatedAttendance
  });
};

/**
 * Synchronizes attendance status changes with LOGS_DISCIPLINE.
 * If attendance is changed to "DU_TIET", removes associated attendance discipline logs.
 */
export const syncAttendanceSave = (
  db: SchoolData, 
  studentId: string, 
  date: string, 
  newStatus: string
): SchoolData => {
  let updatedAttendance = db.ATTENDANCE;
  let updatedLogs = db.LOGS_DISCIPLINE;

  if (!newStatus || newStatus === 'DU_TIET') {
    // Remove attendance record
    updatedAttendance = db.ATTENDANCE.filter(a => !(a.student_id === studentId && a.date === date));
    // Remove any attendance-related discipline logs for that student on that date
    updatedLogs = db.LOGS_DISCIPLINE.filter(l => {
      if (l.student_id !== studentId || l.date !== date) return true;
      return !isAttendanceRuleCode(l.rule_code);
    });
  } else {
    // Upsert attendance record
    const existingIndex = updatedAttendance.findIndex(a => a.student_id === studentId && a.date === date);
    const attType = (['SP', 'SK', 'CP', 'CK', 'Tiet'].includes(newStatus) ? newStatus : 'SK') as any;
    const newRecord: Attendance = {
      date,
      student_id: studentId,
      status: newStatus as any,
      attendance: {
        type: attType,
        periods: [],
        note: newStatus
      }
    };

    if (existingIndex >= 0) {
      updatedAttendance = [
        ...updatedAttendance.slice(0, existingIndex),
        newRecord,
        ...updatedAttendance.slice(existingIndex + 1)
      ];
    } else {
      updatedAttendance = [newRecord, ...updatedAttendance];
    }
  }

  return sanitizeSchoolData({
    ...db,
    LOGS_DISCIPLINE: updatedLogs,
    ATTENDANCE: updatedAttendance
  });
};
