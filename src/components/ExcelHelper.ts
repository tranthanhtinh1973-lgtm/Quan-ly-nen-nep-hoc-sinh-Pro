import XLSX from 'xlsx-js-style';
import { Student, User, Attendance } from '../types';
import { evaluateSemesterResult } from '../lib/EvaluationHelper';
import { GoogleDriveService } from '../lib/GoogleDriveService';
import { analyzeAttendanceCode, normalizeAttendanceCode, mergeAttendanceCodes } from '../lib/AttendanceHelper';

export class ExcelHelper {
  // Export list of schools to Excel file with the requested columns
  static exportSchools(schools: any[], title: string = 'Danh_Sach_Truong_Hoc'): void {
    const data = schools.map((s, idx) => ({
      'STT': idx + 1,
      'Mã trường': s.school_id || s['Mã trường'] || '',
      'Tên trường': s.school_name || s['Tên trường'] || '',
      'địa chỉ/năm học': s.address || s['địa chỉ/năm học'] || '',
      'tài khoản admin': s.admin_username || s['tài khoản admin'] || '',
      'mật khẩu admin': s.admin_password || s['mật khẩu admin'] || '',
      'Trạng Thái': s.status || s['Trạng Thái'] || 'Active',
      'Hành Động': s.action || s['Hành Động'] || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trường Học');
    ExcelHelper.saveWorkbook(workbook, `${title}.xlsx`);
  }

  // Safe file downloader supporting Blob fallback
  private static saveWorkbook(workbook: any, filename: string): void {
    try {
      XLSX.writeFile(workbook, filename);
    } catch (e) {
      console.warn('XLSX.writeFile failed, using Blob fallback:', e);
      try {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err: any) {
        console.error('Blob download failed:', err);
        alert('Không thể tạo file Excel: ' + (err?.message || 'Lỗi bộ nhớ trình duyệt'));
      }
    }
  }

  // Import list of schools from Excel file
  static importSchools(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const parsed = jsonData.map((row) => {
            const school_id = row['Mã trường'] || row['Mã định danh'] || row['Mã Trường'] || `SCH${Math.floor(100 + Math.random() * 900)}`;
            const school_name = row['Tên trường'] || row['Tên Trường'] || row['Tên Cơ Sở Giáo Dục'] || 'Trường mới nhập';
            const address = row['địa chỉ/năm học'] || row['Địa Chỉ / Năm học'] || row['Địa chỉ'] || 'Chưa cập nhật';
            const admin_username = row['tài khoản admin'] || row['Tài Khoản Admin'] || 'admin';
            const admin_password = row['mật khẩu admin'] || row['Mật khẩu'] || '123';
            const statusStr = row['Trạng Thái'] || row['Trạng thái'] || 'Active';
            const status = (statusStr === 'Inactive' || statusStr === 'Tạm Khóa' || statusStr === 'Tạm khóa') ? 'Inactive' : 'Active';

            return {
              school_id: String(school_id).toUpperCase().trim(),
              school_name: String(school_name).trim(),
              address: String(address).trim(),
              admin_username: String(admin_username).trim(),
              admin_password: String(admin_password).trim(),
              status,
              sheet_file_id: `1${String(school_id).toUpperCase().trim()}_Sheet_Drive_File_${Math.floor(1000 + Math.random() * 9000)}`,
            };
          });

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  // Export list of students to Excel file
  static exportStudents(students: Student[], title: string = 'Danh_Sach_Hoc_Sinh'): void {
    const data = students.map((s, idx) => ({
      'STT': idx + 1,
      'Mã Học Sinh': s.id,
      'Mã VnEdu': s.vneduId || s.vnedu_code || '',
      'Họ Và Tên': s.name,
      'Lớp': s.class,
      'Ngày Sinh': s.birth_date,
      'Tên Phụ Huynh': s.parent_name,
      'Số Điện Thoại': s.phone,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Học Sinh');
    ExcelHelper.saveWorkbook(workbook, `${title}.xlsx`);
  }

  // Import list of students from Excel file
  static importStudents(file: File): Promise<Omit<Student, 'password'>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const parsed: Omit<Student, 'password'>[] = jsonData.map((row) => {
            const id = row['Mã Học Sinh'] || row['Mã HS'] || `HS${Math.floor(100 + Math.random() * 900)}`;
            const vnedu_code = row['Mã VnEdu'] || row['Mã VNEDU'] || row['Mã vnEdu'] || row['VnEdu ID'] || row['vneduId'] || '';
            const name = row['Họ Và Tên'] || row['Họ tên'] || row['Họ Tên'] || 'Học sinh mới';
            const cls = row['Lớp'] || '10A1';
            const bdate = row['Ngày Sinh'] || row['Ngày sinh'] || '2010-01-01';
            const parent = row['Tên Phụ Huynh'] || row['Phụ huynh'] || 'Phụ huynh';
            const phone = row['Số Điện Thoại'] || row['SĐT'] || '0900000000';

            return {
              id: String(id).trim(),
              vnedu_code: vnedu_code ? String(vnedu_code).trim() : undefined,
              vneduId: vnedu_code ? String(vnedu_code).trim() : undefined,
              name: String(name).trim(),
              class: String(cls).trim(),
              birth_date: String(bdate).trim(),
              parent_name: String(parent).trim(),
              phone: String(phone).trim(),
            };
          });

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  // Export list of teachers to Excel
  static exportTeachers(users: User[]): void {
    const teachers = users.filter(u => u.role === 'Teacher');
    const data = teachers.map((t, idx) => ({
      'STT': idx + 1,
      'Mã Giáo Viên': t.id,
      'Họ và tên GV': t.full_name || '',
      'Tên Tài Khoản': t.username,
      'Mật khẩu': t.password,
      'Lớp CN': t.class_assigned,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Giáo Viên');
    ExcelHelper.saveWorkbook(workbook, 'Danh_Sach_Giao_Vien.xlsx');
  }

  // Import list of teachers from Excel
  static importTeachers(file: File): Promise<User[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const parsed: User[] = jsonData.map((row) => {
            const id = row['Mã Giáo Viên'] || row['ID'] || row['Mã GV'] || `U${Math.floor(100 + Math.random() * 900)}`;
            const full_name = row['Họ và tên GV'] || row['họ và tên GV'] || row['Họ tên GV'] || row['Họ Tên'] || '';
            const username = row['Tên Tài Khoản'] || row['Tên Tài Khoản Đăng Nhập'] || row['Username'] || 'gv_new';
            const password = row['Mật khẩu'] || row['Mật Khẩu'] || row['Password'] || '123';
            const cls = row['Lớp CN'] || row['Lớp Phân Công'] || row['Lớp chủ nhiệm'] || '';

            return {
              id: String(id).trim(),
              full_name: String(full_name).trim(),
              username: String(username).trim(),
              password: String(password).trim(),
              role: 'Teacher',
              class_assigned: String(cls).trim(),
            };
          });

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  // Export attendance log to Excel (VnEdu Month-grid layout)
  static exportAttendance(attendance: Attendance[], students: Student[], className: string): void {
    const classStudents = students.filter(s => s.class === className);
    
    // Determine year/month from attendance or default to current date
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1; // 1-indexed
    if (attendance.length > 0) {
      const parts = attendance[0].date.split('-');
      if (parts.length >= 2) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const gradeMatch = className.match(/^\d+/);
    const grade = gradeMatch ? gradeMatch[0] : '10';

    // Helper to get Excel column letters
    const getColumnLetter = (colIndex: number): string => {
      let temp = colIndex;
      let letter = '';
      while (temp > 0) {
        let modulo = (temp - 1) % 26;
        letter = String.fromCharCode(65 + modulo) + letter;
        temp = Math.floor((temp - modulo) / 26);
      }
      return letter;
    };

    // Helper to get Day of the week
    const getDayOfWeekStr = (y: number, m: number, d: number): string => {
      const dateObj = new Date(y, m - 1, d);
      const dayIndex = dateObj.getDay();
      if (dayIndex === 0) return 'CN';
      return `T${dayIndex + 1}`;
    };

    // Helper to split student's name
    const splitStudentName = (fullName: string) => {
      const cleanName = fullName.trim();
      const parts = cleanName.split(/\s+/);
      if (parts.length <= 1) {
        return { firstName: '', lastName: cleanName };
      }
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, parts.length - 1).join(' ');
      return { firstName, lastName };
    };

    const lastColIndex = 8 + daysInMonth;
    const lastColLetter = getColumnLetter(lastColIndex);

    const ws: any = {};
    const merges: any[] = [];

    const addMerge = (startRow: number, startCol: number, endRow: number, endCol: number) => {
      merges.push({
        s: { r: startRow - 1, c: startCol - 1 },
        e: { r: endRow - 1, c: endCol - 1 }
      });
    };

    const setCell = (r: number, c: number, val: any, style: any = {}, type: string = 's') => {
      const cellRef = getColumnLetter(c) + r;
      ws[cellRef] = { v: val, t: type, s: style };
    };

    const applyStyleToRange = (startRow: number, startCol: number, endRow: number, endCol: number, style: any) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cellRef = getColumnLetter(c) + r;
          if (!ws[cellRef]) {
            ws[cellRef] = { v: '', t: 's' };
          }
          ws[cellRef].s = style;
        }
      }
    };

    // Styling configurations
    const titleLeftStyle = {
      font: { name: 'Arial', sz: 11, bold: false },
      alignment: { vertical: 'center', horizontal: 'left' }
    };

    const titleLeftBoldStyle = {
      font: { name: 'Arial', sz: 11, bold: true },
      alignment: { vertical: 'center', horizontal: 'left' }
    };

    const titleCenterBoldStyle = {
      font: { name: 'Arial', sz: 11, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const titleCenterBoldUnderlineStyle = {
      font: { name: 'Arial', sz: 11, bold: true, underline: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const titleMainStyle = {
      font: { name: 'Arial', sz: 16, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const titleSubStyle = {
      font: { name: 'Arial', sz: 11, bold: true, italic: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const headerStyle = {
      font: { name: 'Arial', sz: 9.5, bold: true },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      border: {
        top: { style: 'thin', color: { rgb: 'A0AEC0' } },
        bottom: { style: 'thin', color: { rgb: 'A0AEC0' } },
        left: { style: 'thin', color: { rgb: 'A0AEC0' } },
        right: { style: 'thin', color: { rgb: 'A0AEC0' } }
      }
    };

    const dataStyleCenter = {
      font: { name: 'Arial', sz: 10 },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } }
      }
    };

    const dataStyleLeft = {
      font: { name: 'Arial', sz: 10 },
      alignment: { vertical: 'center', horizontal: 'left' },
      border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } }
      }
    };

    // 1. PHẦN TIÊU NGỮ & QUỐC HIỆU (DÒNG 1 - 4)
    setCell(1, 1, "SỞ GIÁO DỤC VÀ ĐÀO TẠO LẠNG SƠN", titleLeftStyle);
    setCell(1, 4, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", titleCenterBoldStyle);
    addMerge(1, 1, 1, 3);
    addMerge(1, 4, 1, lastColIndex);

    setCell(2, 1, "TRƯỜNG THPT LỘC BÌNH", titleLeftBoldStyle);
    setCell(2, 4, "Độc lập - Tự do - Hạnh phúc", titleCenterBoldUnderlineStyle);
    addMerge(2, 1, 2, 3);
    addMerge(2, 4, 2, lastColIndex);

    setCell(3, 1, "SỐ ĐIỂM DANH", titleMainStyle);
    addMerge(3, 1, 3, lastColIndex);

    setCell(4, 1, `Tháng ${month} năm ${year} - Khối ${grade} - Lớp ${className}`, titleSubStyle);
    addMerge(4, 1, 4, lastColIndex);

    // 2. CẤU TRÚC TIÊU ĐỀ BẢNG (DÒNG 6 VÀ DÒNG 7)
    setCell(6, 1, "STT");
    addMerge(6, 1, 7, 1);

    setCell(6, 2, "Mã học sinh");
    addMerge(6, 2, 7, 2);

    setCell(6, 3, "Họ và tên");
    addMerge(6, 3, 7, 4);

    // Days 1 to daysInMonth
    for (let d = 1; d <= daysInMonth; d++) {
      setCell(6, 4 + d, d, {}, 'n');
      setCell(7, 4 + d, getDayOfWeekStr(year, month, d));
    }

    // TS Buổi nghỉ
    const tsColIdx = 5 + daysInMonth;
    setCell(6, tsColIdx, "TS Buổi nghỉ");
    addMerge(6, tsColIdx, 6, tsColIdx + 2);
    setCell(7, tsColIdx, "TS");
    setCell(7, tsColIdx + 1, "P");
    setCell(7, tsColIdx + 2, "K");

    // TS bỏ tiết
    const skipColIdx = 8 + daysInMonth;
    setCell(6, skipColIdx, "TS\nbỏ\ntiết");
    addMerge(6, skipColIdx, 7, skipColIdx);

    // Apply headerStyle
    applyStyleToRange(6, 1, 7, lastColIndex, headerStyle);

    // 3. NẠP DỮ LIỆU ĐIỂM DANH VÀO CÁC Ô TƯƠNG ỨNG
    classStudents.forEach((stud, idx) => {
      const r = 8 + idx;
      
      setCell(r, 1, idx + 1, dataStyleCenter, 'n');
      
      // Column B: VnEdu Student ID
      const anyStud = stud as any;
      const vneduCodeVal = String(anyStud.vneduId || anyStud.maVnEdu || anyStud.vnedu_code || anyStud.code || '').trim();
      setCell(r, 2, vneduCodeVal, dataStyleCenter);

      const { firstName, lastName } = splitStudentName(stud.name);
      setCell(r, 3, firstName, dataStyleLeft);
      setCell(r, 4, lastName, dataStyleLeft);

      let countP = 0;
      let countK = 0;
      let countTiet = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const targetDate = `${year}-${monthStr}-${dayStr}`;

        const dayRecords = attendance.filter(a => a.student_id === stud.id && a.date === targetDate);
        let cellVal = '';
        if (dayRecords.length > 0) {
          const rawCodes = dayRecords.map(r => r.status || r.attendance?.type || '');
          cellVal = mergeAttendanceCodes(rawCodes);
          if (cellVal === 'DU_TIET') cellVal = '';

          const { countP: p, countK: k, countTiet: t } = analyzeAttendanceCode(cellVal);
          countP += p;
          countK += k;
          countTiet += t;
        }
        setCell(r, 4 + day, cellVal, dataStyleCenter);
      }

      setCell(r, tsColIdx, countP + countK, dataStyleCenter, 'n');
      setCell(r, tsColIdx + 1, countP, dataStyleCenter, 'n');
      setCell(r, tsColIdx + 2, countK, dataStyleCenter, 'n');
      setCell(r, skipColIdx, countTiet, dataStyleCenter, 'n');
    });

    // Set merges and widths
    ws['!merges'] = merges;

    const cols: any[] = [
      { wch: 5 },  // STT
      { wch: 15 }, // Mã học sinh
      { wch: 18 }, // Họ và tên đệm
      { wch: 10 }, // Tên học sinh
    ];
    for (let d = 1; d <= daysInMonth; d++) {
      cols.push({ wch: 4 });
    }
    cols.push({ wch: 5 }); // TS
    cols.push({ wch: 5 }); // P
    cols.push({ wch: 5 }); // K
    cols.push({ wch: 8 }); // TS bỏ tiết
    ws['!cols'] = cols;

    ws['!ref'] = `A1:${lastColLetter}${7 + classStudents.length}`;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, `Điểm Danh Tháng ${month}-${year}`);
    ExcelHelper.saveWorkbook(workbook, `so_diem_danh_${className.toLowerCase()}_${month}_${year}.xlsx`);
  }

  // Export monthly summary report matching the sample PDF/Image template
  static exportMonthlyReport(db: any, className: string, monthStr: string = 'Tháng 10'): void {
    if (!db || !db.STUDENTS) return;

    const activeConfig = db.CONFIG?.[0] || { department: 'SỞ GD&ĐT LÂM ĐỒNG', school_name: 'TRƯỜNG THPT NGUYỄN TRÃI', year: '2026-2027', semester: 'Học kỳ I' };
    const deptName = (activeConfig.department || 'SỞ GD&ĐT').toUpperCase();
    const schoolName = GoogleDriveService.getDisplaySchoolName(undefined, activeConfig.school_name).toUpperCase();
    const schoolYear = activeConfig.year || '2026-2027';

    // Filter students for the class flexibly
    const cleanClass = String(className || '').trim().toLowerCase();
    let classStudents = cleanClass && cleanClass !== 'toàn trường' && cleanClass !== 'tất cả'
      ? db.STUDENTS.filter((s: any) => {
          const sClass = String(s.class || '').trim().toLowerCase();
          return sClass === cleanClass || sClass.replace(/^lớp\s+/, '') === cleanClass.replace(/^lớp\s+/, '');
        })
      : db.STUDENTS;

    if (classStudents.length === 0 && db.STUDENTS.length > 0) {
      classStudents = db.STUDENTS;
    }

    if (classStudents.length === 0) {
      alert('Không có dữ liệu học sinh để xuất báo cáo.');
      return;
    }

    const ws: any = {};
    const merges: any[] = [];

    const getColumnLetter = (colIndex: number): string => {
      let temp = colIndex;
      let letter = '';
      while (temp > 0) {
        let modulo = (temp - 1) % 26;
        letter = String.fromCharCode(65 + modulo) + letter;
        temp = Math.floor((temp - modulo) / 26);
      }
      return letter;
    };

    const addMerge = (startRow: number, startCol: number, endRow: number, endCol: number) => {
      merges.push({
        s: { r: startRow - 1, c: startCol - 1 },
        e: { r: endRow - 1, c: endCol - 1 }
      });
    };

    const setCell = (r: number, c: number, val: any, style: any = {}, type: string = 's') => {
      const cellRef = getColumnLetter(c) + r;
      ws[cellRef] = { v: val, t: type, s: style };
    };

    // Styles
    const headerLeftBold = {
      font: { name: 'Times New Roman', sz: 10, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const headerRightBold = {
      font: { name: 'Times New Roman', sz: 10, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const headerRightItalic = {
      font: { name: 'Times New Roman', sz: 10, italic: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const titleStyle = {
      font: { name: 'Times New Roman', sz: 14, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const subtitleStyle = {
      font: { name: 'Times New Roman', sz: 11, italic: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const tableHeaderStyle = {
      font: { name: 'Times New Roman', sz: 10, bold: true },
      fill: { fgColor: { rgb: 'EFEFEF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };
    const cellCenterStyle = {
      font: { name: 'Times New Roman', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };
    const cellLeftStyle = {
      font: { name: 'Times New Roman', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    // Row 1: Header Org (Left) & National Motto (Right)
    setCell(1, 1, deptName, headerLeftBold);
    addMerge(1, 1, 1, 4);
    setCell(1, 6, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', headerRightBold);
    addMerge(1, 6, 1, 9);

    // Row 2: School Name (Left) & Sub-motto (Right)
    setCell(2, 1, schoolName, headerLeftBold);
    addMerge(2, 1, 2, 4);
    setCell(2, 6, 'Độc lập - Tự do - Hạnh phúc', headerRightItalic);
    addMerge(2, 6, 2, 9);

    // Row 4: Title
    const titleText = `BÁO CÁO KẾT QUẢ RÈN LUYỆN ${monthStr.toUpperCase()}`;
    setCell(4, 1, titleText, titleStyle);
    addMerge(4, 1, 4, 9);

    // Row 5: Subtitle
    const classText = `Lớp: ${className || 'Toàn trường'}  |  Năm học: ${schoolYear}`;
    setCell(5, 1, classText, subtitleStyle);
    addMerge(5, 1, 5, 9);

    // Row 7: Table Column Headers
    const headers = [
      'STT',
      'Mã HS',
      'Họ và tên',
      'Lớp',
      `Điểm trừ\n(${monthStr})`,
      `Điểm cộng\n(${monthStr})`,
      `Điểm tháng\n(${monthStr})`,
      `Xếp loại\ntháng`,
      'Chi tiết lỗi vi phạm / Ghi chú'
    ];

    headers.forEach((h, idx) => {
      setCell(7, idx + 1, h, tableHeaderStyle);
    });

    let countTot = 0;
    let countKha = 0;
    let countDat = 0;
    let countChuaDat = 0;

    // Populate Student Data Rows starting at Row 8
    classStudents.forEach((s: any, idx: number) => {
      const rowIdx = 8 + idx;

      // Filter month logs
      const studentLogs = (db.LOGS_DISCIPLINE || []).filter((l: any) => {
        if (l.student_id !== s.id) return false;
        if (l.term_month && l.term_month === monthStr) return true;
        if (l.date) {
          const parts = l.date.split('-');
          if (parts.length >= 2) {
            const m = parseInt(parts[1], 10);
            return `Tháng ${m}` === monthStr;
          }
        }
        return false;
      });

      const minusLogs = studentLogs.filter((l: any) => l.points < 0);
      const plusLogs = studentLogs.filter((l: any) => l.points > 0);

      const minusPoints = Math.abs(minusLogs.reduce((acc: number, curr: any) => acc + curr.points, 0));
      const plusPoints = plusLogs.reduce((acc: number, curr: any) => acc + curr.points, 0);
      const monthScore = Math.max(0, Math.min(100, 100 - minusPoints + plusPoints));

      // According to Request 3 Rules:
      // Tốt: 85 - 100
      // Khá: 70 - 84
      // Đạt: 50 - 69
      // Chưa đạt: Dưới 50
      let rating = 'Tốt';
      if (monthScore < 50) {
        rating = 'Chưa đạt';
        countChuaDat++;
      } else if (monthScore < 70) {
        rating = 'Đạt';
        countDat++;
      } else if (monthScore < 85) {
        rating = 'Khá';
        countKha++;
      } else {
        countTot++;
      }

      // Helper to format date into DD/MM/YYYY
      const formatDateStr = (dStr: string) => {
        if (!dStr) return '';
        const clean = String(dStr).split('T')[0].trim();
        if (clean.includes('-')) {
          const parts = clean.split('-');
          if (parts.length === 3) {
            const [y, m, d] = parts;
            if (y.length === 4) {
              return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
            }
          }
        }
        return clean;
      };

      // Format violation details text with date and newlines
      const violationsList: string[] = [];
      minusLogs.forEach((l: any) => {
        let text = l.notes || '';
        const rule = (db.SCORE_RULES || []).find((r: any) => r.code === l.rule_code);
        const ruleName = rule ? rule.name : l.rule_code;

        let fullText = text;
        if (!fullText) {
          fullText = ruleName;
        } else if (ruleName && fullText !== ruleName && !fullText.toLowerCase().includes(ruleName.toLowerCase())) {
          fullText = `${ruleName} (${fullText})`;
        }

        const rawDate = l.date || l.created_at || '';
        const formattedDate = formatDateStr(rawDate);
        const dateTag = formattedDate ? `[${formattedDate}] ` : '';

        if (fullText) {
          violationsList.push(`- ${dateTag}${fullText} (-${Math.abs(l.points)}đ)`);
        }
      });
      const violationsDetail = violationsList.length > 0 ? violationsList.join('\n') : 'Không';

      setCell(rowIdx, 1, idx + 1, cellCenterStyle, 'n');
      setCell(rowIdx, 2, s.id || '', cellCenterStyle);
      setCell(rowIdx, 3, s.name || '', cellLeftStyle);
      setCell(rowIdx, 4, s.class || className || '', cellCenterStyle);
      setCell(rowIdx, 5, minusPoints, cellCenterStyle, 'n');
      setCell(rowIdx, 6, plusPoints, cellCenterStyle, 'n');
      setCell(rowIdx, 7, monthScore, cellCenterStyle, 'n');
      setCell(rowIdx, 8, rating, cellCenterStyle);
      setCell(rowIdx, 9, violationsDetail, cellLeftStyle);
    });

    const lastDataRow = 7 + classStudents.length;

    // Statistics Table section
    const statStartRow = lastDataRow + 3;
    setCell(statStartRow, 1, `THỐNG KÊ KẾT QUẢ XẾP LOẠI ${monthStr.toUpperCase()}`, {
      font: { name: 'Times New Roman', sz: 11, bold: true },
      alignment: { horizontal: 'left', vertical: 'center' }
    });

    const totalStudents = classStudents.length;
    const statHeaders = ['Xếp loại', 'Tốt', 'Khá', 'Đạt', 'Chưa đạt', 'Tổng cộng'];
    const statCounts = ['Số lượng', countTot, countKha, countDat, countChuaDat, totalStudents];
    const statPercentages = [
      'Tỷ lệ',
      totalStudents ? `${((countTot / totalStudents) * 100).toFixed(1)}%` : '0%',
      totalStudents ? `${((countKha / totalStudents) * 100).toFixed(1)}%` : '0%',
      totalStudents ? `${((countDat / totalStudents) * 100).toFixed(1)}%` : '0%',
      totalStudents ? `${((countChuaDat / totalStudents) * 100).toFixed(1)}%` : '0%',
      '100%'
    ];

    statHeaders.forEach((h, idx) => setCell(statStartRow + 1, idx + 1, h, tableHeaderStyle));
    statCounts.forEach((c, idx) => setCell(statStartRow + 2, idx + 1, c, cellCenterStyle, typeof c === 'number' ? 'n' : 's'));
    statPercentages.forEach((p, idx) => setCell(statStartRow + 3, idx + 1, p, cellCenterStyle));

    // Signatures block
    const sigRow = statStartRow + 6;
    setCell(sigRow, 2, 'NGƯỜI LẬP BÁO CÁO', {
      font: { name: 'Times New Roman', sz: 11, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(sigRow, 2, sigRow, 4);

    setCell(sigRow, 7, `......, ngày ..... tháng ..... năm 20...`, {
      font: { name: 'Times New Roman', sz: 11, italic: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(sigRow, 7, sigRow, 9);

    setCell(sigRow + 1, 7, 'GIÁO VIÊN CHỦ NHIỆM', {
      font: { name: 'Times New Roman', sz: 11, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(sigRow + 1, 7, sigRow + 1, 9);

    setCell(sigRow + 2, 2, '(Ký và ghi rõ họ tên)', {
      font: { name: 'Times New Roman', sz: 10, italic: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(sigRow + 2, 2, sigRow + 2, 4);

    setCell(sigRow + 2, 7, '(Ký và ghi rõ họ tên)', {
      font: { name: 'Times New Roman', sz: 10, italic: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    addMerge(sigRow + 2, 7, sigRow + 2, 9);

    // Set Column Widths
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Mã HS
      { wch: 22 }, // Họ và tên
      { wch: 8 },  // Lớp
      { wch: 12 }, // Điểm trừ
      { wch: 12 }, // Điểm cộng
      { wch: 14 }, // Điểm tháng
      { wch: 14 }, // Xếp loại tháng
      { wch: 50 }  // Chi tiết lỗi vi phạm
    ];

    ws['!merges'] = merges;

    // Range calculation
    const totalRows = sigRow + 7;
    ws['!ref'] = `A1:I${totalRows}`;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, 'Báo Cáo Tháng');
    
    const safeMonthName = monthStr.replace(/\s+/g, '_');
    const safeClassName = (className || 'Toan_Truong').replace(/\s+/g, '_');
    ExcelHelper.saveWorkbook(workbook, `Bao_Cao_Tong_Hop_Ren_Luyen_${safeMonthName}_Lop_${safeClassName}.xlsx`);
  }

  // Export Semester Summary Report matching standard MOET / VNEDU template
  static exportSemesterReport(db: any, className: string, selectedTerm: string = 'Học kỳ I'): void {
    if (!db || !db.STUDENTS) return;

    const activeConfig = db.CONFIG?.[0] || { school_name: 'THPT Lộc Bình', year: '2026-2027', semester: selectedTerm };
    const schoolName = GoogleDriveService.getDisplaySchoolName(undefined, activeConfig.school_name);
    const schoolYear = activeConfig.year || '2026-2027';

    // Filter students for the class flexibly
    const cleanClass = String(className || '').trim().toLowerCase();
    let classStudents = cleanClass && cleanClass !== 'tất cả' && cleanClass !== 'toàn trường'
      ? db.STUDENTS.filter((s: any) => {
          const sClass = String(s.class || '').trim().toLowerCase();
          return sClass === cleanClass || sClass.replace(/^lớp\s+/, '') === cleanClass.replace(/^lớp\s+/, '');
        })
      : db.STUDENTS;

    if (classStudents.length === 0 && db.STUDENTS.length > 0) {
      classStudents = db.STUDENTS;
    }

    if (classStudents.length === 0) {
      alert('Không có dữ liệu học sinh để xuất báo cáo.');
      return;
    }

    const termMonthsList = selectedTerm === 'Học kỳ I'
      ? ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1']
      : ['Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];

    const ws: any = {};
    const merges: any[] = [];

    const getColumnLetter = (colIndex: number): string => {
      let temp = colIndex;
      let letter = '';
      while (temp > 0) {
        let modulo = (temp - 1) % 26;
        letter = String.fromCharCode(65 + modulo) + letter;
        temp = Math.floor((temp - modulo) / 26);
      }
      return letter;
    };

    const addMerge = (startRow: number, startCol: number, endRow: number, endCol: number) => {
      merges.push({
        s: { r: startRow - 1, c: startCol - 1 },
        e: { r: endRow - 1, c: endCol - 1 }
      });
    };

    const setCell = (r: number, c: number, val: any, style: any = {}, type: string = 's') => {
      const cellRef = getColumnLetter(c) + r;
      ws[cellRef] = { v: val, t: type, s: style };
    };

    // Styling configurations
    const titleLeftStyle = {
      font: { name: 'Times New Roman', sz: 11, bold: false },
      alignment: { vertical: 'center', horizontal: 'left' }
    };

    const titleLeftBoldStyle = {
      font: { name: 'Times New Roman', sz: 11, bold: true },
      alignment: { vertical: 'center', horizontal: 'left' }
    };

    const titleCenterBoldStyle = {
      font: { name: 'Times New Roman', sz: 11, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const titleCenterBoldUnderlineStyle = {
      font: { name: 'Times New Roman', sz: 11, bold: true, underline: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const titleMainStyle = {
      font: { name: 'Times New Roman', sz: 15, bold: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const titleSubStyle = {
      font: { name: 'Times New Roman', sz: 11, bold: true, italic: true },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const headerStyle = {
      font: { name: 'Times New Roman', sz: 10, bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const cellCenterStyle = {
      font: { name: 'Times New Roman', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const cellLeftStyle = {
      font: { name: 'Times New Roman', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const lastColIndex = 6 + termMonthsList.length + 3; // STT, Mã HS, VnEdu, Họ tên, Lớp, Ngày sinh + monthly cols + TB, Xếp loại, Ghi chú

    // Row 1: Left header & Right header
    setCell(1, 1, "SỞ GIÁO DỤC VÀ ĐÀO TẠO LẠNG SƠN", titleLeftStyle);
    addMerge(1, 1, 1, 4);
    setCell(1, 5, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", titleCenterBoldStyle);
    addMerge(1, 5, 1, lastColIndex);

    // Row 2: School name & Motto
    setCell(2, 1, `TRƯỜNG ${schoolName.toUpperCase()}`, titleLeftBoldStyle);
    addMerge(2, 1, 2, 4);
    setCell(2, 5, "Độc lập - Tự do - Hạnh phúc", titleCenterBoldUnderlineStyle);
    addMerge(2, 5, 2, lastColIndex);

    // Row 3: Main Title
    setCell(3, 1, `BÁO CÁO KẾT QUẢ RÈN LUYỆN ${selectedTerm.toUpperCase()} CỦA HỌC SINH`, titleMainStyle);
    addMerge(3, 1, 3, lastColIndex);

    // Row 4: Subtitle Class & Year
    setCell(4, 1, `Lớp: ${className || 'Toàn trường'} - Năm học: ${schoolYear}`, titleSubStyle);
    addMerge(4, 1, 4, lastColIndex);

    // Row 6: Column Headers
    const baseHeaders = [
      'STT',
      'Mã HS',
      'Mã VnEdu',
      'Họ và tên',
      'Lớp',
      'Ngày sinh'
    ];
    
    baseHeaders.forEach((h, idx) => {
      setCell(6, idx + 1, h, headerStyle);
    });

    termMonthsList.forEach((m, idx) => {
      setCell(6, baseHeaders.length + idx + 1, m, headerStyle);
    });

    const tailHeaders = [
      `Điểm TB\n${selectedTerm}`,
      `Xếp loại\n${selectedTerm}`,
      'Ghi chú / Chi tiết vi phạm'
    ];

    tailHeaders.forEach((h, idx) => {
      setCell(6, baseHeaders.length + termMonthsList.length + idx + 1, h, headerStyle);
    });

    // Row 7+: Student Rows
    classStudents.forEach((s: any, idx: number) => {
      const rowIdx = 7 + idx;
      
      const evalRes = evaluateSemesterResult(s.id, termMonthsList, db.LOGS_DISCIPLINE || []);

      setCell(rowIdx, 1, idx + 1, cellCenterStyle, 'n');
      setCell(rowIdx, 2, s.id || '', cellCenterStyle);
      setCell(rowIdx, 3, s.vneduId || s.vnedu_code || '', cellCenterStyle);
      setCell(rowIdx, 4, s.name || '', cellLeftStyle);
      setCell(rowIdx, 5, s.class || className || '', cellCenterStyle);
      setCell(rowIdx, 6, s.birth_date || '', cellCenterStyle);

      // Monthly Scores
      termMonthsList.forEach((_, mIdx) => {
        const score = evalRes.monthlyScores[mIdx];
        setCell(rowIdx, 6 + mIdx + 1, score !== undefined ? score : 100, cellCenterStyle, 'n');
      });

      const avgColIdx = 6 + termMonthsList.length + 1;
      const rankColIdx = avgColIdx + 1;
      const noteColIdx = rankColIdx + 1;

      setCell(rowIdx, avgColIdx, evalRes.average, cellCenterStyle, 'n');
      setCell(rowIdx, rankColIdx, evalRes.classification, cellCenterStyle);

      // Filter logs for this student in this term to build notes
      const studentTermLogs = (db.LOGS_DISCIPLINE || []).filter((l: any) => l.student_id === s.id);
      const minusLogs = studentTermLogs.filter((l: any) => l.points < 0);
      const notesList = minusLogs.map((l: any) => {
        const rule = (db.SCORE_RULES || []).find((r: any) => r.code === l.rule_code);
        const name = l.notes || (rule ? rule.name : l.rule_code);
        const rawDate = l.date || l.created_at || '';
        let dStr = rawDate ? String(rawDate).split('T')[0].trim() : '';
        if (dStr.includes('-')) {
          const parts = dStr.split('-');
          if (parts.length === 3 && parts[0].length === 4) {
            dStr = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
          }
        }
        return `${dStr ? `[${dStr}] ` : ''}${name}`;
      });

      setCell(rowIdx, noteColIdx, notesList.join('; '), cellLeftStyle);
    });

    // Column Widths
    const cols: any[] = [
      { wch: 5 },  // STT
      { wch: 14 }, // Mã HS
      { wch: 14 }, // Mã VnEdu
      { wch: 22 }, // Họ và tên
      { wch: 8 },  // Lớp
      { wch: 12 }, // Ngày sinh
    ];

    termMonthsList.forEach(() => {
      cols.push({ wch: 10 }); // Month scores
    });

    cols.push({ wch: 12 }); // Điểm TB HK
    cols.push({ wch: 12 }); // Xếp loại HK
    cols.push({ wch: 45 }); // Ghi chú

    ws['!cols'] = cols;
    ws['!merges'] = merges;

    const totalRows = 6 + classStudents.length;
    ws['!ref'] = `A1:${getColumnLetter(lastColIndex)}${totalRows}`;

    const workbook = XLSX.utils.book_new();
    const sheetName = selectedTerm === 'Học kỳ I' ? 'KQ_HK1' : 'KQ_HK2';
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);

    const safeTermName = selectedTerm.replace(/\s+/g, '_');
    const safeClassName = (className || 'Toan_Truong').replace(/\s+/g, '_');
    ExcelHelper.saveWorkbook(workbook, `Bao_Cao_Ket_Qua_Ren_Luyen_${safeTermName}_Lop_${safeClassName}.xlsx`);
  }

  // Import monthly report Excel with robust header scanning and violation log extraction
  static importMonthlyReport(file: File, db: any, selectedMonth: string = 'Tháng 9', recordedBy: string = 'Admin'): Promise<{ updatedDb: any, successCount: number, logsAddedCount: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // 1. Convert sheet to 2D array to scan for actual table header row
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

          if (!rawRows || rawRows.length === 0) {
            return reject(new Error('Tệp Excel rỗng hoặc không có dữ liệu.'));
          }

          // 2. Find header row by searching for column keywords
          let headerRowIdx = -1;
          const headerKeywords = [
            'mã hs', 'mã học sinh', 'mã vnedu', 'vneduid', 'mã số',
            'họ và tên', 'họ tên', 'tên học sinh', 'học sinh',
            'lỗi vi phạm', 'chi tiết lỗi', 'ghi chú', 'nội dung vi phạm',
            'điểm trừ', 'điểm cộng', 'điểm tháng', 'xếp loại'
          ];

          for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
            const rowStr = (rawRows[r] || []).map(cell => String(cell || '').toLowerCase().trim()).join(' ');
            const matchCount = headerKeywords.filter(kw => rowStr.includes(kw)).length;
            if (matchCount >= 2) {
              headerRowIdx = r;
              break;
            }
          }

          if (headerRowIdx === -1) {
            headerRowIdx = 0;
          }

          // 3. Extract JSON array using range starting at detected header row
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIdx, defval: '' }) as any[];

          if (!jsonData || jsonData.length === 0) {
            return reject(new Error('Không thể đọc dữ liệu các cột từ tệp Excel.'));
          }

          // Determine target year & month
          const matchMonth = selectedMonth.match(/\d+/);
          const monthNum = matchMonth ? parseInt(matchMonth[0], 10) : 9;
          const activeConfig = db.CONFIG?.[0] || { year: '2026-2027' };
          const yearStr = (activeConfig.year || '2026-2027').split('-')[0] || '2026';
          const finalYear = (monthNum >= 1 && monthNum <= 7) 
            ? ((activeConfig.year || '2026-2027').split('-')[1] || '2027') 
            : yearStr;
          const defaultDateStr = `${finalYear}-${String(monthNum).padStart(2, '0')}-15`;

          const currentLogs = [...(db.LOGS_DISCIPLINE || [])];
          const currentStudents = [...(db.STUDENTS || [])];
          let logsAddedCount = 0;
          let successCount = 0;

          // Helper to normalize dates
          const parseDateDMY = (dStr: string) => {
            if (!dStr) return defaultDateStr;
            const clean = String(dStr).trim().replace(/[\[\]]/g, '');
            if (clean.includes('/')) {
              const parts = clean.split('/');
              if (parts.length === 3) {
                const [d, m, y] = parts;
                const fullY = y.length === 2 ? `20${y}` : y;
                return `${fullY}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              } else if (parts.length === 2) {
                const [d, m] = parts;
                return `${finalYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              }
            } else if (clean.includes('-')) {
              const parts = clean.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) return clean;
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
            return defaultDateStr;
          };

          jsonData.forEach((row) => {
            const rowKeys = Object.keys(row);

            // Match column headers flexibly
            const foundStudentIdKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["mã học sinh", "mã hs", "mã định danh", "studentcode", "student id", "mã số", "id"].includes(clean);
            });
            const foundVneduKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["mã vnedu", "vneduid", "mã học sinh vnedu", "mã định danh vnedu", "vnedu id", "số định danh"].includes(clean);
            });
            const foundNameKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["họ và tên", "họ tên", "tên học sinh", "học sinh", "name", "ho va ten"].includes(clean);
            });
            const foundClassKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["lớp", "lớp học", "class", "tên lớp"].includes(clean);
            });

            const rawIdVal = foundStudentIdKey ? String(row[foundStudentIdKey] || '').trim() : '';
            const rawVneduVal = foundVneduKey ? String(row[foundVneduKey] || '').trim() : '';
            const rawNameVal = foundNameKey ? String(row[foundNameKey] || '').trim() : '';
            const rawClassVal = foundClassKey ? String(row[foundClassKey] || '').trim().toUpperCase() : '';

            if (!rawIdVal && !rawVneduVal && !rawNameVal) return;

            // Find matching student
            let matchedStudent = currentStudents.find(s => {
              if (rawIdVal) {
                if (s.id.toLowerCase() === rawIdVal.toLowerCase()) return true;
                if (s.id.replace(/^(TRƯ_|LB_)/i, '').toLowerCase() === rawIdVal.replace(/^(TRƯ_|LB_)/i, '').toLowerCase()) return true;
              }
              if (rawVneduVal) {
                const sVnedu = (s.vnedu_code || s.vneduId || '').toLowerCase();
                if (sVnedu && sVnedu === rawVneduVal.toLowerCase()) return true;
              }
              if (rawNameVal) {
                const sName = s.name.toLowerCase().trim();
                const rName = rawNameVal.toLowerCase().trim();
                if (sName === rName) {
                  if (rawClassVal) {
                    const c1 = s.class.toUpperCase().replace(/^LỚP\s+/i, '');
                    const c2 = rawClassVal.replace(/^LỚP\s+/i, '');
                    return c1 === c2;
                  }
                  return true;
                }
              }
              return false;
            });

            // Auto create missing student if name is available
            if (!matchedStudent && rawNameVal) {
              const cls = rawClassVal || '10A1';
              const cleanClass = cls.replace(/^LỚP\s+/i, '');
              const classStudentsCount = currentStudents.filter(st => st.class.toUpperCase() === cleanClass.toUpperCase()).length + 1;
              const generatedId = rawIdVal || `LB_${cleanClass}_${String(classStudentsCount).padStart(2, '0')}`;

              matchedStudent = {
                id: generatedId,
                name: rawNameVal,
                class: cleanClass,
                vnedu_code: rawVneduVal || undefined,
                vneduId: rawVneduVal || undefined,
                birth_date: '2010-01-01',
                parent_name: 'Phụ huynh',
                phone: '0900000000',
                password: '123'
              };
              currentStudents.push(matchedStudent);
            }

            if (!matchedStudent) return;
            const studentId = matchedStudent.id;

            // Column keys for violation details / scores
            const foundViolationKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return [
                "chi tiết lỗi vi phạm / ghi chú", "chi tiết lỗi vi phạm", "chi tiết lỗi", "chi tiết",
                "lỗi vi phạm", "vi phạm", "hành vi", "nội dung", 
                "nội dung vi phạm", "tên lỗi", "ghi chú", "tên hành vi"
              ].includes(clean);
            });

            const foundMinusKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["điểm trừ", "trừ điểm", "điểm phạt", "phạt"].includes(clean);
            });
            const foundPlusKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["điểm cộng", "cộng điểm", "thưởng", "điểm thưởng"].includes(clean);
            });
            const foundPointsKey = rowKeys.find(k => {
              const clean = k.toLowerCase().trim();
              return ["điểm tháng", "điểm", "diem", "số điểm", "điểm số", "points"].includes(clean);
            });

            const rawViolationText = foundViolationKey ? String(row[foundViolationKey] || '').trim() : '';

            if (rawViolationText && rawViolationText !== 'Không' && rawViolationText !== '-') {
              // Multiline split
              const lines = rawViolationText.split(/[\r\n;]+/).map(l => l.trim()).filter(l => l.length > 0);

              lines.forEach(line => {
                let lineDate = defaultDateStr;
                const dateMatch = line.match(/\[?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\]?/);
                if (dateMatch) {
                  lineDate = parseDateDMY(dateMatch[1]);
                }

                let linePoints = 0;
                const pointsMatch = line.match(/\(([-+]?\d+)\s*đ?\)/i);
                if (pointsMatch) {
                  linePoints = parseInt(pointsMatch[1], 10);
                }

                let cleanNotes = line
                  .replace(/\[?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\]?/g, '')
                  .replace(/\([-+]?\d+\s*đ?\)/gi, '')
                  .replace(/^[-*•\s]+/, '')
                  .trim();

                if (!cleanNotes) cleanNotes = 'Vi phạm nội quy rèn luyện';

                if (linePoints === 0) {
                  if (foundMinusKey && row[foundMinusKey] !== undefined && row[foundMinusKey] !== '') {
                    const mVal = Math.abs(parseInt(String(row[foundMinusKey]).replace(/[^\d-]/g, ''), 10));
                    if (!isNaN(mVal) && mVal > 0) linePoints = -mVal;
                  }
                  if (linePoints === 0) linePoints = -2;
                }

                let ruleCode = linePoints < 0 ? 'VP01' : 'KT01';
                const matchedRule = (db.SCORE_RULES || []).find((r: any) => 
                  r.name.toLowerCase().includes(cleanNotes.toLowerCase()) || 
                  cleanNotes.toLowerCase().includes(r.name.toLowerCase())
                );
                if (matchedRule) {
                  ruleCode = matchedRule.code;
                }

                currentLogs.push({
                  id: `L-VIO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  student_id: studentId,
                  date: lineDate,
                  rule_code: ruleCode,
                  points: linePoints,
                  notes: cleanNotes,
                  recorded_by: recordedBy,
                  term_month: selectedMonth
                });
                logsAddedCount++;
              });

              successCount++;
            } else if (foundMinusKey || foundPlusKey || foundPointsKey) {
              let minusVal = 0;
              let plusVal = 0;

              if (foundMinusKey && row[foundMinusKey] !== undefined && row[foundMinusKey] !== '') {
                const val = Math.abs(parseInt(String(row[foundMinusKey]).replace(/[^\d-]/g, ''), 10));
                if (!isNaN(val)) minusVal = val;
              }
              if (foundPlusKey && row[foundPlusKey] !== undefined && row[foundPlusKey] !== '') {
                const val = Math.abs(parseInt(String(row[foundPlusKey]).replace(/[^\d-]/g, ''), 10));
                if (!isNaN(val)) plusVal = val;
              }

              if (minusVal > 0) {
                currentLogs.push({
                  id: `L-MINUS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  student_id: studentId,
                  date: defaultDateStr,
                  rule_code: 'VP01',
                  points: -minusVal,
                  notes: `Ghi nhận vi phạm ${selectedMonth.toLowerCase()} từ báo cáo Excel`,
                  recorded_by: recordedBy,
                  term_month: selectedMonth
                });
                logsAddedCount++;
              }

              if (plusVal > 0) {
                currentLogs.push({
                  id: `L-PLUS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  student_id: studentId,
                  date: defaultDateStr,
                  rule_code: 'KT01',
                  points: plusVal,
                  notes: `Ghi nhận cộng điểm ${selectedMonth.toLowerCase()} từ báo cáo Excel`,
                  recorded_by: recordedBy,
                  term_month: selectedMonth
                });
                logsAddedCount++;
              }

              if (minusVal > 0 || plusVal > 0) {
                successCount++;
              }
            }
          });

          if (successCount === 0) {
            return reject(new Error('Không tìm thấy dòng học sinh và lỗi vi phạm / điểm số phù hợp trong tệp Excel. Vui lòng kiểm tra lại cấu trúc file.'));
          }

          const updatedDb = {
            ...db,
            STUDENTS: currentStudents,
            LOGS_DISCIPLINE: currentLogs
          };

          resolve({ updatedDb, successCount, logsAddedCount });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }
}


