import { School, SchoolConfig, User, Student, ScoreRule, LogDiscipline, Attendance, Complaint } from '../types';

export const DEFAULT_SCORE_RULES: ScoreRule[] = [
  // Discipline rules (VP01 -> VP15)
  { code: 'VP01', name: 'Đi học muộn / Vào lớp muộn', points: -2, category: 'Discipline' },
  { code: 'VP02', name: 'Không đeo thẻ học sinh / sai phù hiệu', points: -2, category: 'Discipline' },
  { code: 'VP03', name: 'Sai tác phong, trang phục học đường', points: -2, category: 'Discipline' },
  { code: 'VP04', name: 'Sử dụng điện thoại trái phép trong giờ học', points: -5, category: 'Discipline' },
  { code: 'VP05', name: 'Làm việc riêng, mất trật tự trong giờ', points: -2, category: 'Discipline' },
  { code: 'VP06', name: 'Không chuẩn bị bài / thiếu bài tập về nhà', points: -3, category: 'Discipline' },
  { code: 'VP07', name: 'Trốn học, cúp tiết, bỏ sinh hoạt tập thể', points: -5, category: 'Discipline' },
  { code: 'VP08', name: 'Gây mất đoàn kết nội bộ, cãi nhau', points: -5, category: 'Discipline' },
  { code: 'VP09', name: 'Ăn quà vặt, xả rác bừa bãi trong lớp', points: -2, category: 'Discipline' },
  { code: 'VP10', name: 'Sử dụng thuốc lá, vape, chất cấm', points: -10, category: 'Discipline' },
  { code: 'VP11', name: 'Vi phạm quy định an toàn giao thông', points: -5, category: 'Discipline' },
  { code: 'VP12', name: 'Phát ngôn thiếu văn hóa, nói tục chửi bậy', points: -3, category: 'Discipline' },
  { code: 'VP13', name: 'Vô lễ, bất hợp tác với giáo viên, nhân viên', points: -10, category: 'Discipline' },
  { code: 'VP14', name: 'Phá hoại tài sản, viết vẽ bậy lên bàn ghế', points: -10, category: 'Discipline' },
  { code: 'VP15', name: 'Đánh nhau, bạo lực học đường', points: -15, category: 'Discipline' },

  // Reward rules (KT01 -> KT06)
  { code: 'KT01', name: 'Học sinh xuất sắc / đứng đầu học kỳ', points: 15, category: 'Reward' },
  { code: 'KT02', name: 'Đạt giải cuộc thi Học sinh giỏi, KHKT', points: 20, category: 'Reward' },
  { code: 'KT03', name: 'Tích cực phát biểu, đóng góp xây dựng bài', points: 2, category: 'Reward' },
  { code: 'KT04', name: 'Tham gia hoạt động tình nguyện, ngoại khóa tích cực', points: 5, category: 'Reward' },
  { code: 'KT05', name: 'Giúp bạn vượt khó, đôi bạn cùng tiến', points: 5, category: 'Reward' },
  { code: 'KT06', name: 'Nhặt được của rơi, trả lại người mất', points: 10, category: 'Reward' },
];

export const INITIAL_SCHOOLS: School[] = [
  {
    school_id: 'LB',
    school_name: 'THPT Lộc Bình',
    address: 'Khu 3, thị trấn Lộc Bình, huyện Lộc Bình, tỉnh Lạng Sơn',
    admin_username: 'admin_locbinh',
    admin_password: '123',
    sheet_file_id: '1LOCBINH_Sheet_File_Id_111',
    status: 'Active',
  },
  {
    school_id: 'LHP',
    school_name: 'THPT Chuyên Lê Hồng Phong',
    address: '235 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh',
    admin_username: 'admin_lhp',
    admin_password: '123',
    sheet_file_id: '1LHP_Sheet_File_Id_999',
    status: 'Active',
  },
  {
    school_id: 'ND',
    school_name: 'THPT Nguyễn Du',
    address: 'XX Đồng Nai, Quận 10, TP. Hồ Chí Minh',
    admin_username: 'admin_nd',
    admin_password: '123',
    sheet_file_id: '1ND_Sheet_File_Id_888',
    status: 'Active',
  },
  {
    school_id: 'GD',
    school_name: 'THPT Gia Định',
    address: '44 Võ Oanh, Quận Bình Thạnh, TP. Hồ Chí Minh',
    admin_username: 'admin_gd',
    admin_password: '123',
    sheet_file_id: '1GD_Sheet_File_Id_777',
    status: 'Active',
  },
];

// Initial school configs
export const INITIAL_CONFIGS: Record<string, SchoolConfig> = {
  'LB': {
    year: '2026-2027',
    semester: 'Học kỳ I',
    school_name: 'THPT Lộc Bình',
    is_locked: false,
  },
  'LHP': {
    year: '2026-2027',
    semester: 'Học kỳ I',
    school_name: 'THPT Chuyên Lê Hồng Phong',
    is_locked: false,
  },
  'ND': {
    year: '2026-2027',
    semester: 'Học kỳ I',
    school_name: 'THPT Nguyễn Du',
    is_locked: false,
  },
  'GD': {
    year: '2026-2027',
    semester: 'Học kỳ I',
    school_name: 'THPT Gia Định',
    is_locked: false,
  },
};

// Initial per-school USERS
export const INITIAL_USERS: Record<string, User[]> = {
  'LB': [
    { id: 'U041', username: 'admin_locbinh', password: '123', role: 'School Admin', class_assigned: '' },
    { id: 'U042', username: 'gv_nguyenvanhai', password: '123', role: 'Teacher', class_assigned: '10A1', full_name: 'Nguyễn Văn Hải' },
    { id: 'U043', username: 'gv_hoangthimai', password: '123', role: 'Teacher', class_assigned: '10A2', full_name: 'Hoàng Thị Mai' },
  ],
  'LHP': [
    { id: 'U001', username: 'admin_lhp', password: '123', role: 'School Admin', class_assigned: '' },
    { id: 'U002', username: 'gv_nguyenanh', password: '123', role: 'Teacher', class_assigned: '10A1' },
    { id: 'U003', username: 'gv_lethimai', password: '123', role: 'Teacher', class_assigned: '10A2' },
    { id: 'U004', username: 'gv_tranminh', password: '123', role: 'Teacher', class_assigned: '11B1' },
  ],
  'ND': [
    { id: 'U011', username: 'admin_nd', password: '123', role: 'School Admin', class_assigned: '' },
    { id: 'U012', username: 'gv_phamhuong', password: '123', role: 'Teacher', class_assigned: '10C1' },
  ],
  'GD': [
    { id: 'U021', username: 'admin_gd', password: '123', role: 'School Admin', class_assigned: '' },
    { id: 'U022', username: 'gv_hoangnam', password: '123', role: 'Teacher', class_assigned: '12A1' },
  ],
};

// Initial per-school STUDENTS
export const INITIAL_STUDENTS: Record<string, Student[]> = {
  'LB': [
    { id: 'HS001', name: 'Nông Văn Nam', class: '10A1', password: '123', birth_date: '2010-05-12', parent_name: 'Nông Văn Hùng', phone: '0901234567' },
    { id: 'HS002', name: 'Hoàng Thị Thảo', class: '10A1', password: '123', birth_date: '2010-09-24', parent_name: 'Hoàng Văn Lập', phone: '0907654321' },
    { id: 'HS003', name: 'Lý Quốc Bảo', class: '10A2', password: '123', birth_date: '2010-02-18', parent_name: 'Lý Văn Tiến', phone: '0912345678' },
  ],
  'LHP': [
    { id: 'HS001', name: 'Nguyễn Văn Nam', class: '10A1', password: '123', birth_date: '2010-05-12', parent_name: 'Nguyễn Văn Hải', phone: '0901234567' },
    { id: 'HS002', name: 'Lê Thị Mai', class: '10A1', password: '123', birth_date: '2010-09-24', parent_name: 'Lê Trung Kiên', phone: '0907654321' },
    { id: 'HS003', name: 'Trần Hoàng Quân', class: '10A1', password: '123', birth_date: '2010-01-15', parent_name: 'Trần Anh Tuấn', phone: '0912345678' },
    { id: 'HS004', name: 'Phạm Minh Đức', class: '10A1', password: '123', birth_date: '2010-03-30', parent_name: 'Phạm Thành Nam', phone: '0933445566' },
    { id: 'HS005', name: 'Hoàng Thu Trang', class: '10A2', password: '123', birth_date: '2010-07-18', parent_name: 'Hoàng Văn Bình', phone: '0988776655' },
    { id: 'HS006', name: 'Đỗ Gia Bảo', class: '10A2', password: '123', birth_date: '2010-12-05', parent_name: 'Đỗ Văn Mạnh', phone: '0977665544' },
    { id: 'HS007', name: 'Vũ Quốc Huy', class: '11B1', password: '123', birth_date: '2009-02-14', parent_name: 'Vũ Văn Long', phone: '0944556677' },
    { id: 'HS008', name: 'Bùi Minh Hằng', class: '11B1', password: '123', birth_date: '2009-11-20', parent_name: 'Bùi Thị Hà', phone: '0911223344' },
  ],
  'ND': [
    { id: 'HS011', name: 'Phạm Văn Hùng', class: '10C1', password: '123', birth_date: '2010-04-10', parent_name: 'Phạm Văn Long', phone: '0909999999' },
    { id: 'HS012', name: 'Trần Thanh Hương', class: '10C1', password: '123', birth_date: '2010-08-08', parent_name: 'Trần Huy Hoàng', phone: '0908888888' },
  ],
  'GD': [
    { id: 'HS021', name: 'Đặng Minh Khôi', class: '12A1', password: '123', birth_date: '2008-03-05', parent_name: 'Đặng Tuấn Anh', phone: '0902222222' },
    { id: 'HS022', name: 'Nguyễn Ngọc Trinh', class: '12A1', password: '123', birth_date: '2008-10-15', parent_name: 'Nguyễn Hữu Trí', phone: '0901111111' },
  ],
};

// Initial per-school LOGS_DISCIPLINE
export const INITIAL_LOGS: Record<string, LogDiscipline[]> = {
  'LHP': [
    // Prepopulated for Trần Hoàng Quân (HS003) - Trốn học, Sử dụng điện thoại, Vô lễ
    { id: 'L001', student_id: 'HS003', date: '2026-09-02', rule_code: 'VP07', points: -5, notes: 'Trốn tiết sinh hoạt dưới cờ ngày đầu tuần', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    { id: 'L002', student_id: 'HS003', date: '2026-09-08', rule_code: 'VP04', points: -5, notes: 'Chơi game Liên Quân trong giờ học toán', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    { id: 'L003', student_id: 'HS003', date: '2026-09-12', rule_code: 'VP13', points: -10, notes: 'Cãi lời, thái độ thách thức khi cô phê bình', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    
    // Some normal points
    { id: 'L004', student_id: 'HS001', date: '2026-09-05', rule_code: 'KT03', points: 2, notes: 'Tích cực xung phong lên bảng giải toán khó', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    { id: 'L005', student_id: 'HS001', date: '2026-09-10', rule_code: 'KT06', points: 10, notes: 'Nhặt được ví tiền ở sân trường trả lại phòng giám thị', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    
    { id: 'L006', student_id: 'HS002', date: '2026-09-04', rule_code: 'VP01', points: -2, notes: 'Đi trễ 15 phút tiết Văn buổi sáng', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    { id: 'L007', student_id: 'HS002', date: '2026-09-11', rule_code: 'KT04', points: 5, notes: 'Tham gia dọn dẹp vệ sinh phòng Lab tích cực', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    
    { id: 'L008', student_id: 'HS004', date: '2026-09-08', rule_code: 'VP02', points: -2, notes: 'Không đeo thẻ học sinh và quên phù hiệu lớp', recorded_by: 'gv_nguyenanh', term_month: 'Tháng 9' },
    
    { id: 'L009', student_id: 'HS006', date: '2026-09-10', rule_code: 'VP05', points: -2, notes: 'Nói chuyện riêng và ăn bánh tráng trong giờ Hoá', recorded_by: 'gv_lethimai', term_month: 'Tháng 9' },
    { id: 'L010', student_id: 'HS005', date: '2026-09-12', rule_code: 'KT05', points: 5, notes: 'Hướng dẫn bạn Gia Bảo giải bài tập Lý tiến bộ', recorded_by: 'gv_lethimai', term_month: 'Tháng 9' },
  ],
  'ND': [
    { id: 'L101', student_id: 'HS011', date: '2026-09-05', rule_code: 'VP03', points: -2, notes: 'Mặc áo thun không cổ đi học', recorded_by: 'gv_phamhuong', term_month: 'Tháng 9' },
  ],
  'GD': [
    { id: 'L201', student_id: 'HS021', date: '2026-09-10', rule_code: 'KT02', points: 20, notes: 'Giải Nhất cuộc thi HSG cấp Thành phố môn Hoá', recorded_by: 'gv_hoangnam', term_month: 'Tháng 9' },
  ],
};

// Initial per-school ATTENDANCE
export const INITIAL_ATTENDANCE: Record<string, Attendance[]> = {
  'LHP': [
    { date: '2026-09-15', student_id: 'HS001', status: 'P' }, // Phép
    { date: '2026-09-15', student_id: 'HS003', status: 'KP' }, // Không phép
    { date: '2026-09-15', student_id: 'HS004', status: 'BT_SANG' }, // Bỏ tiết sáng
    { date: '2026-09-16', student_id: 'HS003', status: 'BT_CHIEU' }, // Bỏ tiết chiều
  ],
  'ND': [],
  'GD': [],
};

// Initial per-school COMPLAINTS
export const INITIAL_COMPLAINTS: Record<string, Complaint[]> = {
  'LHP': [
    {
      id: 'C001',
      student_id: 'HS003',
      log_id: 'L002',
      reason: 'Dạ lúc đó em chỉ đang mở từ điển điện tử để tra cứu từ tiếng Anh môn học chứ không phải chơi game Liên Quân. Mong Ban Giám Hiệu xem xét lại giúp em ạ.',
      status: 'Pending',
      created_at: '2026-09-09 10:30:00',
    }
  ],
  'ND': [],
  'GD': [],
};
export const DUMMY_EXCEL_TEMPLATES = {
  students: [
    { "Mã Học Sinh": "HS009", "Họ Tên": "Nguyễn Thanh Hải", "Lớp": "10A1", "Ngày Sinh": "2010-08-11", "Phụ Huynh": "Nguyễn Thế Sơn", "SĐT": "0918112233" },
    { "Mã Học Sinh": "HS010", "Họ Tên": "Phạm Quốc Toản", "Lớp": "10A1", "Ngày Sinh": "2010-11-22", "Phụ Huynh": "Phạm Văn Nghiêm", "SĐT": "0938445566" }
  ],
  teachers: [
    { "Mã GV": "GV005", "Tài Khoản": "gv_phamhai", "Mật Khẩu": "123", "Họ Tên": "Phạm Thanh Hải", "Lớp Chủ Nhiệm": "11B2" },
    { "Mã GV": "GV006", "Tài Khoản": "gv_tranthuy", "Mật Khẩu": "123", "Họ Tên": "Trần Thị Thủy", "Lớp Chủ Nhiệm": "12A2" }
  ]
};
