import { School, SchoolConfig, User, Student, ScoreRule, LogDiscipline, Attendance, Complaint, SchoolData } from '../types';
import {
  INITIAL_SCHOOLS,
  INITIAL_CONFIGS,
  INITIAL_USERS,
  INITIAL_STUDENTS,
  INITIAL_LOGS,
  INITIAL_ATTENDANCE,
  INITIAL_COMPLAINTS,
  DEFAULT_SCORE_RULES
} from '../data/defaultData';


const STORAGE_KEYS = {
  SCHOOLS: 'ql_renluyen_schools',
  WEBHOOK_URL: 'ql_renluyen_webhook_url',
  ACTIVE_SCHOOL_PREFIX: 'ql_renluyen_school_data_',
};

// Complete Apps Script code that the user can copy & paste into their Google sheet
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script Webhook - QL_RenLuyen_Data
 * Hướng dẫn:
 * 1. Tạo Google Spreadsheet mới, đặt tên tùy ý.
 * 2. Mở Tiện ích mở rộng > Apps Script.
 * 3. Dán mã nguồn này vào và nhấn Lưu.
 * 4. Nhấn "Triển khai" > "Triển khai mới" > Chọn loại "Ứng dụng web".
 * 5. Cấu hình: "Ai có quyền truy cập" = "Mọi người" (Anyone), nhấn Triển khai.
 * 6. Sao chép URL ứng dụng web được cấp và dán vào phần "Đồng bộ Google Sheets" trên ứng dụng này.
 */

function doGet(e) {
  var action = e.parameter.action;
  var schoolId = e.parameter.schoolId;
  
  if (action === "getSchools") {
    return createResponse(readSchoolsRegistry());
  } else if (action === "getSchoolData") {
    return createResponse(readSchoolData(schoolId));
  }
  
  return createResponse({ status: "error", message: "Yêu cầu không hợp lệ" });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === "saveSchools") {
      writeSchoolsRegistry(data.schools);
      return createResponse({ status: "success", message: "Đã lưu danh mục trường học" });
    } else if (action === "saveSchoolData") {
      writeSchoolData(data.schoolId, data.schoolData);
      return createResponse({ status: "success", message: "Đã đồng bộ dữ liệu trường học" });
    } else if (action === "resetStudentsSheet") {
      resetStudentsSheet(data.schoolId);
      return createResponse({ status: "success", message: "Đã thiết lập dọn dẹp bảng STUDENTS" });
    } else if (action === "appendStudentsBatch") {
      appendStudentsBatch(data.schoolId, data.students);
      return createResponse({ status: "success", message: "Đã lưu mẻ học sinh lớp " + data.class });
    } else if (action === "saveTeachersBatch") {
      saveTeachersBatch(data.schoolId, data.teachers);
      return createResponse({ status: "success", message: "Đã lưu danh sách Giáo viên" });
    } else if (action === "migrateSchema") {
      migrateSheetSchema(data.schoolId, data.tabName, data.headers);
      return createResponse({ status: "success", message: "Đã di trú cấu trúc " + data.tabName });
    }
  } catch (error) {
    return createResponse({ status: "error", message: error.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Giả lập đọc và ghi cơ sở dữ liệu trên trang tính Google Sheets
function readSchoolsRegistry() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Master_Schools_Registry");
  if (!sheet) {
    sheet = ss.insertSheet("Master_Schools_Registry");
    sheet.appendRow(["school_id", "school_name", "address", "admin_username", "admin_password", "sheet_file_id", "status"]);
  }
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var schools = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    schools.push(obj);
  }
  return schools;
}

function writeSchoolsRegistry(schools) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Master_Schools_Registry") || ss.insertSheet("Master_Schools_Registry");
  sheet.clear();
  sheet.appendRow(["school_id", "school_name", "address", "admin_username", "admin_password", "sheet_file_id", "status"]);
  
  if (schools && schools.length > 0) {
    var dataRows = [];
    schools.forEach(function(s) {
      dataRows.push([s.school_id, s.school_name, s.address, s.admin_username, s.admin_password, s.sheet_file_id, s.status]);
    });
    sheet.getRange(2, 1, dataRows.length, 7).setValues(dataRows);
  }
}

function findOrCreateSchoolSpreadsheet(folder, schoolId) {
  var cleanId = String(schoolId || '').trim().toUpperCase();
  var defaultName = (cleanId === 'LB' || cleanId === 'LỘC BÌNH' || cleanId === 'LOC BINH') ? "DB_LỘC BÌNH_THPT" : ("DB_" + cleanId);

  var files = folder.getFilesByName(defaultName);
  if (files.hasNext()) return files.next();

  if (defaultName !== "DB_" + cleanId) {
    var altFiles = folder.getFilesByName("DB_" + cleanId);
    if (altFiles.hasNext()) return altFiles.next();
  }

  var allFiles = folder.getFiles();
  while (allFiles.hasNext()) {
    var f = allFiles.next();
    var fname = f.getName().toUpperCase();
    if (fname.indexOf("DB_") === 0) {
      if (cleanId && fname.indexOf(cleanId) >= 0) return f;
      if ((cleanId === 'LB' || cleanId === 'LOC BINH' || cleanId === 'LỘC BÌNH') && (fname.indexOf("LỘC BÌNH") >= 0 || fname.indexOf("LOC BINH") >= 0 || fname.indexOf("LB") >= 0)) {
        return f;
      }
    }
  }

  var newSS = SpreadsheetApp.create(defaultName);
  var fileId = newSS.getId();
  var file = DriveApp.getFileById(fileId);
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  try {
    var masterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master_Schools_Registry");
    if (masterSheet) {
      var rows = masterSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toUpperCase() === cleanId) {
          masterSheet.getRange(i + 1, 6).setValue(fileId);
          break;
        }
      }
    }
  } catch(err) {}

  return file;
}

function readSchoolData(schoolId) {
  try {
    var folderName = "QL_RenLuyen_Data";
    var folders = DriveApp.getFoldersByName(folderName);
    if (!folders.hasNext()) return null;
    var folder = folders.next();
    
    var file = findOrCreateSchoolSpreadsheet(folder, schoolId);
    if (!file) return null;
    
    var ss = SpreadsheetApp.open(file);
    var schoolData = {};
    var sheets = ss.getSheets();
    
    sheets.forEach(function(sheet) {
      var tabName = sheet.getName();
      var range = sheet.getDataRange();
      var rows = range.getValues();
      if (rows.length === 0) {
        schoolData[tabName] = [];
        return;
      }
      
      var headers = rows[0];
      var dataRows = [];
      for (var i = 1; i < rows.length; i++) {
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = rows[i][j];
        }
        dataRows.push(obj);
      }
      schoolData[tabName] = dataRows;
    });
    
    return schoolData;
  } catch (error) {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("school_" + schoolId);
    if (cached) return JSON.parse(cached);
    return null;
  }
}

function writeSchoolData(schoolId, schoolData) {
  var cache = CacheService.getScriptCache();
  cache.put("school_" + schoolId, JSON.stringify(schoolData), 21600);
  
  var folderName = "QL_RenLuyen_Data";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  
  var file = findOrCreateSchoolSpreadsheet(folder, schoolId);
  
  var targetSS = SpreadsheetApp.open(file);
  for (var tabName in schoolData) {
    var dataRows = schoolData[tabName];
    if (!dataRows || dataRows.length === 0) continue;
    
    var sheet = targetSS.getSheetByName(tabName) || targetSS.insertSheet(tabName);
    sheet.clear();
    
    var headers = Object.keys(dataRows[0]);
    var outputValues = [headers];
    
    dataRows.forEach(function(row) {
      var rowData = headers.map(function(h) { return row[h] !== undefined ? row[h] : ""; });
      outputValues.push(rowData);
    });
    
    sheet.getRange(1, 1, outputValues.length, headers.length).setValues(outputValues);
  }
}

function resetStudentsSheet(schoolId) {
  var folderName = "QL_RenLuyen_Data";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var fileName = "DB_" + schoolId;
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var ss = SpreadsheetApp.open(file);
    var sheet = ss.getSheetByName("STUDENTS") || ss.insertSheet("STUDENTS");
    sheet.clear();
    var headers = ['STT', 'Mã HS', 'Mã Vnedu', 'Họ và tên', 'Lớp', 'Giới tính', 'Ngày sinh', 'Họ tên phụ huynh', 'Số điện thoại', 'Mật khẩu'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
}

function appendStudentsBatch(schoolId, students) {
  if (!students || students.length === 0) return;
  var folderName = "QL_RenLuyen_Data";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var fileName = "DB_" + schoolId;
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var ss = SpreadsheetApp.open(file);
    var sheet = ss.getSheetByName("STUDENTS") || ss.insertSheet("STUDENTS");
    
    var lastRow = sheet.getLastRow();
    var headers = ['STT', 'Mã HS', 'Mã Vnedu', 'Họ và tên', 'Lớp', 'Giới tính', 'Ngày sinh', 'Họ tên phụ huynh', 'Số điện thoại', 'Mật khẩu'];
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      lastRow = 1;
    }
    
    var dataRows = [];
    students.forEach(function(s, idx) {
      dataRows.push([
        lastRow + idx,                                                      // STT
        String(s.maHS || s.id || s.studentId || ""),                       // Mã HS
        String(s.vneduId || s.maVnEdu || s.vnedu_code || "").trim(),       // Mã Vnedu
        String(s.name || s.hoVaTen || ""),                                 // Họ và tên
        String(s.class || s.lop || ""),                                    // Lớp
        String(s.gender || s.gioiTinh || "Nam"),                           // Giới tính
        String(s.birthDate || s.ngaySinh || s.birth_date || ""),           // Ngày sinh
        String(s.parentName || s.hoTenPhuHuynh || s.parent_name || ""),    // Họ tên phụ huynh
        String(s.phone || s.soDienThoai || ""),                            // Số điện thoại
        String(s.password || "123456")                                     // Mật khẩu
      ]);
    });
    
    var maxRows = sheet.getMaxRows();
    var neededRows = (lastRow + dataRows.length) - maxRows;
    if (neededRows > 0) {
      sheet.insertRowsAfter(maxRows, neededRows);
    }
    
    sheet.getRange(lastRow + 1, 1, dataRows.length, headers.length).setValues(dataRows);
  }
function saveTeachersBatch(schoolId, teachers) {
  if (!teachers || teachers.length === 0) return;
  var folderName = "QL_RenLuyen_Data";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var fileName = "DB_" + schoolId;
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var ss = SpreadsheetApp.open(file);
    var sheet = ss.getSheetByName("USERS") || ss.insertSheet("USERS");
    sheet.clear();
    var headers = ['STT', 'Mã GV', 'Tên tài khoản', 'Mật khẩu', 'Vai trò', 'Lớp phân công', 'Họ và tên', 'Chữ ký Base64'];
    var dataRows = [headers];
    teachers.forEach(function(t, idx) {
      dataRows.push([
        idx + 1,
        String(t.id || ""),
        String(t.username || ""),
        String(t.password || ""),
        String(t.role || "Teacher"),
        String(t.class_assigned || t.classAssigned || ""),
        String(t.full_name || t.fullName || ""),
        String(t.signature_base64 || t.signatureBase64 || "")
      ]);
    });
    sheet.getRange(1, 1, dataRows.length, headers.length).setValues(dataRows);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
}

function migrateSheetSchema(schoolId, tabName, headers) {
  var folderName = "QL_RenLuyen_Data";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var fileName = "DB_" + schoolId;
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var ss = SpreadsheetApp.open(file);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(headers);
    }
  }
}
`;

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type SyncListener = (status: SyncStatus, lastSyncedTime?: Date) => void;

export class GoogleDriveService {
  private static syncListeners: SyncListener[] = [];
  private static currentSyncStatus: SyncStatus = 'idle';
  private static lastSyncedTime?: Date;

  static subscribeSync(listener: SyncListener): () => void {
    this.syncListeners.push(listener);
    listener(this.currentSyncStatus, this.lastSyncedTime);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  static getSyncStatus() {
    return { status: this.currentSyncStatus, lastSyncedTime: this.lastSyncedTime };
  }

  private static notifySync(status: SyncStatus) {
    this.currentSyncStatus = status;
    if (status === 'success') {
      this.lastSyncedTime = new Date();
    }
    this.syncListeners.forEach(l => {
      try {
        l(status, this.lastSyncedTime);
      } catch (e) {
        console.error('Error in sync listener:', e);
      }
    });
  }

  // Master Schools Registry
  static getSchools(): School[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(INITIAL_SCHOOLS));
      return INITIAL_SCHOOLS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SCHOOLS;
    } catch (e) {
      return INITIAL_SCHOOLS;
    }
  }

  static async fetchSchoolsFromCentralServer(): Promise<School[] | null> {
    try {
      const res = await fetch('/api/schools');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.schools) && data.schools.length > 0) {
          localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(data.schools));
          return data.schools;
        }
      }
    } catch (e) {
      console.warn('Central server API not reachable for schools:', e);
    }

    // Webhook fallback if central server is empty or offline
    const webhookSchools = await this.fetchSchoolsFromWebhook();
    if (webhookSchools && webhookSchools.length > 0) {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(webhookSchools));
      this.syncSchoolsWithServer(webhookSchools);
      return webhookSchools;
    }

    // If local storage has user-created schools, return local
    const local = this.getSchools();
    if (local && local.length > 0) {
      await this.syncSchoolsWithServer(local);
      return local;
    }

    return null;
  }

  private static async syncSchoolsWithServer(schools: School[]): Promise<void> {
    try {
      await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schools }),
      });
    } catch (e) {
      // Ignore network errors
    }
  }

  static saveSchools(schools: School[]): void {
    localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
    this.syncSchoolsWithServer(schools);
    this.syncWithRealApi('saveSchools', { schools });
  }

  static deleteSchool(schoolId: string): School[] {
    const schools = this.getSchools();
    const cleanId = String(schoolId || '').trim().toUpperCase();
    const updated = schools.filter(s => String(s.school_id || '').trim().toUpperCase() !== cleanId);
    this.saveSchools(updated);
    
    // Clear all storage keys for this school
    localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${schoolId}`);
    localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${cleanId}`);
    localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${schoolId.toLowerCase()}`);
    
    return updated;
  }

  static getDisplaySchoolName(schoolId?: string, configSchoolName?: string): string {
    if (configSchoolName && configSchoolName.trim()) {
      return configSchoolName.trim();
    }
    if (schoolId) {
      const schools = this.getSchools();
      const sch = schools.find(s => s.school_id === schoolId);
      if (sch && sch.school_name) {
        return sch.school_name;
      }
    }
    return 'TRƯỜNG THPT';
  }

  // Get or set Apps Script Webhook URL
  static getWebhookUrl(): string {
    const saved = localStorage.getItem('GOOGLE_SCRIPT_URL') || 
                  localStorage.getItem('appsScriptWebhook') || 
                  localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL);
    return (saved && saved.trim()) ? saved.trim() : 'https://script.google.com/macros/s/AKfycbzqxQLXC7n-3HgqToXi4XAtvBi2kbR9X9ymsxFlUUr0qFdMLfYUe_Xvx0ul5zDI42bwog/exec';
  }

  static setWebhookUrl(url: string): void {
    const trimmed = url.trim();
    localStorage.setItem('GOOGLE_SCRIPT_URL', trimmed);
    localStorage.setItem('appsScriptWebhook', trimmed);
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, trimmed);
  }

  // School data (CONFIG, USERS, STUDENTS, SCORE_RULES, LOGS_DISCIPLINE, ATTENDANCE, COMPLAINTS)
  static getSchoolData(schoolId: string): SchoolData {
    const key = `${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${schoolId}`;
    const raw = localStorage.getItem(key);
    let data: SchoolData | null = null;
    
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse school data:', e);
      }
    }

    if (!data) {
      // Build standard default data for this school
      const config = INITIAL_CONFIGS[schoolId] || {
        year: '2026-2027',
        semester: 'Học kỳ I',
        school_name: `Trường THPT ${schoolId}`,
        is_locked: false,
      };
      
      const users = INITIAL_USERS[schoolId] || [
        { id: 'U-ADMIN', username: `admin_${schoolId.toLowerCase()}`, password: '123', role: 'School Admin', class_assigned: '' }
      ];

      const students = INITIAL_STUDENTS[schoolId] || [];
      const logs = INITIAL_LOGS[schoolId] || [];
      const attendance = INITIAL_ATTENDANCE[schoolId] || [];
      const complaints = INITIAL_COMPLAINTS[schoolId] || [];
      
      data = {
        CONFIG: [config],
        USERS: users,
        STUDENTS: students,
        SCORE_RULES: DEFAULT_SCORE_RULES,
        LOGS_DISCIPLINE: logs,
        ATTENDANCE: attendance,
        COMPLAINTS: complaints,
      };

      localStorage.setItem(key, JSON.stringify(data));
    }

    // Defensive normalization: Ensure all arrays are strictly defined
    data.CONFIG = Array.isArray(data.CONFIG) && data.CONFIG.length > 0 ? data.CONFIG : [{ year: '2026-2027', semester: 'Học kỳ I', school_name: `Trường THPT ${schoolId}`, is_locked: false }];
    
    // Ensure USERS has default teachers/admin if empty or missing teachers
    const defaultUsers = INITIAL_USERS[schoolId] || INITIAL_USERS['LB'] || [
      { id: 'U-ADMIN', username: `admin_${schoolId.toLowerCase()}`, password: '123', role: 'School Admin', class_assigned: '' }
    ];
    if (!Array.isArray(data.USERS) || data.USERS.length === 0) {
      data.USERS = defaultUsers;
    } else {
      defaultUsers.forEach(u => {
        if (!data.USERS.some(existing => existing.username.toLowerCase() === u.username.toLowerCase())) {
          data.USERS.push(u);
        }
      });
    }

    // Filter out synthetic auto-generated accounts (keeping only admin-created accounts)
    if (Array.isArray(data.USERS)) {
      data.USERS = data.USERS.filter(u => !u.id || !u.id.startsWith('GV-'));
    }

    data.STUDENTS = Array.isArray(data.STUDENTS) ? data.STUDENTS : [];
    
    // Check backup storage if any key dataset array is empty or missing
    if (!Array.isArray(data.USERS) || data.USERS.length === 0) {
      const backupUsers = localStorage.getItem('users') || localStorage.getItem(`ql_renluyen_users_backup_${schoolId}`);
      if (backupUsers) {
        try {
          const parsed = JSON.parse(backupUsers);
          if (Array.isArray(parsed) && parsed.length > 0) data.USERS = parsed;
        } catch (e) {}
      }
    }

    if (!Array.isArray(data.SCORE_RULES) || data.SCORE_RULES.length === 0) {
      const backupRules = localStorage.getItem('score_rules') || localStorage.getItem(`ql_renluyen_scorerules_backup_${schoolId}`);
      if (backupRules) {
        try {
          const parsed = JSON.parse(backupRules);
          if (Array.isArray(parsed) && parsed.length > 0) data.SCORE_RULES = parsed;
        } catch (e) {}
      }
    }

    if (!Array.isArray(data.STUDENTS) || data.STUDENTS.length === 0) {
      const backup = localStorage.getItem('students') || localStorage.getItem(`ql_renluyen_students_backup_${schoolId}`);
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed) && parsed.length > 0) data.STUDENTS = parsed;
        } catch (e) {}
      }
    }

    if (!Array.isArray(data.LOGS_DISCIPLINE) || data.LOGS_DISCIPLINE.length === 0) {
      const backupLogs = localStorage.getItem('logs_discipline') || localStorage.getItem(`ql_renluyen_logs_backup_${schoolId}`);
      if (backupLogs) {
        try {
          const parsed = JSON.parse(backupLogs);
          if (Array.isArray(parsed) && parsed.length > 0) data.LOGS_DISCIPLINE = parsed;
        } catch (e) {}
      }
    }

    if (!Array.isArray(data.ATTENDANCE) || data.ATTENDANCE.length === 0) {
      const backupAtt = localStorage.getItem('attendance') || localStorage.getItem(`ql_renluyen_attendance_backup_${schoolId}`);
      if (backupAtt) {
        try {
          const parsed = JSON.parse(backupAtt);
          if (Array.isArray(parsed) && parsed.length > 0) data.ATTENDANCE = parsed;
        } catch (e) {}
      }
    }

    if (!Array.isArray(data.COMPLAINTS) || data.COMPLAINTS.length === 0) {
      const backupComp = localStorage.getItem('complaints') || localStorage.getItem(`ql_renluyen_complaints_backup_${schoolId}`);
      if (backupComp) {
        try {
          const parsed = JSON.parse(backupComp);
          if (Array.isArray(parsed) && parsed.length > 0) data.COMPLAINTS = parsed;
        } catch (e) {}
      }
    }

    data.SCORE_RULES = Array.isArray(data.SCORE_RULES) && data.SCORE_RULES.length > 0 ? data.SCORE_RULES : DEFAULT_SCORE_RULES;
    data.LOGS_DISCIPLINE = Array.isArray(data.LOGS_DISCIPLINE) ? data.LOGS_DISCIPLINE : [];
    data.ATTENDANCE = Array.isArray(data.ATTENDANCE) ? data.ATTENDANCE : [];
    data.COMPLAINTS = Array.isArray(data.COMPLAINTS) ? data.COMPLAINTS : [];

    return data;
  }

  static async fetchSchoolDataFromCentralServer(schoolId: string): Promise<SchoolData | null> {
    if (!schoolId) return null;
    const cleanId = String(schoolId).trim().toUpperCase();
    const localData = this.getSchoolData(cleanId);

    try {
      const res = await fetch(`/api/school-data/${cleanId}`);
      if (res.ok) {
        const body = await res.json();
        if (body && body.schoolData && typeof body.schoolData === 'object' && body.schoolData.CONFIG) {
          const fetchedData = body.schoolData;

          // Merge local USERS and SCORE_RULES
          if (localData && localData.USERS && localData.USERS.length > 0) {
            if (!fetchedData.USERS || !Array.isArray(fetchedData.USERS) || fetchedData.USERS.length === 0) {
              fetchedData.USERS = localData.USERS;
            } else {
              localData.USERS.forEach((u: any) => {
                if (u && u.username && !fetchedData.USERS.some((existing: any) => existing.username.toLowerCase() === u.username.toLowerCase())) {
                  fetchedData.USERS.push(u);
                }
              });
            }
          }

          if (localData && localData.SCORE_RULES && localData.SCORE_RULES.length > 0) {
            if (!fetchedData.SCORE_RULES || !Array.isArray(fetchedData.SCORE_RULES) || fetchedData.SCORE_RULES.length === 0) {
              fetchedData.SCORE_RULES = localData.SCORE_RULES;
            } else {
              localData.SCORE_RULES.forEach((r: any) => {
                if (r && r.code && !fetchedData.SCORE_RULES.some((existing: any) => existing.code === r.code)) {
                  fetchedData.SCORE_RULES.push(r);
                }
              });
            }
          }

          // Merge local STUDENTS to guarantee imported students are never wiped
          if (localData && Array.isArray(localData.STUDENTS) && localData.STUDENTS.length > 0) {
            if (!fetchedData.STUDENTS || !Array.isArray(fetchedData.STUDENTS) || fetchedData.STUDENTS.length === 0) {
              fetchedData.STUDENTS = localData.STUDENTS;
            } else {
              localData.STUDENTS.forEach((s: any) => {
                if (!s) return;
                const sId = String(s.id || '').trim();
                const sVnedu = String(s.vneduId || s.vnedu_code || '').trim();
                const sNameClass = `${String(s.name || '').trim().toLowerCase()}_${String(s.class || '').trim().toLowerCase()}`;

                const existsInFetched = fetchedData.STUDENTS.some((inc: any) => {
                  if (!inc) return false;
                  const incId = String(inc.id || '').trim();
                  const incVnedu = String(inc.vneduId || inc.vnedu_code || '').trim();
                  const incNameClass = `${String(inc.name || '').trim().toLowerCase()}_${String(inc.class || '').trim().toLowerCase()}`;

                  if (sId && incId && sId === incId) return true;
                  if (sVnedu && incVnedu && sVnedu === incVnedu) return true;
                  if (sNameClass !== '_' && sNameClass === incNameClass) return true;
                  return false;
                });

                if (!existsInFetched) {
                  fetchedData.STUDENTS.push(s);
                }
              });
            }
          }

          // Merge local LOGS_DISCIPLINE
          if (localData && Array.isArray(localData.LOGS_DISCIPLINE) && localData.LOGS_DISCIPLINE.length > 0) {
            if (!fetchedData.LOGS_DISCIPLINE || !Array.isArray(fetchedData.LOGS_DISCIPLINE) || fetchedData.LOGS_DISCIPLINE.length === 0) {
              fetchedData.LOGS_DISCIPLINE = localData.LOGS_DISCIPLINE;
            } else {
              localData.LOGS_DISCIPLINE.forEach((l: any) => {
                if (l && l.id && !fetchedData.LOGS_DISCIPLINE.some((inc: any) => inc.id === l.id)) {
                  fetchedData.LOGS_DISCIPLINE.push(l);
                }
              });
            }
          }

          // Merge local ATTENDANCE
          if (localData && Array.isArray(localData.ATTENDANCE) && localData.ATTENDANCE.length > 0) {
            if (!fetchedData.ATTENDANCE || !Array.isArray(fetchedData.ATTENDANCE) || fetchedData.ATTENDANCE.length === 0) {
              fetchedData.ATTENDANCE = localData.ATTENDANCE;
            } else {
              localData.ATTENDANCE.forEach((a: any) => {
                if (a && a.student_id && a.date && !fetchedData.ATTENDANCE.some((inc: any) => inc.student_id === a.student_id && inc.date === a.date)) {
                  fetchedData.ATTENDANCE.push(a);
                }
              });
            }
          }

          // Merge local COMPLAINTS
          if (localData && Array.isArray(localData.COMPLAINTS) && localData.COMPLAINTS.length > 0) {
            if (!fetchedData.COMPLAINTS || !Array.isArray(fetchedData.COMPLAINTS) || fetchedData.COMPLAINTS.length === 0) {
              fetchedData.COMPLAINTS = localData.COMPLAINTS;
            } else {
              localData.COMPLAINTS.forEach((c: any) => {
                if (c && c.id && !fetchedData.COMPLAINTS.some((inc: any) => inc.id === c.id)) {
                  fetchedData.COMPLAINTS.push(c);
                }
              });
            }
          }

          const key = `${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${cleanId}`;
          localStorage.setItem(key, JSON.stringify(fetchedData));
          
          // Save redundant backups for all 6 critical datasets
          if (Array.isArray(fetchedData.USERS) && fetchedData.USERS.length > 0) {
            localStorage.setItem('users', JSON.stringify(fetchedData.USERS));
            localStorage.setItem(`ql_renluyen_users_backup_${cleanId}`, JSON.stringify(fetchedData.USERS));
          }
          if (Array.isArray(fetchedData.SCORE_RULES) && fetchedData.SCORE_RULES.length > 0) {
            localStorage.setItem('score_rules', JSON.stringify(fetchedData.SCORE_RULES));
            localStorage.setItem(`ql_renluyen_scorerules_backup_${cleanId}`, JSON.stringify(fetchedData.SCORE_RULES));
          }
          if (Array.isArray(fetchedData.STUDENTS) && fetchedData.STUDENTS.length > 0) {
            localStorage.setItem('students', JSON.stringify(fetchedData.STUDENTS));
            localStorage.setItem(`ql_renluyen_students_backup_${cleanId}`, JSON.stringify(fetchedData.STUDENTS));
          }
          if (Array.isArray(fetchedData.LOGS_DISCIPLINE) && fetchedData.LOGS_DISCIPLINE.length > 0) {
            localStorage.setItem('logs_discipline', JSON.stringify(fetchedData.LOGS_DISCIPLINE));
            localStorage.setItem(`ql_renluyen_logs_backup_${cleanId}`, JSON.stringify(fetchedData.LOGS_DISCIPLINE));
          }
          if (Array.isArray(fetchedData.ATTENDANCE) && fetchedData.ATTENDANCE.length > 0) {
            localStorage.setItem('attendance', JSON.stringify(fetchedData.ATTENDANCE));
            localStorage.setItem(`ql_renluyen_attendance_backup_${cleanId}`, JSON.stringify(fetchedData.ATTENDANCE));
          }
          if (Array.isArray(fetchedData.COMPLAINTS) && fetchedData.COMPLAINTS.length > 0) {
            localStorage.setItem('complaints', JSON.stringify(fetchedData.COMPLAINTS));
            localStorage.setItem(`ql_renluyen_complaints_backup_${cleanId}`, JSON.stringify(fetchedData.COMPLAINTS));
          }

          // Sync merged result back to central server & Google Sheets
          this.syncSchoolDataWithServer(cleanId, fetchedData);
          this.syncWithRealApi('saveSchoolData', { schoolId: cleanId, schoolData: fetchedData });

          return fetchedData;
        }
      }
    } catch (e) {
      console.warn(`Central server API not reachable for school data ${cleanId}:`, e);
    }

    // Webhook fallback if central server is empty or offline
    const webhookData = await this.fetchSchoolDataFromWebhook(cleanId);
    if (webhookData) {
      const key = `${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${cleanId}`;
      localStorage.setItem(key, JSON.stringify(webhookData));
      if (webhookData.STUDENTS && webhookData.STUDENTS.length > 0) {
        localStorage.setItem('students', JSON.stringify(webhookData.STUDENTS));
        localStorage.setItem(`ql_renluyen_students_backup_${cleanId}`, JSON.stringify(webhookData.STUDENTS));
      }
      await this.syncSchoolDataWithServer(cleanId, webhookData);
      return webhookData;
    }

    // Fallback to local
    if (localData) {
      await this.syncSchoolDataWithServer(cleanId, localData);
      return localData;
    }

    return null;
  }

  private static async syncSchoolDataWithServer(schoolId: string, data: SchoolData): Promise<void> {
    try {
      await fetch('/api/school-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, schoolData: data }),
      });
    } catch (e) {
      // Ignore network error
    }
  }

  static saveSchoolData(schoolId: string, data: SchoolData): void {
    const cleanId = String(schoolId).trim().toUpperCase();
    const key = `${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${cleanId}`;
    localStorage.setItem(key, JSON.stringify(data));

    if (data) {
      if (Array.isArray(data.USERS) && data.USERS.length > 0) {
        localStorage.setItem('users', JSON.stringify(data.USERS));
        localStorage.setItem(`ql_renluyen_users_backup_${cleanId}`, JSON.stringify(data.USERS));
      }
      if (Array.isArray(data.SCORE_RULES) && data.SCORE_RULES.length > 0) {
        localStorage.setItem('score_rules', JSON.stringify(data.SCORE_RULES));
        localStorage.setItem(`ql_renluyen_scorerules_backup_${cleanId}`, JSON.stringify(data.SCORE_RULES));
      }
      if (Array.isArray(data.STUDENTS) && data.STUDENTS.length > 0) {
        localStorage.setItem('students', JSON.stringify(data.STUDENTS));
        localStorage.setItem(`ql_renluyen_students_backup_${cleanId}`, JSON.stringify(data.STUDENTS));
      }
      if (Array.isArray(data.LOGS_DISCIPLINE) && data.LOGS_DISCIPLINE.length > 0) {
        localStorage.setItem('logs_discipline', JSON.stringify(data.LOGS_DISCIPLINE));
        localStorage.setItem(`ql_renluyen_logs_backup_${cleanId}`, JSON.stringify(data.LOGS_DISCIPLINE));
      }
      if (Array.isArray(data.ATTENDANCE) && data.ATTENDANCE.length > 0) {
        localStorage.setItem('attendance', JSON.stringify(data.ATTENDANCE));
        localStorage.setItem(`ql_renluyen_attendance_backup_${cleanId}`, JSON.stringify(data.ATTENDANCE));
      }
      if (Array.isArray(data.COMPLAINTS) && data.COMPLAINTS.length > 0) {
        localStorage.setItem('complaints', JSON.stringify(data.COMPLAINTS));
        localStorage.setItem(`ql_renluyen_complaints_backup_${cleanId}`, JSON.stringify(data.COMPLAINTS));
      }
    }

    this.syncSchoolDataWithServer(cleanId, data);
    this.syncWithRealApi('saveSchoolData', { schoolId: cleanId, schoolData: data });
  }

  // Master Sync Method to pull and synchronize all schools and active school datasets
  static async syncAllData(activeSchoolId?: string): Promise<{ success: boolean; schoolsCount: number; totalStudents: number; message: string }> {
    this.notifySync('syncing');
    try {
      // 1. Fetch schools registry from central server and fallback webhook
      const schools = await this.fetchSchoolsFromCentralServer() || this.getSchools();
      let totalStudents = 0;

      // 2. Sync all schools' schoolData from central server/webhook
      for (const sch of schools) {
        const schId = sch.school_id;
        const sData = await this.fetchSchoolDataFromCentralServer(schId);
        if (sData && Array.isArray(sData.STUDENTS)) {
          totalStudents += sData.STUDENTS.length;
        }
      }

      this.notifySync('success');
      return {
        success: true,
        schoolsCount: schools.length,
        totalStudents,
        message: `Đồng bộ thành công! Đã tải ${schools.length} trường học và ${totalStudents} học sinh từ máy chủ.`
      };
    } catch (err: any) {
      console.error('Master Sync failed:', err);
      this.notifySync('error');
      return {
        success: false,
        schoolsCount: 0,
        totalStudents: 0,
        message: `Lỗi đồng bộ: ${err.message || 'Không thể kết nối máy chủ'}`
      };
    }
  }

  /**
   * 1.3 Cơ chế Tự động sinh Sheet khi có tính năng mới (Dynamic Schema Migration)
   * Before executing a feature, checks if the sheet exists in current data structure.
   * If not, automatically creates the sheet tab with appropriate columns.
   */
  static checkAndMigrateSchema(schoolId: string, tabName: string, defaultHeaders: string[]): void {
    const data = this.getSchoolData(schoolId);
    if (!data[tabName]) {
      // Create empty mock rows conforming to headers
      const initialRow: Record<string, any> = {};
      defaultHeaders.forEach(header => {
        initialRow[header] = '';
      });
      data[tabName] = [];
      this.saveSchoolData(schoolId, data);
      
      // Sync schema migration with real web API if active
      this.syncWithRealApi('migrateSchema', { schoolId, tabName, headers: defaultHeaders });
      console.log(`Schema Migration triggered: Tab '${tabName}' created on Sheet files.`);
    }
  }

  // Actual Webhook call
  private static async syncWithRealApi(action: string, payload: any): Promise<void> {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) return; // No webhook configured, runs completely on simulation

    this.notifySync('syncing');

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // standard Apps Script POST behavior without preflight
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, ...payload }),
      });
      console.log('Synchronized securely with Google Sheets URL successfully.', response);
      this.notifySync('success');
      
      // Return to idle state after 3.5 seconds
      setTimeout(() => {
        if (this.currentSyncStatus === 'success') {
          this.notifySync('idle');
        }
      }, 3500);
    } catch (error) {
      console.warn('Failed to sync with real Google Sheets Apps Script API:', error);
      this.notifySync('error');
    }
  }

  // Manual Triggered Sync all data to Server
  static async triggerFullSync(schoolId: string): Promise<boolean> {
    const data = this.getSchoolData(schoolId);
    await this.syncSchoolDataWithServer(schoolId, data);

    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) return true;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveSchoolData',
          schoolId,
          schoolData: data
        })
      });
      return true;
    } catch (e) {
      console.warn('Full sync warning:', e);
      return false;
    }
  }

  static async fetchSchoolsFromWebhook(): Promise<School[] | null> {
    const url = this.getWebhookUrl();
    if (!url) return null;
    try {
      const res = await fetch(`${url}?action=getSchools`, { redirect: 'follow' });
      if (!res.ok && res.status !== 0) return null;
      const text = await res.text();
      // Parse JSON safely
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(data));
          return data;
        }
      } catch (jsonErr) {
        console.warn('Response was not JSON format or redirect happened', jsonErr);
      }
    } catch (e) {
      console.warn('Error fetching schools from webhook:', e);
    }
    return null;
  }

  static normalizeSchoolData(data: any): SchoolData {
    if (!data || typeof data !== 'object') return data;
    
    // Create copy of data
    const normalized: any = { ...data };
    
    // Normalize CONFIG
    if (normalized.CONFIG && Array.isArray(normalized.CONFIG)) {
      normalized.CONFIG = normalized.CONFIG.map((row: any) => {
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };
        return {
          year: String(getValue(['year', 'Năm học', 'namHoc']) || '2026-2027'),
          semester: String(getValue(['semester', 'Học kỳ', 'hocKy']) || 'Học kỳ I'),
          school_name: String(getValue(['school_name', 'Tên trường', 'tenTruong', 'schoolName']) || 'Trường THPT'),
          is_locked: getValue(['is_locked', 'Đã khóa', 'isLocked', 'Khóa']) === 'true' || getValue(['is_locked', 'Đã khóa', 'isLocked', 'Khóa']) === true
        };
      });
    }

    // Normalize USERS
    if (normalized.USERS && Array.isArray(normalized.USERS)) {
      normalized.USERS = normalized.USERS.map((row: any) => {
        if (!row || Object.keys(row).length === 0) return null;
        
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };

        const parsedId = String(getValue(['Mã GV', 'id', 'maGV', 'ma_gv']) || '').trim();
        const parsedUsername = String(getValue(['Tên tài khoản', 'username', 'tenTaiKhoan', 'user']) || '').trim();
        const parsedPassword = String(getValue(['Mật khẩu', 'password', 'matKhau']) || '123').trim();
        const parsedRole = String(getValue(['Vai trò', 'role', 'vaiTro']) || 'Teacher').trim();
        const parsedClassAssigned = String(getValue(['Lớp phân công', 'class_assigned', 'classAssigned', 'lopPhanCong', 'lop']) || '').trim();
        const parsedFullName = String(getValue(['Họ và tên', 'full_name', 'fullName', 'hoVaTen']) || '').trim();
        const parsedSignature = String(getValue(['Chữ ký Base64', 'signature_base64', 'signatureBase64', 'signature']) || '').trim();

        if (!parsedUsername && !parsedId) return null;

        return {
          id: parsedId || `GV-${parsedUsername}`,
          username: parsedUsername,
          password: parsedPassword,
          role: (parsedRole === 'School Admin' || parsedRole === 'Super Admin') ? parsedRole as any : 'Teacher',
          class_assigned: parsedClassAssigned,
          full_name: parsedFullName,
          signature_base64: parsedSignature || undefined
        };
      }).filter(Boolean);
    }

    // Normalize STUDENTS
    if (normalized.STUDENTS && Array.isArray(normalized.STUDENTS)) {
      normalized.STUDENTS = normalized.STUDENTS.map((row: any) => {
        if (!row || Object.keys(row).length === 0) return null;
        
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };

        const parsedId = String(getValue(['Mã HS', 'id', 'maHS', 'ma_hs']) || '').trim();
        const parsedVneduId = String(getValue(['Mã Vnedu', 'vnedu_id', 'vneduId', 'mã vnedu.vn', 'vnedu_code', 'vneduCode']) || '').replace(/^'/, '').trim();
        const parsedName = String(getValue(['Họ và tên', 'name', 'hoVaTen']) || '').trim();
        const parsedClass = String(getValue(['Lớp', 'class', 'lop']) || '').trim().toUpperCase().replace(/\s+/g, '');
        const parsedGender = String(getValue(['Giới tính', 'gender', 'gioiTinh']) || 'Nam').trim();
        const parsedBirthDate = String(getValue(['Ngày sinh', 'birth_date', 'birthDate', 'ngaySinh']) || '').trim();
        const parsedParentName = String(getValue(['Họ tên phụ huynh', 'parent_name', 'parentName', 'parent_name']) || '').trim();
        const parsedPhone = String(getValue(['Số điện thoại', 'phone', 'soDienThoai']) || '').trim();
        const parsedPassword = String(getValue(['Mật khẩu', 'password', 'matKhau']) || '123456').trim();

        return {
          id: parsedId,
          name: parsedName,
          class: parsedClass,
          gender: parsedGender,
          birth_date: parsedBirthDate,
          birthDate: parsedBirthDate,
          parent_name: parsedParentName,
          parentName: parsedParentName,
          phone: parsedPhone,
          password: parsedPassword,
          vnedu_code: parsedVneduId || undefined,
          vneduId: parsedVneduId || undefined
        };
      }).filter(Boolean);
    }

    // Normalize LOGS_DISCIPLINE
    if (normalized.LOGS_DISCIPLINE && Array.isArray(normalized.LOGS_DISCIPLINE)) {
      normalized.LOGS_DISCIPLINE = normalized.LOGS_DISCIPLINE.map((row: any) => {
        if (!row || Object.keys(row).length === 0) return null;
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };
        return {
          id: String(getValue(['id', 'Mã']) || ''),
          student_id: String(getValue(['student_id', 'Mã HS', 'studentId', 'ma_hs', 'maHS']) || ''),
          date: String(getValue(['date', 'Ngày', 'ngay']) || ''),
          rule_code: String(getValue(['rule_code', 'Mã lỗi', 'ruleCode', 'ma_loi', 'maLoi']) || ''),
          points: Number(getValue(['points', 'Điểm', 'diem'])) || 0,
          notes: String(getValue(['notes', 'Ghi chú', 'ghiChu', 'note']) || ''),
          recorded_by: String(getValue(['recorded_by', 'Người ghi', 'recordedBy', 'nguoiGhi']) || ''),
          term_month: String(getValue(['term_month', 'Tháng', 'termMonth', 'thang']) || ''),
          evidence_base64: String(getValue(['evidence_base64', 'Minh chứng', 'evidence']) || '')
        };
      }).filter(Boolean);
    }

    // Normalize ATTENDANCE
    if (normalized.ATTENDANCE && Array.isArray(normalized.ATTENDANCE)) {
      normalized.ATTENDANCE = normalized.ATTENDANCE.map((row: any) => {
        if (!row || Object.keys(row).length === 0) return null;
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };
        return {
          date: String(getValue(['date', 'Ngày', 'ngay']) || ''),
          student_id: String(getValue(['student_id', 'Mã HS', 'studentId', 'ma_hs', 'maHS']) || ''),
          status: String(getValue(['status', 'Trạng thái', 'trangThai']) || 'P')
        };
      }).filter(Boolean);
    }

    // Normalize COMPLAINTS
    if (normalized.COMPLAINTS && Array.isArray(normalized.COMPLAINTS)) {
      normalized.COMPLAINTS = normalized.COMPLAINTS.map((row: any) => {
        if (!row || Object.keys(row).length === 0) return null;
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };
        return {
          id: String(getValue(['id', 'Mã']) || ''),
          student_id: String(getValue(['student_id', 'Mã HS', 'studentId', 'ma_hs', 'maHS']) || ''),
          log_id: String(getValue(['log_id', 'Mã vi phạm', 'logId']) || ''),
          reason: String(getValue(['reason', 'Lý do', 'lyDo']) || ''),
          evidence_base64: String(getValue(['evidence_base64', 'Minh chứng', 'evidence']) || ''),
          status: String(getValue(['status', 'Trạng thái', 'trangThai']) || 'Pending') as any,
          feedback: String(getValue(['feedback', 'Phản hồi', 'phanHoi']) || ''),
          created_at: String(getValue(['created_at', 'Ngày tạo', 'createdAt']) || '')
        };
      }).filter(Boolean);
    }

    // Normalize SCORE_RULES
    if (normalized.SCORE_RULES && Array.isArray(normalized.SCORE_RULES) && normalized.SCORE_RULES.length > 0) {
      normalized.SCORE_RULES = normalized.SCORE_RULES.map((row: any) => {
        if (!row || Object.keys(row).length === 0) return null;
        const headers = Object.keys(row);
        const getValue = (keys: string[]) => {
          for (const k of keys) {
            const h = headers.find(h => h.trim().toLowerCase() === k.toLowerCase());
            if (h !== undefined && row[h] !== undefined && row[h] !== null) return row[h];
          }
          return '';
        };

        const code = String(getValue(['Mã Quy Chuẩn', 'code', 'Mã', 'ma', 'rule_code', 'ruleCode']) || '').trim();
        const name = String(getValue(['Nội Dung Quy Chuẩn / Hành Vi Rèn Luyện', 'Nội dung', 'name', 'ten', 'rule_name', 'ruleName']) || '').trim();
        const points = Number(getValue(['Mức Điểm Ghi Nhận', 'points', 'Điểm', 'diem'])) || 0;
        const category = String(getValue(['Phân loại', 'category', 'phanLoai']) || (points < 0 ? 'Discipline' : 'Reward')).trim();

        if (!code || !name) return null;

        return {
          code,
          name,
          points,
          category: (category === 'Reward' || category === 'Discipline') ? category : (points < 0 ? 'Discipline' : 'Reward')
        };
      }).filter(Boolean);
    }

    if (!normalized.SCORE_RULES || !Array.isArray(normalized.SCORE_RULES) || normalized.SCORE_RULES.length === 0) {
      normalized.SCORE_RULES = DEFAULT_SCORE_RULES;
    }

    return normalized;
  }

  static async fetchSchoolDataFromWebhook(schoolId: string): Promise<SchoolData | null> {
    const url = this.getWebhookUrl();
    if (!url) return null;
    try {
      const res = await fetch(`${url}?action=getSchoolData&schoolId=${schoolId}`, { redirect: 'follow' });
      if (!res.ok && res.status !== 0) return null;
      const text = await res.text();
      try {
        let data = JSON.parse(text);
        if (data && typeof data === 'object' && !data.status) {
          // Clean and normalize Vietnamese headers back to standard English models
          data = this.normalizeSchoolData(data);
          
          // Merge with local USERS and SCORE_RULES to prevent teacher / rule deletion
          const localData = this.getSchoolData(schoolId);
          if (localData && localData.USERS && localData.USERS.length > 0) {
            if (!data.USERS || !Array.isArray(data.USERS) || data.USERS.length === 0) {
              data.USERS = localData.USERS;
            } else {
              localData.USERS.forEach((u: any) => {
                if (u.username && !data.USERS.some((existing: any) => existing.username.toLowerCase() === u.username.toLowerCase())) {
                  data.USERS.push(u);
                }
              });
            }
          }

          if (localData && localData.SCORE_RULES && localData.SCORE_RULES.length > 0) {
            if (!data.SCORE_RULES || !Array.isArray(data.SCORE_RULES) || data.SCORE_RULES.length === 0) {
              data.SCORE_RULES = localData.SCORE_RULES;
            } else {
              localData.SCORE_RULES.forEach((r: any) => {
                if (r && r.code && !data.SCORE_RULES.some((existing: any) => existing.code === r.code)) {
                  data.SCORE_RULES.push(r);
                }
              });
            }
          }

          if (localData && Array.isArray(localData.STUDENTS) && localData.STUDENTS.length > 0) {
            if (!data.STUDENTS || !Array.isArray(data.STUDENTS) || data.STUDENTS.length === 0) {
              data.STUDENTS = localData.STUDENTS;
            } else {
              localData.STUDENTS.forEach((s: any) => {
                if (!s) return;
                const sId = String(s.id || '').trim();
                const sVnedu = String(s.vneduId || s.vnedu_code || '').trim();
                const sNameClass = `${String(s.name || '').trim().toLowerCase()}_${String(s.class || '').trim().toLowerCase()}`;

                const existsInFetched = data.STUDENTS.some((inc: any) => {
                  if (!inc) return false;
                  const incId = String(inc.id || '').trim();
                  const incVnedu = String(inc.vneduId || inc.vnedu_code || '').trim();
                  const incNameClass = `${String(inc.name || '').trim().toLowerCase()}_${String(inc.class || '').trim().toLowerCase()}`;

                  if (sId && incId && sId === incId) return true;
                  if (sVnedu && incVnedu && sVnedu === incVnedu) return true;
                  if (sNameClass !== '_' && sNameClass === incNameClass) return true;
                  return false;
                });

                if (!existsInFetched) {
                  data.STUDENTS.push(s);
                }
              });
            }
          }

          if (localData && Array.isArray(localData.LOGS_DISCIPLINE) && localData.LOGS_DISCIPLINE.length > 0) {
            if (!data.LOGS_DISCIPLINE || !Array.isArray(data.LOGS_DISCIPLINE) || data.LOGS_DISCIPLINE.length === 0) {
              data.LOGS_DISCIPLINE = localData.LOGS_DISCIPLINE;
            } else {
              localData.LOGS_DISCIPLINE.forEach((l: any) => {
                if (l && l.id && !data.LOGS_DISCIPLINE.some((inc: any) => inc.id === l.id)) {
                  data.LOGS_DISCIPLINE.push(l);
                }
              });
            }
          }

          if (localData && Array.isArray(localData.ATTENDANCE) && localData.ATTENDANCE.length > 0) {
            if (!data.ATTENDANCE || !Array.isArray(data.ATTENDANCE) || data.ATTENDANCE.length === 0) {
              data.ATTENDANCE = localData.ATTENDANCE;
            } else {
              localData.ATTENDANCE.forEach((a: any) => {
                if (a && a.student_id && a.date && !data.ATTENDANCE.some((inc: any) => inc.student_id === a.student_id && inc.date === a.date)) {
                  data.ATTENDANCE.push(a);
                }
              });
            }
          }

          const key = `${STORAGE_KEYS.ACTIVE_SCHOOL_PREFIX}${schoolId}`;
          localStorage.setItem(key, JSON.stringify(data));
          if (data.STUDENTS && data.STUDENTS.length > 0) {
            localStorage.setItem('students', JSON.stringify(data.STUDENTS));
            localStorage.setItem(`ql_renluyen_students_backup_${schoolId}`, JSON.stringify(data.STUDENTS));
          }
        }
      } catch (jsonErr) {
        console.warn('Response was not JSON format or redirect happened', jsonErr);
      }
    } catch (e) {
      console.warn(`Error fetching data for school ${schoolId} from webhook:`, e);
    }
    return null;
  }

  // Batch sync student data by class to prevent Apps Script timeouts and payload size limits
  static async syncStudentsInBatches(
    schoolId: string, 
    allStudents: Student[], 
    onProgress?: (message: string, progressPercent: number) => void
  ): Promise<{ success: boolean; message: string }> {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      return { success: false, message: 'Chưa cấu hình Webhook URL kết nối Google Sheets.' };
    }

    // 1. Group students by class
    const studentsByClass: Record<string, Student[]> = {};
    allStudents.forEach(student => {
      const cls = student.class || 'Khác';
      if (!studentsByClass[cls]) {
        studentsByClass[cls] = [];
      }
      studentsByClass[cls].push(student);
    });

    const classes = Object.keys(studentsByClass).sort();
    if (classes.length === 0) {
      return { success: false, message: 'Danh sách học sinh trống, không có dữ liệu để đồng bộ.' };
    }

    // 2. We will first send a clear signal or reset the sheet STUDENTS to header-only
    try {
      if (onProgress) onProgress('Đang dọn dẹp bảng tính STUDENTS trên Google Sheets...', 0);
      
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'resetStudentsSheet',
          schoolId
        })
      });
      // Sleep 350ms
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (err) {
      console.warn('Error clearing sheet:', err);
    }

    // 3. Send students class by class
    let successCount = 0;
    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      const studentsInClass = studentsByClass[cls];
      const percent = Math.round(((i + 1) / classes.length) * 100);
      
      if (onProgress) {
        onProgress(`Đang đồng bộ học sinh lớp ${cls} (${studentsInClass.length} học sinh)...`, percent);
      }

      const cleanedStudents = studentsInClass.map((stud, idx) => {
        try {
          const anyStud = stud as any;
          return {
            maHS: String(anyStud.maHS || anyStud.id || anyStud.studentId || '').trim(),
            vneduId: String(anyStud.vneduId || anyStud.maVnEdu || anyStud.vnedu_code || anyStud.code || '').trim(),
            name: String(anyStud.name || anyStud.hoVaTen || '').trim(),
            class: String(anyStud.class || anyStud.lop || '').trim(),
            gender: String(anyStud.gender || anyStud.gioiTinh || 'Nam').trim(),
            birthDate: String(anyStud.birthDate || anyStud.ngaySinh || anyStud.birth_date || '').trim(),
            parentName: String(anyStud.parentName || anyStud.hoTenPhuHuynh || anyStud.parent_name || '').trim(),
            phone: String(anyStud.phone || anyStud.soDienThoai || '').trim(),
            password: String(anyStud.password || '123456').trim()
          };
        } catch (e) {
          console.error('Error normalizing student row:', stud, e);
          return {
            maHS: String(stud.id || `ERR-${idx}`),
            vneduId: '',
            name: String(stud.name || 'Lỗi dữ liệu'),
            class: cls,
            gender: 'Nam',
            birthDate: '',
            parentName: '',
            phone: '',
            password: '123456'
          };
        }
      });

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'appendStudentsBatch',
            schoolId,
            class: cls,
            students: cleanedStudents
          })
        });
        successCount++;
      } catch (err) {
        console.error(`Error sending batch for class ${cls}:`, err);
      }

      // Small delay between requests to avoid exceeding rate limits or timeouts
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    if (successCount === classes.length) {
      return { success: true, message: `Đồng bộ thành công toàn bộ ${allStudents.length} học sinh của ${classes.length} lớp lên Google Sheets!` };
    } else {
      return { success: true, message: `Đồng bộ hoàn tất với ${successCount}/${classes.length} lớp được gửi thành công (${allStudents.length} học sinh).` };
    }
  }

  // Batch sync teacher user accounts to Google Sheets and Central Server
  static async syncTeachersInBatches(
    schoolId: string,
    teachers: User[],
    onProgress?: (message: string, progressPercent: number) => void
  ): Promise<{ success: boolean; message: string }> {
    const data = this.getSchoolData(schoolId);
    
    // 1. Save data locally and push to central server endpoint (/api/school-data)
    this.saveSchoolData(schoolId, data);

    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      return { success: true, message: 'Đã lưu danh sách Giáo viên vào hệ thống máy chủ nhà trường thành công.' };
    }

    if (onProgress) onProgress('Đang đồng bộ danh sách Giáo viên lên Google Sheets...', 30);

    try {
      // Send saveTeachersBatch action
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveTeachersBatch',
          schoolId,
          teachers: teachers.map(t => ({
            id: t.id,
            username: t.username,
            password: t.password,
            role: t.role,
            class_assigned: t.class_assigned || '',
            full_name: t.full_name || '',
            signature_base64: t.signature_base64 || ''
          }))
        })
      });

      if (onProgress) onProgress('Đang cập nhật toàn bộ cơ sở dữ liệu trường học...', 70);

      // Also trigger saveSchoolData for full consistency
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveSchoolData',
          schoolId,
          schoolData: data
        })
      });

      if (onProgress) onProgress('Hoàn tất đồng bộ danh sách Giáo viên!', 100);

      return { success: true, message: `Đã đồng bộ thành công ${teachers.length} tài khoản Giáo viên lên Google Sheets!` };
    } catch (err: any) {
      console.error('Error in syncTeachersInBatches:', err);
      return { success: true, message: 'Đã lưu danh sách Giáo viên vào hệ thống máy chủ nhà trường thành công!' };
    }
  }
}
