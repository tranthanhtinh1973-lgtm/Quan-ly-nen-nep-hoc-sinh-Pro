export interface School {
  school_id: string;
  school_name: string;
  address: string;
  admin_username: string;
  admin_password: string;
  sheet_file_id: string;
  status: 'Active' | 'Inactive' | 'Suspended';
}

export interface SchoolConfig {
  year: string; // e.g. "2026-2027"
  semester: string; // "Học kỳ I" | "Học kỳ II"
  school_name: string;
  is_locked: boolean; // Trạng thái khóa sổ số liệu
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: 'Super Admin' | 'School Admin' | 'Teacher' | 'Student' | string;
  class_assigned?: string; // Class name (e.g., "10A1", "11B2") or empty for Admin
  signature_base64?: string; // Teacher's signature
  full_name?: string; // Họ và tên GV
  name?: string;
  school_id?: string;
  assignedClass?: string;
}

export interface Student {
  id: string; // Mã HS
  name: string; // Họ tên
  class: string; // Lớp
  password?: string;
  birth_date?: string; // Ngày sinh YYYY-MM-DD
  parent_name?: string; // Tên phụ huynh
  phone?: string; // SĐT liên lạc
  gender?: string; // Giới tính: Nam / Nữ
  vnedu_code?: string; // Mã VnEdu 10 chữ số
  vneduId?: string; // Mã VnEdu 10 chữ số chuẩn hóa
  code?: string;
  password_changed?: boolean; // Đã đổi mật khẩu mặc định chưa
  must_change_password?: boolean; // Yêu cầu bắt buộc đổi mật khẩu
}

export interface ScoreRule {
  code: string; // Mã lỗi/Mã khen thưởng
  name: string; // Tên lỗi/hành vi rèn luyện
  points: number; // Số điểm mặc định (+/-)
  category: 'Discipline' | 'Reward'; // Loại rèn luyện
}

export interface LogDiscipline {
  id: string;
  student_id: string;
  date: string; // YYYY-MM-DD
  rule_code: string; // Mã hành vi
  points: number; // Điểm thay đổi
  notes: string; // Ghi chú / Minh chứng
  recorded_by: string; // Giáo viên ghi nhận
  term_month: string; // Tháng ghi nhận (e.g. "Tháng 8", "Tháng 9")
  evidence_base64?: string; // Hình ảnh minh chứng đính kèm
}

export interface Attendance {
  id?: string;
  date: string; // YYYY-MM-DD
  student_id: string;
  status: 'P' | 'KP' | 'BT_SANG' | 'BT_CHIEU' | 'SP' | 'SK' | 'CP' | 'CK' | 'Tiet' | string; // P: Phép, KP: Không phép, BT_SANG: Bỏ tiết sáng, BT_CHIEU: Bỏ tiết chiều, or VNEDU codes
  notes?: string;
  attendance?: {
    type: 'SP' | 'SK' | 'CP' | 'CK' | 'Tiet';
    periods: string[];
    note?: string;
  };
}

export interface Complaint {
  id: string;
  student_id: string;
  log_id: string;
  reason: string;
  evidence_base64?: string; // Minh chứng đính kèm
  status: 'Pending' | 'Approved' | 'Rejected'; // Chờ duyệt | Chấp nhận | Từ chối
  feedback?: string; // Phản hồi của BGH
  response?: string; // Phản hồi của BGH
  created_at: string; // YYYY-MM-DD HH:mm:ss
}

// Active login session type
export interface Session {
  role: 'Super Admin' | 'School Admin' | 'Teacher' | 'Student';
  schoolId?: string; // Empty for Super Admin
  schoolName?: string;
  userId?: string; // For Teacher or Admin
  username?: string;
  studentId?: string; // For Student portal
  studentClass?: string; // For Student portal
  user?: User;
  assignedClass?: string;
  studentCode?: string;
}

export interface SchoolData {
  CONFIG: SchoolConfig[];
  USERS: User[];
  STUDENTS: Student[];
  SCORE_RULES: ScoreRule[];
  LOGS_DISCIPLINE: LogDiscipline[];
  ATTENDANCE: Attendance[];
  COMPLAINTS: Complaint[];
  CLASSES?: any[];
  [key: string]: any[];
}
