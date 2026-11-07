import React, { useState, useEffect } from 'react';
import { GoogleDriveService, SyncStatus } from '../lib/GoogleDriveService';
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AutoSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<Date | undefined>(undefined);
  const [hasWebhook, setHasWebhook] = useState<boolean>(false);

  useEffect(() => {
    // Check if webhook is configured
    setHasWebhook(!!GoogleDriveService.getWebhookUrl());

    // Subscribe to GoogleDriveService sync changes
    const unsubscribe = GoogleDriveService.subscribeSync((newStatus, time) => {
      setStatus(newStatus);
      if (time) {
        setLastSynced(time);
      }
    });

    // Periodically re-check webhook presence in case it gets updated live
    const interval = setInterval(() => {
      setHasWebhook(!!GoogleDriveService.getWebhookUrl());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!hasWebhook) {
    return (
      <div 
        className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-semibold"
        title="Để đồng bộ dữ liệu tự động lên Google Sheets, vui lòng cấu hình URL Webhook tại màn hình quản lý."
      >
        <CloudOff className="w-3.5 h-3.5" />
        <span>Chế độ Ngoại tuyến (Đã lưu nháp)</span>
      </div>
    );
  }

  switch (status) {
    case 'syncing':
      return (
        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tự động đồng bộ...</span>
        </div>
      );
    case 'success':
      return (
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-semibold">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>Đã đồng bộ lên Sheets {lastSynced ? `lúc ${formatTime(lastSynced)}` : ''}</span>
        </div>
      );
    case 'error':
      return (
        <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-1 rounded-full text-xs font-semibold">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>Lỗi đồng bộ tự động! Đang thử lại...</span>
        </div>
      );
    case 'idle':
    default:
      return (
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-slate-600 border border-emerald-100/50 px-2.5 py-1 rounded-full text-xs font-semibold">
          <Cloud className="w-3.5 h-3.5 text-emerald-500" />
          <span>Đồng bộ Google Sheets tự động đang bật</span>
        </div>
      );
  }
}
