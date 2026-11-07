import React, { useState, useEffect } from 'react';
import { Student, ScoreRule, LogDiscipline, Attendance, Complaint, SchoolData } from '../types';
import { GoogleDriveService } from '../lib/GoogleDriveService';
import { PdfGenerator } from './PdfGenerator';
import { evaluateSemesterResult, evaluateYearlyResult, getMonthlyRating, getMonthFromDateStr } from '../lib/EvaluationHelper';
import { ATTENDANCE_DESCRIPTIONS, analyzeAttendanceCode } from '../lib/AttendanceHelper';
import { HelpModal } from './HelpModal';
import { 
  User, 
  Award, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Send, 
  Download, 
  CheckCircle, 
  HelpCircle,
  X,
  Clock,
  KeyRound,
  LogOut,
  Lock,
  ShieldAlert,
  Info
} from 'lucide-react';

interface StudentPortalProps {
  session: any;
  onLogout: () => void;
  onDataChanged?: () => void;
}

export default function StudentPortal({ session, onLogout, onDataChanged }: StudentPortalProps) {
  const schoolId = session.schoolId || 'LHP';
  const studentId = session.username || 'HS001';
  
  const [db, setDb] = useState<SchoolData | null>(null);
  const [studentInfo, setStudentInfo] = useState<Student | null>(null);
  
  // Tabs navigation
  const [activeTab, setActiveTab] = useState<'kpi' | 'logs' | 'attendance' | 'complaints'>('kpi');
  
  // Month selection filter state
  const [selectedMonth, setSelectedMonth] = useState<string>('Tất cả');
  
  // Complaint modal
  const [selectedLogForComplaint, setSelectedLogForComplaint] = useState<LogDiscipline | null>(null);
  const [complaintReason, setComplaintReason] = useState<string>('');

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Password management states
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [isForcedChangePass, setIsForcedChangePass] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passErrorMsg, setPassErrorMsg] = useState('');
  const [passSuccessMsg, setPassSuccessMsg] = useState('');

  useEffect(() => {
    loadStudentData();
  }, [schoolId, studentId, onDataChanged]);

  const populateStudentState = (data: SchoolData) => {
    setDb(data);

    const info = data.STUDENTS.find(s => s.id === studentId);
    if (info) {
      setStudentInfo(info);

      // Check if student needs mandatory password change on first login
      const isDefaultPass = !info.password || info.password === '123456' || info.password === '123' || info.password === info.birth_date;
      const needsForcedChange = !info.password_changed || info.must_change_password || isDefaultPass;
      
      if (needsForcedChange) {
        setIsForcedChangePass(true);
        setShowChangePassModal(true);
      }
    }
  };

  const loadStudentData = () => {
    // 1. Instant local load (0ms rendering delay)
    const localData = GoogleDriveService.getSchoolData(schoolId);
    populateStudentState(localData);

    // 2. Non-blocking background sync
    GoogleDriveService.fetchSchoolDataFromCentralServer(schoolId).then(remoteData => {
      if (remoteData) {
        populateStudentState(remoteData);
      }
    }).catch(() => {});
  };

  const syncAndReload = (updatedDb: SchoolData) => {
    setDb(updatedDb);
    GoogleDriveService.saveSchoolData(schoolId, updatedDb);
    if (onDataChanged) onDataChanged();
  };

  const handleSavePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPassErrorMsg('');
    setPassSuccessMsg('');

    if (!db || !studentInfo) return;

    if (!isForcedChangePass) {
      const currentPass = studentInfo.password || '123456';
      if (oldPasswordInput !== currentPass && oldPasswordInput !== '123456' && oldPasswordInput !== '123') {
        setPassErrorMsg('Mật khẩu hiện tại không chính xác.');
        return;
      }
    }

    if (!newPasswordInput.trim()) {
      setPassErrorMsg('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (newPasswordInput.length < 6) {
      setPassErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPasswordInput === '123456' || newPasswordInput === '123') {
      setPassErrorMsg('Mật khẩu mới không được giống mật khẩu mặc định (123456).');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPassErrorMsg('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }

    const updatedStudents = db.STUDENTS.map(s => {
      if (s.id === studentInfo.id) {
        return {
          ...s,
          password: newPasswordInput,
          password_changed: true,
          must_change_password: false
        };
      }
      return s;
    });

    const updatedDb: SchoolData = {
      ...db,
      STUDENTS: updatedStudents
    };

    const updatedCurrentStudent = {
      ...studentInfo,
      password: newPasswordInput,
      password_changed: true,
      must_change_password: false
    };

    setStudentInfo(updatedCurrentStudent);
    syncAndReload(updatedDb);

    setPassSuccessMsg('Đã thay đổi mật khẩu thành công!');
    setIsForcedChangePass(false);
    
    setTimeout(() => {
      setShowChangePassModal(false);
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPassErrorMsg('');
      setPassSuccessMsg('');
    }, 1200);
  };

  if (!db || !studentInfo) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-500">
        Đang tải dữ liệu học tập cá nhân, vui lòng đợi...
      </div>
    );
  }

  // Calculate scores
  const activeConfig = (db.CONFIG || [])[0] || { semester: 'Học kỳ I' };
  const selectedTerm = activeConfig.semester;
  const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
  const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
  const termMonths = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;
  const availableMonths = ['Tất cả', ...termMonths];

  const allStudentLogs = (db.LOGS_DISCIPLINE || []).filter(l => l.student_id === studentInfo.id);
  const studentLogs = selectedMonth === 'Tất cả'
    ? allStudentLogs
    : allStudentLogs.filter(l => (l.term_month === selectedMonth || (l.date && getMonthFromDateStr(l.date) === selectedMonth)));

  const totalMinus = studentLogs.filter(l => l.points < 0).reduce((acc, curr) => acc + curr.points, 0);
  const totalPlus = studentLogs.filter(l => l.points > 0).reduce((acc, curr) => acc + curr.points, 0);
  const currentScore = Math.max(0, Math.min(100, 100 + totalMinus + totalPlus));

  // Circular 22 evaluations
  const termResult = evaluateSemesterResult(studentInfo.id, termMonths, db.LOGS_DISCIPLINE || [], db.SCORE_RULES || []);
  const t1Res = evaluateSemesterResult(studentInfo.id, monthsForTerm1, db.LOGS_DISCIPLINE || [], db.SCORE_RULES || []);
  const t2Res = evaluateSemesterResult(studentInfo.id, monthsForTerm2, db.LOGS_DISCIPLINE || [], db.SCORE_RULES || []);
  const yearlyClassification = evaluateYearlyResult(t1Res.classification, t2Res.classification);
  const classification = termResult.classification;

  // Attendance history
  const allMyAttendance = (db.ATTENDANCE || []).filter(a => a.student_id === studentInfo.id);
  const myAttendance = selectedMonth === 'Tất cả'
    ? allMyAttendance
    : allMyAttendance.filter(a => a.date && getMonthFromDateStr(a.date) === selectedMonth);

  // Complaints submitted
  const myComplaints = (db.COMPLAINTS || []).filter(c => c.student_id === studentInfo.id);

  // Submit new complaint handler
  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedLogForComplaint) return;

    if (!complaintReason.trim()) {
      alert('Vui lòng nhập lý do giải trình khiếu nại.');
      return;
    }

    const newComplaint: Complaint = {
      id: `C-${Date.now()}`,
      student_id: studentInfo.id,
      log_id: selectedLogForComplaint.id,
      reason: complaintReason,
      status: 'Pending',
      created_at: new Date().toISOString().split('T')[0]
    };

    const updated = {
      ...db,
      COMPLAINTS: [newComplaint, ...db.COMPLAINTS]
    };

    syncAndReload(updated);
    setSelectedLogForComplaint(null);
    setComplaintReason('');
    alert('Đơn giải trình khiếu nại của học sinh đã được gửi thành công đến GVCN và Ban Giám Hiệu để xét duyệt rà soát!');
  };

  // Download Individual Report Card PDF
  const handleDownloadPdf = async () => {
    try {
      const doc = await PdfGenerator.generateStudentPdf(
        studentInfo,
        db.CONFIG[0],
        db.LOGS_DISCIPLINE,
        db.SCORE_RULES,
        db.ATTENDANCE,
        undefined
      );
      doc.save(`Phieu_Lien_Lac_${studentInfo.name.replace(/\s+/g, '_')}.pdf`);
    } catch (e: any) {
      alert('Lỗi tải phiếu liên lạc: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Banner Header block */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{studentInfo.name}</h2>
              <span className="bg-white/20 text-white border border-white/30 text-[10px] font-semibold px-2 py-0.5 rounded">
                LỚP {studentInfo.class}
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium">
              Mã Học Sinh: <code className="bg-white/10 px-1 rounded font-mono text-[11px]">{studentInfo.id}</code>
              {(studentInfo.vneduId || studentInfo.vnedu_code) && (
                <>
                  {' '}| Mã VnEdu: <code className="bg-white/10 px-1 rounded font-mono text-[11px]">{studentInfo.vneduId || studentInfo.vnedu_code}</code>
                </>
              )}
              {' '}| Phụ huynh: {studentInfo.parent_name} ({studentInfo.phone})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-center flex-wrap justify-center sm:justify-end">
          <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/10 min-w-[100px]">
            <span className="block text-[9px] text-blue-200 font-bold uppercase tracking-wider">Hạnh Kiểm {activeConfig.semester}</span>
            <span className="text-sm font-extrabold">{classification}</span>
          </div>

          <div className="bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/10 min-w-[100px]">
            <span className="block text-[9px] text-blue-200 font-bold uppercase tracking-wider">Hạnh Kiểm Cả Năm</span>
            <span className="text-sm font-extrabold">{yearlyClassification}</span>
          </div>

          <div className="bg-white px-5 py-2.5 rounded-2xl text-slate-800 shadow-xl min-w-[100px]">
            <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">ĐIỂM TÍCH LŨY</span>
            <span className="text-2xl font-black text-blue-600">{currentScore}</span>
          </div>
        </div>
      </div>

      {/* Quick Utility Actions toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 gap-3">
        <div className="flex items-center gap-2.5 overflow-x-auto text-xs pb-1 sm:pb-0">
          {/* Nút/Dropdown Lựa chọn xem theo tháng (Đặt ngay trước nút Biểu đồ & Thống kê) */}
          <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-lg shrink-0 text-blue-900 font-bold shadow-2xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="whitespace-nowrap text-xs text-slate-700">Xem theo tháng:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-blue-200 rounded-md py-1 px-2 font-bold text-blue-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {m === 'Tất cả' ? 'Tất cả các tháng' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 shrink-0 hidden sm:block mx-0.5" />

          {[
            { id: 'kpi', name: 'Biểu Đồ & Thống Kê' },
            { id: 'logs', name: 'Nhật Ký Vi Phạm' },
            { id: 'attendance', name: 'Chuyên Cần / Điểm Danh' },
            { id: 'complaints', name: 'Đơn Khiếu Nại' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3.5 py-2 rounded-lg font-bold transition cursor-pointer"
            title="Sổ tay Hướng dẫn & Trợ giúp"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Trợ giúp
          </button>

          <button
            onClick={() => setShowChangePassModal(true)}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3.5 py-2 rounded-lg font-bold transition cursor-pointer"
            title="Đổi mật khẩu cá nhân"
          >
            <KeyRound className="w-4 h-4 text-slate-600" />
            Đổi mật khẩu
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3.5 py-2 rounded-lg font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Tải Phiếu (.PDF)
          </button>

          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-3.5 py-2 rounded-lg font-bold transition cursor-pointer"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Render selected tabs */}
      <div className="space-y-6 text-xs">
        
        {/* SUBVIEW 1: KPI & CHARTS */}
        {activeTab === 'kpi' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* KPI Performance summary */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Cơ Cấu Điểm Rèn Luyện</h4>
              <p className="text-slate-500">
                {selectedMonth === 'Tất cả' ? 'Mốc điểm dựa trên thang điểm chuẩn 100.' : `Số điểm rèn luyện tính riêng trong ${selectedMonth}.`}
              </p>
              
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-600">Điểm chuẩn mặc định</span>
                  <span className="font-bold text-slate-800">100 điểm</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200">
                  <span className="font-semibold text-emerald-700">Điểm cộng (Thành tích)</span>
                  <span className="font-bold text-emerald-800">+{totalPlus} điểm</span>
                </div>
                <div className="flex justify-between items-center bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200">
                  <span className="font-semibold text-rose-700">Điểm trừ (Nề nếp vi phạm)</span>
                  <span className="font-bold text-rose-800">{totalMinus} điểm</span>
                </div>
              </div>
            </div>

            {/* Attendance stats */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">Chuyên Cần Điểm Danh</h4>
              <p className="text-slate-500">
                {selectedMonth === 'Tất cả' ? 'Thống kê tổng hợp cả kỳ học hiện tại.' : `Số lượt điểm danh trong ${selectedMonth}.`}
              </p>
              
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
                  <span className="block text-2xl font-black text-emerald-600">
                    {myAttendance.filter(a => a.status === 'P').length}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Có Phép (P)</span>
                </div>
                
                <div className="p-4 bg-rose-50 text-rose-800 rounded-lg text-center border border-rose-100">
                  <span className="block text-2xl font-black text-rose-600">
                    {myAttendance.filter(a => a.status === 'KP').length}
                  </span>
                  <span className="text-[10px] text-rose-500 font-semibold uppercase">Không Phép (KP)</span>
                </div>

                <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-center border border-amber-100 col-span-2">
                  <span className="block text-xl font-bold text-amber-600">
                    {myAttendance.filter(a => a.status === 'BT_SANG' || a.status === 'BT_CHIEU').length}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Lượt bỏ tiết học</span>
                </div>
              </div>
            </div>

            {/* Kết quả xếp loại học kỳ [selectedTerm] */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 col-span-1 md:col-span-3 lg:col-span-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-600" />
                    Kết quả xếp loại học kỳ ({selectedTerm})
                  </h4>
                  <p className="text-slate-500 text-[11.5px] mt-0.5">Thống kê đánh giá kết quả rèn luyện các tháng:</p>
                </div>
              </div>
              
              {/* Thống kê từng tháng */}
              <div className="space-y-2">
                {termMonths.map((m) => {
                  const logsForMonth = (db.LOGS_DISCIPLINE || []).filter(l => 
                    l.student_id === studentInfo.id && (l.term_month === m || getMonthFromDateStr(l.date) === m)
                  );
                  const minus = logsForMonth.filter(l => l.points < 0).reduce((acc, c) => acc + c.points, 0);
                  const plus = logsForMonth.filter(l => l.points > 0).reduce((acc, c) => acc + c.points, 0);
                  const mScore = Math.max(0, Math.min(100, 100 + minus + plus));
                  const mRating = getMonthlyRating(mScore);

                  let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (mRating === 'Khá') badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (mRating === 'Đạt') badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                  if (mRating === 'Chưa đạt') badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <div key={m} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-semibold">
                      <span className="text-slate-700">{m}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{mScore}đ</span>
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${badgeStyle}`}>
                          {mRating}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Xếp loại cả học kỳ & Cả năm */}
              <div className="pt-2 space-y-2 border-t border-slate-100">
                <div className="flex justify-between items-center bg-blue-50/80 p-3 rounded-lg border border-blue-200">
                  <span className="font-bold text-blue-900">Xếp loại KQRL HK ({selectedTerm === 'Học kỳ I' ? 'I' : 'II'}):</span>
                  <span className={`px-2.5 py-1 rounded text-xs font-black uppercase ${
                    classification === 'Tốt' ? 'bg-emerald-600 text-white' :
                    classification === 'Khá' ? 'bg-blue-600 text-white' :
                    classification === 'Đạt' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {classification}
                  </span>
                </div>

                {/* Nếu có lý do hạ / khống chế xếp loại */}
                {termResult.downgradeReason && (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-800 text-[11px] leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1 text-rose-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      Lý do bị hạ / khống chế xếp loại:
                    </div>
                    <p className="text-rose-900 font-medium">{termResult.downgradeReason}</p>
                  </div>
                )}

                <div className="flex justify-between items-center bg-indigo-50/80 p-3 rounded-lg border border-indigo-200">
                  <span className="font-bold text-indigo-900">Xếp loại KQRL cả năm:</span>
                  <span className={`px-2.5 py-1 rounded text-xs font-black uppercase ${
                    yearlyClassification === 'Tốt' ? 'bg-emerald-600 text-white' :
                    yearlyClassification === 'Khá' ? 'bg-blue-600 text-white' :
                    yearlyClassification === 'Đạt' ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {yearlyClassification}
                  </span>
                </div>
              </div>

              {/* Thông tin quy định chi tiết */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10.5px] text-slate-600 space-y-1.5 leading-normal">
                <span className="font-bold text-slate-800 block">📌 Đánh giá kết quả rèn luyện cả học kỳ:</span>
                <p>• <strong>Mức Tốt:</strong> Có ít nhất 50% số tháng trong học kỳ xếp loại Tốt trở lên, không có tháng nào xếp loại Đạt, Chưa đạt.</p>
                <p>• <strong>Mức Khá:</strong> Có ít nhất 50% số tháng trong học kỳ xếp loại Khá, Tốt, không có tháng nào xếp loại Chưa đạt; Trong học kỳ không vi phạm lỗi bị trừ 60 đến 70 điểm (nếu vi phạm, xếp loại cả học kỳ cao nhất là mức “Đạt”).</p>
                <p>• <strong>Mức Chưa đạt:</strong> Có trên 50% số tháng trong học kỳ xếp loại Chưa đạt; Hoặc trong học kỳ vi phạm các lỗi nghiêm trọng bị trừ từ 80 điểm trở lên.</p>
                <p>• <strong>Mức Đạt:</strong> Các trường hợp còn lại.</p>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW 2: CONDUCT LOGS & COMPLAINTS LAUNCH */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Nhật Ký Vi Phạm &amp; Khen Thưởng Cá Nhân</h4>
                <p className="text-slate-500 mt-0.5">
                  {selectedMonth === 'Tất cả' ? 'Tất cả các ghi nhận trong kỳ học.' : `Danh sách ghi nhận riêng trong ${selectedMonth}.`}
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                Tổng: {studentLogs.length} ghi nhận
              </span>
            </div>

            {studentLogs.length === 0 ? (
              <p className="text-center py-12 text-slate-400 italic">Học sinh rèn luyện tốt, không có bất kỳ ghi nhận vi phạm hay trừ điểm nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-28">Ngày</th>
                      <th className="p-3">Mã &amp; Nội Dung Quy Chuẩn</th>
                      <th className="p-3 text-center">Điểm số</th>
                      <th className="p-3">Ghi chú sự vụ / Minh chứng</th>
                      <th className="p-3 text-center w-28">Khiếu Nại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentLogs.map((log, index) => {
                      const rule = db.SCORE_RULES.find(r => r.code === log.rule_code);
                      const hasComplaint = myComplaints.some(c => c.log_id === log.id);

                      return (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                          <td className="p-3 text-center text-slate-400 font-medium">{index + 1}</td>
                          <td className="p-3 text-slate-600 font-semibold">{log.date}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 border border-blue-200 text-blue-700 font-bold px-1.5 py-0.5 rounded font-mono mr-1.5">
                              {log.rule_code}
                            </span>
                            <span className="font-semibold text-slate-700">{rule ? rule.name : ''}</span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={log.points > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {log.points > 0 ? `+${log.points}` : log.points}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 italic font-medium">{log.notes}</td>
                          <td className="p-3 text-center">
                            {log.points >= 0 ? (
                              <span className="text-slate-300">-</span>
                            ) : hasComplaint ? (
                              <span className="text-amber-600 font-bold">Đã gửi đơn</span>
                            ) : (
                              <button
                                onClick={() => setSelectedLogForComplaint(log)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded font-bold transition cursor-pointer"
                              >
                                Giải trình
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBVIEW 3: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Nhật Ký Điểm Danh Chuyên Cần</h4>
              <p className="text-slate-500 mt-0.5">Chi tiết ghi nhận chuyên cần trong giờ sinh hoạt và các tiết học.</p>
            </div>

            {myAttendance.length === 0 ? (
              <p className="text-center py-12 text-slate-400 italic">Không có dữ liệu vắng mặt hay cúp tiết trong mốc thời gian này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-32">Ngày</th>
                      <th className="p-3 text-center">Trạng thái điểm danh</th>
                      <th className="p-3">Mô tả quy định</th>
                      <th className="p-3">Ghi chú sự vụ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAttendance.map((att, idx) => {
                      const desc = ATTENDANCE_DESCRIPTIONS[att.status] || att.status;
                      const parsed = analyzeAttendanceCode(att.status);

                      return (
                        <tr key={att.id || `att-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                          <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-700">{att.date}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded font-bold ${
                              att.status === 'KP' || att.status === 'SK' || att.status === 'CK' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : att.status === 'P' || att.status === 'SP' || att.status === 'CP'
                                ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {att.status}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-700">{desc}</td>
                          <td className="p-3 text-slate-500 italic">{att.notes || 'Không có ghi chú'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBVIEW 4: COMPLAINTS */}
        {activeTab === 'complaints' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Danh Sách Đơn Giải Trình / Khiếu Nại Đã Gửi</h4>
              <p className="text-slate-500 mt-0.5">Theo dõi trạng thái phản hồi từ GVCN và Ban Giám Hiệu.</p>
            </div>

            {myComplaints.length === 0 ? (
              <p className="text-center py-12 text-slate-400 italic">Chưa có đơn khiếu nại hay giải trình nào được gửi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3 w-28">Ngày gửi</th>
                      <th className="p-3">Nội dung giải trình</th>
                      <th className="p-3 text-center w-32">Trạng thái</th>
                      <th className="p-3">Ý kiến phản hồi / Duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myComplaints.map((c, idx) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="p-3 font-semibold text-slate-600">{c.created_at}</td>
                        <td className="p-3 text-slate-800 font-medium">{c.reason}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded font-bold text-[10px] ${
                            c.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            c.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {c.status === 'Approved' ? 'Được chấp thuận' :
                             c.status === 'Rejected' ? 'Bị từ chối' : 'Đang xét duyệt'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 italic">{c.response || c.feedback || 'Chưa có phản hồi'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Complaint Form Modal */}
      {selectedLogForComplaint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <HelpCircle className="w-5 h-5" />
                GỬI ĐƠN GIẢI TRÌNH KHIẾU NẠI
              </h3>
              <button
                onClick={() => setSelectedLogForComplaint(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="p-5 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 space-y-1">
                <div className="font-bold">Ghi nhận bị khiếu nại:</div>
                <div>• Ngày: <strong>{selectedLogForComplaint.date}</strong></div>
                <div>• Mã lỗi: <strong>{selectedLogForComplaint.rule_code}</strong> ({selectedLogForComplaint.points} điểm)</div>
                <div>• Ghi chú: <em>{selectedLogForComplaint.notes || 'Không có ghi chú'}</em></div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Nội dung / Lý do xin đính chính giải trình *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Nhập lý do cụ thể hoặc minh chứng bằng chứng đính kèm..."
                  value={complaintReason}
                  onChange={(e) => setComplaintReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLogForComplaint(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2 rounded-xl transition cursor-pointer shadow-md flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gửi Đơn Giải Trình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className={`${isForcedChangePass ? 'bg-amber-600' : 'bg-slate-800'} text-white p-5 flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <KeyRound className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {isForcedChangePass ? 'Bắt Buộc Đổi Mật Khẩu Lần Đầu' : 'Thay Đổi Mật Khẩu Cá Nhân'}
                  </h3>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {isForcedChangePass 
                      ? 'Vì mục đích bảo mật, học sinh vui lòng đổi mật khẩu mặc định trước khi tiếp tục.' 
                      : 'Thiết lập mật khẩu mới cho tài khoản học sinh.'}
                  </p>
                </div>
              </div>
              {!isForcedChangePass && (
                <button
                  onClick={() => setShowChangePassModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleSavePasswordChange} className="p-6 space-y-4 text-xs">
              {isForcedChangePass && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    Yêu cầu bắt buộc từ hệ thống:
                  </div>
                  <p>Bạn đang sử dụng mật khẩu mặc định. Hãy tạo một mật khẩu riêng biệt (tối thiểu 6 ký tự) để bảo vệ thông tin điểm rèn luyện.</p>
                </div>
              )}

              {passErrorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  {passErrorMsg}
                </div>
              )}

              {passSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  {passSuccessMsg}
                </div>
              )}

              {!isForcedChangePass && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Mật khẩu hiện tại *</label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu hiện tại..."
                    value={oldPasswordInput}
                    onChange={(e) => setOldPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {!isForcedChangePass && (
                  <button
                    type="button"
                    onClick={() => setShowChangePassModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md"
                >
                  Xác nhận lưu mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} defaultRole="Student" />
    </div>
  );
}
