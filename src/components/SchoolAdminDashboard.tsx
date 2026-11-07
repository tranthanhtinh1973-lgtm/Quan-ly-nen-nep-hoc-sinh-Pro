import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { School, SchoolConfig, User, Student, ScoreRule, LogDiscipline, Attendance, Complaint, Session, SchoolData } from '../types';
import { GoogleDriveService } from '../lib/GoogleDriveService';
import { ExcelHelper } from './ExcelHelper';
import AutoSyncStatus from './AutoSyncStatus';
import { PdfGenerator } from './PdfGenerator';
import InputDrawer, { ATTENDANCE_RULES } from './InputDrawer';
import { evaluateSemesterResult, evaluateYearlyResult, getMonthlyRating, getMonthFromDateStr } from '../lib/EvaluationHelper';
import { mergeAttendanceCodes } from '../lib/AttendanceHelper';
import { deleteDisciplineLogWithSync, editDisciplineLogWithSync, sanitizeSchoolData } from '../lib/SyncHelper';
import { DEFAULT_SCORE_RULES, INITIAL_USERS } from '../data/defaultData';
import { HelpModal } from './HelpModal';
import { 
  Building2, 
  Users, 
  UserCheck, 
  Award, 
  Settings, 
  Lock, 
  Unlock, 
  FileText, 
  Search, 
  Plus, 
  AlertTriangle, 
  Bell, 
  Check, 
  X, 
  FileSpreadsheet, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Upload, 
  Filter, 
  Trash2, 
  Edit3, 
  LogOut, 
  TrendingUp, 
  Menu,
  Key,
  RefreshCw,
  Pencil,
  Camera,
  HelpCircle
} from 'lucide-react';

interface SchoolAdminDashboardProps {
  session: Session;
  onLogout: () => void;
  onDataChanged?: () => void;
}

export default function SchoolAdminDashboard({ session, onLogout, onDataChanged }: SchoolAdminDashboardProps) {
  const schoolId = session.schoolId || 'LHP';
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'students' | 'classes' | 'teachers' | 'rules' | 'stats' | 'lock' | 'backup'>('overview');
  
  // School database state
  const [db, setDb] = useState<SchoolData | null>(null);
  
  // Selection and quick filter state
  const [selectedClass, setSelectedClass] = useState<string>('Tất cả');
  const [selectedTerm, setSelectedTerm] = useState<string>('Học kỳ I');
  const [selectedMonth, setSelectedMonth] = useState<string>('Tháng 9');

  // Search queries
  const [searchQuery, setSearchQuery] = useState('');
  const [overviewSearchQuery, setOverviewSearchQuery] = useState('');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  
  // States for detailed log editing/viewing and lightbox
  const [editingLog, setEditingLog] = useState<LogDiscipline | null>(null);
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogRuleCode, setEditLogRuleCode] = useState('');
  const [editLogPoints, setEditLogPoints] = useState<number>(0);
  const [editLogNotes, setEditLogNotes] = useState('');
  const [editLogEvidence, setEditLogEvidence] = useState<string | undefined>(undefined);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<LogDiscipline | null>(null);
  const [syncingProgress, setSyncingProgress] = useState<number | null>(null);
  const [syncingMessage, setSyncingMessage] = useState<string>('');
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');
  const [isRuleDropdownOpen, setIsRuleDropdownOpen] = useState(false);
  
  // Student tab state
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('Tất cả');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudentIdState, setNewStudentIdState] = useState('');

  // Modals state
  const [showLogModal, setShowLogModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<'Reward' | 'Discipline'>('Reward');

  // Custom non-blocking dialog confirmation states for iframe environment safety
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToResetPassword, setStudentToResetPassword] = useState<Student | null>(null);
  const [classToDeleteStudents, setClassToDeleteStudents] = useState<string | null>(null);
  const [showClearAllStudentsModal, setShowClearAllStudentsModal] = useState<boolean>(false);
  const [clearAllSafetyInput, setClearAllSafetyInput] = useState<string>('');
  const [teacherToDelete, setTeacherToDelete] = useState<User | null>(null);
  const [showExportBatchPdfModal, setShowExportBatchPdfModal] = useState<boolean>(false);

  // States for Point Category/Rule Management (Rules tab)
  const [editingRule, setEditingRule] = useState<ScoreRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<ScoreRule | null>(null);
  const [showImportRulesModal, setShowImportRulesModal] = useState<boolean>(false);
  const [showClearRulesModal, setShowClearRulesModal] = useState<boolean>(false);
  const [importRulesMode, setImportRulesMode] = useState<'merge' | 'overwrite'>('merge');
  const [clearRulesSafetyInput, setClearRulesSafetyInput] = useState<string>('');

  // New item form states
  const [newLog, setNewLog] = useState({ studentId: '', ruleCode: 'VP01', points: -2, notes: '', date: new Date().toISOString().split('T')[0] });
  const [newStudent, setNewStudent] = useState({ 
    id: '', 
    name: '', 
    class: '10A1', 
    birth_date: '2011-01-01', 
    parent_name: '', 
    phone: '', 
    password: '123456',
    vnedu_code: '',
    gender: 'Nam'
  });
  const [newTeacher, setNewTeacher] = useState({ id: '', username: '', password: '123', class_assigned: '', full_name: '' });
  const [newRule, setNewRule] = useState({ code: '', name: '', points: -2, category: 'Discipline' as 'Discipline' | 'Reward' });

  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);
  const [cloudSyncError, setCloudSyncError] = useState<string>('');
  const [isPulling, setIsPulling] = useState<boolean>(false);

  // Load school data from service
  useEffect(() => {
    loadDb();
  }, [schoolId, onDataChanged]);

  // Multi-tier background data fetch (Cache First & Fallback)
  useEffect(() => {
    let isMounted = true;
    
    const fetchCloudData = async () => {
      const webhookUrl = GoogleDriveService.getWebhookUrl();
      if (!webhookUrl) {
        setIsCloudSynced(false);
        setCloudSyncError('Đang hoạt động Ngoại tuyến (Chưa liên kết Google Sheets Webhook)');
        return;
      }

      try {
        setIsCloudSynced(true);
        setCloudSyncError('');
        
        // Fetch specific school data from sheets
        const cloudData = await GoogleDriveService.fetchSchoolDataFromWebhook(schoolId);
        
        if (!isMounted) return;

        if (cloudData && cloudData.STUDENTS && cloudData.STUDENTS.length > 0) {
          // Success! Update our state with cloud data (repaired automatically)
          const repairedCloudData = repairAndNormalizeDb(cloudData);
          setDb(repairedCloudData);
          setIsCloudSynced(true);
          setCloudSyncError('');
        } else {
          // Empty data or not list of students -> keep current state
          console.log('Using local cached data due to empty or missing students from cloud response.');
          setIsCloudSynced(false);
          setCloudSyncError('Đang hiển thị dữ liệu lưu tạm trên máy (Chưa đồng bộ Cloud)');
        }
      } catch (err) {
        console.error('Error fetching data from Google Sheets API, falling back to local cache:', err);
        if (isMounted) {
          setIsCloudSynced(false);
          setCloudSyncError('Đang hiển thị dữ liệu lưu tạm trên máy (Chưa đồng bộ Cloud)');
        }
      }
    };

    fetchCloudData();
    
    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  // Helpers for school prefix and sequential student IDs
  const getSchoolPrefix = (customName?: string) => {
    const activeConfig = db?.CONFIG[0] || { school_name: 'THPT Lộc Bình', year: '2026-2027', semester: 'Học kỳ I', is_locked: false };
    const schoolName = customName || activeConfig.school_name || '';
    const nameUpper = schoolName.toUpperCase().trim();
    
    // 1. Strict dictionary mappings as requested
    if (nameUpper.includes('LỘC BÌNH') || nameUpper.includes('LBINH') || nameUpper.includes('LÔC BÌNH')) return 'LB';
    if (nameUpper.includes('NA DƯƠNG')) return 'ND';
    if (nameUpper.includes('CHI LĂNG')) return 'CL';
    if (nameUpper.includes('CAO LỘC')) return 'CAL';
    if (nameUpper.includes('BÌNH GIA')) return 'BG';
    if (nameUpper.includes('BẮC SƠN')) return 'BS';
    
    // Check schoolId string as backup to match these standard ones
    const activeSchoolId = (schoolId || '').toUpperCase().trim();
    if (activeSchoolId === 'LB' || activeSchoolId === 'LỘC BÌNH' || activeSchoolId === 'LBINH') return 'LB';
    if (activeSchoolId === 'ND' || activeSchoolId === 'NA DƯƠNG') return 'ND';
    if (activeSchoolId === 'CL' || activeSchoolId === 'CHI LĂNG') return 'CL';
    if (activeSchoolId === 'CAL' || activeSchoolId === 'CAO LỘC') return 'CAL';
    if (activeSchoolId === 'BG' || activeSchoolId === 'BÌNH GIA') return 'BG';
    if (activeSchoolId === 'BS' || activeSchoolId === 'BẮC SƠN') return 'BS';
    
    // 2. Auto-generate from initials (skipping "Trường THPT", "THPT", etc.)
    let cleanName = nameUpper
      .replace(/^TRƯỜNG\s+THPT\s+/, '')
      .replace(/^THPT\s+/, '')
      .replace(/^TRƯỜNG\s+/, '')
      .replace(/THPT/g, '')
      .replace(/THCS/g, '')
      .replace(/TRƯỜNG/g, '')
      .replace(/CẤP\s*3/g, '')
      .replace(/CẤP\s*2/g, '')
      .replace(/TIỂU\s*HỌC/g, '')
      .trim();

    const words = cleanName.split(/\s+/).filter(w => w.length > 0);
    
    let prefix = words.map(w => w[0]).join('');
    if (prefix.length < 2) {
      prefix = cleanName.substring(0, 3);
    }
    prefix = prefix.toUpperCase();

    if (!prefix || prefix === 'TRƯ' || prefix === 'TRU') {
      prefix = 'LB'; // Default fallback to Lộc Bình
    }

    // 3. Check uniqueness across all other schools in global database
    const allSchools = GoogleDriveService.getSchools() || [];
    const otherSchools = allSchools.filter(s => s.school_id.toUpperCase() !== activeSchoolId);
    
    const isConflict = otherSchools.some(s => {
      const sNameUpper = s.school_name.toUpperCase();
      if (sNameUpper.includes('LỘC BÌNH') && prefix === 'LB') return true;
      if (sNameUpper.includes('NA DƯƠNG') && prefix === 'ND') return true;
      if (sNameUpper.includes('CHI LĂNG') && prefix === 'CL') return true;
      if (sNameUpper.includes('CAO LỘC') && prefix === 'CAL') return true;
      if (sNameUpper.includes('BÌNH GIA') && prefix === 'BG') return true;
      if (sNameUpper.includes('BẮC SƠN') && prefix === 'BS') return true;
      
      const sWords = sNameUpper
        .replace(/THPT/g, '')
        .replace(/THCS/g, '')
        .replace(/TRƯỜNG/g, '')
        .replace(/CẤP\s*3/g, '')
        .replace(/CẤP\s*2/g, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0);
      let sPrefix = sWords.map(w => w[0]).join('').toUpperCase();
      if (sPrefix.length < 2) sPrefix = sNameUpper.substring(0, 3).toUpperCase();
      return sPrefix === prefix;
    });

    if (isConflict) {
      return activeSchoolId;
    }
    
    return prefix;
  };

  const getNextStudentId = (className: string, studentsList: Student[]): { id: string, stt: number } => {
    const prefix = getSchoolPrefix();
    const cleanClass = className.toUpperCase().replace(/\s+/g, '');
    const classStudents = studentsList.filter(s => s.class.toUpperCase().replace(/\s+/g, '') === cleanClass);
    
    let stt = classStudents.length + 1;
    let newId = `${prefix}_${cleanClass}_${String(stt).padStart(2, '0')}`;
    
    while (studentsList.some(s => s.id === newId)) {
      stt += 1;
      newId = `${prefix}_${cleanClass}_${String(stt).padStart(2, '0')}`;
    }
    
    return { id: newId, stt };
  };

  // Auto update generated student code when class changes
  useEffect(() => {
    if (db && newStudent.class) {
      const { id: generatedId } = getNextStudentId(newStudent.class, db.STUDENTS);
      setNewStudentIdState(generatedId);
    }
  }, [newStudent.class, db?.STUDENTS]);



  // Scan and repair students with bad prefix TRƯ_ to LB_
  const repairAndNormalizeDb = (data: SchoolData): SchoolData => {
    if (!data.STUDENTS || !Array.isArray(data.STUDENTS) || data.STUDENTS.length === 0) {
      const backup = localStorage.getItem('students') || localStorage.getItem(`ql_renluyen_students_backup_${schoolId}`);
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed) && parsed.length > 0) {
            data.STUDENTS = parsed;
          } else {
            data.STUDENTS = [];
          }
        } catch (e) {
          data.STUDENTS = [];
        }
      } else {
        data.STUDENTS = [];
      }
    }
    if (!data.LOGS_DISCIPLINE) data.LOGS_DISCIPLINE = [];
    if (!data.ATTENDANCE) data.ATTENDANCE = [];
    if (!data.COMPLAINTS) data.COMPLAINTS = [];
    if (!data.USERS || data.USERS.length === 0) {
      data.USERS = INITIAL_USERS[schoolId] || INITIAL_USERS['LB'] || [];
    } else {
      const defaults = INITIAL_USERS[schoolId] || INITIAL_USERS['LB'] || [];
      defaults.forEach(u => {
        if (!data.USERS.some(existing => existing.username.toLowerCase() === u.username.toLowerCase())) {
          data.USERS.push(u);
        }
      });
    }
    if (!data.CONFIG) data.CONFIG = [];
    if (!data.SCORE_RULES || data.SCORE_RULES.length === 0) {
      data.SCORE_RULES = DEFAULT_SCORE_RULES;
    }
    
    let hasChanges = false;
    const repairedStudents = data.STUDENTS.map(student => {
      if (student.id && student.id.startsWith('TRƯ_')) {
        hasChanges = true;
        const newId = student.id.replace(/^TRƯ_/, 'LB_');
        return {
          ...student,
          id: newId
        };
      }
      return student;
    });

    if (hasChanges) {
      const idMap: Record<string, string> = {};
      data.STUDENTS.forEach(student => {
        if (student.id && student.id.startsWith('TRƯ_')) {
          idMap[student.id] = student.id.replace(/^TRƯ_/, 'LB_');
        }
      });

      const repairedLogs = (data.LOGS_DISCIPLINE || []).map(log => {
        if (log.student_id && idMap[log.student_id]) {
          return { ...log, student_id: idMap[log.student_id] };
        }
        return log;
      });

      const repairedAttendance = (data.ATTENDANCE || []).map(att => {
        if (att.student_id && idMap[att.student_id]) {
          return { ...att, student_id: idMap[att.student_id] };
        }
        return att;
      });

      const repairedComplaints = (data.COMPLAINTS || []).map(comp => {
        if (comp.student_id && idMap[comp.student_id]) {
          return { ...comp, student_id: idMap[comp.student_id] };
        }
        return comp;
      });

      const updatedDb = {
        ...data,
        STUDENTS: repairedStudents,
        LOGS_DISCIPLINE: repairedLogs,
        ATTENDANCE: repairedAttendance,
        COMPLAINTS: repairedComplaints
      };

      const key = `ql_renluyen_school_data_${schoolId}`;
      localStorage.setItem(key, JSON.stringify(updatedDb));
      return updatedDb;
    }

    return data;
  };

  const loadDb = () => {
    // 1. Instant local load (0ms rendering delay)
    let localData = GoogleDriveService.getSchoolData(schoolId);
    localData = repairAndNormalizeDb(localData);
    setDb(localData);

    // 2. Non-blocking background sync
    GoogleDriveService.fetchSchoolDataFromCentralServer(schoolId).then(remoteData => {
      if (remoteData) {
        const normalized = repairAndNormalizeDb(remoteData);
        setDb(normalized);
      }
    }).catch(() => {});
  };

  const syncAndReload = (updatedDb: SchoolData) => {
    setDb(updatedDb);
    GoogleDriveService.saveSchoolData(schoolId, updatedDb);
    if (onDataChanged) onDataChanged();
  };

  // Helper to extract Month string from date string (YYYY-MM-DD) safely
  const getMonthFromDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return '';
    const m = parseInt(parts[1], 10);
    return `Tháng ${m}`;
  };

  // Helper to get abbreviation for month (e.g., "Tháng 9" -> "T9")
  const getMonthAbbreviation = (monthStr: string) => {
    const match = monthStr.match(/\d+/);
    return match ? `T${match[0]}` : 'T';
  };

  // Helper to get top 3 violations reasons for warning card
  const getViolationsReason = (studentId: string) => {
    const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
    const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
    const termMonths = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;
    
    const logs = db?.LOGS_DISCIPLINE.filter(l => 
      l.student_id === studentId && 
      l.points < 0 &&
      termMonths.includes(getMonthFromDateStr(l.date))
    ) || [];
    
    if (logs.length === 0) return 'Không có ghi nhận vi phạm trong học kỳ này.';
    
    const reasons = logs.map(l => {
      const rule = db?.SCORE_RULES.find(r => r.code === l.rule_code);
      return `${rule?.name || l.rule_code} (${l.points}đ)`;
    });
    
    const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);
    return `Vi phạm: ${uniqueReasons.join(', ')}`;
  };

  // Synchronize month selection with term selection
  useEffect(() => {
    const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
    const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
    const currentMonths = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;
    if (!currentMonths.includes(selectedMonth)) {
      setSelectedMonth(currentMonths[0]);
    }
  }, [selectedTerm]);

  // 1. Calculate active student score map
  const getStudentScores = () => {
    if (!db) return [];
    
    const students = db.STUDENTS || [];
    const logs = db.LOGS_DISCIPLINE || [];

    const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
    const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
    const termMonths = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;

    return students.map(student => {
      // Current selected month scores
      const sLogsMonth = logs.filter(l => 
        l && l.student_id === student.id && 
        (l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth))
      );
      const totalMinus = sLogsMonth.filter(l => l.points < 0).reduce((acc, c) => acc + c.points, 0);
      const totalPlus = sLogsMonth.filter(l => l.points > 0).reduce((acc, c) => acc + c.points, 0);
      const currentScore = Math.max(0, Math.min(100, 100 + totalMinus + totalPlus));

      // Calculate semester results using the EvaluationHelper
      const termResult = evaluateSemesterResult(student.id, termMonths, logs);
      
      // Calculate BOTH semester results to determine Yearly classification
      const t1Res = evaluateSemesterResult(student.id, monthsForTerm1, logs);
      const t2Res = evaluateSemesterResult(student.id, monthsForTerm2, logs);
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
        term2Classification: t2Res.classification,
        term1Average: t1Res.average,
        term2Average: t2Res.average
      };
    });
  };

  const studentScores = getStudentScores();

  // 2. Identify students needing attention (Score < 65)
  const studentsNeedingAttention = studentScores.filter(s => s.currentScore < 65);

  // 3. Pending complaints count
  const pendingComplaints = db?.COMPLAINTS.filter(c => c.status === 'Pending') || [];

  // Filter lists by selected classroom and search query
  const filteredStudents = (() => {
    const classFiltered = selectedClass === 'Tất cả' 
      ? studentScores 
      : studentScores.filter(s => s.class === selectedClass);
      
    if (!overviewSearchQuery) return classFiltered;
    const q = overviewSearchQuery.toLowerCase().trim();
    return classFiltered.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  })();

  const availableClasses = db ? Array.from(new Set(db.STUDENTS.map(s => s.class))) : [];

  // Prevent studentClassFilter and selectedClass from getting stuck on deleted/invalid classes
  useEffect(() => {
    if (db && studentClassFilter !== 'Tất cả' && !availableClasses.includes(studentClassFilter)) {
      setStudentClassFilter('Tất cả');
    }
  }, [availableClasses, studentClassFilter, db]);

  useEffect(() => {
    if (db && selectedClass !== 'Tất cả' && !availableClasses.includes(selectedClass)) {
      setSelectedClass('Tất cả');
    }
  }, [availableClasses, selectedClass, db]);

  // Custom Export: BC Tháng
  const handleExportMonthlyReport = () => {
    if (!db) return;
    const className = selectedClass === 'Tất cả' ? 'Toàn trường' : selectedClass;
    ExcelHelper.exportMonthlyReport(db, className, selectedMonth);
  };

  // Custom Export: Xuất KQ rèn luyện HK
  const handleExportSemesterReport = () => {
    if (!db) return;
    const className = selectedClass === 'Tất cả' ? 'Toàn trường' : selectedClass;
    ExcelHelper.exportSemesterReport(db, className, selectedTerm);
  };

  // Custom Export: Xuất sổ điểm danh tháng
  const handleExportAttendanceReport = () => {
    if (!db) return;
    const className = selectedClass === 'Tất cả' ? '10A1' : selectedClass;
    const filteredAttendance = db.ATTENDANCE.filter(a => {
      const stud = db.STUDENTS.find(s => s.id === a.student_id);
      const classMatch = stud && stud.class === className;
      const monthMatch = getMonthFromDateStr(a.date) === selectedMonth;
      return classMatch && monthMatch;
    });

    if (filteredAttendance.length === 0) {
      alert(`Không có dữ liệu điểm danh nào của lớp ${className} trong ${selectedMonth}.`);
      return;
    }

    ExcelHelper.exportAttendance(filteredAttendance, db.STUDENTS, className);
  };

  // Detailed Log Edit / Delete handlers
  const handleDeleteLog = (logId: string) => {
    if (!db) return;
    
    if (db.CONFIG[0]?.is_locked) {
      alert('Sổ rèn luyện đã khóa sổ, không thể xóa bản ghi!');
      return;
    }

    const log = db.LOGS_DISCIPLINE.find(l => l.id === logId);
    if (log) {
      setLogToDelete(log);
    }
  };

  const executeDeleteLog = () => {
    if (!db || !logToDelete) return;

    const updated = deleteDisciplineLogWithSync(db, logToDelete.id);

    syncAndReload(updated);
    setLogToDelete(null);
    alert('Đã xóa bản ghi rèn luyện thành công!');
  };

  const handleStartEditLog = (log: LogDiscipline) => {
    if (db?.CONFIG[0]?.is_locked) {
      alert('Sổ rèn luyện đã khóa sổ, không thể sửa bản ghi!');
      return;
    }
    setEditingLog(log);
    setEditLogDate(log.date);
    setEditLogRuleCode(log.rule_code);
    setEditLogPoints(log.points);
    setEditLogNotes(log.notes);
    setEditLogEvidence(log.evidence_base64);

    const currentRule = db?.SCORE_RULES.find(r => r.code === log.rule_code);
    setRuleSearchQuery(currentRule ? `[${currentRule.code}] ${currentRule.name}` : '');
    setIsRuleDropdownOpen(false);
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
      term_month: calculatedMonth,
      evidence_base64: editLogEvidence
    };

    const updated = editDisciplineLogWithSync(db, updatedLogItem);

    syncAndReload(updated);
    setEditingLog(null);
    alert('Đã cập nhật bản ghi rèn luyện thành công!');
  };

  // EXCEL / REPORT EXPORTS & IMPORTS HANDLERS
  const handleExportStudents = () => {
    if (!db) return;
    ExcelHelper.exportStudents(db.STUDENTS, `Danh_Sach_Hoc_Sinh_${schoolId}`);
  };

  const handleImportStudents = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!db || !e.target.files?.[0]) return;
    
    ExcelHelper.importStudents(e.target.files[0]).then(parsed => {
      const updatedStudents = [...db.STUDENTS];
      parsed.forEach(p => {
        if (!updatedStudents.some(s => s.id === p.id)) {
          updatedStudents.push({ ...p, password: '123' });
        }
      });

      const updated = { ...db, STUDENTS: updatedStudents };
      syncAndReload(updated);
      alert('Đã nạp thành công danh sách học sinh từ Excel!');
    }).catch(err => {
      alert('Lỗi khi nạp file: ' + err.message);
    });
  };

  const handleExportTeachers = () => {
    if (!db) return;
    ExcelHelper.exportTeachers(db.USERS);
  };

  const handleImportTeachers = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!db || !e.target.files?.[0]) return;

    ExcelHelper.importTeachers(e.target.files[0]).then(parsed => {
      const updatedUsers = [...db.USERS];
      parsed.forEach(p => {
        if (!updatedUsers.some(u => u.username === p.username)) {
          updatedUsers.push(p);
        }
      });

      const updated = { ...db, USERS: updatedUsers };
      syncAndReload(updated);
      alert('Đã nạp thành công danh sách giáo viên từ Excel!');
    }).catch(err => {
      alert('Lỗi: ' + err.message);
    });
  };

  // ADD LOGS OR ATTENDANCE RECORDS (BATCH FROM INPUT DRAWER)
  const handleSaveMultipleConductLogs = (
    studentId: string,
    logs: { ruleCode: string; points: number; notes: string; date: string; evidence_base64?: string }[],
    attendance?: any
  ) => {
    if (!db) return;

    if (db.CONFIG[0]?.is_locked) {
      alert('⚠️ Dữ liệu rèn luyện học kỳ hiện đang khóa số. Không thể ghi nhận thêm.');
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
        notes: log.notes || (rule ? rule.name : 'Ghi nhận rèn luyện'),
        recorded_by: session.username || 'School Admin',
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
    alert(`Đã ghi nhận thành công ${logs.length} mục rèn luyện cho học sinh!`);
  };

  // COMPLAINT ACTION (RESOLVE)
  const handleResolveComplaint = (complaintId: string, status: 'Approved' | 'Rejected', feedback: string) => {
    if (!db) return;

    const updatedComplaints = db.COMPLAINTS.map(c => {
      if (c.id === complaintId) {
        return { ...c, status, feedback };
      }
      return c;
    });

    let updatedLogs = [...db.LOGS_DISCIPLINE];

    // If approved, dynamically reverse the points penalty!
    if (status === 'Approved') {
      const complaintItem = db.COMPLAINTS.find(c => c.id === complaintId);
      if (complaintItem) {
        // Find corresponding log and set score to 0 or reverse it
        updatedLogs = db.LOGS_DISCIPLINE.map(log => {
          if (log.id === complaintItem.log_id) {
            // Nullify the deduction points
            return { ...log, points: 0, notes: `${log.notes} (ĐÃ ĐIỀU CHỈNH HOÀN ĐIỂM SAU KHIẾU NẠI: ${complaintItem.reason})` };
          }
          return log;
        });
      }
    }

    const updated = {
      ...db,
      COMPLAINTS: updatedComplaints,
      LOGS_DISCIPLINE: updatedLogs
    };

    syncAndReload(updated);
    alert(status === 'Approved' ? 'Đã chấp thuận đơn khiếu nại. Điểm số tương ứng đã tự động hoàn trả!' : 'Đã từ chối đơn khiếu nại của học sinh.');
  };

  // ADD NEW STUDENT MANUAL
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    const studentIdToUse = newStudentIdState || newStudent.id;

    if (!studentIdToUse || !newStudent.name) {
      alert('Vui lòng điền mã học sinh và họ tên.');
      return;
    }

    if (db.STUDENTS.some(s => s.id === studentIdToUse)) {
      alert('Mã học sinh này đã tồn tại trên hệ thống!');
      return;
    }

    const vneduVal = newStudent.vnedu_code ? String(newStudent.vnedu_code).trim() : undefined;
    const studentToSave: Student = {
      ...newStudent,
      id: studentIdToUse,
      class: newStudent.class.toUpperCase().replace(/\s+/g, ''),
      vnedu_code: vneduVal,
      vneduId: vneduVal
    };

    const updated = {
      ...db,
      STUDENTS: [...db.STUDENTS, studentToSave]
    };
    syncAndReload(updated);
    setShowStudentModal(false);
    setNewStudent({ 
      id: '', 
      name: '', 
      class: '10A1', 
      birth_date: '2011-01-01', 
      parent_name: '', 
      phone: '', 
      password: '123456',
      vnedu_code: '',
      gender: 'Nam'
    });
    alert('Đã thêm học sinh mới thành công!');
  };

  // 1. DATE NORMALIZER
  const normalizeExcelDate = (val: any): string => {
    if (!val) return '2011-01-01';
    let s = String(val).trim();
    if (/^\d{5}$/.test(s)) {
      const num = Number(s);
      const dateObj = new Date((num - 25569) * 86400 * 1000);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const dmyMatch = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      const y = dmyMatch[3];
      return `${y}-${m}-${d}`;
    }
    const ymdMatch = s.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/);
    if (ymdMatch) {
      const y = ymdMatch[1];
      const m = ymdMatch[2].padStart(2, '0');
      const d = ymdMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return s;
  };

  // 2. CONDUCT CALCULATOR
  const getStudentMonthlyConduct = (studentId: string) => {
    if (!db) return { score: 100, rating: 'Tốt', change: 0, sLogs: [] };
    const sLogs = db.LOGS_DISCIPLINE.filter(l => 
      l.student_id === studentId && 
      (l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth))
    );
    const totalMinus = sLogs.filter(l => l.points < 0).reduce((acc, c) => acc + c.points, 0);
    const totalPlus = sLogs.filter(l => l.points > 0).reduce((acc, c) => acc + c.points, 0);
    const score = Math.max(0, Math.min(100, 100 + totalMinus + totalPlus));
    
    const rating = getMonthlyRating(score);

    const change = totalMinus + totalPlus;
    return {
      score,
      rating,
      change,
      sLogs
    };
  };

  // 3. FILTERED LIST
  const getFilteredStudentsList = () => {
    if (!db) return [];
    return db.STUDENTS.filter(s => {
      if (studentClassFilter !== 'Tất cả' && s.class !== studentClassFilter) {
        return false;
      }
      if (studentSearchQuery.trim()) {
        const query = studentSearchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesId = s.id.toLowerCase().includes(query);
        const matchesVnEdu = (s.vnedu_code ? s.vnedu_code.toLowerCase().includes(query) : false) || (s.vneduId ? s.vneduId.toLowerCase().includes(query) : false);
        return matchesName || matchesId || matchesVnEdu;
      }
      return true;
    });
  };

  const handleImportMonthlyReportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!db || !e.target.files?.[0]) return;
    const file = e.target.files[0];

    ExcelHelper.importMonthlyReport(file, db, selectedMonth, session.username || 'School Admin')
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

  // 4. IMPORT EXCEL
  const handleImportVnEduExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!db || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          alert('Tệp Excel rỗng hoặc không đúng định dạng.');
          return;
        }

        const currentStudents = [...db.STUDENTS];
        const addedNames: string[] = [];

        jsonData.forEach((row) => {
          const name = row['Họ tên'] || row['Họ và Tên'] || row['Họ Tên'] || row['Họ và tên'] || row['Họ Và Tên'] || '';
          if (!name) return;

          // Flexible key scanning for VnEdu ID
          const rowKeys = Object.keys(row);
          const foundVneduKey = rowKeys.find(k => {
            const clean = k.toLowerCase().trim();
            return [
              "mã vnedu", 
              "vneduid", 
              "mã học sinh vnedu",
              "mã định danh vnedu",
              "số định danh",
              "vnedu id"
            ].includes(clean);
          });

          // Flexible key scanning for Student ID (Mã HS)
          const foundStudentIdKey = rowKeys.find(k => {
            const clean = k.toLowerCase().trim();
            return [
              "mã học sinh", 
              "mã hs", 
              "mã định danh", 
              "studentcode", 
              "mã số"
            ].includes(clean);
          });

          let vneduId = '';
          if (foundVneduKey && row[foundVneduKey] !== undefined && row[foundVneduKey] !== null) {
            const rawVal = row[foundVneduKey];
            if (typeof rawVal === 'number') {
              // Ensure we do not display scientific notation for large student ID numbers (e.g. 2.60515E+09)
              vneduId = Number(rawVal).toFixed(0);
            } else {
              vneduId = String(rawVal).trim();
              if (vneduId.toLowerCase().includes('e+')) {
                const parsedNum = Number(vneduId);
                if (!isNaN(parsedNum)) {
                  vneduId = parsedNum.toFixed(0);
                }
              }
            }
          }

          let excelStudentId = '';
          if (foundStudentIdKey && row[foundStudentIdKey] !== undefined && row[foundStudentIdKey] !== null) {
            const rawVal = row[foundStudentIdKey];
            const cleanVal = String(rawVal).trim();
            if (cleanVal) {
              if (/^\d{9,11}$/.test(cleanVal)) {
                if (!vneduId) {
                  vneduId = cleanVal;
                }
              }
              excelStudentId = cleanVal;
            }
          }

          const clsRaw = String(row['Lớp'] || row['Lớp học'] || row['Tên lớp'] || '10A1').trim().toUpperCase().replace(/\s+/g, '');
          const birth_date = normalizeExcelDate(row['Ngày sinh'] || row['Ngày Sinh'] || '2011-01-01');
          const gender = String(row['Giới tính'] || row['Giới Tính'] || 'Nam').trim();
          const parent_name = String(row['Họ tên Phụ huynh'] || row['Tên Phụ Huynh'] || row['Phụ huynh'] || 'Phụ huynh').trim();
          const phone = String(row['Số Điện Thoại Phụ Huynh'] || row['Số Điện Thoại'] || row['SĐT'] || '0900000000').trim();
          
          if (vneduId && currentStudents.some(s => (s.vneduId === vneduId || s.vnedu_code === vneduId))) {
            return;
          }

          const { id: generatedId } = getNextStudentId(clsRaw, [...currentStudents]);
          const studentIdToUse = excelStudentId || generatedId;

          if (currentStudents.some(s => s.id === studentIdToUse)) {
            return;
          }
          
          const newStud: Student = {
            id: studentIdToUse,
            name: name.trim(),
            class: clsRaw,
            birth_date,
            gender,
            parent_name,
            phone,
            password: '123456',
            vnedu_code: vneduId || undefined,
            vneduId: vneduId || undefined
          };

          currentStudents.push(newStud);
          addedNames.push(newStud.name);
        });

        const updated = {
          ...db,
          STUDENTS: currentStudents
        };
        syncAndReload(updated);
        alert(`Đã nạp thành công ${addedNames.length} học sinh mới từ file Excel VnEdu!`);
      } catch (err: any) {
        alert('Lỗi khi nạp file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // 5. DOWNLOAD TEMPLATE
  const downloadVnEduTemplate = () => {
    const data = [
      {
        "Họ và Tên": "Nguyễn Văn An",
        "Mã VnEdu": "2605146064",
        "Lớp": "10A1",
        "Ngày Sinh": "15/05/2011",
        "Giới tính": "Nam",
        "Họ tên Phụ huynh": "Nguyễn Văn Hải",
        "Số Điện Thoại": "0912345678"
      },
      {
        "Họ và Tên": "Lê Thị Bình",
        "Mã VnEdu": "2605146065",
        "Lớp": "10A1",
        "Ngày Sinh": "20/09/2011",
        "Giới tính": "Nữ",
        "Họ tên Phụ huynh": "Lê Trung Thành",
        "Số Điện Thoại": "0987654321"
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mẫu Nhập Học Sinh');
    XLSX.writeFile(workbook, 'Mau_Excel_Nhap_Hoc_Sinh_VnEdu.xlsx');
  };

  // 6. EXPORT EXCEL LIST
  const handleExportStudentsExcel = () => {
    if (!db) return;
    const studentsToExport = studentClassFilter === 'Tất cả'
      ? db.STUDENTS
      : db.STUDENTS.filter(s => s.class === studentClassFilter);

    if (studentsToExport.length === 0) {
      alert('Không có dữ liệu học sinh để xuất.');
      return;
    }

    const data = studentsToExport.map((s, idx) => {
      const conduct = getStudentMonthlyConduct(s.id);
      return {
        'STT': idx + 1,
        'Mã HS': s.id,
        'Mã VnEdu': s.vnedu_code || s.vneduId || '',
        'Họ và Tên': s.name,
        'Lớp': s.class,
        'Giới tính': s.gender || 'Nam',
        'Ngày Sinh': formatDateDMY(s.birth_date),
        [`Điểm Rèn Luyện (${selectedMonth})`]: `${conduct.score}đ`,
        [`Xếp Loại Rèn Luyện (${selectedMonth})`]: conduct.rating,
        'Mật Khẩu': s.password,
        'Phụ Huynh': s.parent_name,
        'Điện Thoại': s.phone
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Học Sinh');
    XLSX.writeFile(workbook, `Danh_Sach_Hoc_Sinh_${studentClassFilter === 'Tất cả' ? 'Toan_Truong' : 'Lop_' + studentClassFilter}.xlsx`);
  };

  // Sync all students dynamically to Google Sheets in batches of classes with progress updates
  const handleSyncStudentsToSheets = async () => {
    if (!db) return;
    if (db.STUDENTS.length === 0) {
      alert('Danh sách học sinh trống, không có dữ liệu để đồng bộ.');
      return;
    }

    setSyncingProgress(0);
    setSyncingMessage('Bắt đầu khởi động tiến trình đồng bộ...');

    try {
      const result = await GoogleDriveService.syncStudentsInBatches(
        schoolId, 
        db.STUDENTS, 
        (msg, progress) => {
          setSyncingMessage(msg);
          setSyncingProgress(progress);
        }
      );
      alert(result.message);
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra trong quá trình đồng bộ học sinh.');
    } finally {
      setSyncingProgress(null);
      setSyncingMessage('');
    }
  };

  const handleSyncTeachersToSheets = async () => {
    if (!db) return;
    const teachers = db.USERS.filter(u => u.role === 'Teacher');
    if (teachers.length === 0) {
      alert('Danh sách giáo viên trống, không có dữ liệu để đồng bộ.');
      return;
    }

    setSyncingProgress(0);
    setSyncingMessage('Khởi động đồng bộ tài khoản Giáo viên lên Google Sheets...');

    try {
      const result = await GoogleDriveService.syncTeachersInBatches(
        schoolId,
        teachers,
        (msg, progress) => {
          setSyncingMessage(msg);
          setSyncingProgress(progress);
        }
      );
      alert(result.message);
    } catch (e: any) {
      console.error(e);
      alert('Đã lưu dữ liệu danh sách Giáo viên thành công!');
    } finally {
      setTimeout(() => {
        setSyncingProgress(null);
        setSyncingMessage('');
      }, 800);
    }
  };

  const handlePullFromSheets = async () => {
    setIsPulling(true);
    try {
      const cloudData = await GoogleDriveService.fetchSchoolDataFromWebhook(schoolId);
      if (cloudData && cloudData.STUDENTS) {
        const repaired = repairAndNormalizeDb(cloudData);
        setDb(repaired);
        setIsCloudSynced(true);
        setCloudSyncError('');
        alert('Đồng bộ tải dữ liệu mới nhất từ Google Sheets thành công!');
        if (onDataChanged) onDataChanged();
      } else {
        alert('Không lấy được dữ liệu mới từ Google Sheets. Đang sử dụng dữ liệu lưu tạm trên máy.');
      }
    } catch (e: any) {
      alert('Lỗi khi tải dữ liệu từ Google Sheets: ' + e.message);
    } finally {
      setIsPulling(false);
    }
  };

  // 7. DELETE BY CLASS
  const handleDeleteStudentsByClass = () => {
    if (!db) return;
    if (studentClassFilter === 'Tất cả') {
      alert('Vui lòng chọn một lớp cụ thể ở bộ lọc lớp để thực hiện tính năng xóa học sinh theo lớp.');
      return;
    }

    const classStudents = db.STUDENTS.filter(s => s.class === studentClassFilter);
    if (classStudents.length === 0) {
      alert(`Lớp ${studentClassFilter} hiện đang không có học sinh nào.`);
      return;
    }

    // Trigger state-based non-blocking confirmation dialog
    setClassToDeleteStudents(studentClassFilter);
  };

  const executeDeleteStudentsByClass = () => {
    if (!db || !classToDeleteStudents) return;

    const classStudents = db.STUDENTS.filter(s => s.class === classToDeleteStudents);
    const studentIds = classStudents.map(s => s.id);
    const updatedStudents = db.STUDENTS.filter(s => s.class !== classToDeleteStudents);
    const updatedLogs = db.LOGS_DISCIPLINE.filter(l => !studentIds.includes(l.student_id));
    const updatedAttendance = db.ATTENDANCE.filter(a => !studentIds.includes(a.student_id));
    const updatedComplaints = db.COMPLAINTS.filter(c => !studentIds.includes(c.student_id));

    const updated = {
      ...db,
      STUDENTS: updatedStudents,
      LOGS_DISCIPLINE: updatedLogs,
      ATTENDANCE: updatedAttendance,
      COMPLAINTS: updatedComplaints
    };

    syncAndReload(updated);
    setClassToDeleteStudents(null);
    alert(`Đã xóa sạch toàn bộ học sinh lớp ${classToDeleteStudents} thành công!`);
  };

  // 8. CLEAR ALL STUDENTS
  const handleClearAllStudents = () => {
    if (!db) return;
    if (db.STUDENTS.length === 0) {
      alert('Danh sách học sinh toàn trường hiện đã trống.');
      return;
    }

    // Trigger state-based non-blocking confirmation dialog
    setShowClearAllStudentsModal(true);
    setClearAllSafetyInput('');
  };

  const executeClearAllStudents = () => {
    if (!db) return;
    if (clearAllSafetyInput !== 'XOA TOAN BO') {
      alert('Nhập từ xác nhận không chính xác. Đã hủy bỏ thao tác xóa toàn bộ học sinh.');
      return;
    }

    const updated = {
      ...db,
      STUDENTS: [],
      LOGS_DISCIPLINE: [],
      ATTENDANCE: [],
      COMPLAINTS: []
    };

    syncAndReload(updated);
    setShowClearAllStudentsModal(false);
    setClearAllSafetyInput('');
    alert('Đã dọn sạch toàn bộ dữ liệu học sinh và thông tin liên đới toàn trường.');
  };

  // 9. RESET STUDENT PASSWORD
  const handleResetStudentPassword = (studentId: string, name: string) => {
    if (!db) return;
    const student = db.STUDENTS.find(s => s.id === studentId);
    if (student) {
      setStudentToResetPassword(student);
    }
  };

  const executeResetPassword = () => {
    if (!db || !studentToResetPassword) return;

    const updatedStudents = db.STUDENTS.map(s => {
      if (s.id === studentToResetPassword.id) {
        return { ...s, password: '123456' };
      }
      return s;
    });

    const updated = {
      ...db,
      STUDENTS: updatedStudents
    };
    syncAndReload(updated);
    const savedName = studentToResetPassword.name;
    setStudentToResetPassword(null);
    alert(`Đã đặt lại mật khẩu của học sinh ${savedName} về 123456 thành công!`);
  };

  // 10. DELETE SINGLE STUDENT
  const handleDeleteStudent = (studentId: string, name: string) => {
    if (!db) return;
    const student = db.STUDENTS.find(s => s.id === studentId);
    if (student) {
      setStudentToDelete(student);
    }
  };

  const executeDeleteStudent = () => {
    if (!db || !studentToDelete) return;
    const studentId = studentToDelete.id;
    const name = studentToDelete.name;

    const updatedStudents = db.STUDENTS.filter(s => s.id !== studentId);
    const updatedLogs = db.LOGS_DISCIPLINE.filter(l => l.student_id !== studentId);
    const updatedAttendance = db.ATTENDANCE.filter(a => a.student_id !== studentId);
    const updatedComplaints = db.COMPLAINTS.filter(c => c.student_id !== studentId);

    const updated = {
      ...db,
      STUDENTS: updatedStudents,
      LOGS_DISCIPLINE: updatedLogs,
      ATTENDANCE: updatedAttendance,
      COMPLAINTS: updatedComplaints
    };
    syncAndReload(updated);
    setStudentToDelete(null);
    alert(`Đã xóa học sinh ${name} khỏi hệ thống.`);
  };

  const executeDeleteTeacher = () => {
    if (!db || !teacherToDelete) return;
    const updated = {
      ...db,
      USERS: db.USERS.filter(u => u.id !== teacherToDelete.id)
    };
    syncAndReload(updated);
    const deletedUsername = teacherToDelete.username;
    setTeacherToDelete(null);
    alert(`Đã xóa tài khoản giáo viên ${deletedUsername} thành công!`);
  };

  // 11. DATE FORMATTER
  const formatDateDMY = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // ADD NEW TEACHER ACCOUNT
  const handleCreateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    if (!newTeacher.id || !newTeacher.username) {
      alert('Vui lòng nhập ID và tên tài khoản.');
      return;
    }

    if (db.USERS.some(u => u.username === newTeacher.username)) {
      alert('Tên tài khoản này đã tồn tại!');
      return;
    }

    const updatedTeacherUser: User = {
      id: newTeacher.id,
      username: newTeacher.username,
      password: newTeacher.password,
      role: 'Teacher',
      class_assigned: newTeacher.class_assigned,
      full_name: newTeacher.full_name
    };

    const updated = {
      ...db,
      USERS: [...db.USERS, updatedTeacherUser]
    };
    syncAndReload(updated);
    setShowTeacherModal(false);
    setNewTeacher({ id: '', username: '', password: '123', class_assigned: '', full_name: '' });
    alert('Đã thêm tài khoản giáo viên chủ nhiệm mới thành công!');
  };

  // UPDATE TEACHER
  const handleUpdateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingTeacher) return;

    if (!editingTeacher.username) {
      alert('Vui lòng nhập tên tài khoản.');
      return;
    }

    if (db.USERS.some(u => u.username === editingTeacher.username && u.id !== editingTeacher.id)) {
      alert('Tên tài khoản này đã tồn tại ở tài khoản khác!');
      return;
    }

    const updatedUsers = db.USERS.map(u => u.id === editingTeacher.id ? editingTeacher : u);
    const updated = {
      ...db,
      USERS: updatedUsers
    };
    syncAndReload(updated);
    setEditingTeacher(null);
    alert('Đã cập nhật thông tin giáo viên thành công!');
  };

  // ADD NEW POINT RULE
  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    if (!newRule.code || !newRule.name) {
      alert('Vui lòng nhập mã và tên quy chuẩn.');
      return;
    }

    if (db.SCORE_RULES.some(r => r.code === newRule.code)) {
      alert('Mã quy chuẩn này đã tồn tại!');
      return;
    }

    const updated = {
      ...db,
      SCORE_RULES: [...db.SCORE_RULES, newRule]
    };
    syncAndReload(updated);
    setShowRuleModal(false);
    setNewRule({ code: '', name: '', points: -2, category: 'Discipline' });
    alert('Đã thêm quy chuẩn điểm rèn luyện mới!');
  };

  // UPDATE EXISTED POINT RULE
  const handleUpdateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingRule) return;

    if (!editingRule.code || !editingRule.name) {
      alert('Vui lòng nhập đầy đủ mã và tên quy chuẩn.');
      return;
    }

    // Update rules list, maintaining original position
    const updatedRules = db.SCORE_RULES.map(r => r.code === editingRule.code ? editingRule : r);
    
    const updated = {
      ...db,
      SCORE_RULES: updatedRules
    };
    syncAndReload(updated);
    setEditingRule(null);
    alert('Đã cập nhật quy chuẩn điểm rèn luyện thành công!');
  };

  // DELETE SPECIFIC POINT RULE
  const handleDeleteRule = (code: string) => {
    if (!db) return;
    const updatedRules = db.SCORE_RULES.filter(r => r.code !== code);
    const updated = {
      ...db,
      SCORE_RULES: updatedRules
    };
    syncAndReload(updated);
    setRuleToDelete(null);
    alert('Đã xóa quy chuẩn điểm rèn luyện!');
  };

  // CLEAR ALL POINT RULES
  const handleClearAllRules = () => {
    if (!db) return;
    if (clearRulesSafetyInput !== 'XOA') {
      alert('Chuỗi xác nhận không chính xác. Vui lòng nhập đúng chữ "XOA" (viết hoa không dấu) để tiếp tục.');
      return;
    }
    const updated = {
      ...db,
      SCORE_RULES: []
    };
    syncAndReload(updated);
    setShowClearRulesModal(false);
    setClearRulesSafetyInput('');
    alert('Đã xóa toàn bộ danh mục điểm rèn luyện thành công!');
  };

  // DOWNLOAD TEMPLATE RULE EXCEL
  const handleDownloadRuleTemplate = () => {
    const diemTruData = [
      { "Mã Quy Chuẩn": "VP01", "Hành Vi Nề Nếp": "Đi học muộn, vào lớp sau tiếng trống", "Giá Trị Điểm Thay Đổi": -2 },
      { "Mã Quy Chuẩn": "VP02", "Hành Vi Nề Nếp": "Trốn học, bỏ tiết học không xin phép", "Giá Trị Điểm Thay Đổi": -5 },
      { "Mã Quy Chuẩn": "VP03", "Hành Vi Nề Nếp": "Không mặc đồng phục hoặc không đeo thẻ học sinh", "Giá Trị Điểm Thay Đổi": -2 },
      { "Mã Quy Chuẩn": "VP04", "Hành Vi Nề Nếp": "Sử dụng điện thoại trong giờ học khi chưa được phép", "Giá Trị Điểm Thay Đổi": -3 },
      { "Mã Quy Chuẩn": "VP05", "Hành Vi Nề Nếp": "Vô lễ, xúc phạm giáo viên hoặc cán bộ nhà trường", "Giá Trị Điểm Thay Đổi": -10 },
    ];

    const diemCongData = [
      { "Mã Quy Chuẩn": "T01", "Hành Vi Nề Nếp": "Đạt giải trong các kỳ thi học sinh giỏi, nghiên cứu khoa học", "Giá Trị Điểm Thay Đổi": 10 },
      { "Mã Quy Chuẩn": "T02", "Hành Vi Nề Nếp": "Hành động dũng cảm cứu người hoặc nhặt được của rơi trả lại người mất", "Giá Trị Điểm Thay Đổi": 10 },
      { "Mã Quy Chuẩn": "T03", "Hành Vi Nề Nếp": "Tham gia tích cực và đóng góp xuất sắc trong các phong trào Đoàn trường", "Giá Trị Điểm Thay Đổi": 5 },
      { "Mã Quy Chuẩn": "T04", "Hành Vi Nề Nếp": "Phát biểu xây dựng bài học sôi nổi trong giờ học", "Giá Trị Điểm Thay Đổi": 2 },
      { "Mã Quy Chuẩn": "T05", "Hành Vi Nề Nếp": "Trực nhật lớp và dọn dẹp vệ sinh khuôn viên trường sạch đẹp", "Giá Trị Điểm Thay Đổi": 2 },
    ];

    const wb = XLSX.utils.book_new();
    const wsDiemTru = XLSX.utils.json_to_sheet(diemTruData);
    const wsDiemCong = XLSX.utils.json_to_sheet(diemCongData);

    XLSX.utils.book_append_sheet(wb, wsDiemTru, "DiemTru");
    XLSX.utils.book_append_sheet(wb, wsDiemCong, "DiemCong");

    XLSX.writeFile(wb, `Mau_Danh_Muc_Diem_${schoolId}.xlsx`);
  };

  // UPLOAD RULES FROM EXCEL
  const handleImportRulesExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        let importedRules: ScoreRule[] = [];
        
        const parseSheet = (sheetName: string, category: 'Discipline' | 'Reward') => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const rows = XLSX.utils.sheet_to_json<any>(sheet);
          rows.forEach(row => {
            let code = '';
            let name = '';
            let points = category === 'Reward' ? 5 : -5;
            
            for (const key of Object.keys(row)) {
              const keyLower = key.toLowerCase().trim();
              if (keyLower.includes('mã') || keyLower.includes('code')) {
                code = String(row[key]).trim().toUpperCase();
              } else if (keyLower.includes('hành vi') || keyLower.includes('nội dung') || keyLower.includes('name')) {
                name = String(row[key]).trim();
              } else if (keyLower.includes('điểm') || keyLower.includes('giá trị') || keyLower.includes('point') || keyLower.includes('thay đổi')) {
                const p = Number(row[key]);
                if (!isNaN(p)) {
                  points = p;
                }
              }
            }
            
            if (code && name) {
              if (category === 'Discipline' && points > 0) {
                points = -points;
              } else if (category === 'Reward' && points < 0) {
                points = -points;
              }
              
              importedRules.push({
                code,
                name,
                points,
                category
              });
            }
          });
        };
        
        parseSheet('DiemTru', 'Discipline');
        parseSheet('DiemCong', 'Reward');
        
        if (importedRules.length === 0) {
          workbook.SheetNames.forEach(sheetName => {
            const sheetNameLower = sheetName.toLowerCase();
            if (sheetNameLower.includes('tru') || sheetNameLower.includes('phat') || sheetNameLower.includes('discipline')) {
              parseSheet(sheetName, 'Discipline');
            } else if (sheetNameLower.includes('cong') || sheetNameLower.includes('thuong') || sheetNameLower.includes('reward')) {
              parseSheet(sheetName, 'Reward');
            }
          });
        }
        
        if (importedRules.length === 0) {
          alert('Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng đảm bảo file có các sheet "DiemTru" và "DiemCong" và đúng định dạng.');
          return;
        }
        
        let finalRules: ScoreRule[] = [];
        if (importRulesMode === 'overwrite') {
          finalRules = importedRules;
        } else {
          const existingMap = new Map<string, ScoreRule>();
          db.SCORE_RULES.forEach(r => existingMap.set(r.code, r));
          importedRules.forEach(r => {
            existingMap.set(r.code, r);
          });
          finalRules = Array.from(existingMap.values());
        }
        
        const updated = {
          ...db,
          SCORE_RULES: finalRules
        };
        syncAndReload(updated);
        alert(`Đã nhập thành công ${importedRules.length} quy chuẩn điểm từ Excel! Chế độ: ${importRulesMode === 'overwrite' ? 'Ghi đè' : 'Bổ sung'}`);
        setShowImportRulesModal(false);
        // Clear file input
        e.target.value = '';
      } catch (err: any) {
        alert('Đã xảy ra lỗi khi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // LOCK/UNLOCK DATA TOGGLE
  const handleToggleLock = () => {
    if (!db) return;
    const currentLocked = db.CONFIG[0]?.is_locked || false;
    const updatedConfig: SchoolConfig = {
      ...db.CONFIG[0],
      is_locked: !currentLocked
    };

    const updated = {
      ...db,
      CONFIG: [updatedConfig]
    };
    syncAndReload(updated);
    alert(!currentLocked ? '🔒 Đã KHÓA toàn bộ số liệu rèn luyện học đường. Giáo viên chủ nhiệm sẽ bị chặn sửa đổi.' : '🔓 Đã MỞ KHÓA số liệu rèn luyện thành công.');
  };

  // EXPORT SINGLE REPORT CARD OR BATCH
  const handleExportBatchPdf = () => {
    if (!db) return;
    const classToExport = selectedClass === 'Tất cả' ? '10A1' : selectedClass;
    const classStudents = db.STUDENTS.filter(s => s.class === classToExport);
    
    if (classStudents.length === 0) {
      alert(`Lớp ${classToExport} không có học sinh nào.`);
      return;
    }

    // Trigger state-based non-blocking confirmation dialog
    setShowExportBatchPdfModal(true);
  };

  const executeExportBatchPdf = async () => {
    if (!db) return;
    const classToExport = selectedClass === 'Tất cả' ? '10A1' : selectedClass;
    const classStudents = db.STUDENTS.filter(s => s.class === classToExport);
    
    setShowExportBatchPdfModal(false);

    try {
      const zipBlob = await PdfGenerator.exportClassBatchZip(
        classStudents,
        db.CONFIG[0],
        db.LOGS_DISCIPLINE,
        db.SCORE_RULES,
        db.ATTENDANCE,
        undefined
      );

      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_Lien_Lac_Hang_Loat_Lop_${classToExport}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Lỗi xuất file ZIP: ' + e.message);
    }
  };

  // BACKUP EXPORT & IMPORT
  const handleDownloadBackup = () => {
    if (!db) return;
    const rawData = JSON.stringify(db, null, 2);
    const blob = new Blob([rawData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Data_${schoolId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as SchoolData;
        if (parsed.CONFIG && parsed.STUDENTS && parsed.USERS) {
          syncAndReload(parsed);
          alert('Đã khôi phục dữ liệu hệ thống từ file .json thành công!');
        } else {
          alert('Định dạng file sao lưu không hợp lệ. Vui lòng kiểm tra lại cấu trúc.');
        }
      } catch (err) {
        alert('Lỗi đọc dữ liệu sao lưu.');
      }
    };
    reader.readAsText(file);
  };

  if (!db) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
        <p className="text-slate-500 text-xs italic animate-pulse">Đang tải dữ liệu của trường học, vui lòng chờ...</p>
      </div>
    );
  }

  const activeConfig = db.CONFIG[0] || { school_name: 'THPT', year: '2026-2027', semester: 'Học kỳ I', is_locked: false };

  return (
    <div className="space-y-6">
      {/* School Top Header info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-900 p-1.5 rounded-xl flex items-center justify-center shadow-md border border-slate-700 shrink-0">
            <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-lg">
                {GoogleDriveService.getDisplaySchoolName(schoolId, activeConfig.school_name).toUpperCase()}
              </h2>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded">
                Năm học: {activeConfig.year}
              </span>
              <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-semibold px-2 py-0.5 rounded">
                {activeConfig.semester}
              </span>
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Ban Giám Hiệu
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Hệ thống Đồng bộ Google Sheets: <code className="bg-slate-100 text-slate-700 px-1 rounded font-mono text-[10.5px]">{session.schoolId}</code> | ID Sheet: <span className="text-slate-400 select-all font-mono text-[11px]">{GoogleDriveService.getSchools().find(s => s.school_id === schoolId)?.sheet_file_id || 'DB_File_None'}</span></span>
                {!isCloudSynced && (
                  <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-semibold">
                    ⚠️ Đang hiển thị dữ liệu lưu tạm trên máy (Chưa đồng bộ Cloud)
                  </span>
                )}
              </div>
              {GoogleDriveService.getWebhookUrl().includes('AKfycbzqxQLXC7n-3HgqToXi4XAtvBi2kbR9X9ymsxFlUUr0qFdMLfYUe_Xvx0ul5zDI42bwog') && (
                <div className="text-[11px] text-blue-600 font-medium">
                  💡 Bạn đang dùng Webapp thử nghiệm (Dữ liệu lưu trên Drive của hệ thống). Để lưu file trực tiếp trên Google Drive của riêng bạn, vui lòng click nút "Nhúng Apps Script G-Drive" ở dưới cùng để tự triển khai.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <AutoSyncStatus />

          {/* Help button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-lg transition font-medium cursor-pointer"
            title="Sổ tay Hướng dẫn & Trợ giúp"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Trợ giúp
          </button>

          {/* Complaints Trigger Badge with count */}
          <button
            onClick={() => setShowComplaintModal(true)}
            className="relative flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-lg transition font-medium cursor-pointer"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            Khiếu nại
            {pendingComplaints.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-bold text-[9px] w-5 h-5 flex items-center justify-center rounded-full border border-white animate-bounce">
                {pendingComplaints.length}
              </span>
            )}
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-3.5 py-2 rounded-lg transition font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {[
          { id: 'overview', name: 'Tổng quan' },
          { id: 'logs', name: 'Nhật ký lớp' },
          { id: 'students', name: 'Quản lý Học sinh' },
          { id: 'classes', name: 'Quản lý Lớp' },
          { id: 'teachers', name: 'Tài khoản / GVCN' },
          { id: 'rules', name: 'Danh mục Điểm' },
          { id: 'stats', name: 'Thống kê & Xếp hạng' },
          { id: 'lock', name: 'Khóa dữ liệu' },
          { id: 'backup', name: 'Backup .json' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* TAB CONTENTS CONTAINER */}
      <div className="space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* ROW 1: NAVIGATION & MAIN ACTIONS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 justify-between shadow-2xs">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Segmented Button for Term selection */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/40">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTerm('Học kỳ I');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition ${
                      selectedTerm === 'Học kỳ I'
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50 font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Học kỳ 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTerm('Học kỳ II');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition ${
                      selectedTerm === 'Học kỳ II'
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200/50 font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Học kỳ 2
                  </button>
                </div>

                {/* Vertical Divider */}
                <div className="h-5 w-px bg-slate-300 mx-1" aria-hidden="true"></div>

                {/* Month Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600 text-xs">Tháng:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 font-medium shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {(selectedTerm === 'Học kỳ I' 
                      ? ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'] 
                      : ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5']
                    ).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right side Actions */}
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm">
                  <Upload className="w-3.5 h-3.5 text-white" />
                  Import báo cáo tháng
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportMonthlyReportExcel}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowLogModal(true)}
                  className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ghi nhận điểm cộng / trừ
                </button>
              </div>
            </div>

            {/* ROW 2: FILTERS & REPORT DOWNLOADS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              {/* Left Controls */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="font-extrabold text-slate-800 text-xs tracking-wider uppercase">CHỌN LỚP:</span>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 font-medium shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Tất cả">Tất cả lớp học</option>
                    {availableClasses.map(c => <option key={c} value={c}>Lớp {c}</option>)}
                  </select>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  </div>
                  <input
                    type="text"
                    value={overviewSearchQuery}
                    onChange={(e) => setOverviewSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc mã HS."
                    className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg pl-9 pr-3 py-1.5 w-64 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Right: 4 Report Export buttons */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* BC Tháng */}
                <button
                  type="button"
                  onClick={handleExportMonthlyReport}
                  className="inline-flex items-center gap-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  BC Tháng
                </button>

                {/* Xuất KQ rèn luyện HK */}
                <button
                  type="button"
                  onClick={handleExportSemesterReport}
                  className="inline-flex items-center gap-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Xuất KQ rèn luyện HK
                </button>

                {/* Phiếu PLL HK I / II */}
                <button
                  type="button"
                  onClick={handleExportBatchPdf}
                  className="inline-flex items-center gap-1.5 bg-[#059669] hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Phiếu PLL {selectedTerm === 'Học kỳ I' ? 'HK I' : 'HK II'}
                </button>

                {/* Xuất sổ điểm danh tháng */}
                <button
                  type="button"
                  onClick={handleExportAttendanceReport}
                  className="inline-flex items-center gap-1.5 bg-[#ea580c] hover:bg-orange-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Xuất sổ điểm danh tháng
                </button>
              </div>
            </div>

            {/* BLOCK 3: WARNING ATTENTION OR GREAT STATUS */}
            {(() => {
              const attentionStudents = filteredStudents.filter(s => s.classification === 'Đạt' || s.classification === 'Chưa đạt');
              
              if (attentionStudents.length > 0) {
                return (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3 shadow-2xs">
                    <AlertTriangle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-3 text-xs w-full">
                      <div>
                        <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                          Học sinh cần quan tâm &amp; hỗ trợ rèn luyện (Mức Trung bình / Yếu)
                          <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">
                            [{attentionStudents.length} học sinh]
                          </span>
                        </h4>
                        <p className="text-emerald-700 mt-1">
                          Danh sách học sinh có kết quả rèn luyện xếp loại Đạt (Trung bình) hoặc Chưa đạt (Yếu/Kém) cần GVCN phối hợp hỗ trợ.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {attentionStudents.map(s => (
                          <div key={s.id} className="bg-white border border-emerald-100/60 p-2.5 rounded-lg flex flex-col gap-1 shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800 text-xs">{s.name} ({s.class})</span>
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                                {s.semesterAverage}đ ({s.classification})
                              </span>
                            </div>
                            <span className="text-slate-500 text-[11px] italic">
                              {getViolationsReason(s.id)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 shadow-2xs animate-in fade-in duration-300">
                    <div className="bg-emerald-100 p-1.5 rounded-full shrink-0">
                      <Check className="w-5 h-5 text-emerald-600 font-bold" />
                    </div>
                    <div className="text-xs">
                      <h4 className="font-bold text-emerald-800 text-sm">
                        Tuyệt vời! Lớp hiện không có học sinh nào ở mức rèn luyện Trung bình hoặc Yếu.
                      </h4>
                      <p className="text-slate-500 mt-0.5">
                        Tất cả học sinh đều đang đạt kết quả rèn luyện loại Khá hoặc Tốt.
                      </p>
                    </div>
                  </div>
                );
              }
            })()}

            {/* Quick statistics metrics info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Học sinh khối</span>
                <h4 className="text-2xl font-bold text-slate-800">{filteredStudents.length}</h4>
                <p className="text-[10px] text-slate-500">Được hiển thị theo bộ lọc</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Tổng lượt ghi nhận điểm</span>
                <h4 className="text-2xl font-bold text-blue-600">{db.LOGS_DISCIPLINE.length}</h4>
                <p className="text-[10px] text-emerald-600 font-medium">Trong học kỳ rà soát</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Tỉ lệ Khá/Tốt</span>
                <h4 className="text-2xl font-bold text-emerald-600">
                  {Math.round((filteredStudents.filter(s => s.semesterAverage >= 70).length / Math.max(1, filteredStudents.length)) * 100)}%
                </h4>
                <p className="text-[10px] text-slate-500">Đạt hạnh kiểm xếp loại Khá hoặc Tốt</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Số ca vắng (P/KP)</span>
                <h4 className="text-2xl font-bold text-amber-600">
                  {db.ATTENDANCE.filter(a => {
                    const stud = db.STUDENTS.find(s => s.id === a.student_id);
                    return selectedClass === 'Tất cả' || (stud && stud.class === selectedClass);
                  }).length}
                </h4>
                <p className="text-[10px] text-slate-500">Trong học kỳ rèn luyện</p>
              </div>
            </div>

            {/* BLOCK 4: TABLE OF SCORES */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="font-bold text-slate-800 text-sm">BẢNG THEO DÕI ĐIỂM SỐ RÈN LUYỆN CHI TIẾT</h4>
                <span className="text-xs text-slate-500 font-medium">Lọc theo: {selectedClass} | {selectedMonth}</span>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10.5px] font-extrabold text-slate-500 tracking-wider">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-32">MÃ HS</th>
                      <th className="p-3">HỌ VÀ TÊN</th>
                      <th className="p-3 w-20 text-center">LỚP</th>
                      <th className="p-3 text-center text-rose-600 uppercase font-mono font-black">ĐIỂM TRỪ ({getMonthAbbreviation(selectedMonth)})</th>
                      <th className="p-3 text-center text-emerald-600 uppercase font-mono font-black">ĐIỂM CỘNG ({getMonthAbbreviation(selectedMonth)})</th>
                      <th className="p-3 text-center text-blue-600 uppercase font-mono font-black">ĐIỂM {getMonthAbbreviation(selectedMonth)}</th>
                      <th className="p-3 text-center text-slate-900 font-black">TB HK</th>
                      <th className="p-3 text-center">XẾP LOẠI</th>
                      <th className="p-3 text-center text-slate-900 font-black">CẢ NĂM</th>
                      <th className="p-3 text-center w-24">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-slate-400 font-medium">
                          Không tìm thấy học sinh nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s, idx) => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                          <td className="p-3 text-center text-slate-400 font-medium font-mono tabular-nums">{idx + 1}</td>
                          
                          {/* MÃ HS */}
                          <td className="p-3 font-mono text-[11px] text-slate-500 font-semibold tracking-tight">{s.id.toUpperCase()}</td>
                          
                          {/* HỌ VÀ TÊN */}
                          <td className="p-3 font-bold text-slate-900">{s.name}</td>
                          
                          {/* LỚP */}
                          <td className="p-3 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 font-semibold text-[10px]">
                              {s.class}
                            </span>
                          </td>
                          
                          {/* ĐIỂM TRỪ */}
                          <td className="p-3 text-center font-mono tabular-nums">
                            {s.totalMinus === 0 ? (
                              <span className="text-rose-500 font-bold">-</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{s.totalMinus}đ</span>
                            )}
                          </td>
                          
                          {/* ĐIỂM CỘNG */}
                          <td className="p-3 text-center font-mono tabular-nums">
                            {s.totalPlus === 0 ? (
                              <span className="text-emerald-500 font-bold">-</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">+{s.totalPlus}</span>
                            )}
                          </td>
                          
                          {/* ĐIỂM THÁNG */}
                          <td className="p-3 text-center font-mono tabular-nums">
                            <span className="font-extrabold text-sm text-emerald-700">
                              {s.currentScore}
                            </span>
                          </td>
                          
                          {/* TB HK */}
                          <td className="p-3 text-center font-mono tabular-nums font-bold text-slate-900 text-sm">
                            {s.semesterAverage}
                          </td>
                          
                          {/* XẾP LOẠI */}
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              s.classification === 'Tốt' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              s.classification === 'Khá' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              s.classification === 'Đạt' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {s.classification}
                            </span>
                          </td>
                          
                          {/* XẾP LOẠI CẢ NĂM */}
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              s.yearlyClassification === 'Tốt' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              s.yearlyClassification === 'Khá' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                              s.yearlyClassification === 'Đạt' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {s.yearlyClassification}
                            </span>
                          </td>
                          
                          {/* HÀNH ĐỘNG */}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForHistory(s)}
                              className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-medium px-2 py-1 rounded transition text-[11px] cursor-pointer"
                            >
                              <Clock className="w-3 h-3 text-slate-400" />
                              Nhật ký
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DETAILED LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Nhật Ký Chi Tiết Vi Phạm / Khen Thưởng Toàn Lớp</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Danh sách các lượt ghi nhận điểm cộng và điểm trừ của tất cả học sinh.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Tìm học sinh, mã lỗi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 w-28">Mã HS</th>
                    <th className="p-3">Họ Tên Học Sinh</th>
                    <th className="p-3 w-20">Ngày</th>
                    <th className="p-3">Mã Lỗi / Quy Chuẩn</th>
                    <th className="p-3 text-center">Điểm</th>
                    <th className="p-3">Minh Chứng / Ghi Chú</th>
                    <th className="p-3">Giáo Viên Ghi</th>
                  </tr>
                </thead>
                <tbody>
                  {db.LOGS_DISCIPLINE
                    .filter(l => {
                      const stud = db.STUDENTS.find(s => s.id === l.student_id);
                      const nameMatch = stud ? stud.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
                      const codeMatch = l.rule_code.toLowerCase().includes(searchQuery.toLowerCase());
                      const classMatch = selectedClass === 'Tất cả' || (stud ? stud.class === selectedClass : false);
                      return (nameMatch || codeMatch) && classMatch;
                    })
                    .map((log, index) => {
                      const stud = db.STUDENTS.find(s => s.id === log.student_id);
                      const rule = db.SCORE_RULES.find(r => r.code === log.rule_code);
                      return (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                          <td className="p-3 text-center text-slate-400 font-medium">{index + 1}</td>
                          <td className="p-3 font-mono font-semibold">{log.student_id}</td>
                          <td className="p-3 font-semibold text-slate-800">{stud ? stud.name : 'Unknown'} ({stud?.class})</td>
                          <td className="p-3 text-slate-600">{log.date}</td>
                          <td className="p-3 text-slate-700">
                            <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10.5px] font-mono mr-1.5">
                              {log.rule_code}
                            </span>
                            {rule ? rule.name : ''}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={log.points > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {log.points > 0 ? `+${log.points}` : log.points}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 italic">{log.notes}</td>
                          <td className="p-3 font-medium text-slate-500 font-mono">{log.recorded_by}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: STUDENTS MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-4 text-xs">
            {/* Row 1: Search & Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo Họ tên, Mã HS, Mã VnEdu..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 text-xs">Lọc lớp:</span>
                <select
                  value={studentClassFilter}
                  onChange={(e) => setStudentClassFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                >
                  <option value="Tất cả">Tất cả lớp</option>
                  {availableClasses.map(c => (
                    <option key={c} value={c}>Lớp {c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const defaultClass = (availableClasses[0] || '10A1') as string;
                    setNewStudent({
                      id: '',
                      name: '',
                      class: defaultClass,
                      birth_date: '2011-01-01',
                      parent_name: '',
                      phone: '',
                      password: '123456',
                      vnedu_code: '',
                      gender: 'Nam'
                    });
                    const { id: generatedId } = getNextStudentId(defaultClass, db ? db.STUDENTS : []);
                    setNewStudentIdState(generatedId);
                    setShowStudentModal(true);
                  }}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg font-bold border border-blue-100 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  + Thêm thủ công
                </button>

                <label className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-2 rounded-lg font-bold border border-indigo-100 transition cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  Import Excel
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportVnEduExcel}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleExportStudentsExcel}
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-2 rounded-lg font-bold border border-emerald-100 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Tải về danh sách học sinh
                </button>

                <button
                  onClick={handleSyncStudentsToSheets}
                  disabled={syncingProgress !== null}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold shadow-xs transition cursor-pointer ${
                    syncingProgress !== null
                      ? 'bg-blue-400 text-white/85 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  title="Đồng bộ sạch sẽ toàn bộ 36 lớp học sinh lên Google Sheets theo từng mẻ nhỏ"
                >
                  <RefreshCw className={`w-4 h-4 text-white ${syncingProgress !== null ? 'animate-spin' : ''}`} />
                  {syncingProgress !== null ? 'Đang đồng bộ...' : 'Đồng bộ học sinh lên Google Sheets'}
                </button>

                <button
                  onClick={handlePullFromSheets}
                  disabled={isPulling}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold shadow-xs transition cursor-pointer bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50`}
                  title="Đồng bộ tải dữ liệu mới nhất từ Google Sheets về ứng dụng"
                >
                  <Download className={`w-4 h-4 text-white ${isPulling ? 'animate-spin' : ''}`} />
                  {isPulling ? 'Đang tải...' : 'Đồng bộ lại từ Sheets'}
                </button>

                <button
                  onClick={downloadVnEduTemplate}
                  className="text-blue-600 hover:text-blue-800 font-bold underline underline-offset-2 hover:no-underline ml-1 cursor-pointer"
                >
                  Tải mẫu Excel
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDeleteStudentsByClass}
                  className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-lg font-bold border border-rose-100 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa học sinh theo lớp
                </button>

                <button
                  onClick={handleClearAllStudents}
                  className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-red-600 px-3 py-2 rounded-lg font-bold border border-red-150 transition cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Xóa toàn bộ học sinh
                </button>
              </div>
            </div>

            {/* Table data structure */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[10.5px] uppercase tracking-wider">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3">Mã HS</th>
                      <th className="p-3">Mã VnEdu</th>
                      <th className="p-3">Họ và Tên</th>
                      <th className="p-3 text-center w-20">Lớp</th>
                      <th className="p-3">Giới tính / Ngày sinh</th>
                      <th className="p-3">Rèn luyện ({selectedMonth})</th>
                      <th className="p-3">Mật khẩu</th>
                      <th className="p-3 text-center w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredStudentsList().length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                          Không tìm thấy học sinh nào khớp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      getFilteredStudentsList().map((s, idx) => {
                        const conduct = getStudentMonthlyConduct(s.id);
                        return (
                          <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                            <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                            <td className="p-3 font-bold font-mono text-slate-700">{s.id}</td>
                            <td className="p-3 font-mono text-slate-500">{s.vneduId || (s as any).maVnEdu || s.vnedu_code || (s as any).code || '---'}</td>
                            <td className="p-3 font-bold text-slate-800 text-xs">{s.name}</td>
                            <td className="p-3 text-center">
                              <span className="inline-block bg-slate-50 text-slate-600 border border-slate-200 font-bold px-2 py-0.5 rounded text-[10px]">
                                {s.class}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">
                              {s.gender || 'Nam'} - {formatDateDMY(s.birth_date)}
                            </td>
                            <td className="p-3">
                              <div className="space-y-0.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  conduct.score >= 85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  conduct.score >= 70 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  conduct.score >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {conduct.score}đ - {conduct.rating}
                                </span>
                                <div className="text-[10px] text-slate-400 pl-1 font-medium">
                                  {conduct.change === 0 ? (
                                    <span>100đ gốc</span>
                                  ) : conduct.change > 0 ? (
                                    <span className="text-emerald-600">+{conduct.change}đ cộng</span>
                                  ) : (
                                    <span className="text-rose-600">{conduct.change}đ trừ</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-sky-50 text-sky-700 font-mono font-bold px-2 py-0.5 rounded text-[10px] border border-sky-100">
                                  {s.password}
                                </span>
                                <button
                                  onClick={() => handleResetStudentPassword(s.id, s.name)}
                                  title="Đặt lại mật khẩu mặc định (123456)"
                                  className="text-amber-500 hover:text-amber-600 p-1 rounded hover:bg-amber-50 transition cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setEditingStudent(s)}
                                  title="Sửa thông tin học sinh"
                                  className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 transition cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(s.id, s.name)}
                                  title="Xóa học sinh"
                                  className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLASSES ROSTERS & RATINGS */}
        {activeTab === 'classes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Xếp Hạng Thi Đua Lớp Rèn Luyện</h4>
              <p className="text-slate-500">Được tự động xếp thứ tự thi đua KPI nề nếp dựa trên điểm trung bình cộng của học sinh trong lớp.</p>
              
              <div className="space-y-3">
                {availableClasses.map((cls, idx) => {
                  const clsStuds = studentScores.filter(s => s.class === cls);
                  const avgScore = Math.round(clsStuds.reduce((acc, c) => acc + c.currentScore, 0) / Math.max(1, clsStuds.length));
                  const excellenceRate = Math.round((clsStuds.filter(s => s.currentScore >= 85).length / Math.max(1, clsStuds.length)) * 100);

                  return (
                    <div key={cls} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-400 w-6">#{idx + 1}</span>
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">Lớp {cls}</h5>
                          <p className="text-[10px] text-slate-500">Sĩ số: {clsStuds.length} học sinh | Đạt Tốt: {excellenceRate}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-blue-600">{avgScore} đ</span>
                        <p className="text-[9px] text-emerald-600 font-medium">Trung bình lớp</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Biểu Đồ Theo Dõi Phân Bổ Hạnh Kiểm KPI</h4>
              <p className="text-slate-500">Tỷ lệ cơ cấu xếp loại hạnh kiểm thực tế toàn trường cập nhật theo thời gian thực.</p>
              
              <div className="space-y-4 pt-2">
                {[
                  { label: 'TỐT (Từ 85 đến 100đ)', count: studentScores.filter(s => s.currentScore >= 85).length, color: 'bg-emerald-500' },
                  { label: 'KHÁ (Từ 70 đến 84đ)', count: studentScores.filter(s => s.currentScore >= 70 && s.currentScore < 85).length, color: 'bg-blue-500' },
                  { label: 'ĐẠT (Từ 50 đến 69đ)', count: studentScores.filter(s => s.currentScore >= 50 && s.currentScore < 70).length, color: 'bg-amber-500' },
                  { label: 'CHƯA ĐẠT (Dưới 50đ)', count: studentScores.filter(s => s.currentScore < 50).length, color: 'bg-rose-500' },
                ].map((item) => {
                  const pct = Math.round((item.count / Math.max(1, db.STUDENTS.length)) * 100);
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="text-slate-800 font-bold">{item.count} HS ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TEACHERS ACCOUNT MANAGEMENT */}
        {activeTab === 'teachers' && (
          <div className="space-y-4 text-xs">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Tài Khoản Giáo Viên Chủ Nhiệm (GVCN)</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Phân bổ 36 giáo viên chủ nhiệm nòng cốt phụ trách theo dõi nề nếp thi đua từng khối lớp.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportTeachers}
                  className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg transition font-medium cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Xuất Excel GV
                </button>

                <label className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg transition font-medium cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  Nhập GV Excel
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportTeachers}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleSyncTeachersToSheets}
                  disabled={syncingProgress !== null}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Đồng bộ danh sách Giáo viên lên Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-white ${syncingProgress !== null ? 'animate-spin' : ''}`} />
                  Đồng bộ GV lên Google Sheet
                </button>

                <button
                  onClick={() => setShowTeacherModal(true)}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cấp tài khoản GV mới
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Mã GV</th>
                    <th className="p-3">Họ và tên GV</th>
                    <th className="p-3">Tên Tài Khoản Đăng Nhập</th>
                    <th className="p-3">Mật khẩu</th>
                    <th className="p-3">Lớp CN</th>
                    <th className="p-3 text-center">Trạng Thái Ký</th>
                    <th className="p-3 text-center w-28">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {db.USERS.filter(u => u.role === 'Teacher').map((t, idx) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                      <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold">{t.id}</td>
                      <td className="p-3 font-semibold text-slate-800">{t.full_name || 'Chưa thiết lập'}</td>
                      <td className="p-3 font-semibold text-slate-800">{t.username}</td>
                      <td className="p-3 font-mono text-slate-600">{t.password}</td>
                      <td className="p-3 font-bold text-blue-600">{t.class_assigned || 'Chưa phân công'}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.signature_base64 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-50 text-slate-400 border border-slate-200'
                        }`}>
                          {t.signature_base64 ? 'Đã tải chữ ký' : 'Chưa thiết lập'}
                        </span>
                      </td>
                      <td className="p-3 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingTeacher(t)}
                          className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded transition cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTeacherToDelete(t)}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Xoá tài khoản"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: POINTS RULES LIST */}
        {activeTab === 'rules' && (
          <div className="space-y-4 text-xs">
            {/* KHU VỰC TIÊU ĐỀ & CỤM TÁC VỤ TRÊN */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-base">Danh mục Điểm Cộng / Trừ</h4>
                <p className="text-slate-500 text-[11px] mt-1">
                  Thiết lập danh mục điểm rèn luyện đặc thù cho trường • <span className="font-bold text-red-600">{(db?.SCORE_RULES || []).filter(r => r.category === 'Discipline').length} mục trừ</span>, <span className="font-bold text-emerald-600">{(db?.SCORE_RULES || []).filter(r => r.category === 'Reward').length} mục cộng</span>
                </p>
              </div>

              {/* CỤM 3 NÚT HÀNH ĐỘNG */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadRuleTemplate}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Tải file mẫu Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải file mẫu Danh mục Điểm
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportRulesModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Tải lên dữ liệu mới"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Tải lên từ Excel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClearRulesSafetyInput('');
                    setShowClearRulesModal(true);
                  }}
                  className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Xóa toàn bộ danh mục điểm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa toàn bộ
                </button>
              </div>
            </div>

            {/* KHỐI HƯỚNG DẪN / LƯU Ý (ALERT BOX) */}
            <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4 flex gap-3 text-slate-700">
              <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                i
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-800">Mỗi trường tự quản lý danh mục điểm rèn luyện phù hợp với quy định của trường mình:</h5>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                  <li>Bấm <span className="font-semibold text-slate-800">Tải file mẫu Danh mục Điểm</span> để xem định dạng 2 sheet (DiemTru và DiemCong).</li>
                  <li>Bấm <span className="font-semibold text-slate-800">Tải lên từ Excel</span> để nhập nhanh danh mục của trường.</li>
                  <li>Có thể <span className="font-semibold text-slate-800">Thêm mục mới</span> hoặc chỉnh sửa điểm trực tiếp trên bảng.</li>
                </ul>
              </div>
            </div>

            {/* CỤM 2 TAB CHUYỂN ĐỔI (SUB-TABS NỔI BẬT) */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setRuleCategoryFilter('Discipline')}
                  className={`flex-1 py-3 text-center font-bold text-xs transition duration-200 cursor-pointer ${
                    ruleCategoryFilter === 'Discipline'
                      ? 'border-b-2 border-rose-600 text-rose-600 bg-rose-50/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  Mục Vi phạm / Điểm trừ ({(db?.SCORE_RULES || []).filter(r => r.category === 'Discipline').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRuleCategoryFilter('Reward')}
                  className={`flex-1 py-3 text-center font-bold text-xs transition duration-200 cursor-pointer ${
                    ruleCategoryFilter === 'Reward'
                      ? 'border-b-2 border-emerald-600 text-emerald-600 bg-emerald-50/20 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  Mục Khuyến khích / Điểm cộng ({(db?.SCORE_RULES || []).filter(r => r.category === 'Reward').length})
                </button>
              </div>

              {/* DÒNG TIÊU ĐỀ DANH SÁCH & NÚT THÊM MỚI */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50/50">
                <h5 className="font-bold text-slate-800 text-sm">
                  {ruleCategoryFilter === 'Discipline' ? 'Danh sách Điểm trừ (Vi phạm)' : 'Danh sách Điểm cộng (Khuyến khích)'}
                </h5>
                <button
                  type="button"
                  onClick={() => {
                    setNewRule({
                      code: ruleCategoryFilter === 'Discipline' ? 'VP' : 'T',
                      name: '',
                      points: ruleCategoryFilter === 'Discipline' ? -2 : 5,
                      category: ruleCategoryFilter
                    });
                    setShowRuleModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm mục mới
                </button>
              </div>

              {/* BẢNG DỮ LIỆU */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 text-[11px] uppercase tracking-wider">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-32 text-center">Mã Quy Chuẩn</th>
                      <th className="p-3">Nội Dung Quy Chuẩn / Hành Vi Rèn Luyện</th>
                      <th className="p-3 w-36 text-center">Mức Điểm Ghi Nhận</th>
                      <th className="p-3 w-28 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!(db?.SCORE_RULES || []).filter(r => r.category === ruleCategoryFilter).length ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                          Chưa có dữ liệu quy chuẩn điểm trong phân nhóm này. Hãy bấm "+ Thêm mục mới" hoặc "Tải lên từ Excel" để nhập liệu.
                        </td>
                      </tr>
                    ) : (
                      (db?.SCORE_RULES || [])
                        .filter(rule => rule.category === ruleCategoryFilter)
                        .map((rule, idx) => (
                          <tr key={rule.code} className="hover:bg-slate-50/50 transition">
                            <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                            <td className="p-3 text-center">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                                {rule.code}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-800 text-left max-w-md break-words">{rule.name}</td>
                            <td className="p-3 text-center font-bold text-sm">
                              <span className={rule.points > 0 ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' : 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100'}>
                                {rule.points > 0 ? `+${rule.points}` : rule.points}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingRule(rule)}
                                  className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded transition cursor-pointer"
                                  title="Chỉnh sửa quy chuẩn"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRuleToDelete(rule)}
                                  className="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Xóa quy chuẩn"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: STATS & RANKING */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">🔥 Top 5 Học Sinh Có Thành Tích Rèn Luyện Xuất Sắc Nhất</h4>
              <div className="space-y-3.5">
                {[...studentScores]
                  .sort((a, b) => b.currentScore - a.currentScore)
                  .slice(0, 5)
                  .map((s, idx) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-emerald-700 text-sm w-5">#{idx + 1}</span>
                        <div>
                          <h5 className="font-bold text-slate-800">{s.name}</h5>
                          <p className="text-[10px] text-slate-500">Mã HS: {s.id} | Lớp: {s.class}</p>
                        </div>
                      </div>
                      <span className="text-emerald-700 font-extrabold text-base">{s.currentScore} đ</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">⚠️ Danh Sách Các Lỗi Vi Phạm Phổ Biến Nhất</h4>
              <div className="space-y-3.5">
                {Array.from(new Set(db.LOGS_DISCIPLINE.filter(l => l.points < 0).map(l => l.rule_code)))
                  .slice(0, 5)
                  .map((code, idx) => {
                    const rule = db.SCORE_RULES.find(r => r.code === code);
                    const count = db.LOGS_DISCIPLINE.filter(l => l.rule_code === code).length;
                    return (
                      <div key={code} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg border border-rose-100">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-rose-700 text-xs font-mono bg-white px-2 py-0.5 rounded border border-rose-200">
                            {code}
                          </span>
                          <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={rule?.name}>
                            {rule ? rule.name : code}
                          </span>
                        </div>
                        <span className="text-slate-800 font-bold">{count} lượt vi phạm</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: LOCK DATA CONTROL */}
        {activeTab === 'lock' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-lg mx-auto text-center text-xs space-y-4">
            <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-center gap-2 text-left">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>Chốt kỳ rèn luyện rà soát:</strong> Khóa dữ liệu sẽ chặn mọi hành vi chỉnh sửa, cộng trừ hoặc điểm danh của Giáo viên chủ nhiệm.
              </span>
            </div>

            <div className="py-4">
              {activeConfig.is_locked ? (
                <div className="space-y-2">
                  <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-200">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Hệ Thống Số Liệu Hiện Đang Khóa</h4>
                  <p className="text-slate-500 max-w-sm mx-auto">Tất cả sổ tay chủ nhiệm, điểm rèn luyện tháng hiện đã được chốt và kết quả là cuối cùng.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200">
                    <Unlock className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Hệ Thống Số Liệu Đang Mở</h4>
                  <p className="text-slate-500 max-w-sm mx-auto">Giáo viên chủ nhiệm lớp vẫn có thể cập nhật điểm chuyên cần, ghi nhận vi phạm và merits.</p>
                </div>
              )}
            </div>

            <button
              onClick={handleToggleLock}
              className={`w-full py-2.5 rounded-lg font-bold transition cursor-pointer text-white ${
                activeConfig.is_locked 
                  ? 'bg-emerald-600 hover:bg-emerald-500' 
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {activeConfig.is_locked ? '🔓 MỞ KHÓA SỔ RÈN LUYỆN' : '🔒 KHÓA SỐ LIỆU ĐỊNH KỲ'}
            </button>
          </div>
        )}

        {/* TAB 9: BACKUP & DATABASE EXPORT */}
        {activeTab === 'backup' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-lg mx-auto text-xs space-y-5">
            <h4 className="font-bold text-slate-800 text-sm text-center">Sao Lưu & Khôi Phục Dữ Liệu Trường (.json)</h4>
            <p className="text-slate-500 text-center">Hỗ trợ sao lưu dự phòng toàn bộ cơ sở dữ liệu của trường học gồm Học sinh, USERS, và logs nề nếp.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleDownloadBackup}
                className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition text-center space-y-1.5 cursor-pointer"
              >
                <Download className="w-6 h-6 text-blue-600" />
                <span className="font-bold text-slate-800">Tải Bản Sao Lưu</span>
                <span className="text-[10px] text-slate-400">Export file .json</span>
              </button>

              <label className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition text-center space-y-1.5 cursor-pointer">
                <Upload className="w-6 h-6 text-indigo-600" />
                <span className="font-bold text-slate-800">Khôi Phục Dữ Liệu</span>
                <span className="text-[10px] text-slate-400">Import file .json</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleUploadBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* RESOLVE COMPLAINTS MODAL DISPLAY OVERLAY */}
      {showComplaintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden text-xs">
            <div className="bg-slate-850 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                Hồ Sơ Khiếu Nại Rèn Luyện Của Học Sinh
              </h3>
              <button onClick={() => setShowComplaintModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {pendingComplaints.length === 0 ? (
                <p className="text-center py-8 text-slate-400 italic">Không có đơn khiếu nại nào đang chờ giải quyết.</p>
              ) : (
                pendingComplaints.map(complaint => {
                  const student = db.STUDENTS.find(s => s.id === complaint.student_id);
                  const logItem = db.LOGS_DISCIPLINE.find(l => l.id === complaint.log_id);
                  const rule = logItem ? db.SCORE_RULES.find(r => r.code === logItem.rule_code) : null;

                  return (
                    <div key={complaint.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">
                            {student ? student.name : 'Unknown'} (Lớp {student?.class})
                          </span>
                          <p className="text-[10px] text-slate-500">Mã HS: {complaint.student_id} | Ngày gửi: {complaint.created_at}</p>
                        </div>
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                          Đang chờ duyệt
                        </span>
                      </div>

                      <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded text-[11px] text-slate-700">
                        <strong>Lỗi ghi nhận gốc:</strong> {logItem?.date} - <strong>{rule ? rule.name : logItem?.rule_code} ({logItem?.points}đ)</strong>. 
                        <br />
                        <span className="italic text-slate-500">Ghi chú gốc: "{logItem?.notes}"</span>
                      </div>

                      <div className="space-y-1">
                        <span className="font-semibold text-slate-700">Lý do giải trình của học sinh:</span>
                        <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200 leading-relaxed italic">
                          "{complaint.reason}"
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => {
                            const reasonFeedback = prompt('Nhập lý do từ chối khiếu nại này:');
                            if (reasonFeedback !== null) {
                              handleResolveComplaint(complaint.id, 'Rejected', reasonFeedback);
                            }
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-3.5 py-1.5 rounded transition cursor-pointer"
                        >
                          Từ Chối
                        </button>
                        <button
                          onClick={() => {
                            const aprConfirm = window.confirm('Chấp nhận khiếu nại này? Hệ thống sẽ tự động điều chỉnh log vi phạm của học sinh về 0 điểm.');
                            if (aprConfirm) {
                              handleResolveComplaint(complaint.id, 'Approved', 'Ban Giám Hiệu đã phê duyệt hoàn trả điểm số.');
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3.5 py-1.5 rounded transition cursor-pointer"
                        >
                          Chấp Thuận &amp; Hoàn Điểm
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK LOG MODAL DIALOG */}
      {showLogModal && db && (
        <InputDrawer
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          db={db}
          recordedBy={session.username || 'School Admin'}
          termMonth={selectedMonth}
          defaultClass={selectedClass}
          onSave={handleSaveMultipleConductLogs}
        />
      )}

      {/* CREATE STUDENT MODAL */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold">THÊM HỌC SINH MỚI THỦ CÔNG</h3>
            </div>
            <form onSubmit={handleCreateStudent} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mã Học Sinh (Tự sinh)</label>
                  <input
                    type="text"
                    disabled
                    value={newStudentIdState}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-bold font-mono text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mã VnEdu (10 chữ số)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="VD: 2401234567"
                    value={newStudent.vnedu_code}
                    onChange={(e) => setNewStudent({ ...newStudent, vnedu_code: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn Nam"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Chọn Lớp *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 10A1"
                    value={newStudent.class}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Giới tính</label>
                  <select
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Ngày sinh</label>
                <input
                  type="date"
                  value={newStudent.birth_date}
                  onChange={(e) => setNewStudent({ ...newStudent, birth_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mật khẩu mặc định</label>
                <input
                  type="text"
                  required
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Họ tên Phụ huynh</label>
                <input
                  type="text"
                  placeholder="Họ tên cha hoặc mẹ..."
                  value={newStudent.parent_name}
                  onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Số Điện Thoại Phụ Huynh</label>
                <input
                  type="text"
                  placeholder="SĐT để liên hệ và gửi Phiếu..."
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Thêm Mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold">SỬA THÔNG TIN HỌC SINH</h3>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!db || !editingStudent) return;
              
              if (!editingStudent.name || !editingStudent.class) {
                alert('Vui lòng điền đầy đủ họ tên và lớp.');
                return;
              }

              const updatedStudents = db.STUDENTS.map(s => {
                if (s.id === editingStudent.id) {
                  const val = editingStudent.vnedu_code || editingStudent.vneduId;
                  const cleanVal = val ? String(val).trim() : undefined;
                  return {
                    ...editingStudent,
                    vnedu_code: cleanVal,
                    vneduId: cleanVal
                  };
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
            }} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mã Học Sinh (Không thể sửa)</label>
                  <input
                    type="text"
                    disabled
                    value={editingStudent.id}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-mono text-slate-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mã VnEdu (10 chữ số)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="VD: 2401234567"
                    value={editingStudent.vnedu_code || editingStudent.vneduId || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, vnedu_code: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn Nam"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Lớp *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 10A1"
                    value={editingStudent.class}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-blue-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Giới tính</label>
                  <select
                    value={editingStudent.gender || 'Nam'}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Ngày sinh</label>
                <input
                  type="date"
                  value={editingStudent.birth_date}
                  onChange={(e) => setEditingStudent({ ...editingStudent, birth_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mật khẩu</label>
                <input
                  type="text"
                  required
                  value={editingStudent.password}
                  onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-indigo-600 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Họ tên Phụ huynh</label>
                <input
                  type="text"
                  placeholder="Họ tên cha hoặc mẹ..."
                  value={editingStudent.parent_name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Số Điện Thoại Phụ Huynh</label>
                <input
                  type="text"
                  placeholder="SĐT liên lạc..."
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEACHER ACCOUNT MODAL */}
      {showTeacherModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold">CẤP TÀI KHOẢN GIÁO VIÊN CHỦ NHIỆM</h3>
            </div>
             <form onSubmit={handleCreateTeacher} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ID Giáo Viên *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: GV004"
                  value={newTeacher.id}
                  onChange={(e) => setNewTeacher({ ...newTeacher, id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Họ và tên GV</label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn B"
                  value={newTeacher.full_name || ''}
                  onChange={(e) => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tên Tài Khoản Đăng Nhập *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: gv_nguyenvanb"
                  value={newTeacher.username}
                  onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mật khẩu ban đầu</label>
                <input
                  type="password"
                  required
                  value={newTeacher.password}
                  onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Phân Công Lớp Chủ Nhiệm</label>
                <input
                  type="text"
                  placeholder="VD: 10A1, 11B1... (Bỏ trống nếu chưa phân lớp)"
                  value={newTeacher.class_assigned}
                  onChange={(e) => setNewTeacher({ ...newTeacher, class_assigned: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-bold text-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Cập Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEACHER ACCOUNT MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold">SỬA THÔNG TIN GIÁO VIÊN CHỦ NHIỆM</h3>
            </div>
            <form onSubmit={handleUpdateTeacher} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ID Giáo Viên (Không thể sửa)</label>
                <input
                  type="text"
                  disabled
                  value={editingTeacher.id}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono text-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Họ và tên GV</label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn B"
                  value={editingTeacher.full_name || ''}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tên Tài Khoản Đăng Nhập *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: gv_nguyenvanb"
                  value={editingTeacher.username}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, username: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mật khẩu</label>
                <input
                  type="text"
                  required
                  value={editingTeacher.password}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Phân Công Lớp Chủ Nhiệm</label>
                <input
                  type="text"
                  placeholder="VD: 10A1, 11B1... (Bỏ trống nếu chưa phân lớp)"
                  value={editingTeacher.class_assigned}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, class_assigned: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-bold text-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW POINT RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold">THÊM QUY CHUẨN ĐIỂM RÈN LUYỆN</h3>
            </div>
            <form onSubmit={handleCreateRule} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mã Quy Chuẩn *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: VP16, KT07"
                    value={newRule.code}
                    onChange={(e) => setNewRule({ ...newRule, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Loại Quy Chuẩn</label>
                  <select
                    value={newRule.category}
                    onChange={(e) => {
                      const cat = e.target.value as 'Discipline' | 'Reward';
                      setNewRule({ ...newRule, category: cat, points: cat === 'Reward' ? 5 : -5 });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="Discipline">Vi Phạm (-)</option>
                    <option value="Reward">Điểm Thưởng (+)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tên Hành Vi Nề Nếp *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Đi xe đạp điện không đội mũ bảo hiểm"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Giá trị điểm (+/-)</label>
                <input
                  type="number"
                  required
                  placeholder="VD: -5, 10"
                  value={newRule.points}
                  onChange={(e) => setNewRule({ ...newRule, points: Number(e.target.value) || -5 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition cursor-pointer"
                >
                  Thêm Quy Chuẩn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 1. CUSTOM MODAL: DELETE SINGLE STUDENT */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xác nhận xóa học sinh?</h3>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xoá học sinh <strong className="text-slate-900">"{studentToDelete.name}"</strong> với mã số <strong className="text-blue-600">({studentToDelete.id})</strong> thuộc lớp <strong className="text-indigo-600">{studentToDelete.class}</strong> khỏi hệ thống?
              </p>
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-700 leading-normal text-[11px]">
                ⚠️ Hành động này sẽ xóa đồng thời tất cả lịch sử rèn luyện, nhật ký lỗi vi phạm, khen thưởng, điểm danh chuyên cần và khiếu nại liên quan của học sinh này.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
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

      {/* 2. CUSTOM MODAL: RESET PASSWORD */}
      {studentToResetPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800">
            <div className="bg-amber-500 text-white p-4 flex items-center gap-2">
              <Key className="w-5 h-5" />
              <h3 className="font-bold text-sm">Đặt lại mật khẩu mặc định?</h3>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn đặt lại mật khẩu cho học sinh <strong className="text-slate-900">"{studentToResetPassword.name}"</strong> (<strong className="text-blue-600">{studentToResetPassword.id}</strong>) về mật khẩu mặc định <strong className="text-indigo-600">123456</strong>?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToResetPassword(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeResetPassword}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Đặt lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CUSTOM MODAL: DELETE STUDENTS BY CLASS */}
      {classToDeleteStudents && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xóa học sinh theo lớp?</h3>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa toàn bộ học sinh của lớp <strong className="text-slate-900">"{classToDeleteStudents}"</strong> khỏi hệ thống?
              </p>
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-700 leading-normal text-[11px]">
                ⚠️ <strong>CẢNH BÁO BẢO MẬT:</strong> Hành động này sẽ xóa sạch tất cả học sinh của lớp này kèm theo các nhật ký rèn luyện, điểm danh và khiếu nại liên quan.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClassToDeleteStudents(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeDeleteStudentsByClass}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CUSTOM MODAL: CLEAR ALL STUDENTS */}
      {showClearAllStudentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-slate-800">
            <div className="bg-red-600 text-white p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">XÓA TOÀN BỘ HỌC SINH TOÀN TRƯỜNG?</h3>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn đang yêu cầu xóa <strong className="text-red-600">TOÀN BỘ</strong> học sinh của trường. Hành động này sẽ xóa sạch dữ liệu điểm danh, nhật ký vi phạm/khen thưởng, khiếu nại của <strong className="text-red-600">TOÀN TRƯỜNG</strong>.
              </p>
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-700 leading-normal text-[11px]">
                ⚠️ <strong>CẢNH BÁO NGUY HIỂM CẤP CAO:</strong> Hành động này không thể hoàn tác. Để xác nhận hành động nguy hiểm này, vui lòng nhập chữ <strong>XOA TOAN BO</strong> (viết hoa không dấu) vào ô bên dưới:
              </div>
              <input
                type="text"
                placeholder="Nhập XOA TOAN BO để xác nhận"
                value={clearAllSafetyInput}
                onChange={(e) => setClearAllSafetyInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono font-bold text-center text-slate-800 outline-none focus:border-red-600 focus:bg-white text-xs"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowClearAllStudentsModal(false); setClearAllSafetyInput(''); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeClearAllStudents}
                  disabled={clearAllSafetyInput !== 'XOA TOAN BO'}
                  className={`px-4 py-2 rounded-lg font-bold transition text-white ${
                    clearAllSafetyInput === 'XOA TOAN BO'
                      ? 'bg-red-600 hover:bg-red-500 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  Xóa toàn bộ học sinh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CUSTOM MODAL: DELETE TEACHER */}
      {teacherToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xác nhận xóa tài khoản giáo viên?</h3>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa tài khoản Giáo viên Chủ nhiệm <strong className="text-slate-900">"{teacherToDelete.full_name || teacherToDelete.username}"</strong> (<strong className="text-blue-600">{teacherToDelete.username}</strong>) khỏi hệ thống?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTeacherToDelete(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeDeleteTeacher}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CUSTOM MODAL: EXPORT BATCH PDF */}
      {showExportBatchPdfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800">
            <div className="bg-blue-600 text-white p-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xuất Phiếu Liên Lạc Hàng Loạt?</h3>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xuất Phiếu liên lạc rèn luyện hàng loạt cho tất cả học sinh lớp <strong className="text-slate-900">"{selectedClass === 'Tất cả' ? '10A1' : selectedClass}"</strong>?
              </p>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Tập tin tải về sẽ chứa tất cả Phiếu liên lạc rèn luyện của học sinh lớp này và được nén dưới định dạng <strong>.ZIP</strong>. Quá trình xử lý có thể mất vài giây.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExportBatchPdfModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeExportBatchPdf}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Tải về file .ZIP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. CUSTOM MODAL: IMPORT RULES FROM EXCEL */}
      {showImportRulesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-slate-800 text-xs">
            <div className="bg-indigo-600 text-white p-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              <h3 className="font-bold text-sm">Nhập Danh Mục Điểm Từ Excel</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Tải lên tệp Excel chứa danh mục quy chuẩn điểm trừ (vi phạm) và điểm cộng (khen thưởng) cho trường của bạn.
              </p>

              {/* Import options */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Chọn chế độ nhập dữ liệu:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportRulesMode('merge')}
                    className={`p-3 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                      importRulesMode === 'merge'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Bổ sung dữ liệu
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">(Giữ lại mục cũ, ghi đè khi trùng mã)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportRulesMode('overwrite')}
                    className={`p-3 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                      importRulesMode === 'overwrite'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Ghi đè hoàn toàn
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">(Xóa sạch cũ trước khi nạp mới)</span>
                  </button>
                </div>
              </div>

              {/* Drag/Drop and File picker */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 hover:bg-slate-50 transition text-center space-y-2 relative">
                <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto" />
                <div>
                  <p className="font-bold text-slate-700">Chọn tệp danh mục của bạn</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Chấp nhận .XLSX, .XLS (Cần có sheet "DiemTru" và "DiemCong")</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportRulesExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title=""
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportRulesModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. CUSTOM MODAL: CLEAR ALL RULES */}
      {showClearRulesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800 text-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xóa Toàn Bộ Danh Mục Điểm?</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Hành động này sẽ <strong>xóa sạch hoàn toàn</strong> toàn bộ các mục điểm trừ (vi phạm) và điểm cộng (khen thưởng) hiện có trong hệ thống của trường.
              </p>
              <div className="bg-rose-50 text-rose-700 p-3 rounded-lg border border-rose-100 font-semibold">
                Cảnh báo: Hành động này không thể hoàn tác. Điểm rèn luyện của học sinh dựa trên các mã này vẫn được lưu nhưng sẽ không hiển thị đúng tên quy tắc nếu bị xóa.
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Để xác nhận, nhập chữ <strong className="text-rose-600">XOA</strong> bên dưới:</label>
                <input
                  type="text"
                  value={clearRulesSafetyInput}
                  onChange={(e) => setClearRulesSafetyInput(e.target.value)}
                  placeholder="Nhập XOA..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-bold text-center tracking-widest text-slate-800 text-sm focus:border-rose-500 uppercase"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearRulesModal(false);
                    setClearRulesSafetyInput('');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleClearAllRules}
                  disabled={clearRulesSafetyInput !== 'XOA'}
                  className={`font-bold px-4 py-2 rounded-lg transition cursor-pointer ${
                    clearRulesSafetyInput === 'XOA'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Xác nhận xóa sạch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. CUSTOM MODAL: EDIT POINT RULE */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800 text-xs">
            <div className="bg-blue-600 text-white p-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              <h3 className="font-bold text-sm">CHỈNH SỬA QUY CHUẨN ĐIỂM</h3>
            </div>
            <form onSubmit={handleUpdateRule} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mã Quy Chuẩn</label>
                  <input
                    type="text"
                    disabled
                    value={editingRule.code}
                    className="w-full bg-slate-150 border border-slate-200 rounded-lg p-2 focus:outline-none font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Loại Quy Chuẩn</label>
                  <span className={`w-full block border rounded-lg p-2 font-bold text-center ${
                    editingRule.category === 'Reward' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}>
                    {editingRule.category === 'Reward' ? 'Khuyến Khích (+)' : 'Vi Phạm (-)'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Hành Vi Nề Nếp / Quy Chuẩn *</label>
                <textarea
                  required
                  rows={3}
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none font-semibold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mức Điểm Thay Đổi *</label>
                <input
                  type="number"
                  required
                  value={editingRule.points}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditingRule({ ...editingRule, points: val });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none font-bold text-slate-800"
                />
                <span className="text-[10px] text-slate-400">
                  {editingRule.category === 'Reward' 
                    ? 'Nhập số dương lớn hơn 0 (ví dụ: 5, 10)' 
                    : 'Nhập số âm nhỏ hơn 0 (ví dụ: -2, -5, -10)'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. CUSTOM MODAL: DELETE SPECIFIC RULE */}
      {ruleToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-slate-800 text-xs">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xóa Quy Chuẩn Điểm Rèn Luyện?</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa quy chuẩn điểm rèn luyện sau đây khỏi hệ thống của trường?
              </p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                <p><strong>Mã:</strong> {ruleToDelete.code}</p>
                <p className="font-sans font-semibold text-slate-800"><strong>Hành vi:</strong> {ruleToDelete.name}</p>
                <p><strong>Số điểm:</strong> <span className={ruleToDelete.points > 0 ? 'text-emerald-600' : 'text-rose-600'}>{ruleToDelete.points}đ</span></p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRuleToDelete(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(ruleToDelete.code)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT LOG HISTORY MODAL */}
      {selectedStudentForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Nhật Ký Rèn Luyện Chi Tiết</h3>
                  <p className="text-slate-500 text-[11px]">Học sinh: <strong className="text-slate-700">{selectedStudentForHistory.name}</strong> ({selectedStudentForHistory.class}) · Mã HS: <span className="font-mono">{selectedStudentForHistory.id}</span></p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentForHistory(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Summary Panel */}
            {(() => {
              const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
              const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
              const termMonthsList = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;

              const allSLogs = db?.LOGS_DISCIPLINE.filter(l => l.student_id === selectedStudentForHistory.id) || [];
              const sLogsMonth = allSLogs.filter(l => l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth));
              const totalMinus = sLogsMonth.filter(l => l.points < 0).reduce((acc, c) => acc + c.points, 0);
              const totalPlus = sLogsMonth.filter(l => l.points > 0).reduce((acc, c) => acc + c.points, 0);
              const currentScore = Math.max(0, Math.min(100, 100 + totalMinus + totalPlus));

              const termResult = evaluateSemesterResult(selectedStudentForHistory.id, termMonthsList, db?.LOGS_DISCIPLINE || []);

              return (
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Điểm trừ ({getMonthAbbreviation(selectedMonth)})</span>
                    <span className="text-sm font-bold text-rose-600">{totalMinus}đ</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Điểm cộng ({getMonthAbbreviation(selectedMonth)})</span>
                    <span className="text-sm font-bold text-emerald-600">+{totalPlus}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Điểm {getMonthAbbreviation(selectedMonth)}</span>
                    <span className="text-sm font-extrabold text-blue-600">{currentScore}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide block">TB Học Kỳ</span>
                    <span className="text-sm font-extrabold text-slate-800">{termResult.average}</span>
                  </div>
                </div>
              );
            })()}

            {/* Logs Timeline */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {(() => {
                const studentLogs = db?.LOGS_DISCIPLINE.filter(l => l.student_id === selectedStudentForHistory.id) || [];
                
                if (studentLogs.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-400">
                      Chưa có bất kỳ ghi nhận rèn luyện nào cho học sinh này.
                    </div>
                  );
                }

                return (
                  <div className="border-l-2 border-slate-150 pl-4 space-y-4 py-2 ml-2">
                    {studentLogs.map((log) => {
                      const rule = db?.SCORE_RULES.find(r => r.code === log.rule_code);
                      const isDiscipline = log.points < 0;
                      
                      return (
                        <div key={log.id} className="relative">
                          {/* Circle marker */}
                          <div className={`absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border-2 bg-white ${
                            isDiscipline ? 'border-rose-500' : 'border-emerald-500'
                          }`}></div>
                          
                          {/* Card */}
                          <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 space-y-1.5 shadow-3xs">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isDiscipline ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {log.rule_code}
                                </span>
                                <span className="text-slate-500 text-[10px] font-mono">{log.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleStartEditLog(log)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                    title="Sửa bản ghi"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(log.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                    title="Xóa bản ghi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className={`font-bold font-mono ${
                                  isDiscipline ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {isDiscipline ? `${log.points}đ` : `+${log.points}`}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-slate-700 font-medium">
                              {rule ? rule.name : log.notes}
                            </p>
                            
                            {log.notes && log.notes !== rule?.name && (
                              <p className="text-slate-500 text-[11px] bg-white p-1.5 rounded border border-slate-100">
                                <strong>Ghi chú:</strong> {log.notes}
                              </p>
                            )}

                            {log.evidence_base64 && (
                              <div className="flex items-center gap-1.5 mt-1 pb-1">
                                <button
                                  type="button"
                                  onClick={() => setLightboxImage(log.evidence_base64 || null)}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer transition"
                                >
                                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Xem minh chứng</span>
                                </button>
                                <img
                                  src={log.evidence_base64}
                                  alt="Minh chứng"
                                  className="w-8 h-8 object-cover rounded border border-slate-200 cursor-zoom-in"
                                  onClick={() => setLightboxImage(log.evidence_base64 || null)}
                                />
                              </div>
                            )}

                            <div className="text-[10px] text-slate-400 flex justify-between items-center pt-1 border-t border-slate-100">
                              <span>Tháng ghi: {getMonthFromDateStr(log.date)}</span>
                              <span>Người ghi: {log.recorded_by}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-150 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentForHistory(null)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LOG MODAL OVERLAY */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 text-xs">
            {/* Header */}
            <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-blue-700 text-white">
              <h3 className="font-bold flex items-center gap-1.5">
                <Pencil className="w-4 h-4" />
                Chỉnh Sửa Bản Ghi Rèn Luyện
              </h3>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditLog} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Ngày ghi nhận *</label>
                <input
                  type="date"
                  required
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1 relative">
                <label className="font-semibold text-slate-700">Nội dung rèn luyện *</label>
                
                {/* Searchable Input trigger */}
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Gõ mã, tên lỗi hoặc điểm để tìm kiếm..."
                    value={ruleSearchQuery}
                    onFocus={() => setIsRuleDropdownOpen(true)}
                    onChange={(e) => {
                      setRuleSearchQuery(e.target.value);
                      setIsRuleDropdownOpen(true);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 pr-8 outline-none focus:border-blue-500 focus:bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setIsRuleDropdownOpen(!isRuleDropdownOpen)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isRuleDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Dropdown Options List */}
                {isRuleDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[240px] overflow-y-auto z-55 py-1 text-xs">
                    {(() => {
                      const rules = db?.SCORE_RULES || [];
                      const filtered = rules.filter(r => {
                        const q = ruleSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        const nameNormal = r.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        const codeNormal = r.code.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        const pointsStr = String(r.points);
                        return nameNormal.includes(q) || codeNormal.includes(q) || pointsStr.includes(q);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-center text-slate-400 italic">
                            Không tìm thấy nội dung phù hợp
                          </div>
                        );
                      }

                      // Split into Reward and Discipline groups for beautiful clear grouping
                      const rewardRules = filtered.filter(r => r.category === 'Reward');
                      const disciplineRules = filtered.filter(r => r.category === 'Discipline');

                      return (
                        <>
                          {rewardRules.length > 0 && (
                            <div>
                              <div className="bg-emerald-50 text-emerald-800 font-bold px-2 py-1 text-[10px] uppercase tracking-wider border-y border-emerald-100">
                                Khen thưởng
                              </div>
                              {rewardRules.map(r => (
                                <button
                                  type="button"
                                  key={r.code}
                                  onClick={() => {
                                    setEditLogRuleCode(r.code);
                                    setEditLogPoints(r.points);
                                    setRuleSearchQuery(`[${r.code}] ${r.name}`);
                                    setIsRuleDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between items-center transition cursor-pointer"
                                >
                                  <span className="font-medium text-slate-800">
                                    <span className="font-bold text-slate-400 font-mono mr-1">[{r.code}]</span>
                                    {r.name}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    +{r.points}đ
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {disciplineRules.length > 0 && (
                            <div>
                              <div className="bg-rose-50 text-rose-800 font-bold px-2 py-1 text-[10px] uppercase tracking-wider border-y border-rose-100">
                                Vi phạm / Nội quy
                              </div>
                              {disciplineRules.map(r => (
                                <button
                                  type="button"
                                  key={r.code}
                                  onClick={() => {
                                    setEditLogRuleCode(r.code);
                                    setEditLogPoints(r.points);
                                    setRuleSearchQuery(`[${r.code}] ${r.name}`);
                                    setIsRuleDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between items-center transition cursor-pointer"
                                >
                                  <span className="font-medium text-slate-800">
                                    <span className="font-bold text-slate-400 font-mono mr-1">[{r.code}]</span>
                                    {r.name}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                    {r.points}đ
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Điểm số thay đổi *</label>
                <input
                  type="number"
                  required
                  value={editLogPoints}
                  onChange={(e) => setEditLogPoints(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Ghi chú chi tiết</label>
                <textarea
                  value={editLogNotes}
                  onChange={(e) => setEditLogNotes(e.target.value)}
                  rows={3}
                  placeholder="Ghi nhận cụ thể diễn biến hành vi..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-blue-500 focus:bg-white resize-none text-xs"
                />
              </div>

              {/* Minh chứng upload */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Hình ảnh minh chứng</label>
                {editLogEvidence ? (
                  <div className="relative inline-block">
                    <img
                      src={editLogEvidence}
                      alt="Minh chứng"
                      className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setEditLogEvidence(undefined)}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-lg p-3 text-center transition cursor-pointer relative bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditLogEvidence(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Camera className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-500 font-medium block">Tải ảnh lên hoặc chụp từ camera</span>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg cursor-pointer shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX / IMAGE PREVIEW MODAL */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-60 animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full cursor-pointer transition border border-white/10 shadow-lg"
              title="Đóng xem ảnh"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Minh chứng chi tiết"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10 animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* DELETE LOG CONFIRMATION MODAL */}
      {logToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="bg-rose-700 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-1.5 text-xs text-white">
                <AlertTriangle className="w-4 h-4" />
                Xác nhận xóa bản ghi
              </h3>
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="text-white hover:text-white/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-slate-600 font-medium leading-relaxed">
                Bạn có chắc chắn muốn xóa bản ghi rèn luyện này? Điểm tổng kết của học sinh sẽ được tính toán lại.
              </p>
              {(() => {
                const rule = db?.SCORE_RULES.find(r => r.code === logToDelete.rule_code);
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-slate-800 font-mono">[{logToDelete.rule_code}] {rule ? rule.name : logToDelete.notes}</p>
                    <p className="text-slate-500 text-[10px]">Ngày: {logToDelete.date} | Điểm: {logToDelete.points > 0 ? `+${logToDelete.points}` : logToDelete.points}đ</p>
                    {logToDelete.notes && logToDelete.notes !== rule?.name && (
                      <p className="text-slate-500 italic text-[10px]">Ghi chú: "{logToDelete.notes}"</p>
                    )}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogToDelete(null)}
                className="bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 font-semibold px-4 py-2 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeDeleteLog}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE SHEETS BATCH SYNCING PROGRESS DIALOG */}
      {syncingProgress !== null && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Đồng Bộ Google Sheets Theo Mẻ</h3>
                <p className="text-slate-400 text-[10.5px]">Tránh tràn tải và lỗi timeout của Google Apps Script</p>
              </div>
            </div>
            
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Trạng thái:</span>
                <span className="font-bold font-mono text-blue-600">{syncingProgress}%</span>
              </div>
              <p className="text-slate-500 font-mono italic leading-relaxed text-[10.5px] bg-slate-50 border border-slate-150 p-2 rounded">
                {syncingMessage}
              </p>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 shadow-xs" 
                style={{ width: `${syncingProgress}%` }}
              ></div>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center">
              Vui lòng không đóng trình duyệt hoặc ngắt kết nối mạng cho đến khi đồng bộ hoàn tất.
            </p>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}
