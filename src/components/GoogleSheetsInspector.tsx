import React, { useState, useEffect } from 'react';
import { Table, Save, RefreshCw, Code, CheckCircle, Database, HelpCircle, X } from 'lucide-react';
import { GoogleDriveService, GOOGLE_APPS_SCRIPT_TEMPLATE } from '../lib/GoogleDriveService';

interface GoogleSheetsInspectorProps {
  currentSchoolId?: string;
  onDataChanged?: () => void;
}

export default function GoogleSheetsInspector({ currentSchoolId, onDataChanged }: GoogleSheetsInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load webhook and sheets data
  useEffect(() => {
    setWebhookUrl(GoogleDriveService.getWebhookUrl());
    refreshData();
  }, [currentSchoolId]);

  const refreshData = () => {
    const s = GoogleDriveService.getSchools();
    setSchools(s);
    if (currentSchoolId) {
      const sData = GoogleDriveService.getSchoolData(currentSchoolId);
      setSchoolData(sData);
      
      // Default to CONFIG or first tab
      if (!activeTab || activeTab === 'Master_Schools_Registry') {
        setActiveTab('CONFIG');
      }
    } else {
      setActiveTab('Master_Schools_Registry');
    }
  };

  const handleFullSyncPull = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch schools registry
      await GoogleDriveService.fetchSchoolsFromWebhook();
      
      // 2. Fetch specific school data if exists
      if (currentSchoolId) {
        await GoogleDriveService.fetchSchoolDataFromWebhook(currentSchoolId);
      }
      
      refreshData();
      if (onDataChanged) onDataChanged();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = () => {
    if (!webhookUrl.trim()) {
      alert("Vui lòng nhập URL Apps Script Webhook hợp lệ!");
      return;
    }
    localStorage.setItem('GOOGLE_SCRIPT_URL', webhookUrl.trim());
    localStorage.setItem('appsScriptWebhook', webhookUrl.trim());
    GoogleDriveService.setWebhookUrl(webhookUrl.trim());
    alert("Đã lưu cấu hình Apps Script Webhook thành công!");
    // Kích hoạt nạp lại dữ liệu ngay sau khi lưu
    handleFullSyncPull();
  };

  const handleCellEdit = (tabName: string, rowIndex: number, key: string, value: any) => {
    if (tabName === 'Master_Schools_Registry') {
      const updated = [...schools];
      updated[rowIndex][key] = value;
      setSchools(updated);
      GoogleDriveService.saveSchools(updated);
    } else if (schoolData && currentSchoolId) {
      const updatedTab = [...schoolData[tabName]];
      
      // Parse points if key is 'points'
      let parsedValue = value;
      if (key === 'points' || key === 'is_locked') {
        if (key === 'points') parsedValue = Number(value) || 0;
        if (key === 'is_locked') parsedValue = value === 'true' || value === true;
      }

      updatedTab[rowIndex][key] = parsedValue;
      const updatedData = { ...schoolData, [tabName]: updatedTab };
      setSchoolData(updatedData);
      GoogleDriveService.saveSchoolData(currentSchoolId, updatedData);
    }
    
    if (onDataChanged) onDataChanged();
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = currentSchoolId 
    ? ['CONFIG', 'USERS', 'STUDENTS', 'SCORE_RULES', 'LOGS_DISCIPLINE', 'ATTENDANCE', 'COMPLAINTS']
    : ['Master_Schools_Registry'];

  const getActiveRows = () => {
    if (activeTab === 'Master_Schools_Registry') return schools;
    if (schoolData && schoolData[activeTab]) return schoolData[activeTab];
    return [];
  };

  const activeRows = getActiveRows();
  const activeHeaders = activeRows.length > 0 ? Object.keys(activeRows[0]) : [];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl text-slate-100 transition-all duration-300">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 select-none">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-sky-400 animate-pulse" />
          <span className="font-semibold text-sm tracking-wide">GOOGLE SHEETS LIVE SYNCHRONIZER & INSPECTOR</span>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
            {webhookUrl ? 'Connected with Google Drive' : 'Local Sandbox Mode (Auto-Sync)'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowScriptModal(true)}
            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-950 px-2.5 py-1 rounded border border-sky-800 transition"
          >
            <Code className="w-3.5 h-3.5" />
            Nhúng Apps Script G-Drive
          </button>
          
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) refreshData();
            }}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-700 px-3 py-1 rounded transition"
          >
            <Table className="w-3.5 h-3.5" />
            {isOpen ? 'Thu nhỏ bảng tính' : 'Xem Bảng tính Sheets'}
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      {isOpen && (
        <div className="h-72 flex flex-col">
          {/* Subheader Toolbar & Webhook Config */}
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-slate-400 font-medium whitespace-nowrap">Apps Script Webhook:</span>
              <input
                type="text"
                placeholder="Dán URL Deployment Google Apps Script tại đây để đồng bộ thực tế..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 w-full md:w-96 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
              />
              <button
                onClick={handleSaveConfig}
                className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded transition font-medium cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu cấu hình
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <button
                onClick={handleFullSyncPull}
                disabled={isSyncing}
                className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1.5 rounded border border-slate-700 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ lại'}
              </button>
              <span className="hidden lg:inline text-[11px]">
                💡 Bạn có thể sửa trực tiếp nội dung các ô rèn luyện bên dưới để kiểm tra tính năng tự động tính toán điểm.
              </span>
            </div>
          </div>

          {/* Sheets Tabs Header */}
          <div className="bg-slate-900 px-2 pt-1 flex items-end gap-1 overflow-x-auto border-b border-slate-800 select-none">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium rounded-t-md border-t border-x transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? 'bg-slate-950 border-slate-700 text-sky-400 font-semibold'
                    : 'bg-slate-850 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                📊 {tab}
              </button>
            ))}
            <span className="text-slate-600 text-xs py-1.5 px-3 italic ml-auto font-mono">
              {currentSchoolId ? `File: DB_${currentSchoolId}.xlsx` : 'File: Master_Schools_Registry.xlsx'}
            </span>
          </div>

          {/* Cells Grid spreadsheet */}
          <div className="flex-1 overflow-auto bg-slate-950 font-mono text-[11px]">
            {activeRows.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Table className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                <span>Trang tính hiện đang rỗng hoặc chưa nạp dữ liệu rèn luyện.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 select-none border-b border-slate-800">
                    <th className="w-12 text-center border-r border-slate-800 py-1 bg-slate-850"></th>
                    {activeHeaders.map((header, hIdx) => (
                      <th key={header} className="px-2 border-r border-slate-800 py-1 bg-slate-850 font-semibold text-center text-slate-300">
                        {String.fromCharCode(65 + hIdx)} <span className="text-slate-500 font-normal">({header})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-850 hover:bg-slate-900/60 transition">
                      <td className="text-center bg-slate-900 border-r border-slate-800 text-slate-500 font-bold py-1 select-none">
                        {rIdx + 1}
                      </td>
                      {activeHeaders.map((header) => (
                        <td key={header} className="p-0 border-r border-slate-850 relative">
                          <input
                            type="text"
                            value={row[header] !== undefined ? String(row[header]) : ''}
                            onChange={(e) => handleCellEdit(activeTab, rIdx, header, e.target.value)}
                            className="bg-transparent border-none text-slate-200 px-2 py-1 w-full focus:outline-none focus:bg-slate-800 focus:text-white truncate"
                            title={`Sửa dòng ${rIdx + 1}, cột ${header}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Apps Script Installation Instructions Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[85vh]">
            <div className="flex justify-between items-center bg-slate-800 p-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-sky-400" />
                <h3 className="font-semibold text-base text-slate-100">Cấu hình đồng bộ Google Drive & Sheets</h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                Để kết nối ứng dụng này với <strong>Google Drive của riêng bạn</strong> và tự động phát sinh các tệp 
                Google Sheets tương ứng khi có trường học mới, hãy làm theo hướng dẫn dưới đây:
              </p>
              
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  Truy cập vào <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-sky-400 underline hover:text-sky-300">Google Sheets</a> và tạo một tệp Trang tính mới.
                </li>
                <li>
                  Chọn <strong>Tiện ích mở rộng (Extensions)</strong> &gt; <strong>Apps Script</strong>.
                </li>
                <li>
                  Xóa tất cả mã hiện tại, sao chép đoạn mã nguồn mẫu bên dưới và dán vào.
                </li>
                <li>
                  Nhấn biểu tượng <strong>Lưu</strong> (hình đĩa mềm).
                </li>
                <li>
                  Nhấn nút <strong>Triển khai (Deploy)</strong> ở góc trên bên phải &gt; <strong>Triển khai mới (New deployment)</strong>.
                </li>
                <li>
                  Chọn loại cấu hình là <strong>Ứng dụng web (Web app)</strong>. 
                  Đặt cấu hình <i>"Người có quyền truy cập" (Who has access)</i> thành <strong>Mọi người (Anyone)</strong>. Đây là bước quan trọng để API ứng dụng có thể đồng bộ.
                </li>
                <li>
                  Sao chép <strong>URL ứng dụng web (Web app URL)</strong> được cấp sau khi triển khai và dán vào ô Apps Script Webhook của hệ thống rèn luyện này.
                </li>
              </ol>

              <div className="relative">
                <div className="flex justify-between items-center bg-slate-950 px-3 py-1.5 rounded-t-md text-[11px] text-slate-400 font-mono">
                  <span>MÃ NGUỒN GOOGLE APPS SCRIPT</span>
                  <button
                    onClick={copyTemplate}
                    className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                  >
                    {copied ? 'Đã sao chép!' : 'Sao chép mã'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-b-md max-h-56 overflow-y-auto font-mono text-[10px] text-emerald-400 border border-slate-800">
                  {GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>

            <div className="bg-slate-800 p-3 flex justify-end border-t border-slate-700">
              <button
                onClick={() => setShowScriptModal(false)}
                className="bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-2 rounded transition cursor-pointer"
              >
                Hoàn tất đọc hướng dẫn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
