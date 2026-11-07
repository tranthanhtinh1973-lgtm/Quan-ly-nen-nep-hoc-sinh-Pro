import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  UserCheck,
  GraduationCap,
  KeyRound,
  FileSpreadsheet,
  Smartphone,
  Laptop,
  CheckCircle2,
  Lock,
  Search,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: 'Student' | 'Teacher' | 'All';
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, defaultRole = 'All' }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'teacher' | 'student' | 'pwa'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header with App Logo Emblem */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-4 sm:p-6 flex items-center justify-between border-b border-slate-700 relative overflow-hidden">
          <div className="flex items-center gap-3 z-10">
            <div className="w-12 h-12 rounded-xl bg-white/10 p-1.5 backdrop-blur border border-white/20 shadow-md flex items-center justify-center">
              <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Sổ tay Hướng dẫn & Trợ giúp</h2>
                <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-medium">Thông tư 22</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">Hướng dẫn chi tiết cho Giáo viên chủ nhiệm & Học sinh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer z-10"
            title="Đóng"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Decorative background shield accent */}
          <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none">
            <img src="/logo.svg" alt="" className="w-48 h-48" />
          </div>
        </div>

        {/* Tab Selection & Search */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Tất cả hướng dẫn
            </button>
            <button
              onClick={() => setActiveTab('teacher')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'teacher'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> Dành cho GVCN
            </button>
            <button
              onClick={() => setActiveTab('student')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Dành cho Học sinh
            </button>
            <button
              onClick={() => setActiveTab('pwa')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pwa'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Cài ứng dụng
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm hướng dẫn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Modal Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs sm:text-sm">

          {/* 1. HƯỚNG DẪN DÀNH CHO HỌC SINH */}
          {(activeTab === 'all' || activeTab === 'student') && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-blue-100 pb-2 text-blue-900 font-bold text-base">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3>1. Hướng dẫn sử dụng dành cho HỌC SINH</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Đăng nhập học sinh */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-blue-300 transition">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                    <span>Cách Đăng nhập vào tài khoản</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                    <li>Chọn loại tài khoản: <strong className="text-slate-800">Học sinh</strong>.</li>
                    <li>Chọn đúng <strong className="text-slate-800">Đơn vị Nhà trường</strong> của bạn.</li>
                    <li>Nhập <strong className="text-slate-800">Mã học sinh / Mã vnEdu</strong> hoặc Tên đăng nhập được cấp.</li>
                    <li>Nhập mật khẩu (Nếu lần đầu, nhập mật khẩu do lớp cấp hoặc `123`).</li>
                    <li>Nhấn <strong className="text-blue-600">Đăng nhập</strong>.</li>
                  </ol>
                </div>

                {/* Đổi mật khẩu học sinh */}
                <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200 hover:border-amber-300 transition">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-sm mb-2">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>Các bước Đổi mật khẩu (Bắt buộc)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-700 pl-1">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>Bắt buộc đổi mật khẩu:</strong> Sau lần đăng nhập đầu tiên, hệ thống sẽ hiện bảng yêu cầu học sinh thay đổi mật khẩu mặc định.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 6 ký tự).</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Hoặc mở tính năng <strong>"Đổi mật khẩu"</strong> ở góc trên bên phải màn hình Học sinh bất cứ lúc nào.</span>
                    </li>
                  </ul>
                </div>

                {/* Xem báo cáo rèn luyện */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-blue-300 transition md:col-span-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Cách Xem Xếp loại Rèn luyện & Báo cáo Học kỳ</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-1">Thống kê theo Tháng:</h4>
                      <p>Xem đánh giá mức <span className="font-semibold text-emerald-600">Tốt / Khá / Đạt / Chưa đạt</span> từng tháng trong học kỳ kèm tổng điểm chuyên cần và điểm vi phạm.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-1">Xếp loại Học kỳ (Thông tư 22):</h4>
                      <p>Hệ thống tự động tổng hợp kết quả cả học kỳ. Nếu bị vi phạm nặng (bị trừ từ 60 - 80 điểm trở lên), ô lý do hạ bậc sẽ ghi rõ căn cứ.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. HƯỚNG DẪN DÀNH CHO GIÁO VIÊN CHỦ NHIỆM */}
          {(activeTab === 'all' || activeTab === 'teacher') && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-purple-100 pb-2 text-purple-900 font-bold text-base">
                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3>2. Hướng dẫn sử dụng dành cho GIÁO VIÊN CHỦ NHIỆM (GVCN)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Đăng nhập GVCN */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-purple-300 transition">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
                    <ChevronRight className="w-4 h-4 text-purple-600" />
                    <span>Cách Đăng nhập GVCN</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                    <li>Chọn loại người dùng: <strong className="text-slate-800">GVCN</strong>.</li>
                    <li>Chọn đúng <strong className="text-slate-800">Đơn vị Nhà trường</strong>.</li>
                    <li>Tên đăng nhập: Nhập mã GV do trường cấp (VD: `gv_10a1`, `gv_10a2`...).</li>
                    <li>Mật khẩu mặc định: `123`.</li>
                  </ol>
                </div>

                {/* Quản lý rèn luyện & điểm danh */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-purple-300 transition">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Chấm điểm & Ghi nhận Kỷ luật</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 pl-1">
                    <li>• **Ghi nhận vi phạm:** Chọn học sinh → Thêm vi phạm theo bảng lỗi chuẩn.</li>
                    <li>• **Điểm danh chuyên cần:** Ghi nhận nghỉ P (Phép), KP (Không phép), bỏ tiết.</li>
                    <li>• **Duyệt nghỉ phép:** Xem và phê duyệt đơn xin nghỉ do học sinh gửi.</li>
                  </ul>
                </div>

                {/* Xem báo cáo & Xuất file PDF/Excel */}
                <div className="bg-purple-50/60 rounded-xl p-4 border border-purple-200 hover:border-purple-300 transition md:col-span-2">
                  <div className="flex items-center gap-2 font-bold text-purple-900 text-sm mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-purple-700" />
                    <span>Cách Xem Báo cáo & Xuất Bảng xếp loại KQRL</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <strong className="text-purple-900 block mb-1">1. Xuất Sổ Rèn Luyện PDF:</strong>
                      <span>Tự động tạo mẫu phiếu tổng hợp theo Thông tư 22 có đầy đủ chữ ký để in ấn, lưu trữ.</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <strong className="text-purple-900 block mb-1">2. Xuất Excel Báo Cáo:</strong>
                      <span>Tải file Excel tổng hợp điểm rèn luyện, chuyên cần của toàn bộ học sinh trong lớp.</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <strong className="text-purple-900 block mb-1">3. Đồng bộ Google Sheets:</strong>
                      <span>Dữ liệu chấm điểm được tự động đẩy lên tệp Google Sheets chung của nhà trường.</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 3. CÀI ĐẶT ỨNG DỤNG LÊN ĐIỆN THOẠI & MÁY TÍNH */}
          {(activeTab === 'all' || activeTab === 'pwa') && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-emerald-100 pb-2 text-emerald-900 font-bold text-base">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3>3. Hướng dẫn Cài đặt Ứng dụng ra Màn hình chính (PWA)</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* iOS iPhone */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Trên iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                    <li>Mở link phần mềm bằng trình duyệt **Safari**.</li>
                    <li>Bấm nút **Chia sẻ** *(ô vuông có mũi tên lên ở đáy màn hình)*.</li>
                    <li>Chọn **"Thêm vào Màn hình chính"** *(Add to Home Screen)*.</li>
                    <li>Nhấn **"Thêm"**. Lô-gô ứng dụng sẽ xuất hiện ngoài màn hình.</li>
                  </ol>
                </div>

                {/* Android */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Trên Android (Chrome)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                    <li>Mở link phần mềm bằng trình duyệt **Google Chrome**.</li>
                    <li>Bấm biểu tượng **3 Dấu chấm** góc trên bên phải.</li>
                    <li>Chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào Màn hình chính"**.</li>
                    <li>Nhấn **"Cài đặt"** để hoàn tất.</li>
                  </ol>
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Hệ thống Đánh giá Rèn luyện Học sinh • Chuẩn Bộ GD&ĐT</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition cursor-pointer shadow-sm"
          >
            Đã hiểu & Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
