import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearSessionAndReload = () => {
    try {
      localStorage.removeItem('ql_renluyen_session');
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.pathname + window.location.search;
  };

  private handleFullResetAndReload = () => {
    try {
      localStorage.removeItem('ql_renluyen_session');
      // Clear school specific local data keys to repair corrupted school objects
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ql_renluyen_school_data_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Failed to clear local storage:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.pathname;
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] my-8 max-w-2xl mx-auto p-6 bg-white border border-rose-200 rounded-2xl shadow-lg text-slate-800 flex flex-col items-center text-center animate-fade-in">
          <div className="bg-rose-100 text-rose-600 p-4 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            {this.props.fallbackTitle || 'Đã xảy ra lỗi hiển thị (Giao diện)'}
          </h2>
          <p className="text-xs text-slate-600 max-w-md mb-4 leading-relaxed">
            Hệ thống đã tự động khoanh vùng và chặn lỗi màn hình trắng. Vui lòng bấm nút dưới đây để tải lại trang hoặc khôi phục phiên làm việc.
          </p>

          {this.state.error && (
            <div className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-left text-[11px] font-mono text-rose-700 overflow-x-auto mb-6 max-h-32">
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Tải lại trang
            </button>
            
            <button
              onClick={this.handleClearSessionAndReload}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Đặt lại phiên &amp; Đăng nhập lại
            </button>

            <button
              onClick={this.handleFullResetAndReload}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Xóa bộ đệm dữ liệu trường cũ bị lỗi để khởi tạo lại dữ liệu sạch"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Khôi phục dữ liệu sạch
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
