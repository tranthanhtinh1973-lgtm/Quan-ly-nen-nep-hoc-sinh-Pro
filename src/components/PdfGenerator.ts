import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { Student, SchoolConfig, LogDiscipline, Attendance, ScoreRule, User } from '../types';
import { evaluateSemesterResult, getMonthFromDateStr, SemesterResult } from '../lib/EvaluationHelper';
import { GoogleDriveService } from '../lib/GoogleDriveService';

export class PdfGenerator {

  // Dynamic non-generic teacher comment generator based on student conduct & specific violations
  static generateDynamicComment(
    student: Student,
    logs: LogDiscipline[],
    termMonths: string[],
    semesterResult: SemesterResult
  ): string {
    const studentLogs = logs.filter(
      l => l.student_id === student.id && termMonths.includes(getMonthFromDateStr(l.date))
    );

    const minusLogs = studentLogs.filter(l => l.points < 0);
    const plusLogs = studentLogs.filter(l => l.points > 0);
    const rating = semesterResult.classification;
    const score = semesterResult.average;

    if (minusLogs.length === 0) {
      if (plusLogs.length > 0) {
        return `Học sinh ${student.name} có ý thức kỷ luật rất tốt, chấp hành nghiêm túc mọi quy định của nhà trường. Tích cực tham gia các phong trào thi đua và có ${plusLogs.length} lần được ghi nhận khen thưởng trong học kỳ.`;
      }
      return `Học sinh thực hiện rất tốt nề nếp, kỷ luật của nhà trường. Có thái độ tích cực trong học tập và rèn luyện.`;
    }

    // Extract unique violation notes / descriptions with count
    const violationCounts: { [key: string]: number } = {};
    minusLogs.forEach(l => {
      let desc = l.notes || l.rule_code || 'vi phạm nề nếp';
      desc = desc.toLowerCase().trim();
      violationCounts[desc] = (violationCounts[desc] || 0) + 1;
    });

    const violationSummaries = Object.entries(violationCounts).map(([desc, count]) => {
      return count > 1 ? `${desc} (${count} lần)` : desc;
    });

    const topViolationsText = violationSummaries.slice(0, 3).join(', ');

    if (score >= 85 || rating === 'Tốt') {
      return `Học sinh ${student.name} có ý thức kỷ luật tốt, chấp hành nề nếp nhà trường. Trong kỳ có một vài sơ xuất nhỏ (${topViolationsText}) nhưng đã tự giác rút kinh nghiệm và rèn luyện tiến bộ.`;
    } else if (score >= 70 || rating === 'Khá') {
      return `Học sinh ${student.name} về cơ bản chấp hành tốt quy định nhà trường. Tuy nhiên trong học kỳ còn mắc một số vi phạm như: ${topViolationsText}. Cần tập trung rút kinh nghiệm và rèn luyện tích cực hơn.`;
    } else if (score >= 50 || rating === 'Đạt') {
      return `Học sinh ${student.name} cần chú ý nâng cao hơn nữa ý thức kỷ luật. Trong học kỳ đã tái phạm các lỗi nề nếp: ${topViolationsText}. Đề nghị học sinh nghiêm túc kiểm điểm và chấn chỉnh ngay thái độ rèn luyện.`;
    } else {
      return `Học sinh ${student.name} chưa có ý thức rèn luyện tốt, thường xuyên vi phạm kỷ luật nề nếp của nhà trường (${topViolationsText}). Cần nghiêm túc kiểm điểm và có sự phối hợp chặt chẽ giữa gia đình và nhà trường để giáo dục.`;
    }
  }

  // Generate A4 PDF matching exact sample layout with 100% accurate Vietnamese diacritics
  static async generateStudentPdf(
    student: Student,
    config: SchoolConfig,
    logs: LogDiscipline[],
    rules: ScoreRule[],
    attendance: Attendance[],
    teacher: User | undefined,
    startingPoints: number = 100
  ): Promise<jsPDF> {
    const selectedTerm = config.semester || 'Học kỳ I';
    const monthsForTerm1 = ['Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1'];
    const monthsForTerm2 = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];
    const termMonths = selectedTerm === 'Học kỳ I' ? monthsForTerm1 : monthsForTerm2;

    const termResult = evaluateSemesterResult(student.id, termMonths, logs);

    // Compute monthly scores and ratings
    const monthlyData = termMonths.map((m, idx) => {
      const score = termResult.monthlyScores[idx] !== undefined ? termResult.monthlyScores[idx] : 100;
      const rating = termResult.monthlyRatings[idx] || (score >= 85 ? 'Tốt' : score >= 70 ? 'Khá' : score >= 50 ? 'Đạt' : 'Chưa đạt');
      return { month: m, score, rating };
    });

    const teacherComment = this.generateDynamicComment(student, logs, termMonths, termResult);

    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const rawSchoolName = GoogleDriveService.getDisplaySchoolName(undefined, config?.school_name);
    const schoolUpper = 'SỞ GD&ĐT LẠNG SƠN';
    const subSchoolUpper = rawSchoolName.toUpperCase();

    // Color mapping for semester rating
    let ratingColor = '#16a34a'; // Green for Tốt
    if (termResult.classification === 'Khá') ratingColor = '#2563eb';
    else if (termResult.classification === 'Đạt') ratingColor = '#d97706';
    else if (termResult.classification === 'Chưa đạt') ratingColor = '#dc2626';

    // Construct hidden HTML container formatted identically to official PDF sample
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '794px'; // 96 DPI A4 width
    container.style.padding = '50px 60px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = "'Times New Roman', Times, serif";
    container.style.color = '#000000';
    container.style.boxSizing = 'border-box';
    container.style.lineHeight = '1.5';

    const monthlyRows = monthlyData.map(d => `
      <tr>
        <td style="border: 1px solid #000; padding: 7px 12px; text-align: center;">${d.month}</td>
        <td style="border: 1px solid #000; padding: 7px 12px; text-align: center;">${d.score}</td>
        <td style="border: 1px solid #000; padding: 7px 12px; text-align: center;">${d.rating}</td>
      </tr>
    `).join('');

    const teacherName = teacher?.full_name || teacher?.username || 'Dương Thị My';
    const teacherSigImg = teacher?.signature_base64 
      ? `<img src="${teacher.signature_base64}" style="max-height: 50px; max-width: 150px; object-fit: contain;" />` 
      : '';

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px;">
        <div style="text-align: center; font-weight: bold; font-size: 14px; line-height: 1.3;">
          <div>${schoolUpper}</div>
          <div>${subSchoolUpper}</div>
        </div>
        <div style="text-align: center; font-size: 14px; line-height: 1.3;">
          <div style="font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div style="font-weight: bold; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</div>
          <div style="font-style: italic; font-size: 13px; margin-top: 10px; text-align: right;">
            Lộc Bình, ngày ${day} tháng ${month} năm ${year}
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 25px; margin-bottom: 25px;">
        <div style="font-size: 20px; font-weight: bold; text-transform: uppercase;">
          PHIẾU LIÊN LẠC ${selectedTerm.toUpperCase()}
        </div>
        <div style="font-size: 15px; margin-top: 4px;">
          Năm học ${config.year || '2026-2027'}
        </div>
      </div>

      <div style="font-size: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 50px;">
        <div>- Họ và tên học sinh: <span style="font-weight: bold; text-transform: uppercase;">${student.name}</span></div>
        <div>Lớp: <span style="font-weight: bold;">${student.class}</span></div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
        <thead>
          <tr style="font-weight: bold; background-color: #ffffff;">
            <th style="border: 1px solid #000; padding: 8px 12px; width: 35%; text-align: center;">Tháng</th>
            <th style="border: 1px solid #000; padding: 8px 12px; width: 32%; text-align: center;">Điểm Rèn Luyện</th>
            <th style="border: 1px solid #000; padding: 8px 12px; width: 33%; text-align: center;">Xếp Loại Tháng</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyRows}
          <tr style="font-weight: bold;">
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: center;">TRUNG BÌNH HỌC KỲ</td>
            <td colspan="2" style="border: 1px solid #000; padding: 8px 12px; text-align: center;">
              ${termResult.average} điểm
            </td>
          </tr>
          <tr style="font-weight: bold;">
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: center;">XẾP LOẠI HỌC KỲ</td>
            <td colspan="2" style="border: 1px solid #000; padding: 8px 12px; text-align: center; color: ${ratingColor}; font-size: 16px;">
              ${termResult.classification.toUpperCase()}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
        <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">
          NHẬT XÉT CỦA GIÁO VIÊN CHỦ NHIỆM:
        </div>
        <div style="text-indent: 20px; text-align: justify; margin-bottom: 10px;">
          ${teacherComment}
        </div>
        <div style="margin-top: 8px;">
          - <strong>Đề nghị:</strong> Kính đề nghị Quý phụ huynh tiếp tục đồng hành, quan tâm và phối hợp chặt chẽ với Giáo viên chủ nhiệm để giúp học sinh tiến bộ hơn trong thời gian tới.
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 30px; font-size: 14px;">
        <div style="width: 45%;">
          <div style="font-weight: bold; text-transform: uppercase;">CHA MẸ HỌC SINH</div>
          <div style="font-style: italic; font-size: 13px; color: #4b5563;">(Ký và ghi rõ họ tên)</div>
          <div style="height: 80px;"></div>
          <div style="font-weight: bold;">${student.parent_name || ''}</div>
        </div>
        <div style="width: 45%;">
          <div style="font-weight: bold; text-transform: uppercase;">GIÁO VIÊN CHỦ NHIỆM</div>
          <div style="font-style: italic; font-size: 13px; color: #4b5563;">(Ký và ghi rõ họ tên)</div>
          <div style="height: 80px; display: flex; align-items: center; justify-content: center;">
            ${teacherSigImg}
          </div>
          <div style="font-weight: bold;">${teacherName}</div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 80px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px;">
        © 2026 Hệ thống Quản lý Kỷ luật & Rèn luyện - Phát triển bởi AI Studio Build
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf;
    } finally {
      document.body.removeChild(container);
    }
  }

  // Compile multiple student PDFs into a single ZIP archive
  static async exportClassBatchZip(
    students: Student[],
    config: SchoolConfig,
    logs: LogDiscipline[],
    rules: ScoreRule[],
    attendance: Attendance[],
    teacher: User | undefined,
    startingPoints: number = 100
  ): Promise<Blob> {
    const zip = new JSZip();

    for (const student of students) {
      const doc = await this.generateStudentPdf(student, config, logs, rules, attendance, teacher, startingPoints);
      const pdfBlob = doc.output('blob');
      const filename = `Phieu_Lien_Lac_RL_${student.class}_${student.id}_${student.name.replace(/\s+/g, '_')}.pdf`;
      zip.file(filename, pdfBlob);
    }

    return await zip.generateAsync({ type: 'blob' });
  }
}
