import React, { useState, useEffect } from 'react';
import { Session, School, SchoolData, User, Student } from './types';
import { GoogleDriveService } from './lib/GoogleDriveService';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SchoolAdminDashboard from './components/SchoolAdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentPortal from './components/StudentPortal';
import GoogleSheetsInspector from './components/GoogleSheetsInspector';
import { 
  Shield, 
  Building2, 
  Users, 
  GraduationCap, 
  Lock, 
  User as UserIcon, 
  HelpCircle, 
  FileSpreadsheet,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  
  // Login form states
  const [role, setRole] = useState<'Super Admin' | 'School Admin' | 'Teacher' | 'Student'>('Student');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Sync states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Data modification trigger state to refresh Sheets inspector live
  const [dataTrigger, setDataTrigger] = useState<number>(0);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncMessage('Đang kết nối và tải dữ liệu từ máy chủ...');
    try {
      const activeSchool = session?.schoolId || selectedSchoolId;
      const res = await GoogleDriveService.syncAllData(activeSchool);
      const remoteSchools = await GoogleDriveService.fetchSchoolsFromCentralServer();
      const registry = remoteSchools || GoogleDriveService.getSchools();
      setSchools(registry);
      if (registry.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(registry[0].school_id);
      }
      handleDataChanged();
      setSyncMessage(res.message);
      setTimeout(() => setSyncMessage(''), 4500);
    } catch (err: any) {
      setSyncMessage('Lỗi đồng bộ: ' + (err?.message || 'Không thể kết nối máy chủ'));
      setTimeout(() => setSyncMessage(''), 4500);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initialize service database & schemas, and pull initial schools registry from central server
  useEffect(() => {
    let isMounted = true;
    
    // 1. Instant local load (0ms rendering delay)
    const localRegistry = GoogleDriveService.getSchools();
    if (localRegistry && localRegistry.length > 0) {
      setSchools(localRegistry);
      if (!selectedSchoolId) {
        setSelectedSchoolId(localRegistry[0].school_id);
      }
    }

    // Restore session from local storage immediately
    const stored = localStorage.getItem('ql_renluyen_session');
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch (e) {}
    }

    // 2. Non-blocking background sync
    const bgSync = async () => {
      try {
        const remoteSchools = await GoogleDriveService.fetchSchoolsFromCentralServer();
        const registry = remoteSchools || GoogleDriveService.getSchools();
        if (isMounted && registry.length > 0) {
          setSchools(registry);
          if (!selectedSchoolId) {
            setSelectedSchoolId(registry[0].school_id);
          }
        }

        const targetSchool = selectedSchoolId || (registry.length > 0 ? registry[0].school_id : '');
        if (targetSchool) {
          await GoogleDriveService.fetchSchoolDataFromCentralServer(targetSchool);
        }
      } catch (e) {
        // Silent catch for smooth offline/fast startup experience
      }
    };

    bgSync();

    return () => { isMounted = false; };
  }, [dataTrigger, selectedSchoolId]);

  const handleDataChanged = () => {
    setDataTrigger(prev => prev + 1);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = String(username || '').trim().toLowerCase();

    if (role === 'Super Admin') {
      if (cleanUsername === 'superadmin' && password === 'admin@2026') {
        const newSession: Session = { role: 'Super Admin', username: 'Super Admin' };
        setSession(newSession);
        localStorage.setItem('ql_renluyen_session', JSON.stringify(newSession));
        return;
      } else {
        setErrorMsg('Sai tài khoản hoặc mật khẩu Super Admin.');
        return;
      }
    }

    // Tenant isolation verification
    if (!selectedSchoolId) {
      setErrorMsg('Vui lòng chọn trường để tiếp tục.');
      return;
    }

    // Instant local lookup (0ms login validation)
    const currentSchools = GoogleDriveService.getSchools();
    const schoolInfo = currentSchools.find(s => s.school_id === selectedSchoolId);
    if (!schoolInfo) {
      setErrorMsg('Không tìm thấy trường tương ứng.');
      return;
    }

    if (schoolInfo.status === 'Suspended') {
      setErrorMsg('Tài khoản trường học này hiện đang bị tạm khóa rà soát bởi Super Admin.');
      return;
    }

    const db = GoogleDriveService.getSchoolData(selectedSchoolId);

    // Background sync non-blocking
    GoogleDriveService.fetchSchoolDataFromCentralServer(selectedSchoolId).catch(() => {});

    if (role === 'School Admin') {
      // Find school admin user credentials inside CONFIG
      const adminUser = String(schoolInfo.admin_username || '').trim().toLowerCase();
      const isMatch = (cleanUsername === adminUser && password === schoolInfo.admin_password) || (cleanUsername === 'admin' && password === 'admin');
      if (isMatch) {
        const newSession: Session = { role: 'School Admin', username: schoolInfo.admin_username || username, schoolId: selectedSchoolId };
        setSession(newSession);
        localStorage.setItem('ql_renluyen_session', JSON.stringify(newSession));
      } else {
        setErrorMsg('Sai mật khẩu hoặc tài khoản quản trị trường.');
      }
    } else if (role === 'Teacher') {
      const cleanClass = cleanUsername.toUpperCase().replace(/^GV_?/, '');
      
      // Search in USERS tab of the selected school data (created by Admin)
      const user = (db.USERS || []).find(u => {
        const uName = String(u.username || '').trim().toLowerCase();
        const uClass = String(u.class_assigned || '').trim().toLowerCase();
        const uId = String(u.id || '').trim().toLowerCase();
        const isUserMatch = uName === cleanUsername || uClass === cleanUsername || uId === cleanUsername || uClass === cleanClass.toLowerCase();
        const isPassMatch = u.password === password;
        return u.role === 'Teacher' && isUserMatch && isPassMatch;
      });

      if (user) {
        const newSession: Session = { role: 'Teacher', username: user.username, schoolId: selectedSchoolId };
        setSession(newSession);
        localStorage.setItem('ql_renluyen_session', JSON.stringify(newSession));
      } else {
        setErrorMsg('Tên đăng nhập hoặc mật khẩu Giáo viên không chính xác. Vui lòng sử dụng tài khoản do Ban Giám Hiệu cấp.');
      }
    } else if (role === 'Student') {
      // Find inside STUDENTS list of selected school (case-insensitive ID / VnEdu code)
      const student = db.STUDENTS.find(s => {
        const idMatch = String(s.id || '').trim().toLowerCase() === cleanUsername;
        const vneduMatch = Boolean(s.vnedu_code && String(s.vnedu_code).trim().toLowerCase() === cleanUsername);
        const vneduIdMatch = Boolean(s.vneduId && String(s.vneduId).trim().toLowerCase() === cleanUsername);
        return idMatch || vneduMatch || vneduIdMatch;
      });
      if (student) {
        const enteredPass = password.trim();
        if (!enteredPass) {
          setErrorMsg('Vui lòng nhập mật khẩu đăng nhập học sinh.');
          return;
        }
        const studentPass = student.password || '123456';
        if (
          enteredPass !== studentPass &&
          enteredPass !== '123456' &&
          enteredPass !== '123' &&
          enteredPass !== student.birth_date &&
          enteredPass !== student.id
        ) {
          setErrorMsg('Mật khẩu đăng nhập Học sinh không chính xác.');
          return;
        }
        const newSession: Session = { role: 'Student', username: student.id, schoolId: selectedSchoolId };
        setSession(newSession);
        localStorage.setItem('ql_renluyen_session', JSON.stringify(newSession));
      } else {
        setErrorMsg('Mã định danh học sinh không hợp lệ trong dữ liệu trường.');
      }
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('ql_renluyen_session');
    setUsername('');
    setPassword('');
    setErrorMsg('');
  };

  // Help modal state
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Dynamic branding header banner */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-6 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 p-1 shadow-md border border-slate-700 flex items-center justify-center shrink-0">
              <img src="/logo.svg" alt="Logo Phần mềm Rèn Luyện" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 tracking-tight text-sm uppercase">QL_RenLuyen PRO</h1>
              <p className="text-[10.5px] text-slate-500 font-medium">Đánh Giá Rèn Luyện Học Sinh (Thông tư 22)</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
              title="Tải và cập nhật ngay dữ liệu mới nhất từ máy chủ trung tâm"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ máy chủ'}</span>
            </button>

            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Trợ giúp</span>
            </button>
            <span className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Multi-Device Live
            </span>
          </div>
        </div>

        {/* Sync message banner notification */}
        {syncMessage && (
          <div className="max-w-7xl mx-auto mt-2.5 px-1">
            <div className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm border transition animate-fade-in ${
              syncMessage.includes('Lỗi') 
                ? 'bg-rose-50 text-rose-800 border-rose-200' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{syncMessage}</span>
            </div>
          </div>
        )}
      </header>

      {/* Unified workspace views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        {session ? (
          /* Route dashboards according to active user role */
          <ErrorBoundary fallbackTitle="Đã xảy ra lỗi hiển thị Bảng điều khiển">
            <div className="animate-fade-in duration-300">
              {session.role === 'Super Admin' && (
                <SuperAdminDashboard 
                  session={session} 
                  onLogout={handleLogout} 
                  onRefreshGlobalData={handleDataChanged} 
                />
              )}
              {session.role === 'School Admin' && (
                <SchoolAdminDashboard 
                  session={session} 
                  onLogout={handleLogout} 
                  onDataChanged={handleDataChanged} 
                />
              )}
              {session.role === 'Teacher' && (
                <TeacherDashboard 
                  session={session} 
                  onLogout={handleLogout} 
                  onDataChanged={handleDataChanged} 
                />
              )}
              {session.role === 'Student' && (
                <StudentPortal 
                  session={session} 
                  onLogout={handleLogout} 
                  onDataChanged={handleDataChanged} 
                />
              )}
            </div>
          </ErrorBoundary>
        ) : (
          /* Authentication Login Screen UI */
          <div className="max-w-md mx-auto my-8 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fade-in">
            {/* Header branding box */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 text-white text-center flex flex-col items-center relative">
              <div className="w-16 h-16 bg-white/10 p-2 rounded-2xl border border-white/20 shadow-md backdrop-blur mb-2.5 flex items-center justify-center">
                <img src="/logo.svg" alt="Logo Phần Mềm Rèn Luyện" className="w-full h-full object-contain" />
              </div>
              <h3 className="font-extrabold text-base uppercase tracking-wider text-white">Hệ Thống Đánh Giá Rèn Luyện</h3>
              <p className="text-xs text-slate-300 mt-1">Chuẩn Thông tư 22 - Bộ Giáo dục &amp; Đào tạo</p>
            </div>

            {/* Role switch toggle bars */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-4 gap-1 text-[10.5px] font-bold text-center">
              {[
                { id: 'Super Admin', name: 'Hệ thống', icon: Shield },
                { id: 'School Admin', name: 'Nhà trường', icon: Building2 },
                { id: 'Teacher', name: 'GVCN', icon: Users },
                { id: 'Student', name: 'Học sinh', icon: GraduationCap },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRole(item.id as any);
                      setErrorMsg('');
                    }}
                    className={`p-2 rounded-lg border transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      role === item.id 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </button>
                );
              })}
            </div>

            {/* Error prompt alerts */}
            {errorMsg && (
              <div className="mx-6 mt-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Form submission inputs */}
            <form onSubmit={handleLogin} className="p-6 space-y-4 text-xs">
              
              {/* Select School dropdown (for all roles except Super Admin) */}
              {role !== 'Super Admin' && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">Chọn Trường học quản trị *</label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  >
                    {schools.length === 0 ? (
                      <option value="">-- Đang tải danh sách trường --</option>
                    ) : (
                      schools.map(sch => (
                        <option key={sch.school_id} value={sch.school_id}>
                          {sch.school_name.toUpperCase()} ({sch.school_id})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Login fields */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  {role === 'Student' ? 'Mã số Học sinh *' : 'Tên tài khoản hoặc Mã số *'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={role === 'Student' ? 'VD: HS001' : 'Tên tài khoản...'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-3 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Password field (Visible for all roles including Student) */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">Mật khẩu truy cập *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={role === 'Student' ? 'Mật khẩu (mặc định: 123456)...' : 'Mật khẩu...'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-10 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Hint Box helpers */}
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-[10.5px] text-slate-600 leading-relaxed">
                {role === 'Student' && (
                  <span>💡 <strong>Đăng nhập Học sinh:</strong> Điền <strong>Mã số Học sinh</strong> (VD: <code>HS001</code>) và <strong>Mật khẩu</strong> (Mặc định: <code>123456</code>). Học sinh bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.</span>
                )}
                {role === 'Teacher' && (
                  <span>💡 <strong>Tài khoản giáo viên mẫu:</strong> Đăng nhập với tài khoản <code>gv_nguyenanh</code>, mật khẩu <code>123</code> để vào Sổ chủ nhiệm lớp 10A1.</span>
                )}
                {role === 'School Admin' && (
                  <span>💡 <strong>Tài khoản Ban giám hiệu:</strong> Đăng nhập với tên <code>admin</code>, mật khẩu <code>admin</code> để vào quản trị toàn trường.</span>
                )}
                {role === 'Super Admin' && (
                  <span>💡 <strong>Tài khoản Super Admin:</strong> Đăng nhập với tên <code>Superadmin</code>, mật khẩu <code>admin@2026</code> để vào quản lý Multi-tenant các trường.</span>
                )}
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-1 text-sm mt-3"
              >
                VÀO HỆ THỐNG
              </button>

              {/* Help button trigger inside login card */}
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-800 font-semibold py-1 mt-1 cursor-pointer flex items-center justify-center gap-1 hover:underline"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Hướng dẫn đăng nhập &amp; cách xem báo cáo</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Render the outstanding Sheets synchronizer inspector in footer dynamically */}
      <div key={`sheets_ins_${dataTrigger}`}>
        <GoogleSheetsInspector 
          currentSchoolId={session?.schoolId} 
          onDataChanged={handleDataChanged} 
        />
      </div>

      {/* Footer bản quyền tác giả */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-center text-xs text-slate-500 font-medium shadow-xs">
        <div className="max-w-7xl mx-auto px-6">
          Phần mềm được xây dựng và phát triển bởi <span className="font-bold text-slate-800">Trần Thanh Tịnh</span>. Nghiêm cấm mọi hành vi chỉnh sửa, sao chép, phát tán khi chưa có sự đồng ý của tác giả.
        </div>
      </footer>
    </div>
  );
}
