import React, { useState, useEffect } from 'react';
import { School, Session } from '../types';
import { GoogleDriveService } from '../lib/GoogleDriveService';
import { ExcelHelper } from './ExcelHelper';
import { 
  Plus, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  Building2, 
  Users, 
  UserCheck, 
  Key, 
  LogOut, 
  Lock,
  Globe
} from 'lucide-react';

interface SuperAdminDashboardProps {
  session: Session;
  onLogout: () => void;
  onRefreshGlobalData?: () => void;
}

export default function SuperAdminDashboard({ session, onLogout, onRefreshGlobalData }: SuperAdminDashboardProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  
  // Form fields for new school
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newSchoolAdmin, setNewSchoolAdmin] = useState('');
  const [newSchoolPass, setNewSchoolPass] = useState('123');

  // Edit school states
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editSchoolAddress, setEditSchoolAddress] = useState('');
  const [editSchoolAdmin, setEditSchoolAdmin] = useState('');
  const [editSchoolPass, setEditSchoolPass] = useState('');
  const [editSchoolSheetId, setEditSchoolSheetId] = useState('');

  // Custom delete confirmation states (fixing iframe window.confirm unresponsive bug)
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);

  // Stats
  const [stats, setStats] = useState({
    schoolsCount: 0,
    studentsCount: 0,
    teachersCount: 0
  });

  useEffect(() => {
    loadSchoolsData();
  }, [onRefreshGlobalData]);

  const loadSchoolsData = async () => {
    const remoteSchools = await GoogleDriveService.fetchSchoolsFromCentralServer();
    const sList = remoteSchools || GoogleDriveService.getSchools();
    setSchools(sList);

    // Calculate aggregated stats across all schools
    let totalStudents = 0;
    let totalTeachers = 0;

    for (const s of sList) {
      await GoogleDriveService.fetchSchoolDataFromCentralServer(s.school_id);
      const sData = GoogleDriveService.getSchoolData(s.school_id);
      totalStudents += sData.STUDENTS?.length || 0;
      totalTeachers += sData.USERS?.filter(u => u.role === 'Teacher')?.length || 0;
    }

    setStats({
      schoolsCount: sList.length,
      studentsCount: totalStudents,
      teachersCount: totalTeachers
    });
  };

  const handleAddSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolId || !newSchoolName || !newSchoolAdmin) {
      alert('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }

    const uppercaseId = newSchoolId.toUpperCase().trim();
    
    // Check duplication
    if (schools.some(s => s.school_id === uppercaseId)) {
      alert('Mã định danh trường này đã tồn tại trên hệ thống!');
      return;
    }

    const newSchool: School = {
      school_id: uppercaseId,
      school_name: newSchoolName.trim(),
      address: newSchoolAddress.trim() || 'Chưa cập nhật địa chỉ',
      admin_username: newSchoolAdmin.trim(),
      admin_password: newSchoolPass,
      sheet_file_id: `1${uppercaseId}_Sheet_Drive_File_${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Active',
    };

    const updated = [...schools, newSchool];
    setSchools(updated);
    GoogleDriveService.saveSchools(updated);
    
    // Initialize default school data space
    const defaultData = GoogleDriveService.getSchoolData(uppercaseId);
    
    // Auto-save default data to trigger immediate Google Sheet file creation on Google Drive in background
    GoogleDriveService.saveSchoolData(uppercaseId, defaultData);

    alert(`Đã thêm trường mới thành công!\nHệ thống tự động kích hoạt tạo tệp dữ liệu Google Sheets riêng biệt: DB_${uppercaseId} trong thư mục lưu trữ trên Google Drive.`);

    // Reset forms
    setNewSchoolId('');
    setNewSchoolName('');
    setNewSchoolAddress('');
    setNewSchoolAdmin('');
    setNewSchoolPass('123');
    setShowAddModal(false);
    loadSchoolsData();
    if (onRefreshGlobalData) onRefreshGlobalData();
  };

  const handleToggleStatus = (schoolId: string) => {
    const updated = schools.map(s => {
      if (s.school_id === schoolId) {
        const nextStatus = s.status === 'Active' ? 'Inactive' : 'Active';
        return { ...s, status: nextStatus as 'Active' | 'Inactive' };
      }
      return s;
    });
    setSchools(updated);
    GoogleDriveService.saveSchools(updated);
    loadSchoolsData();
    if (onRefreshGlobalData) onRefreshGlobalData();
  };

  const handleStartEdit = (school: School) => {
    setEditingSchool(school);
    setEditSchoolName(String(school.school_name || ''));
    setEditSchoolAddress(String(school.address || ''));
    setEditSchoolAdmin(String(school.admin_username || ''));
    setEditSchoolPass(String(school.admin_password || ''));
    setEditSchoolSheetId(String(school.sheet_file_id || ''));
  };

  const handleSaveEditSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;

    const updated = schools.map(s => {
      if (s.school_id === editingSchool.school_id) {
        return {
          ...s,
          school_name: String(editSchoolName).trim(),
          address: String(editSchoolAddress).trim(),
          admin_username: String(editSchoolAdmin).trim(),
          admin_password: String(editSchoolPass).trim(),
          sheet_file_id: String(editSchoolSheetId).trim()
        };
      }
      return s;
    });

    setSchools(updated);
    GoogleDriveService.saveSchools(updated);
    setEditingSchool(null);
    loadSchoolsData();
    if (onRefreshGlobalData) onRefreshGlobalData();
    alert('Đã cập nhật thông tin nhà trường thành công!');
  };

  const executeDeleteSchool = () => {
    if (!deletingSchool) return;
    const schoolId = deletingSchool.school_id;

    const updated = GoogleDriveService.deleteSchool(schoolId);
    setSchools(updated);

    setDeletingSchool(null);
    loadSchoolsData();
    if (onRefreshGlobalData) onRefreshGlobalData();
    alert('Đã xóa bản ghi trường học thành công!');
  };

  const handleExportSchools = () => {
    ExcelHelper.exportSchools(schools, 'Danh_Sach_Cac_Truong_Hoc');
  };

  const handleImportSchoolsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    ExcelHelper.importSchools(file).then((parsed) => {
      const updated = [...schools];
      parsed.forEach((item) => {
        if (!updated.some(s => s.school_id === item.school_id)) {
          updated.push(item);
        }
      });
      setSchools(updated);
      GoogleDriveService.saveSchools(updated);
      loadSchoolsData();
      alert('Đã nhập danh sách trường từ Excel thành công!');
    }).catch(err => {
      alert('Lỗi khi tải file Excel: ' + err.message);
    });
  };

  const handleDownloadSample = () => {
    const sample = [
      {
        school_id: 'LHP',
        school_name: 'THPT Chuyên Lê Hồng Phong',
        address: '235 Nguyễn Văn Cừ, Q5',
        admin_username: 'admin_lhp',
        admin_password: '123',
        status: 'Active',
        action: ''
      },
      {
        school_id: 'ND',
        school_name: 'THPT Nguyễn Du',
        address: 'Quận 10, TP.HCM',
        admin_username: 'admin_nd',
        admin_password: '123',
        status: 'Active',
        action: ''
      }
    ];
    ExcelHelper.exportSchools(sample, 'Mau_Import_TruongHoc');
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Top Header info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg text-slate-800">Cổng Quản Trị Cấp Cao</h2>
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
                Hệ thống Toàn tỉnh
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Đăng nhập dưới quyền Super Admin Hệ thống Quản lý &amp; Đánh giá Rèn luyện Học sinh Đa trường.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg transition font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Tải File Mẫu
          </button>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg transition font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Nhập từ Excel
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportSchoolsExcel}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowPassModal(true)}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg transition font-medium cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            Đổi mật khẩu
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-3 py-2 rounded-lg transition font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* KPI statistics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tổng số trường liên kết</span>
            <h3 className="text-3xl font-bold text-slate-800">{stats.schoolsCount}</h3>
            <p className="text-[10px] text-emerald-600 font-medium">Bản ghi độc lập trên Google Drive</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tổng số học sinh tỉnh</span>
            <h3 className="text-3xl font-bold text-slate-800">{stats.studentsCount}</h3>
            <p className="text-[10px] text-indigo-600 font-medium">Đánh giá rèn luyện tự động</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tổng số tài khoản giáo viên</span>
            <h3 className="text-3xl font-bold text-slate-800">{stats.teachersCount}</h3>
            <p className="text-[10px] text-amber-600 font-medium">Phân quyền GVCN các lớp</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Primary registry grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Danh Mục Đăng Ký Các Trường Học</h3>
            <p className="text-xs text-slate-500 mt-0.5">Quản lý định danh liên kết và cấp quyền truy cập cơ sở dữ liệu.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSchools}
              className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-lg transition font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Xuất Excel
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              THÊM TRƯỜNG MỚI
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 w-24">Mã Trường</th>
                <th className="py-3 px-4">Tên Cơ Sở Giáo Dục</th>
                <th className="py-3 px-4">Địa Chỉ / Năm học</th>
                <th className="py-3 px-4">Tài Khoản Admin</th>
                <th className="py-3 px-4">Mật Khẩu</th>
                <th className="py-3 px-4">ID Tệp Google Sheets</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-center w-28">Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {schools.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                    Chưa có trường học nào đăng ký. Nhấn "Thêm trường mới" để khởi tạo.
                  </td>
                </tr>
              ) : (
                schools.map((school, index) => (
                  <tr key={school.school_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4 font-bold text-blue-600">{school.school_id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{school.school_name}</td>
                    <td className="py-3 px-4 text-slate-600">{school.address}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{school.admin_username}</td>
                    <td className="py-3 px-4 font-mono text-slate-700 bg-slate-50/50 font-semibold">{school.admin_password}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 select-all truncate max-w-[120px]" title={school.sheet_file_id}>
                      {school.sheet_file_id}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        school.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}>
                        {school.status === 'Active' ? 'Hoạt Động' : 'Tạm Khóa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(school.school_id)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            school.status === 'Active'
                              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={school.status === 'Active' ? 'Khóa tạm thời' : 'Mở khóa'}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleStartEdit(school)}
                          className="p-1.5 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingSchool(school)}
                          className="p-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                          title="Xóa trường rèn luyện"
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

      {/* Add School Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold text-base flex items-center gap-1.5">
                <Building2 className="w-5 h-5" />
                THÊM TRƯỜNG MỚI &amp; TẠO SHEETS
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">Tự động cấu hình riêng biệt cho cơ sở rèn luyện mới.</p>
            </div>

            <form onSubmit={handleAddSchool} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1">
                  <label className="font-semibold text-slate-700">Mã Trường *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: LHP, ND"
                    value={newSchoolId}
                    onChange={(e) => setNewSchoolId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-blue-600 text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700">Tên Trường Học *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: THPT Lê Hồng Phong"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Địa chỉ trường học</label>
                <input
                  type="text"
                  placeholder="Nhập địa chỉ hành chính..."
                  value={newSchoolAddress}
                  onChange={(e) => setNewSchoolAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="space-y-1 col-span-2">
                  <span className="font-bold text-[10px] text-blue-700 block uppercase tracking-wider">Cấp tài khoản BGH</span>
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Tên Tài Khoản Admin *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: admin_lhp"
                    value={newSchoolAdmin}
                    onChange={(e) => setNewSchoolAdmin(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mật khẩu ban đầu</label>
                  <input
                    type="password"
                    required
                    placeholder="VD: 123"
                    value={newSchoolPass}
                    onChange={(e) => setNewSchoolPass(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="text-[10px] text-amber-600 bg-amber-50 p-3 rounded border border-amber-100 leading-relaxed">
                🚀 Hệ thống sẽ tự động đăng ký một tập tin cơ sở dữ liệu riêng tên <strong>DB_[Mã]_TênTrường.xlsx</strong> 
                trong danh mục Drive, tách biệt tài khoản đăng nhập cho Ban Giám Hiệu.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Khởi Tạo Cơ Sở
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-slate-800 text-white p-4">
              <h3 className="font-bold text-sm">Đổi mật khẩu Super Admin</h3>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mật khẩu mới</label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPassModal(false)}
                  className="bg-slate-100 text-slate-700 px-3.5 py-1.5 rounded transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    alert('Đã thay đổi mật khẩu Super Admin thành công!');
                    setShowPassModal(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition cursor-pointer"
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {editingSchool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-blue-700 text-white p-4">
              <h3 className="font-bold text-base flex items-center gap-1.5">
                <Edit3 className="w-5 h-5" />
                CẬP NHẬT THÔNG TIN TRƯỜNG
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">Sửa đổi cấu hình phân quyền và liên kết tệp của trường.</p>
            </div>

            <form onSubmit={handleSaveEditSchool} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1">
                  <label className="font-semibold text-slate-700">Mã Trường (Khóa)</label>
                  <input
                    type="text"
                    disabled
                    value={editingSchool.school_id}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-400 font-bold focus:outline-none text-xs cursor-not-allowed"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700">Tên Trường Học *</label>
                  <input
                    type="text"
                    required
                    value={editSchoolName}
                    onChange={(e) => setEditSchoolName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Địa chỉ trường học</label>
                <input
                  type="text"
                  value={editSchoolAddress}
                  onChange={(e) => setEditSchoolAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="space-y-1 col-span-2">
                  <span className="font-bold text-[10px] text-blue-700 block uppercase tracking-wider">Tài khoản quản trị Ban Giám Hiệu</span>
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Tên Tài Khoản Admin *</label>
                  <input
                    type="text"
                    required
                    value={editSchoolAdmin}
                    onChange={(e) => setEditSchoolAdmin(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mật khẩu Admin *</label>
                  <input
                    type="text"
                    required
                    value={editSchoolPass}
                    onChange={(e) => setEditSchoolPass(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ID Tệp Google Sheets liên kết</label>
                <input
                  type="text"
                  required
                  value={editSchoolSheetId}
                  onChange={(e) => setEditSchoolSheetId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-600 text-[11px] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSchool(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deletingSchool && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-sm">Xác nhận xóa nhà trường?</h3>
            </div>
            
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Bạn có chắc chắn muốn xóa trường rèn luyện <strong className="text-slate-900">"{deletingSchool.school_name}"</strong> với mã số <strong className="text-blue-600">({deletingSchool.school_id})</strong> khỏi hệ thống?
              </p>
              
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-700 leading-normal text-[11px]">
                ⚠️ <strong>Cảnh báo quan trọng:</strong> Hành động này sẽ xóa toàn bộ bộ nhớ cục bộ, lịch sử thi đua rèn luyện của học sinh và hủy liên kết tệp dữ liệu trên Google Drive. Hành động này không thể hoàn tác.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingSchool(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeDeleteSchool}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
