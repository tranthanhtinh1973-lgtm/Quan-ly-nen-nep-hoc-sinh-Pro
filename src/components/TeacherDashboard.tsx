import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { SchoolConfig, User, Student, LogDiscipline, Attendance, Complaint, ScoreRule, SchoolData } from '../types';
import { GoogleDriveService } from '../lib/GoogleDriveService';
import { ExcelHelper } from './ExcelHelper';
import AutoSyncStatus from './AutoSyncStatus';
import { PdfGenerator } from './PdfGenerator';
import InputDrawer, { ATTENDANCE_RULES } from './InputDrawer';
import { evaluateSemesterResult, evaluateYearlyResult, getMonthFromDateStr, getMonthlyRating } from '../lib/EvaluationHelper';
import { ATTENDANCE_DESCRIPTIONS, normalizeAttendanceCode, mergeAttendanceCodes } from '../lib/AttendanceHelper';
import { deleteDisciplineLogWithSync, editDisciplineLogWithSync, syncAttendanceSave, sanitizeSchoolData } from '../lib/SyncHelper';
import { HelpModal } from './HelpModal';
import { 
  Users, 
  FileText, 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Upload, 
  Plus, 
  Trash2, 
  Pencil, 
  Eye, 
  Award, 
  Download, 
  Lock, 
  CheckCircle,
  Signature,
  FileSpreadsheet,
  X,
  Key,
  RefreshCw,
  Edit3,
  Search,
  Filter,
  Check,
  RotateCcw,
  Shield,
  LogOut,
  Bell,
  ChevronRight,
  HelpCircle
} from 'lucide-react';

interface TeacherDashboardProps {
  session: any;
  onLogout: () => void;
  onDataChanged?: () => void;
}

export default function TeacherDashboard({ session, onLogout, onDataChanged }: TeacherDashboardProps) {
  const schoolId = session.schoolId || 'LHP';
  const username = session.username || 'gv_nguyenanh';
  
  const [db, setDb] = useState<SchoolData | null>(null);
  
  // Main top tabs: 'overview' | 'logs' | 'students'
  const [mainTab, setMainTab] = useState<'overview' | 'logs' | 'students'>('overview');
  
  // Sub-tabs under 'logs' (Nhật ký lớp): 'roster' | 'logs_merits' | 'attendance'
  const [logSubTab, setLogSubTab] = useState<'logs_merits' | 'roster' | 'attendance'>('logs_merits');

  // Specific teacher profile
  const [teacherProfile, setTeacherProfile] = useState<User | null>(null);
  const [classAssigned, setClassAssigned] = useState<string>('10A1');
  const [teacherDisplayName, setTeacherDisplayName] = useState<string>('Giáo viên Chủ nhiệm');
  
  // Filters for Overview tab
  const [selectedTerm, setSelectedTerm] = useState<'Học kỳ I' | 'Học kỳ II'>('Học kỳ I');
  const [selectedMonth, setSelectedMonth] = useState<string>('Tháng 9');
  const [overviewSearchQuery, setOverviewSearchQuery] = useState<string>('');

  // Filters for Student Management & Class Log tabs
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('Tất cả');
  const [selectedLogMonth, setSelectedLogMonth] = useState<string>('Tất cả');

  // Filter logs by selected month & semester date ranges
  const isLogInSelectedMonth = (log: LogDiscipline) => {
    if (selectedLogMonth === 'Tất cả') return true;
    if (log.term_month === selectedLogMonth) return true;

    if (log.date) {
      const parts = log.date.split('-');
      if (parts.length >= 2) {
        const m = parseInt(parts[1], 10);
        const d = parts.length === 3 ? parseInt(parts[2], 10) : 1;

        if (selectedLogMonth === 'Tháng 8') return m === 8 && d >= 20;
        if (selectedLogMonth === 'Tháng 9') return m === 9;
        if (selectedLogMonth === 'Tháng 10') return m === 10;
        if (selectedLogMonth === 'Tháng 11') return m === 11;
        if (selectedLogMonth === 'Tháng 12') return m === 12;
        if (selectedLogMonth === 'Tháng 1 (HK I)') return m === 1 && d <= 15;
        if (selectedLogMonth === 'Tháng 1 (HK II)') return m === 1 && d >= 16;
        if (selectedLogMonth === 'Tháng 2') return m === 2;
        if (selectedLogMonth === 'Tháng 3') return m === 3;
        if (selectedLogMonth === 'Tháng 4') return m === 4;
        if (selectedLogMonth === 'Tháng 5') return m === 5 && d <= 30;
        if (selectedLogMonth === 'Tháng 1') return m === 1;
      }
    }

    const monthFromDate = getMonthFromDateStr(log.date);
    if (monthFromDate && selectedLogMonth.includes(monthFromDate)) return true;

    return false;
  };

  // Modals
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showComplaintsModal, setShowComplaintsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<Student | null>(null);

  // Student CRUD Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [showDeleteClassModal, setShowDeleteClassModal] = useState<boolean>(false);
  const [showDeleteAllStudentsModal, setShowDeleteAllStudentsModal] = useState<boolean>(false);

  // Discipline Log Edit & Delete State
  const [logToDelete, setLogToDelete] = useState<LogDiscipline | null>(null);
  const [editingLog, setEditingLog] = useState<LogDiscipline | null>(null);
  const [editLogDate, setEditLogDate] = useState<string>('');
  const [editLogRuleCode, setEditLogRuleCode] = useState<string>('');
  const [editLogPoints, setEditLogPoints] = useState<number>(0);
  const [editLogNotes, setEditLogNotes] = useState<string>('');

  // New Student Form State
  const [newStudent, setNewStudent] = useState({
    id: '',
    vnedu_code: '',
    name: '',
    class: '10A1',
    gender: 'Nam',
    birth_date: '2010-11-17',
    parent_name: '',
    phone: '',
    password: '123456'
  });

  // Password Change Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Signature Uploader State
  const [signaturePreview, setSignaturePreview] = useState<string>('');

  // Attendance Form States
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceState, setAttendanceState] = useState<Record<string, 'P' | 'KP' | 'BT_SANG' | 'BT_CHIEU' | 'DU_TIET'>>({});

  useEffect(() => {
    loadTeacherData();
  }, [schoolId, username, onDataChanged]);

  const populateTeacherState = (data: SchoolData) => {
    setDb(data);

    const cleanUser = String(username || '').trim().toLowerCase();
    const allClassesInStudents = Array.from(new Set((data.STUDENTS || []).map(s => String(s.class || '').trim()))).filter(Boolean);

    // 1. Look for user in USERS by username, class_assigned, or ID
    let profile = (data.USERS || []).find(u => 
      String(u.username || '').trim().toLowerCase() === cleanUser ||
      String(u.class_assigned || '').trim().toLowerCase() === cleanUser ||
      String(u.id || '').trim().toLowerCase() === cleanUser
    );

    // 2. Derive class name from username (e.g., '10A1', 'gv_10a1' -> '10A1')
    let derivedClass = '';
    const cleanUpper = cleanUser.toUpperCase().replace(/^GV_?/, '');
    const matchedClass = allClassesInStudents.find(c => c.toUpperCase() === cleanUpper || c.toUpperCase() === cleanUser.toUpperCase());
    
    if (matchedClass) {
      derivedClass = matchedClass;
    } else if (/^\d{1,2}[A-Z]\d{1,2}$/.test(cleanUpper)) {
      derivedClass = cleanUpper;
    }

    if (profile) {
      setTeacherProfile(profile);
      const cls = profile.class_assigned || derivedClass || allClassesInStudents[0] || '10A1';
      setClassAssigned(cls);
      const displayName = profile.full_name || profile.username || (cls ? `GVCN Lớp ${cls}` : 'Giáo viên Chủ nhiệm');
      setTeacherDisplayName(displayName);
      if (profile.signature_base64) {
        setSignaturePreview(profile.signature_base64);
      }
      setNewStudent(prev => ({ ...prev, class: cls }));
    } else {
      const defaultCls = derivedClass || allClassesInStudents[0] || '10A1';
      setClassAssigned(defaultCls);
      setTeacherDisplayName(`GVCN Lớp ${defaultCls}`);
      setNewStudent(prev => ({ ...prev, class: defaultCls }));
    }

    // Prefill attendance state for date
    if (data.ATTENDANCE) {
      const todayLogs = data.ATTENDANCE.filter(a => a.date === attendanceDate);
      const prestate: Record<string, any> = {};
      todayLogs.forEach(log => {
        const raw = log.status || log.attendance?.type || '';
        prestate[log.student_id] = prestate[log.student_id] ? mergeAttendanceCodes([prestate[log.student_id], raw]) : raw;
      });
      setAttendanceState(prestate);
    }
  };

  const loadTeacherData = () => {
    // 1. Instant local load (0ms rendering delay)
    const localData = GoogleDriveService.getSchoolData(schoolId);
    populateTeacherState(localData);

    // 2. Non-blocking background sync
    GoogleDriveService.fetchSchoolDataFromCentralServer(schoolId).then(remoteData => {
      if (remoteData) {
        populateTeacherState(remoteData);
      }
    }).catch(() => {});
  };

  const syncAndReload = (updatedDb: SchoolData) => {
    setDb(updatedDb);
    GoogleDriveService.saveSchoolData(schoolId, updatedDb);
    if (onDataChanged) onDataChanged();
  };

  if (!db) return null;

  const activeConfig = db.CONFIG[0] || { school_name: 'THPT Lộc Bình', year: '2026-2027', semester: 'Học kỳ I', is_locked: false };

  // Months lists
  const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
  const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
  const activeMonths = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;

  // Helper score calculations for students of the assigned class
  const getMyClassStudents = () => {
    const termMonths = activeMonths;

    return db.STUDENTS.filter(s => s.class === classAssigned).map(student => {
      // Current selected month scores
      const sLogsMonth = db.LOGS_DISCIPLINE.filter(l => 
        l.student_id === student.id && 
        (l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth))
      );
      const totalMinus = sLogsMonth.filter(l => l.points < 0).reduce((acc, curr) => acc + curr.points, 0);
      const totalPlus = sLogsMonth.filter(l => l.points > 0).reduce((acc, curr) => acc + curr.points, 0);
      const currentScore = Math.max(0, Math.min(100, 100 + totalMinus + totalPlus));

      // Calculate term results
      const termResult = evaluateSemesterResult(student.id, termMonths, db.LOGS_DISCIPLINE);
      const t1Res = evaluateSemesterResult(student.id, monthsForTerm1, db.LOGS_DISCIPLINE);
      const t2Res = evaluateSemesterResult(student.id, monthsForTerm2, db.LOGS_DISCIPLINE);
      const yearlyClassification = evaluateYearlyResult(t1Res.classification, t2Res.classification);

      return {
        ...student,
        totalMinus,
        totalPlus,
        currentScore,
        semesterAverage: termResult.average,
        classification: termResult.classification,
        yearlyClassification,
        term1Classification: t1Res.classification,
        term2Classification: t2Res.classification
      };
    });
  };

  const classroomStudents = getMyClassStudents();

  // All students filtered for overview search
  const filteredOverviewStudents = classroomStudents.filter(s => {
    if (!overviewSearchQuery.trim()) return true;
    const q = overviewSearchQuery.toLowerCase().trim();
    return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.vnedu_code && s.vnedu_code.toLowerCase().includes(q));
  });

  // Students needing attention (score < 70 or rating Đạt/Chưa đạt)
  const studentsNeedingAttention = classroomStudents.filter(s => s.currentScore < 70 || s.classification === 'Đạt' || s.classification === 'Chưa đạt');

  // Filter pending complaints regarding students of this class
  const classComplaints = db.COMPLAINTS.filter(c => {
    const stud = db.STUDENTS.find(s => s.id === c.student_id);
    return stud?.class === classAssigned;
  }) || [];
  const pendingComplaints = classComplaints.filter(c => c.status === 'Pending');

  // Filter students for 'Quản lý Học sinh' tab (shows all students, searchable by name, code, class, vnedu)
  const availableClasses = Array.from(new Set(db.STUDENTS.map(s => s.class)));
  const filteredManagementStudents = db.STUDENTS.filter(s => {
    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase().trim();
      const matchesName = s.name.toLowerCase().includes(q);
      const matchesId = s.id.toLowerCase().includes(q);
      const matchesClass = s.class.toLowerCase().includes(q);
      const matchesVnEdu = Boolean(s.vnedu_code && s.vnedu_code.toLowerCase().includes(q)) || Boolean(s.vneduId && s.vneduId.toLowerCase().includes(q));
      return matchesName || matchesId || matchesClass || matchesVnEdu;
    }
    return true;
  });

  // Export handlers
  const handleDownloadMonthlyReport = () => {
    if (!db) {
      alert('Dữ liệu đang được tải từ máy chủ, vui lòng thử lại sau giây lát.');
      return;
    }
    try {
      // Determine active class or default to classAssigned
      const targetClass = classAssigned || (db.STUDENTS.length > 0 ? db.STUDENTS[0].class : '10A1');
      ExcelHelper.exportMonthlyReport(db, targetClass, selectedMonth);
    } catch (e: any) {
      console.error('Error exporting monthly report:', e);
      alert('Có lỗi xảy ra khi tạo báo cáo tháng: ' + (e?.message || 'Vui lòng kiểm tra lại dữ liệu'));
    }
  };

  const handleDownloadSemesterReport = () => {
    if (!db) {
      alert('Dữ liệu đang được tải từ máy chủ, vui lòng thử lại sau giây lát.');
      return;
    }
    try {
      const targetClass = classAssigned || (db.STUDENTS.length > 0 ? db.STUDENTS[0].class : '10A1');
      ExcelHelper.exportSemesterReport(db, targetClass, selectedTerm);
    } catch (e: any) {
      console.error('Error exporting semester report:', e);
      alert('Có lỗi xảy ra khi tạo báo cáo học kỳ: ' + (e?.message || 'Vui lòng kiểm tra lại dữ liệu'));
    }
  };

  const handleDownloadAttendanceReport = () => {
    if (!db) return;
    try {
      const cleanClass = String(classAssigned || '').trim().toLowerCase();
      let filteredAttendance = db.ATTENDANCE.filter(a => {
        const stud = db.STUDENTS.find(s => String(s.id).trim().toLowerCase() === String(a.student_id).trim().toLowerCase());
        if (!stud) return false;
        const sClass = String(stud.class || '').trim().toLowerCase();
        return !cleanClass || sClass === cleanClass || sClass.replace(/^lớp\s+/, '') === cleanClass.replace(/^lớp\s+/, '');
      });

      if (filteredAttendance.length === 0 && db.ATTENDANCE.length > 0) {
        filteredAttendance = db.ATTENDANCE;
      }

      if (filteredAttendance.length === 0) {
        alert(`Không có dữ liệu điểm danh nào của lớp ${classAssigned || 'này'}.`);
        return;
      }

      ExcelHelper.exportAttendance(filteredAttendance, db.STUDENTS, classAssigned || '10A1');
    } catch (e: any) {
      console.error('Error exporting attendance report:', e);
      alert('Có lỗi xảy ra khi tạo sổ điểm danh: ' + (e?.message || 'Vui lòng thử lại'));
    }
  };

  const handleImportMonthlyReport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!db || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    ExcelHelper.importMonthlyReport(file, db, selectedMonth, teacherDisplayName || username)
      .then(({ updatedDb, successCount, logsAddedCount }) => {
        syncAndReload(updatedDb);
        alert(`Nạp báo cáo tháng thành công! Đã xử lý ${successCount} dòng học sinh và ghi nhận ${logsAddedCount} mục rèn luyện trong ${selectedMonth}.`);
      })
      .catch((err: any) => {
        console.error('Import monthly report error:', err);
        alert('Lỗi khi nạp báo cáo tháng: ' + (err?.message || 'File Excel không đúng cấu trúc.'));
      });

    e.target.value = '';
  };

  const handleDownloadBatchPdf = async () => {
    if (classroomStudents.length === 0) return;
    try {
      const zipBlob = await PdfGenerator.exportClassBatchZip(
        classroomStudents,
        activeConfig,
        db.LOGS_DISCIPLINE,
        db.SCORE_RULES,
        db.ATTENDANCE,
        teacherProfile || undefined
      );

      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Lien_Lac_Hang_Loat_Lop_${classAssigned}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Lỗi xuất phiếu liên lạc hàng loạt: ' + e.message);
    }
  };

  // Student CRUD Operations
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim()) {
      alert('Vui lòng nhập Họ và Tên học sinh.');
      return;
    }

    const prefix = 'LB';
    const cleanClass = (newStudent.class || classAssigned).toUpperCase().replace(/\s+/g, '');
    const classCount = db.STUDENTS.filter(s => s.class.toUpperCase() === cleanClass).length + 1;
    const generatedId = `${prefix}_${cleanClass}_${String(classCount).padStart(2, '0')}`;
    const studentIdToUse = newStudent.id.trim() || generatedId;

    if (db.STUDENTS.some(s => s.id === studentIdToUse)) {
      alert('Mã học sinh này đã tồn tại!');
      return;
    }

    const studentToSave: Student = {
      id: studentIdToUse,
      vnedu_code: newStudent.vnedu_code.trim() || undefined,
      vneduId: newStudent.vnedu_code.trim() || undefined,
      name: newStudent.name.trim(),
      class: cleanClass,
      gender: newStudent.gender,
      birth_date: newStudent.birth_date,
      parent_name: newStudent.parent_name.trim(),
      phone: newStudent.phone.trim(),
      password: newStudent.password || '123456'
    };

    const updated = {
      ...db,
      STUDENTS: [...db.STUDENTS, studentToSave]
    };

    syncAndReload(updated);
    setShowAddStudentModal(false);
    setNewStudent({
      id: '',
      vnedu_code: '',
      name: '',
      class: classAssigned,
      gender: 'Nam',
      birth_date: '2010-11-17',
      parent_name: '',
      phone: '',
      password: '123456'
    });
    alert('Đã thêm học sinh mới thành công!');
  };

  const handleSaveEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const updatedStudents = db.STUDENTS.map(s => {
      if (s.id === editingStudent.id) {
        return { ...editingStudent };
      }
      return s;
    });

    const updated = {
      ...db,
      STUDENTS: updatedStudents
    };

    syncAndReload(updated);
    setEditingStudent(null);
    alert('Đã cập nhật thông tin học sinh thành công!');
  };

  const executeDeleteStudent = () => {
    if (!studentToDelete) return;

    const updatedStudents = db.STUDENTS.filter(s => s.id !== studentToDelete.id);
    const updatedLogs = db.LOGS_DISCIPLINE.filter(l => l.student_id !== studentToDelete.id);
    const updatedAttendance = db.ATTENDANCE.filter(a => a.student_id !== studentToDelete.id);
    const updatedComplaints = db.COMPLAINTS.filter(c => c.student_id !== studentToDelete.id);

    const updated = {
      ...db,
      STUDENTS: updatedStudents,
      LOGS_DISCIPLINE: updatedLogs,
      ATTENDANCE: updatedAttendance,
      COMPLAINTS: updatedComplaints
    };

    syncAndReload(updated);
    setStudentToDelete(null);
    alert(`Đã xóa học sinh ${studentToDelete.name} thành công!`);
  };

  const executeDeleteClassStudents = () => {
    const updatedStudents = db.STUDENTS.filter(s => s.class !== classAssigned);
    const updated = { ...db, STUDENTS: updatedStudents };
    syncAndReload(updated);
    setShowDeleteClassModal(false);
    alert(`Đã xóa toàn bộ học sinh lớp ${classAssigned}!`);
  };

  const executeDeleteAllStudents = () => {
    const updated = { ...db, STUDENTS: [] };
    syncAndReload(updated);
    setShowDeleteAllStudentsModal(false);
    alert('Đã xóa toàn bộ danh sách học sinh!');
  };

  const handleImportStudentsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    ExcelHelper.importStudents(file).then(parsed => {
      const updatedStudents = [...db.STUDENTS];
      parsed.forEach(p => {
        if (!updatedStudents.some(s => s.id === p.id)) {
          updatedStudents.push({ ...p, password: (p as any).password || '123456' });
        }
      });
      const updated = { ...db, STUDENTS: updatedStudents };
      syncAndReload(updated);
      alert('Đã nạp danh sách học sinh từ file Excel thành công!');
    }).catch(err => {
      alert('Lỗi khi đọc file Excel: ' + err.message);
    });
    e.target.value = '';
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      alert('Mật khẩu mới không khớp hoặc bị bỏ trống.');
      return;
    }

    const updatedUsers = db.USERS.map(u => {
      if (u.username.toLowerCase() === username.toLowerCase()) {
        return { ...u, password: newPassword };
      }
      return u;
    });

    const updated = { ...db, USERS: updatedUsers };
    syncAndReload(updated);
    setShowPasswordModal(false);
    setNewPassword('');
    setConfirmPassword('');
    alert('Đã đổi mật khẩu cá nhân thành công!');
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setSignaturePreview(base64);

      const updatedUsers = db.USERS.map(u => {
        if (u.username.toLowerCase() === username.toLowerCase()) {
          return { ...u, signature_base64: base64 };
        }
        return u;
      });

      const updated = { ...db, USERS: updatedUsers };
      syncAndReload(updated);
      setShowSignatureModal(false);
      alert('Đã cập nhật chữ ký số thành công!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMultipleConductLogs = (
    studentId: string,
    logs: { ruleCode: string; points: number; notes: string; date: string; evidence_base64?: string }[],
    attendance?: any
  ) => {
    if (activeConfig.is_locked) {
      alert('⚠️ Trường đang khóa sổ dữ liệu rèn luyện. Không thể thêm bản ghi.');
      return;
    }

    const newLogs: LogDiscipline[] = logs.map((log, idx) => {
      const rule = db.SCORE_RULES.find(r => r.code === log.ruleCode) ||
                   ATTENDANCE_RULES.find(r => r.code === log.ruleCode);
      return {
        id: `L-${Date.now()}-${idx}`,
        student_id: studentId,
        date: log.date,
        rule_code: log.ruleCode,
        points: log.points,
        notes: log.notes || (rule ? rule.name : 'Ghi nhận GVCN'),
        recorded_by: username,
        term_month: selectedMonth,
        evidence_base64: log.evidence_base64
      };
    });

    let updatedAttendance = db.ATTENDANCE;
    if (attendance) {
      const existing = db.ATTENDANCE.find(a => a.student_id === studentId && a.date === attendance.date);
      if (existing) {
        const mergedStatus = mergeAttendanceCodes([existing.status || existing.attendance?.type || '', attendance.status || attendance.attendance?.type || '']);
        const mergedRecord = {
          ...attendance,
          status: mergedStatus,
          attendance: {
            ...attendance.attendance,
            type: mergedStatus
          }
        };
        updatedAttendance = [
          mergedRecord,
          ...db.ATTENDANCE.filter(a => !(a.student_id === studentId && a.date === attendance.date))
        ];
      } else {
        updatedAttendance = [attendance, ...db.ATTENDANCE];
      }
    }

    const updated = {
      ...db,
      LOGS_DISCIPLINE: [...newLogs, ...db.LOGS_DISCIPLINE],
      ATTENDANCE: updatedAttendance
    };

    syncAndReload(updated);
    setShowLogModal(false);
    alert(`Đã ghi nhận thành công ${logs.length} mục rèn luyện!`);
  };

  const handleDeleteLog = (logId: string) => {
    if (!db) return;
    if (activeConfig.is_locked) {
      alert('Sổ rèn luyện đã khóa sổ, không thể xóa bản ghi!');
      return;
    }
    const log = db.LOGS_DISCIPLINE.find(l => l.id === logId);
    if (log) setLogToDelete(log);
  };

  const executeDeleteLog = () => {
    if (!db || !logToDelete) return;
    const updated = deleteDisciplineLogWithSync(db, logToDelete.id);
    syncAndReload(updated);
    setLogToDelete(null);
    alert('Đã xóa bản ghi rèn luyện thành công!');
  };

  const handleStartEditLog = (log: LogDiscipline) => {
    if (activeConfig.is_locked) {
      alert('Sổ rèn luyện đã khóa sổ, không thể sửa bản ghi!');
      return;
    }
    setEditingLog(log);
    setEditLogDate(log.date);
    setEditLogRuleCode(log.rule_code);
    setEditLogPoints(log.points);
    setEditLogNotes(log.notes);
  };

  const handleSaveEditLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingLog) return;
    const calculatedMonth = getMonthFromDateStr(editLogDate) || editingLog.term_month;
    const updatedLogItem: LogDiscipline = {
      ...editingLog,
      date: editLogDate,
      rule_code: editLogRuleCode,
      points: Number(editLogPoints),
      notes: editLogNotes.trim(),
      term_month: calculatedMonth
    };
    const updated = editDisciplineLogWithSync(db, updatedLogItem);
    syncAndReload(updated);
    setEditingLog(null);
    alert('Đã cập nhật bản ghi rèn luyện thành công!');
  };

  const handleSaveAttendance = () => {
    if (activeConfig.is_locked) {
      alert('⚠️ Dữ liệu học đường hiện đang khóa số.');
      return;
    }

    let currentDb = db;
    classroomStudents.forEach(s => {
      const state = attendanceState[s.id] || 'DU_TIET';
      currentDb = syncAttendanceSave(currentDb, s.id, attendanceDate, state);
    });

    syncAndReload(currentDb);
    alert(`Đã lưu sổ điểm danh lớp ${classAssigned} ngày ${attendanceDate}!`);
  };

  return (
    <div className="space-y-5 font-sans">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BANNER (Exact dark blue navy header from Image 1)           */}
      {/* ========================================================================= */}
      <div className="bg-[#132247] text-white rounded-xl shadow-lg p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-blue-900">
        
        {/* Left branding info */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-slate-900 p-1.5 rounded-xl flex items-center justify-center shadow-md border border-slate-700 shrink-0">
            <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base md:text-lg tracking-tight text-white">
                {GoogleDriveService.getDisplaySchoolName(schoolId, activeConfig.school_name)}
              </h2>
              <span className="bg-slate-800/80 text-slate-200 border border-slate-700 text-[11px] font-medium px-2.5 py-0.5 rounded-full">
                Năm học {activeConfig.year || '2026-2027'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              Giáo viên chủ nhiệm: <span className="text-white font-semibold">{teacherDisplayName}</span> - Lớp <span className="text-amber-300 font-bold">{classAssigned}</span>
            </p>
          </div>
        </div>

        {/* Right header buttons */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Help button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-1.5 bg-[#1e3466] hover:bg-[#284380] text-white px-3.5 py-2 rounded-lg font-medium transition cursor-pointer border border-blue-800/60 shadow-xs"
            title="Sổ tay Hướng dẫn & Trợ giúp"
          >
            <HelpCircle className="w-4 h-4 text-blue-300" />
            <span>Trợ giúp</span>
          </button>

          {/* Complaints button */}
          <button
            onClick={() => setShowComplaintsModal(true)}
            className="relative inline-flex items-center gap-1.5 bg-[#1e3466] hover:bg-[#284380] text-white px-3.5 py-2 rounded-lg font-medium transition cursor-pointer border border-blue-800/60 shadow-xs"
          >
            <Bell className="w-4 h-4 text-amber-300 fill-amber-300/20" />
            <span>Giải quyết khiếu nại</span>
            {pendingComplaints.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingComplaints.length}
              </span>
            )}
          </button>

          {/* Personal signature button */}
          <button
            onClick={() => setShowSignatureModal(true)}
            className="inline-flex items-center gap-1.5 bg-[#1e3466] hover:bg-[#284380] text-white px-3.5 py-2 rounded-lg font-medium transition cursor-pointer border border-blue-800/60 shadow-xs"
          >
            <Signature className="w-4 h-4 text-emerald-400" />
            <span>Chữ ký cá nhân</span>
          </button>

          {/* Change password button */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center gap-1.5 bg-[#1e3466] hover:bg-[#284380] text-white px-3.5 py-2 rounded-lg font-medium transition cursor-pointer border border-blue-800/60 shadow-xs"
          >
            <Key className="w-4 h-4 text-sky-300" />
            <span>Đổi mật khẩu</span>
          </button>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer shadow-xs ml-1"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRIMARY NAVIGATION TABS (Image 1 Header Nav)                          */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex items-center gap-2">
        <button
          onClick={() => setMainTab('overview')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
            mainTab === 'overview'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Tổng quan</span>
        </button>

        <button
          onClick={() => setMainTab('logs')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
            mainTab === 'logs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Nhật ký lớp</span>
        </button>

        <button
          onClick={() => setMainTab('students')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
            mainTab === 'students'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản lý Học sinh</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TỔNG QUAN (Exact layout from Image 1)                              */}
      {/* ========================================================================= */}
      {mainTab === 'overview' && (
        <div className="space-y-4">
          
          {/* Row 1 Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            
            {/* Term & Month Selectors */}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {/* Semester segmented buttons */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedTerm('Học kỳ I')}
                  className={`px-4 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    selectedTerm === 'Học kỳ I' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Học kỳ 1
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTerm('Học kỳ II')}
                  className={`px-4 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    selectedTerm === 'Học kỳ II' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Học kỳ 2
                </button>
              </div>

              {/* Month selector dropdown */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Tháng:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-3 py-1.5 text-xs shadow-2xs focus:outline-none focus:border-blue-600"
                >
                  {activeMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right actions: Refresh & Record Discipline */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={loadTeacherData}
                className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Làm mới dữ liệu</span>
              </button>

              <button
                disabled={activeConfig.is_locked}
                onClick={() => {
                  if (activeConfig.is_locked) {
                    alert('Số liệu rèn luyện hiện đang khóa sổ.');
                    return;
                  }
                  setShowLogModal(true);
                }}
                className={`inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm ${
                  activeConfig.is_locked ? 'opacity-50 cursor-not-allowed bg-slate-400' : ''
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Ghi nhận Điểm trừ / Cộng</span>
              </button>
            </div>
          </div>

          {/* Row 2 Controls: Search & Report Exports */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80 text-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc mã HS..."
                value={overviewSearchQuery}
                onChange={(e) => setOverviewSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
              />
            </div>

            {/* Export & Import Buttons Bar */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <label className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>Import báo cáo tháng</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportMonthlyReport}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleDownloadMonthlyReport}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>BC Tháng</span>
              </button>

              <button
                onClick={handleDownloadSemesterReport}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Xuất KQ rèn luyện HK</span>
              </button>

              <button
                onClick={handleDownloadBatchPdf}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Phiếu PLL HK I</span>
              </button>

              <button
                onClick={handleDownloadAttendanceReport}
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất sổ điểm danh tháng</span>
              </button>
            </div>
          </div>

          {/* Row 3 Warning Card ("Học sinh cần quan tâm & hỗ trợ rèn luyện") */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    Học sinh cần quan tâm &amp; hỗ trợ rèn luyện (Mức Trung bình / Yếu)
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {studentsNeedingAttention.length} học sinh
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Danh sách học sinh có kết quả rèn luyện xếp loại Đạt (Trung bình) hoặc Chưa đạt (Yếu/Kém) cần GVCN phối hợp hỗ trợ
                </p>
              </div>
            </div>

            {/* Empty state or list */}
            {studentsNeedingAttention.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <p className="font-bold text-slate-800 text-xs">
                  Tuyệt vời! Lớp hiện không có học sinh nào ở mức rèn luyện Trung bình hoặc Yếu.
                </p>
                <p className="text-[11px] text-slate-500">
                  Tất cả học sinh đều đang đạt kết quả rèn luyện loại Khá hoặc Tốt.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg border border-amber-200 mt-2">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-100/50 text-slate-700 font-bold border-b border-amber-200">
                      <th className="p-2.5 w-10 text-center">STT</th>
                      <th className="p-2.5">Mã HS</th>
                      <th className="p-2.5">Họ và tên</th>
                      <th className="p-2.5 text-center">Điểm T9</th>
                      <th className="p-2.5 text-center">Xếp loại</th>
                      <th className="p-2.5">Lý do / Hành vi vi phạm cần lưu ý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsNeedingAttention.map((s, idx) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-amber-50/20">
                        <td className="p-2.5 text-center font-medium text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-700">{s.id}</td>
                        <td className="p-2.5 font-bold text-slate-900">{s.name}</td>
                        <td className="p-2.5 text-center font-extrabold text-rose-600">{s.currentScore}</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.classification === 'Đạt' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {s.classification}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 italic">
                          {db.LOGS_DISCIPLINE.filter(l => 
                            l.student_id === s.id && 
                            l.points < 0 && 
                            (l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth))
                          ).map(l => l.notes).filter(Boolean).join('; ') || 'Cần rút kinh nghiệm rèn luyện trong tháng'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Row 4 Main Overview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 w-32">MÃ HS</th>
                    <th className="p-3">HỌ VÀ TÊN</th>
                    <th className="p-3 text-center w-20">LỚP</th>
                    <th className="p-3 text-center text-rose-600">ĐIỂM TRỪ ({selectedMonth.replace('Tháng ', 'T')})</th>
                    <th className="p-3 text-center text-emerald-600">ĐIỂM CỘNG ({selectedMonth.replace('Tháng ', 'T')})</th>
                    <th className="p-3 text-center">ĐIỂM {selectedMonth.replace('Tháng ', 'T')}</th>
                    <th className="p-3 text-center">TB HK</th>
                    <th className="p-3 text-center">XẾP LOẠI</th>
                    <th className="p-3 text-center w-28">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOverviewStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 text-center text-slate-400 font-medium">{index + 1}</td>
                      <td className="p-3 font-mono font-semibold text-slate-600">{student.id}</td>
                      <td className="p-3 font-extrabold text-slate-900">{student.name}</td>
                      <td className="p-3 text-center">
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {student.class}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-500">
                        {student.totalMinus === 0 ? '-' : <span className="text-rose-600">{student.totalMinus}</span>}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-500">
                        {student.totalPlus === 0 ? '-' : <span className="text-emerald-600">+{student.totalPlus}</span>}
                      </td>
                      <td className="p-3 text-center font-black text-emerald-600 text-sm">
                        {student.currentScore}
                      </td>
                      <td className="p-3 text-center font-extrabold text-slate-800 text-sm">
                        {student.semesterAverage}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-extrabold ${
                          student.classification === 'Tốt' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          student.classification === 'Khá' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          student.classification === 'Đạt' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-rose-100 text-rose-700 border border-rose-200'
                        }`}>
                          {student.classification}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedStudentLogs(student)}
                          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer text-[11px]"
                          title="Xem nhật ký rèn luyện"
                        >
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Nhật ký</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: NHẬT KÝ LỚP (Exact layout from Image 2)                           */}
      {/* ========================================================================= */}
      {mainTab === 'logs' && (
        <div className="space-y-4">
          
          {/* Sub-navigation Tabs & Month Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setLogSubTab('roster')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  logSubTab === 'roster' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Sổ Chủ Nhiệm Lớp
              </button>
              <button
                onClick={() => setLogSubTab('logs_merits')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  logSubTab === 'logs_merits' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Nhật ký lỗi vi phạm &amp; Merits
              </button>
              <button
                onClick={() => setLogSubTab('attendance')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  logSubTab === 'attendance' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Điểm danh chuyên cần
              </button>
            </div>

            {/* "Tháng" Selector dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
              <Calendar className="w-4 h-4 text-blue-600 ml-1.5" />
              <span className="font-extrabold text-slate-700">Tháng:</span>
              <select
                value={selectedLogMonth}
                onChange={(e) => setSelectedLogMonth(e.target.value)}
                className="bg-white border border-slate-300 font-bold text-blue-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="Tất cả">Tất cả các tháng</option>
                <optgroup label="Học kỳ I (20/8 - 15/1)">
                  <option value="Tháng 8">Tháng 8 (20/8 - 31/8)</option>
                  <option value="Tháng 9">Tháng 9 (01/9 - 30/9)</option>
                  <option value="Tháng 10">Tháng 10 (01/10 - 31/10)</option>
                  <option value="Tháng 11">Tháng 11 (01/11 - 30/11)</option>
                  <option value="Tháng 12">Tháng 12 (01/12 - 31/12)</option>
                  <option value="Tháng 1 (HK I)">Tháng 1 (01/1 - 15/1)</option>
                </optgroup>
                <optgroup label="Học kỳ II (16/1 - 30/5)">
                  <option value="Tháng 1 (HK II)">Tháng 1 (16/1 - 31/1)</option>
                  <option value="Tháng 2">Tháng 2 (01/2 - 28/2)</option>
                  <option value="Tháng 3">Tháng 3 (01/3 - 31/3)</option>
                  <option value="Tháng 4">Tháng 4 (01/4 - 30/4)</option>
                  <option value="Tháng 5">Tháng 5 (01/5 - 30/5)</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Quick Month Filter Pills Bar */}
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="font-bold text-slate-500 shrink-0 mr-1">Lọc nhanh tháng:</span>
            {[
              { label: 'Tất cả', val: 'Tất cả' },
              { label: 'T8 (20/8-31/8)', val: 'Tháng 8' },
              { label: 'Tháng 9', val: 'Tháng 9' },
              { label: 'Tháng 10', val: 'Tháng 10' },
              { label: 'Tháng 11', val: 'Tháng 11' },
              { label: 'Tháng 12', val: 'Tháng 12' },
              { label: 'T1 (1/1-15/1)', val: 'Tháng 1 (HK I)' },
              { label: 'T1 (16/1-31/1)', val: 'Tháng 1 (HK II)' },
              { label: 'Tháng 2', val: 'Tháng 2' },
              { label: 'Tháng 3', val: 'Tháng 3' },
              { label: 'Tháng 4', val: 'Tháng 4' },
              { label: 'T5 (1/5-30/5)', val: 'Tháng 5' },
            ].map(m => (
              <button
                key={m.val}
                onClick={() => setSelectedLogMonth(m.val)}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                  selectedLogMonth === m.val
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Sub-Tab 1: Nhật ký vi phạm & Merits */}
          {logSubTab === 'logs_merits' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-xs">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Nhật Ký Vi Phạm &amp; Điểm Thưởng Lớp {classAssigned}
                  </h3>
                  <p className="text-slate-500 mt-0.5">
                    {selectedLogMonth === 'Tất cả'
                      ? 'Đang hiển thị toàn bộ nhật ký vi phạm / khen thưởng.'
                      : `Đang lọc dữ liệu theo: ${selectedLogMonth}`}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-lg font-bold text-xs">
                  Hiển thị {db.LOGS_DISCIPLINE.filter(l => {
                    const stud = db.STUDENTS.find(s => s.id === l.student_id);
                    return stud && stud.class === classAssigned && isLogInSelectedMonth(l);
                  }).length} bản ghi
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[11px] border-b border-slate-200">
                      <th className="p-3.5 w-12 text-center">STT</th>
                      <th className="p-3.5 w-28">Mã HS</th>
                      <th className="p-3.5">Họ Tên Học Sinh</th>
                      <th className="p-3.5 w-28">Ngày</th>
                      <th className="p-3.5">Mã Hành Vi</th>
                      <th className="p-3.5 text-center w-20">Điểm số</th>
                      <th className="p-3.5">Chi tiết / Minh chứng</th>
                      <th className="p-3.5 w-28">Giáo viên ghi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.LOGS_DISCIPLINE
                      .filter(l => {
                        const stud = db.STUDENTS.find(s => s.id === l.student_id);
                        return stud && stud.class === classAssigned && isLogInSelectedMonth(l);
                      })
                      .map((log, index) => {
                        const stud = db.STUDENTS.find(s => s.id === log.student_id);
                        const rule = db.SCORE_RULES.find(r => r.code === log.rule_code);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/70 transition">
                            <td className="p-3.5 text-center text-slate-400 font-medium">{index + 1}</td>
                            <td className="p-3.5 font-mono font-bold text-slate-700">{log.student_id}</td>
                            <td className="p-3.5 font-extrabold text-slate-900">{stud?.name || '---'}</td>
                            <td className="p-3.5 text-slate-600 font-medium">{log.date}</td>
                            <td className="p-3.5">
                              <span className="bg-blue-50 border border-blue-200 text-blue-700 font-extrabold px-2 py-0.5 rounded font-mono mr-2">
                                {log.rule_code}
                              </span>
                              <span className="font-semibold text-slate-800">{rule ? rule.name : ''}</span>
                            </td>
                            <td className="p-3.5 text-center font-extrabold text-sm">
                              <span className={log.points > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {log.points > 0 ? `+${log.points}` : log.points}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-600 italic font-medium">{log.notes || '---'}</td>
                            <td className="p-3.5 font-mono text-slate-500 font-semibold">{log.recorded_by}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Sổ Chủ Nhiệm Lớp */}
          {logSubTab === 'roster' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
              <h3 className="font-extrabold text-slate-900 text-base border-b border-slate-100 pb-3">
                Danh Sách Học Sinh Chủ Nhiệm Lớp {classAssigned}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[11px] border-b border-slate-200">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3">Mã Học Sinh</th>
                      <th className="p-3">Mã VnEdu</th>
                      <th className="p-3">Họ và Tên</th>
                      <th className="p-3 text-center">Điểm trừ</th>
                      <th className="p-3 text-center">Điểm cộng</th>
                      <th className="p-3 text-center">Điểm hiện hành</th>
                      <th className="p-3 text-center">Xếp loại</th>
                      <th className="p-3">Phụ huynh liên lạc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classroomStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold">{s.id}</td>
                        <td className="p-3 font-mono text-slate-500">{s.vneduId || s.vnedu_code || '---'}</td>
                        <td className="p-3 font-extrabold text-slate-900">{s.name}</td>
                        <td className="p-3 text-center font-bold text-rose-600">{s.totalMinus}đ</td>
                        <td className="p-3 text-center font-bold text-emerald-600">+{s.totalPlus}đ</td>
                        <td className="p-3 text-center font-black text-blue-600 text-sm">{s.currentScore}đ</td>
                        <td className="p-3 text-center font-bold">{s.classification}</td>
                        <td className="p-3 text-slate-600">{s.parent_name} ({s.phone})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Điểm danh chuyên cần */}
          {logSubTab === 'attendance' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Điểm Danh Chuyên Cần Lớp {classAssigned}</h3>
                  <p className="text-slate-500 mt-0.5">Tích chọn trạng thái nghỉ có phép, không phép hoặc bỏ tiết của học sinh.</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-700">Ngày điểm danh:</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      const todayLogs = db.ATTENDANCE.filter(a => a.date === e.target.value);
                      const prestate: Record<string, any> = {};
                      todayLogs.forEach(log => {
                        const raw = log.status || log.attendance?.type || '';
                        prestate[log.student_id] = prestate[log.student_id] ? mergeAttendanceCodes([prestate[log.student_id], raw]) : raw;
                      });
                      setAttendanceState(prestate);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold focus:outline-none"
                  />
                  <button
                    onClick={handleSaveAttendance}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                  >
                    Lưu sổ điểm danh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[11px] border-b border-slate-200">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-28">Mã HS</th>
                      <th className="p-3">Học Sinh</th>
                      <th className="p-3 w-64 text-center">Trạng Thái Điểm Danh (Quy chuẩn TT22 / VnEdu)</th>
                      <th className="p-3">Mã Ghi Nhận / Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classroomStudents.map((s, idx) => {
                      const rawStatus = attendanceState[s.id] || 'DU_TIET';
                      const currentStatus = normalizeAttendanceCode(rawStatus);

                      const isKnownCode = ['DU_TIET', 'SPCP', 'SP', 'CP', 'SKCK', 'SK', 'CK', 'SPCK', 'SKCP'].includes(currentStatus);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold">{s.id}</td>
                          <td className="p-3 font-extrabold text-slate-900">{s.name}</td>
                          
                          <td className="p-3 text-center">
                            <select
                              value={isKnownCode ? currentStatus : 'CUSTOM'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== 'CUSTOM') {
                                  setAttendanceState({ ...attendanceState, [s.id]: val } as any);
                                }
                              }}
                              className={`w-full text-xs font-bold p-2 rounded-lg border focus:outline-none ${
                                currentStatus === 'DU_TIET' ? 'bg-slate-50 border-slate-200 text-slate-700' :
                                currentStatus.includes('P') && !currentStatus.includes('K') ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                                currentStatus.includes('K') ? 'bg-rose-50 border-rose-300 text-rose-800' :
                                'bg-amber-50 border-amber-300 text-amber-800'
                              }`}
                            >
                              <option value="DU_TIET">Đủ tiết học (Bình thường)</option>
                              <option value="SPCP">Nghỉ phép cả ngày (SPCP)</option>
                              <option value="SP">Nghỉ phép buổi sáng (SP)</option>
                              <option value="CP">Nghỉ phép buổi chiều (CP)</option>
                              <option value="SKCK">Không phép cả ngày (SKCK)</option>
                              <option value="SK">Không phép buổi sáng (SK)</option>
                              <option value="CK">Không phép buổi chiều (CK)</option>
                              <option value="SPCK">Sáng có phép, Chiều không phép (SPCK)</option>
                              <option value="SKCP">Sáng không phép, Chiều có phép (SKCP)</option>
                              <option value="CUSTOM">Bỏ tiết / Tùy chọn (vd: C124, S12C34, SKC34)</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder="Nhập mã điểm danh (vd: C124, S12C34, SKC34)..."
                              value={currentStatus === 'DU_TIET' ? '' : currentStatus}
                              onChange={(e) => setAttendanceState({ ...attendanceState, [s.id]: e.target.value || 'DU_TIET' } as any)}
                              className="w-full text-xs font-mono font-bold p-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: QUẢN LÝ HỌC SINH                                                  */}
      {/* ========================================================================= */}
      {mainTab === 'students' && (
        <div className="space-y-3">
          
          {/* Top Controls Bar (Slim & Rearranged) */}
          <div className="bg-white p-2.5 px-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left Search Bar */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, mã HS, mã VnEdu, lớp..."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
              />
            </div>

            {/* Right Clean Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm thủ công</span>
              </button>

              <label className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Import Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportStudentsExcel}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => ExcelHelper.exportStudents(filteredManagementStudents, `Danh_Sach_Hoc_Sinh_${classAssigned}`)}
                className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tải về danh sách</span>
              </button>

              <button
                onClick={() => {
                  const sample = [
                    { "Họ và Tên": "Nguyễn Văn An", "Mã VnEdu": "2504195944", "Lớp": classAssigned, "Ngày Sinh": "17/11/2010", "Giới tính": "Nam", "Họ tên Phụ huynh": "Nguyễn Văn Hải", "Số Điện Thoại": "0912345678" }
                  ];
                  ExcelHelper.exportStudents(sample as any, 'Mau_Import_HocSinh');
                }}
                className="text-slate-600 hover:text-blue-600 underline font-medium px-2 py-1 transition cursor-pointer text-[11px]"
              >
                Tải mẫu Excel
              </button>

              <button
                onClick={() => setShowDeleteClassModal(true)}
                className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer text-[11px]"
                title={`Xóa danh sách lớp ${classAssigned}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa theo lớp</span>
              </button>

              <button
                onClick={() => setShowDeleteAllStudentsModal(true)}
                className="inline-flex items-center gap-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer text-[11px]"
                title="Xóa toàn bộ học sinh"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa tất cả</span>
              </button>
            </div>
          </div>

          {/* Main Table for Quản lý Học sinh (Compact & Max Visibility) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[11px] border-b border-slate-200">
                    <th className="p-2.5 w-10 text-center">STT</th>
                    <th className="p-2.5 w-28">MÃ HS</th>
                    <th className="p-2.5 w-28">MÃ VNEDU</th>
                    <th className="p-2.5">HỌ VÀ TÊN</th>
                    <th className="p-2.5 text-center w-16">LỚP</th>
                    <th className="p-2.5">GIỚI TÍNH / NGÀY SINH</th>
                    <th className="p-2.5 text-center">RÈN LUYỆN ({selectedMonth.replace('Tháng ', 'T')})</th>
                    <th className="p-2.5 text-center w-24">MẬT KHẨU</th>
                    <th className="p-2.5 text-center w-28">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredManagementStudents.map((s, index) => {
                    const sLogsMonth = db.LOGS_DISCIPLINE.filter(l => 
                      l.student_id === s.id && 
                      (l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth))
                    );
                    const totalMinus = sLogsMonth.filter(l => l.points < 0).reduce((acc, c) => acc + c.points, 0);
                    const totalPlus = sLogsMonth.filter(l => l.points > 0).reduce((acc, c) => acc + c.points, 0);
                    const currentScore = Math.max(0, Math.min(100, 100 + totalMinus + totalPlus));
                    const rating = getMonthlyRating(currentScore);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-2.5 text-center text-slate-400 font-medium">{index + 1}</td>
                        <td className="p-2.5 font-mono font-semibold text-slate-600">{s.id}</td>
                        <td className="p-2.5 font-mono text-slate-600 font-medium">{s.vneduId || s.vnedu_code || '---'}</td>
                        <td className="p-2.5 font-extrabold text-slate-900">{s.name}</td>
                        <td className="p-2.5 text-center">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px]">
                            {s.class}
                          </span>
                        </td>
                        <td className="p-2.5 font-medium text-slate-700">
                          {s.gender || 'Nam'} - {s.birth_date || (s as any).birthDate || '17/11/2010'}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full text-[11px]">
                              {currentScore}đ - {rating}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="bg-blue-50 border border-blue-200 text-blue-700 font-mono font-extrabold px-2 py-0.5 rounded-lg text-[11px]">
                            {s.password || '123456'}
                          </span>
                        </td>
                        {/* THAO TÁC Column: Edit, Delete & Print PDF buttons */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={async () => {
                                try {
                                  const doc = await PdfGenerator.generateStudentPdf(
                                    s,
                                    activeConfig,
                                    db.LOGS_DISCIPLINE,
                                    db.SCORE_RULES,
                                    db.ATTENDANCE,
                                    teacherProfile || undefined
                                  );
                                  doc.save(`Phieu_Lien_Lac_${s.class}_${s.name.replace(/\s+/g, '_')}.pdf`);
                                } catch (e: any) {
                                  alert('Lỗi xuất phiếu liên lạc PDF: ' + e.message);
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold px-2 py-0.5 rounded-lg transition cursor-pointer text-[11px]"
                              title="In/Tải phiếu liên lạc PDF"
                            >
                              <FileText className="w-3 h-3" />
                              <span>In phiếu</span>
                            </button>

                            <button
                              onClick={() => setEditingStudent({ ...s })}
                              className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold px-2 py-0.5 rounded-lg transition cursor-pointer text-[11px]"
                              title="Chỉnh sửa thông tin học sinh"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Sửa</span>
                            </button>

                            <button
                              onClick={() => setStudentToDelete(s)}
                              className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold px-2 py-0.5 rounded-lg transition cursor-pointer text-[11px]"
                              title="Xóa học sinh này"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & DIALOGS                                                          */}
      {/* ========================================================================= */}

      {/* 1. ADD STUDENT MODAL */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                THÊM HỌC SINH MỚI
              </h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Mã Học Sinh (Để trống để tự sinh)</label>
                  <input
                    type="text"
                    placeholder="VD: LB_11A12_01"
                    value={newStudent.id}
                    onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Mã VnEdu</label>
                  <input
                    type="text"
                    placeholder="VD: 2504195944"
                    value={newStudent.vnedu_code}
                    onChange={(e) => setNewStudent({ ...newStudent, vnedu_code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Họ và Tên Học Sinh *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nông Tuấn Anh"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Lớp</label>
                  <input
                    type="text"
                    required
                    value={newStudent.class}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Giới tính</label>
                  <select
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Ngày sinh</label>
                  <input
                    type="date"
                    value={newStudent.birth_date}
                    onChange={(e) => setNewStudent({ ...newStudent, birth_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Họ tên Phụ huynh</label>
                  <input
                    type="text"
                    placeholder="Tên phụ huynh..."
                    value={newStudent.parent_name}
                    onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    placeholder="SĐT..."
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mật khẩu tra cứu mặc định</label>
                <input
                  type="text"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-blue-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer shadow-xs"
                >
                  Lưu học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Pencil className="w-4 h-4" />
                CHỈNH SỬA THÔNG TIN HỌC SINH
              </h3>
              <button onClick={() => setEditingStudent(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Mã Học Sinh (Không sửa)</label>
                  <input
                    type="text"
                    disabled
                    value={editingStudent.id}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Mã VnEdu</label>
                  <input
                    type="text"
                    value={editingStudent.vnedu_code || editingStudent.vneduId || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, vnedu_code: e.target.value, vneduId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Họ và Tên Học Sinh *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Lớp</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.class}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Giới tính</label>
                  <select
                    value={editingStudent.gender || 'Nam'}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Ngày sinh</label>
                  <input
                    type="text"
                    value={editingStudent.birth_date || (editingStudent as any).birthDate || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, birth_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Họ tên Phụ huynh</label>
                  <input
                    type="text"
                    value={editingStudent.parent_name || (editingStudent as any).parentName || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, parent_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Số điện thoại</label>
                  <input
                    type="text"
                    value={editingStudent.phone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mật khẩu đăng nhập</label>
                <input
                  type="text"
                  value={editingStudent.password || '123456'}
                  onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-blue-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CONFIRM DELETE SINGLE STUDENT MODAL */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xác nhận xóa học sinh?</h3>
            </div>
            
            <div className="p-5 space-y-3">
              <p className="text-slate-700 font-medium">
                Bạn có chắc chắn muốn xóa bản ghi học sinh <strong className="text-slate-900">{studentToDelete.name}</strong> (<span className="font-mono">{studentToDelete.id}</span>) khỏi hệ thống?
              </p>
              
              <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-rose-700 text-[11px] leading-relaxed">
                ⚠️ Hành động này sẽ xóa đồng thời tất cả dữ liệu rèn luyện và lịch sử điểm danh của học sinh này.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeDeleteStudent}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONFIRM DELETE CLASS STUDENTS MODAL */}
      {showDeleteClassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xóa học sinh theo lớp</h3>
            </div>
            
            <div className="p-5 space-y-3">
              <p className="text-slate-700 font-medium">
                Bạn có chắc chắn muốn xóa toàn bộ học sinh thuộc <strong className="text-rose-700">Lớp {classAssigned}</strong>?
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteClassModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={executeDeleteClassStudents}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CONFIRM DELETE ALL STUDENTS MODAL */}
      {showDeleteAllStudentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xóa TOÀN BỘ học sinh</h3>
            </div>
            
            <div className="p-5 space-y-3">
              <p className="text-slate-700 font-medium">
                ⚠️ CẢNH BÁO: Bạn chuẩn bị xóa <strong className="text-rose-700">toàn bộ học sinh</strong> trong cơ sở dữ liệu trường học.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllStudentsModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={executeDeleteAllStudents}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa hết
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-1.5">
                <Key className="w-4 h-4 text-sky-400" />
                Đổi Mật Khẩu Cá Nhân
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer shadow-xs"
                >
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. PERSONAL SIGNATURE MODAL */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-1.5">
                <Signature className="w-4 h-4 text-emerald-400" />
                Cài Đặt Chữ Ký Số Cá Nhân (.PNG)
              </h3>
              <button onClick={() => setShowSignatureModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Hãy tải lên tệp ảnh chứa chữ ký cá nhân của bạn (Tốt nhất là tệp .PNG tách nền). Chữ ký sẽ được chèn tự động khi xuất Phiếu liên lạc.
              </p>

              <div className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center bg-slate-50">
                {signaturePreview ? (
                  <div className="space-y-2">
                    <img src={signaturePreview} alt="Signature Preview" className="mx-auto max-h-16 object-contain border border-slate-300 bg-white p-1 rounded" />
                    <span className="text-[10px] text-emerald-600 block font-semibold">✓ Đã thiết lập chữ ký số</span>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-400">
                    <Upload className="w-8 h-8 mx-auto text-slate-300" />
                    <span className="block text-[10.5px]">Kéo thả tệp hoặc nhấp để chọn...</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                  id="sig_file_input"
                />
                <label htmlFor="sig_file_input" className="mt-3 inline-block bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-1.5 rounded transition text-[10.5px] cursor-pointer">
                  Chọn ảnh chữ ký
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. STUDENT DISCIPLINE HISTORY LOG MODAL */}
      {selectedStudentLogs && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden text-xs">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" />
                Nhật Ký Rèn Luyện: {selectedStudentLogs.name} ({selectedStudentLogs.id})
              </h3>
              <button onClick={() => setSelectedStudentLogs(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
              {db.LOGS_DISCIPLINE.filter(l => l.student_id === selectedStudentLogs.id).length === 0 ? (
                <p className="text-center py-6 text-slate-400 italic">Học sinh chưa có ghi nhận vi phạm hay điểm thưởng rèn luyện nào.</p>
              ) : (
                db.LOGS_DISCIPLINE
                  .filter(l => l.student_id === selectedStudentLogs.id)
                  .map(log => {
                    const rule = db.SCORE_RULES.find(r => r.code === log.rule_code);
                    return (
                      <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="bg-blue-100 border border-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded font-mono text-[10px] mr-1.5">
                            {log.rule_code}
                          </span>
                          <span className="font-bold text-slate-800">{rule ? rule.name : ''}</span>
                          <p className="text-[10px] text-slate-500 mt-1">Ngày: {log.date} | Người ghi: {log.recorded_by}</p>
                          <p className="text-slate-600 italic mt-0.5">Ghi chú: "{log.notes}"</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditLog(log)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Sửa ghi nhận"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Xóa ghi nhận"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className={`font-extrabold text-sm ${log.points > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {log.points > 0 ? `+${log.points}` : log.points} đ
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="p-3 bg-slate-50 flex justify-end border-t border-slate-100">
              <button onClick={() => setSelectedStudentLogs(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg font-bold transition cursor-pointer">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA BẢN GHI RÈN LUYỆN */}
      {logToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-rose-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Xác Nhận Xóa Bản Ghi Rèn Luyện
              </h3>
              <button onClick={() => setLogToDelete(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-slate-700 font-medium">
                Bạn có chắc chắn muốn xóa bản ghi rèn luyện <strong>[{logToDelete.rule_code}]</strong> ngày <strong>{logToDelete.date}</strong> của học sinh?
              </p>
              <p className="text-slate-500 italic bg-amber-50 p-2.5 rounded border border-amber-200">
                Ghi chú: "{logToDelete.notes}" ({logToDelete.points > 0 ? `+${logToDelete.points}` : logToDelete.points}đ)
              </p>
            </div>
            <div className="p-3 bg-slate-50 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={() => setLogToDelete(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition cursor-pointer">
                Hủy bỏ
              </button>
              <button onClick={executeDeleteLog} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition cursor-pointer">
                Xóa bản ghi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA BẢN GHI RÈN LUYỆN */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="bg-blue-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Sửa Bản Ghi Rèn Luyện
              </h3>
              <button onClick={() => setEditingLog(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditLog} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày ghi nhận</label>
                  <input
                    type="date"
                    value={editLogDate}
                    onChange={(e) => setEditLogDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Điểm cộng / trừ</label>
                  <input
                    type="number"
                    value={editLogPoints}
                    onChange={(e) => setEditLogPoints(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã nội dung / Quy tắc</label>
                <input
                  type="text"
                  value={editLogRuleCode}
                  onChange={(e) => setEditLogRuleCode(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú chi tiết</label>
                <textarea
                  value={editLogNotes}
                  onChange={(e) => setEditLogNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditingLog(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition cursor-pointer">
                  Hủy bỏ
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. COMPLAINTS RESOLUTION MODAL */}
      {showComplaintsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-300" />
                ĐƠN KHIẾU NẠI ĐANG CHỜ GIẢI QUYẾT
              </h3>
              <button onClick={() => setShowComplaintsModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {pendingComplaints.length === 0 ? (
                <p className="text-center py-6 text-slate-400 italic">Lớp rèn luyện chủ nhiệm hiện không có đơn khiếu nại nào.</p>
              ) : (
                pendingComplaints.map(comp => {
                  const studObj = db.STUDENTS.find(s => s.id === comp.student_id);
                  const logObj = db.LOGS_DISCIPLINE.find(l => l.id === comp.log_id);
                  const ruleObj = logObj ? db.SCORE_RULES.find(r => r.code === logObj.rule_code) : null;

                  return (
                    <div key={comp.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                        <span className="font-bold text-slate-800">{studObj?.name} ({comp.student_id})</span>
                        <span className="text-[10px] text-slate-400">{comp.created_at}</span>
                      </div>

                      <div className="text-[10.5px] bg-amber-50 p-2 rounded text-slate-700">
                        <strong>Lỗi rèn luyện bị trừ:</strong> {ruleObj?.name} ({logObj?.points}đ)
                        <br />
                        <strong>Học sinh viết giải trình:</strong> "{comp.reason}"
                      </div>

                      <p className="text-[10px] text-rose-600 leading-relaxed font-semibold">
                        💡 Lưu ý: Báo Ban Giám Hiệu duyệt để tự động hoàn trả điểm số rèn luyện cho học sinh.
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. INPUT DRAWER FOR ADDING DISCIPLINE / MERITS LOGS */}
      {showLogModal && (
        <InputDrawer
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          db={db}
          recordedBy={username}
          termMonth={selectedMonth}
          defaultClass={classAssigned}
          onSave={handleSaveMultipleConductLogs}
        />
      )}

      {/* 11. HELP MODAL */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        defaultRole="Teacher"
      />

    </div>
  );
}
