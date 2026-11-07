import React, { useState, useEffect, useRef } from 'react';
import { SchoolData, Student, ScoreRule } from '../types';
import { formatAttendanceCode } from '../lib/AttendanceHelper';
import { 
  X, 
  Calendar, 
  Search, 
  Camera, 
  Image as ImageIcon, 
  Check, 
  Trash2,
  Info
} from 'lucide-react';

export const ATTENDANCE_RULES: ScoreRule[] = [
  { code: 'VP_N_SP', name: 'Nghỉ học có phép (Sáng) (SP)', points: 0, category: 'Discipline' },
  { code: 'VP_N_SK', name: 'Nghỉ học không phép (Sáng) (SK)', points: -5, category: 'Discipline' },
  { code: 'VP_N_CP', name: 'Nghỉ học có phép (Chiều) (CP)', points: 0, category: 'Discipline' },
  { code: 'VP_N_CK', name: 'Nghỉ học không phép (Chiều) (CK)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_S1', name: 'Bỏ tiết học (Tiết 1 S)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_S2', name: 'Bỏ tiết học (Tiết 2 S)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_S3', name: 'Bỏ tiết học (Tiết 3 S)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_S4', name: 'Bỏ tiết học (Tiết 4 S)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_S5', name: 'Bỏ tiết học (Tiết 5 S)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_C1', name: 'Bỏ tiết học (Tiết 1 C)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_C2', name: 'Bỏ tiết học (Tiết 2 C)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_C3', name: 'Bỏ tiết học (Tiết 3 C)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_C4', name: 'Bỏ tiết học (Tiết 4 C)', points: -5, category: 'Discipline' },
  { code: 'VP_BT_C5', name: 'Bỏ tiết học (Tiết 5 C)', points: -5, category: 'Discipline' },
];

interface InputDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  db: SchoolData;
  recordedBy: string;
  termMonth: string;
  onSave: (
    studentId: string, 
    logs: { ruleCode: string; points: number; notes: string; date: string; evidence_base64?: string }[],
    attendance?: {
      date: string;
      student_id: string;
      status: 'SP' | 'SK' | 'CP' | 'CK' | 'Tiet';
      attendance: {
        type: 'SP' | 'SK' | 'CP' | 'CK' | 'Tiet';
        periods: string[];
        note?: string;
      }
    }
  ) => void;
  defaultClass?: string;
}

export default function InputDrawer({
  isOpen,
  onClose,
  db,
  recordedBy,
  termMonth,
  onSave,
  defaultClass = 'Tất cả'
}: InputDrawerProps) {
  // 1. Time & Category state
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<'Discipline' | 'Reward'>('Discipline');

  // 2. Student Search & Select state
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 3. Rule Search & Select state
  const [ruleSearch, setRuleSearch] = useState<string>('');
  const [selectedRuleCodes, setSelectedRuleCodes] = useState<string[]>([]);

  // 4. Notes & Evidence state
  const [notes, setNotes] = useState<string>('');
  const [evidenceBase64, setEvidenceBase64] = useState<string>('');
  
  // 5. Automatic Attendance Assistant state
  const [morningType, setMorningType] = useState<'SP' | 'SK' | null>(null);
  const [afternoonType, setAfternoonType] = useState<'CP' | 'CK' | null>(null);
  const [attendancePeriods, setAttendancePeriods] = useState<string[]>([]);
  const [showAttendanceAssistant, setShowAttendanceAssistant] = useState<boolean>(false);
  const [manualShowAttendance, setManualShowAttendance] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge database rules with standard attendance rules
  const allRules = [...db.SCORE_RULES];
  ATTENDANCE_RULES.forEach(attRule => {
    if (!allRules.some(r => r.code === attRule.code)) {
      allRules.push(attRule);
    }
  });

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setLogDate(new Date().toISOString().split('T')[0]);
      setCategory('Discipline');
      setStudentSearch('');
      setSelectedStudent(null);
      setRuleSearch('');
      setSelectedRuleCodes([]);
      setNotes('');
      setEvidenceBase64('');
      setMorningType(null);
      setAfternoonType(null);
      setAttendancePeriods([]);
      setShowAttendanceAssistant(false);
      setManualShowAttendance(false);
    }
  }, [isOpen]);

  // Check if any selected rule is attendance-related
  const hasAttendanceKeyword = selectedRuleCodes.some(code => {
    const rule = allRules.find(r => r.code === code);
    if (!rule) return false;
    const nameLower = rule.name.toLowerCase();
    return nameLower.includes('bỏ tiết') || nameLower.includes('nghỉ học') || nameLower.includes('vắng') || nameLower.includes('tiết');
  });

  // Auto show attendance assistant if relevant rule selected
  useEffect(() => {
    if (hasAttendanceKeyword) {
      setShowAttendanceAssistant(true);
    } else if (!manualShowAttendance) {
      setShowAttendanceAssistant(false);
    }
  }, [hasAttendanceKeyword, manualShowAttendance]);

  // Sync selected rules to attendance states
  useEffect(() => {
    // 1. Detect morning absence
    let mType: 'SP' | 'SK' | null = null;
    if (selectedRuleCodes.includes('VP_N_SP')) mType = 'SP';
    else if (selectedRuleCodes.includes('VP_N_SK')) mType = 'SK';
    setMorningType(mType);

    // 2. Detect afternoon absence
    let aType: 'CP' | 'CK' | null = null;
    if (selectedRuleCodes.includes('VP_N_CP')) aType = 'CP';
    else if (selectedRuleCodes.includes('VP_N_CK')) aType = 'CK';
    setAfternoonType(aType);

    // 3. Detect periods
    const periods: string[] = [];
    const periodMapping: Record<string, string> = {
      'VP_BT_S1': 'S1', 'VP_BT_S2': 'S2', 'VP_BT_S3': 'S3', 'VP_BT_S4': 'S4', 'VP_BT_S5': 'S5',
      'VP_BT_C1': 'C1', 'VP_BT_C2': 'C2', 'VP_BT_C3': 'C3', 'VP_BT_C4': 'C4', 'VP_BT_C5': 'C5'
    };
    Object.entries(periodMapping).forEach(([ruleCode, periodKey]) => {
      if (selectedRuleCodes.includes(ruleCode)) {
        periods.push(periodKey);
      }
    });
    setAttendancePeriods(periods);
  }, [selectedRuleCodes]);

  // Calculate formatted attendance code according to Request 9
  const displayAttendanceCode = formatAttendanceCode({
    morningType,
    afternoonType,
    morningPeriods: attendancePeriods.filter(p => p.startsWith('S')),
    afternoonPeriods: attendancePeriods.filter(p => p.startsWith('C'))
  });

  // Auto generate standard note format when attendance parameters change
  useEffect(() => {
    if (displayAttendanceCode) {
      setNotes(displayAttendanceCode);
    }
  }, [displayAttendanceCode]);

  if (!isOpen) return null;

  // Filter students
  const filteredStudents = db.STUDENTS.filter(s => {
    if (defaultClass !== 'Tất cả' && s.class !== defaultClass) {
      return false;
    }
    if (!studentSearch.trim()) return true;
    const query = studentSearch.toLowerCase();
    const matchesVnEdu = (s.vnedu_code ? s.vnedu_code.toLowerCase().includes(query) : false) || (s.vneduId ? s.vneduId.toLowerCase().includes(query) : false);
    return s.id.toLowerCase().includes(query) || s.name.toLowerCase().includes(query) || s.class.toLowerCase().includes(query) || matchesVnEdu;
  });

  // Filter rules
  const filteredRules = allRules.filter(r => {
    if (r.category !== category) return false;
    if (!ruleSearch.trim()) return true;
    const query = ruleSearch.toLowerCase();
    return r.code.toLowerCase().includes(query) || r.name.toLowerCase().includes(query);
  });

  // Handle rule checkbox toggle
  const handleToggleRule = (code: string) => {
    setSelectedRuleCodes(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  // Toggle from attendance assistant to rules list
  const handleToggleAttendanceType = (type: 'SP' | 'SK' | 'CP' | 'CK') => {
    setSelectedRuleCodes(prev => {
      const targetRule = `VP_N_${type}`;
      const isAlreadySelected = prev.includes(targetRule);

      let filtered = prev;
      if (type === 'SP' || type === 'SK') {
        filtered = filtered.filter(code => code !== 'VP_N_SP' && code !== 'VP_N_SK');
      } else {
        filtered = filtered.filter(code => code !== 'VP_N_CP' && code !== 'VP_N_CK');
      }

      if (!isAlreadySelected) {
        filtered.push(targetRule);
      }
      return filtered;
    });
  };

  const handleTogglePeriod = (period: string) => {
    setSelectedRuleCodes(prev => {
      const targetCode = `VP_BT_${period}`;
      if (prev.includes(targetCode)) {
        return prev.filter(c => c !== targetCode);
      } else {
        return [...prev, targetCode];
      }
    });
  };

  // Image upload handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidenceBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidenceBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setEvidenceBase64(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setEvidenceBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Vui lòng chọn học sinh trước khi lưu.');
      return;
    }
    if (selectedRuleCodes.length === 0) {
      alert('Vui lòng chọn ít nhất một nội dung vi phạm / khen thưởng.');
      return;
    }

    const logsToCreate = selectedRuleCodes.map(code => {
      const rule = allRules.find(r => r.code === code);
      return {
        ruleCode: code,
        points: rule ? rule.points : (category === 'Discipline' ? -2 : 2),
        notes: notes.trim(),
        date: logDate,
        evidence_base64: evidenceBase64 || undefined
      };
    });

    const hasAttendanceData = morningType || afternoonType || attendancePeriods.length > 0;
    const finalCode = displayAttendanceCode || 'SK';
    const attendanceRecord = hasAttendanceData ? {
      date: logDate,
      student_id: selectedStudent.id,
      status: finalCode as any,
      attendance: {
        type: finalCode as any,
        periods: attendancePeriods,
        note: notes.trim() || finalCode
      }
    } : undefined;

    onSave(selectedStudent.id, logsToCreate, attendanceRecord);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 text-xs text-slate-800 animate-scale-up">
        
        {/* 1. TIÊU ĐỀ MODAL VÀ NÚT BẤM ĐÓNG */}
        <div className="bg-blue-700 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-200" />
            <h3 className="font-extrabold text-sm tracking-wide">Ghi nhận điểm cộng / trừ</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - 3 columns */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* CỘT 1 (BÊN TRÁI): THỜI GIAN, PHÂN LOẠI & CHỌN HỌC SINH */}
          <div className="w-full md:w-1/3 p-4 flex flex-col overflow-y-auto space-y-4">
            {/* 1. Chọn ngày */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span>1. Chọn ngày ghi nhận:</span>
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* 2. Phân loại */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">2. Phân loại ghi nhận:</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Discipline');
                    setSelectedRuleCodes([]); 
                  }}
                  className={`py-2 px-3 rounded-md font-bold text-center transition-all cursor-pointer ${
                    category === 'Discipline'
                      ? 'bg-red-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Vi phạm (-)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Reward');
                    setSelectedRuleCodes([]); 
                  }}
                  className={`py-2 px-3 rounded-md font-bold text-center transition-all cursor-pointer ${
                    category === 'Reward'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Tốt (+)
                </button>
              </div>
            </div>

            {/* 3. Tìm học sinh */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-[220px]">
              <label className="font-bold text-slate-700 block">3. Tìm &amp; chọn học sinh:</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Nhập tên, mã HS hoặc mã VnEdu..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8 pr-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white text-xs"
                />
              </div>

              {/* Student list */}
              <div className="border border-slate-200 rounded-lg overflow-y-auto flex-1 bg-slate-50 max-h-[180px] md:max-h-none">
                {filteredStudents.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 italic">Không tìm thấy học sinh nào</div>
                ) : (
                  filteredStudents.map(student => {
                    const isSelected = selectedStudent?.id === student.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className={`w-full text-left p-2.5 border-b border-slate-150 transition-all flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-50 border-l-4 border-l-blue-600 text-blue-800 font-bold' 
                            : 'hover:bg-slate-100/80 text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold">{student.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Mã: {student.id} 
                            {(student.vneduId || student.vnedu_code) && ` · VnEdu: ${student.vneduId || student.vnedu_code}`}
                            {' '}· Lớp: {student.class}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="bg-blue-600 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Selection banner */}
              {selectedStudent && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-500 font-bold block uppercase tracking-wider">Đang chọn học sinh</span>
                    <strong className="text-slate-800 text-xs">{selectedStudent.name}</strong> 
                    <span className="text-slate-500"> ({selectedStudent.class})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="Bỏ chọn"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CỘT 2 (Ở GIỮA): CHỌN NỘI DUNG VI PHẠM / KHEN THƯỞNG */}
          <div className="w-full md:w-1/3 p-4 flex flex-col overflow-y-auto space-y-3">
            <label className="font-bold text-slate-700 block">
              {category === 'Discipline' ? '4. Chọn nội dung vi phạm:' : '4. Chọn nội dung khen thưởng:'}
            </label>
            
            {/* Rule search bar */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Tìm danh mục lỗi / điểm tốt..."
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8 pr-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white text-xs"
              />
            </div>

            {/* Scrollable rules list */}
            <div className="border border-slate-200 rounded-lg overflow-y-auto flex-1 bg-slate-50 max-h-[250px] md:max-h-none space-y-1.5 p-2">
              {filteredRules.length === 0 ? (
                <div className="p-6 text-center text-slate-400 italic">Không tìm thấy quy chuẩn rèn luyện nào</div>
              ) : (
                filteredRules.map(rule => {
                  const isChecked = selectedRuleCodes.includes(rule.code);
                  return (
                    <div
                      key={rule.code}
                      onClick={() => handleToggleRule(rule.code)}
                      className={`p-2.5 rounded-lg border transition-all flex items-start gap-2 cursor-pointer bg-white ${
                        isChecked
                          ? 'border-blue-500 ring-1 ring-blue-500/30 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} 
                        className="mt-0.5 w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0 pr-1">
                        <p className="font-semibold text-slate-800 break-words leading-tight text-xs">{rule.name}</p>
                        <span className="inline-block mt-0.5 text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-bold">
                          Mã: {rule.code}
                        </span>
                      </div>
                      <div className="shrink-0">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          rule.points > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {rule.points > 0 ? `+${rule.points}` : rule.points}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selection rule counters */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Đã chọn: <strong className="text-blue-600 text-xs">{selectedRuleCodes.length}</strong> nội dung</span>
              {selectedRuleCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedRuleCodes([])}
                  className="text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  Xóa tất cả chọn
                </button>
              )}
            </div>
          </div>

          {/* CỘT 3 (BÊN PHẢI): GHI CHÚ & MINH CHỨNG & TRỢ LÝ ĐIỂM DANH */}
          <div className="w-full md:w-1/3 p-4 flex flex-col overflow-y-auto space-y-4">
            
            {/* TRỢ LÝ ĐIỂM DANH TỰ ĐỘNG */}
            {category === 'Discipline' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    Trợ lý điểm danh VnEdu:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setManualShowAttendance(!manualShowAttendance);
                      if (!manualShowAttendance) {
                        setShowAttendanceAssistant(true);
                      }
                    }}
                    className="text-orange-600 hover:text-orange-700 font-extrabold text-[10px] uppercase underline tracking-wide cursor-pointer"
                  >
                    {showAttendanceAssistant ? 'Ẩn trợ lý' : 'Hiện trợ lý'}
                  </button>
                </div>

                {showAttendanceAssistant && (
                  <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-3 space-y-3 animate-slide-in">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-orange-100 pb-1.5">
                      <span className="font-extrabold text-orange-800 text-[11px] tracking-wide">Trợ lý điểm danh</span>
                      <span className="bg-amber-100 text-amber-800 font-black text-[9px] px-1.5 py-0.5 rounded border border-amber-300">
                        TỰ ĐỘNG
                      </span>
                    </div>

                    {/* Phần 1: NGHỈ NGUYÊN BUỔI */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-slate-600 text-[10px] block">PHẦN 1: NGHỈ NGUYÊN BUỔI</span>
                      
                      {/* Hàng Sáng */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block">Hàng Sáng:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendanceType('SP')}
                            className={`py-1.5 px-2 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer text-center ${
                              morningType === 'SP'
                                ? 'bg-orange-500 border-orange-600 text-white shadow-sm font-black'
                                : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                            }`}
                          >
                            Nghỉ CP (SP)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAttendanceType('SK')}
                            className={`py-1.5 px-2 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer text-center ${
                              morningType === 'SK'
                                ? 'bg-orange-500 border-orange-600 text-white shadow-sm font-black'
                                : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                            }`}
                          >
                            Nghỉ KP (SK)
                          </button>
                        </div>
                      </div>

                      {/* Hàng Chiều */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block">Hàng Chiều:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendanceType('CP')}
                            className={`py-1.5 px-2 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer text-center ${
                              afternoonType === 'CP'
                                ? 'bg-orange-500 border-orange-600 text-white shadow-sm font-black'
                                : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                            }`}
                          >
                            Nghỉ CP (CP)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAttendanceType('CK')}
                            className={`py-1.5 px-2 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer text-center ${
                              afternoonType === 'CK'
                                ? 'bg-orange-500 border-orange-600 text-white shadow-sm font-black'
                                : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                            }`}
                          >
                            Nghỉ KP (CK)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Phần 2: BỎ TIẾT HỌC */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-slate-600 text-[10px] block">PHẦN 2: BỎ TIẾT HỌC</span>
                      
                      {/* Hàng Sáng */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-semibold w-10 shrink-0">Sáng:</span>
                        <div className="flex gap-1 flex-1">
                          {['S1', 'S2', 'S3', 'S4', 'S5'].map((p, idx) => {
                            const isSelected = attendancePeriods.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleTogglePeriod(p)}
                                className={`w-6 h-6 rounded-full border text-[10px] font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                                    : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                                }`}
                                title={`Bỏ tiết ${idx + 1} Sáng`}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hàng Chiều */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-semibold w-10 shrink-0">Chiều:</span>
                        <div className="flex gap-1 flex-1">
                          {['C1', 'C2', 'C3', 'C4', 'C5'].map((p, idx) => {
                            const isSelected = attendancePeriods.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleTogglePeriod(p)}
                                className={`w-6 h-6 rounded-full border text-[10px] font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                                    : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-50'
                                }`}
                                title={`Bỏ tiết ${idx + 1} Chiều`}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Phần 3: Ô MÃ ĐIỂM DANH TỰ ĐỘNG TỔNG HỢP */}
                    <div className="bg-amber-50 border border-orange-300 rounded-lg p-2.5 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-medium">Mã chuẩn:</span>
                        <span className="bg-white border border-orange-200 text-orange-800 font-mono font-black px-2 py-0.5 rounded text-xs tracking-wide">
                          {displayAttendanceCode || 'Bình thường'}
                        </span>
                      </div>
                      <span className="text-orange-800 font-bold italic">
                        ({(morningType ? 0.5 : 0) + (afternoonType ? 0.5 : 0)} ngày nghỉ, {attendancePeriods.length} tiết bỏ)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Detailed note */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">5. Ghi chú &amp; Minh chứng sự việc:</label>
              <textarea
                rows={4}
                placeholder="Nhập ghi chú chi tiết sự việc..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-600 focus:bg-white text-xs font-semibold"
              />
            </div>

            {/* Evidence image upload box */}
            <div className="space-y-1.5 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  Hình ảnh minh chứng:
                </label>
                <div className="flex items-center gap-1 text-emerald-600">
                  <Camera className="w-4 h-4" />
                  <span className="text-[10px] font-bold">Chụp/Dán ảnh</span>
                </div>
              </div>

              {/* Upload field */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onPaste={handlePaste}
                onClick={handleTriggerUpload}
                className="border-2 border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/50 hover:bg-slate-50 transition text-center flex-1 flex flex-col items-center justify-center space-y-2 cursor-pointer relative min-h-[140px]"
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {evidenceBase64 ? (
                  <div className="absolute inset-0 p-2 bg-white rounded-xl flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <img 
                      src={evidenceBase64} 
                      alt="Minh chứng" 
                      className="max-h-24 max-w-full rounded object-contain shadow-xs border border-slate-100" 
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="mt-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-2 py-1 rounded flex items-center gap-1 font-bold text-[10px] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Xóa ảnh minh chứng
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-7 h-7 text-slate-400" />
                    <div>
                      <p className="font-bold text-slate-600">Bấm hoặc kéo thả ảnh</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ dán ảnh chụp màn hình (Ctrl+V)</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* CHÂN MODAL (FOOTER) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-lg transition cursor-pointer shadow-md flex items-center gap-1 text-xs"
          >
            <Check className="w-4 h-4" />
            Lưu Ghi Nhận
          </button>
        </div>
      </div>
    </div>
  );
}
