import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Calendar,
  Building2,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Report types
const REPORT_TYPES = {
  ks2: {
    id: 'ks2',
    name: 'KS-2 (Bajarilgan ishlar dalolatnomasi)',
    description: "Bajarilgan qurilish-montaj ishlari to'g'risidagi dalolatnoma",
    icon: ClipboardList,
    color: 'bg-blue-100 text-blue-700',
  },
  ks3: {
    id: 'ks3',
    name: 'KS-3 (Smeta hisob-kitobi)',
    description: 'Bajarilgan ish qiymati to\'g\'risidagi ma\'lumotnoma',
    icon: FileSpreadsheet,
    color: 'bg-green-100 text-green-700',
  },
  smeta_summary: {
    id: 'smeta_summary',
    name: 'Smeta xulosasi',
    description: 'Loyiha smetasi bo\'yicha umumiy hisobot',
    icon: FileText,
    color: 'bg-purple-100 text-purple-700',
  },
  progress_report: {
    id: 'progress_report',
    name: 'Progress hisoboti',
    description: 'Loyiha bajarilish holati to\'g\'risida hisobot',
    icon: Building2,
    color: 'bg-orange-100 text-orange-700',
  },
};

// Generate KS-2 Report HTML
const generateKS2HTML = (project, sections, items, reportData) => {
  const currentDate = format(new Date(), 'dd.MM.yyyy');
  const periodStart = reportData.periodStart ? format(new Date(reportData.periodStart), 'dd.MM.yyyy') : '-';
  const periodEnd = reportData.periodEnd ? format(new Date(reportData.periodEnd), 'dd.MM.yyyy') : '-';

  // Calculate totals
  let totalAmount = 0;
  const itemRows = items.map((item, index) => {
    const amount = (item.quantity_completed || 0) * (item.unit_price || 0);
    totalAmount += amount;
    return `
      <tr>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 8px;">${item.code || ''}</td>
        <td style="border: 1px solid #000; padding: 8px;">${item.name || ''}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.unit || ''}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${item.quantity_completed || 0}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${(item.unit_price || 0).toLocaleString()}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${amount.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>KS-2 - ${project.name}</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          font-size: 12pt;
          line-height: 1.5;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 16pt;
          margin-bottom: 10px;
        }
        .header h2 {
          font-size: 14pt;
          font-weight: normal;
        }
        .info-block {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .info-left, .info-right {
          width: 48%;
        }
        .info-row {
          margin-bottom: 8px;
        }
        .info-label {
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          border: 1px solid #000;
          padding: 8px;
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .total-row {
          font-weight: bold;
          background-color: #f5f5f5;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 50px;
        }
        .signature-block {
          width: 45%;
          text-align: center;
        }
        .signature-line {
          border-bottom: 1px solid #000;
          margin: 30px 20px 5px;
        }
        @media print {
          body { padding: 0; }
          @page { margin: 20mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>DALOLATNOMA</h1>
        <h2>Bajarilgan qurilish-montaj ishlari qabul qilish to'g'risida</h2>
        <p>(KS-2 shakli)</p>
      </div>

      <div class="info-block">
        <div class="info-left">
          <div class="info-row"><span class="info-label">Buyurtmachi:</span> ${project.client_name || '-'}</div>
          <div class="info-row"><span class="info-label">Pudratchi:</span> ${reportData.contractorName || '-'}</div>
          <div class="info-row"><span class="info-label">Qurilish:</span> ${project.name}</div>
          <div class="info-row"><span class="info-label">Manzil:</span> ${[project.address, project.city, project.region].filter(Boolean).join(', ') || '-'}</div>
        </div>
        <div class="info-right">
          <div class="info-row"><span class="info-label">Shartnoma raqami:</span> ${reportData.contractNumber || '-'}</div>
          <div class="info-row"><span class="info-label">Shartnoma sanasi:</span> ${reportData.contractDate || '-'}</div>
          <div class="info-row"><span class="info-label">Hisobot davri:</span> ${periodStart} - ${periodEnd}</div>
          <div class="info-row"><span class="info-label">Dalolatnoma raqami:</span> ${reportData.actNumber || '-'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;">№</th>
            <th style="width: 80px;">Kod</th>
            <th>Ish nomi</th>
            <th style="width: 60px;">Birlik</th>
            <th style="width: 80px;">Miqdori</th>
            <th style="width: 100px;">Birlik narxi</th>
            <th style="width: 120px;">Jami summa</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="total-row">
            <td colspan="6" style="border: 1px solid #000; padding: 8px; text-align: right;">JAMI:</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${totalAmount.toLocaleString()} ${project.currency || 'UZS'}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top: 20px;">
        Ushbu dalolatnoma yuqorida ko'rsatilgan ishlarning bajarilganligini tasdiqlaydi.
      </p>

      <div class="signatures">
        <div class="signature-block">
          <p><strong>Topshirdi (Pudratchi):</strong></p>
          <div class="signature-line"></div>
          <p>F.I.O., imzo</p>
          <p>M.O.</p>
        </div>
        <div class="signature-block">
          <p><strong>Qabul qildi (Buyurtmachi):</strong></p>
          <div class="signature-line"></div>
          <p>F.I.O., imzo</p>
          <p>M.O.</p>
        </div>
      </div>

      <p style="text-align: right; margin-top: 30px;">Sana: ${currentDate}</p>
    </body>
    </html>
  `;
};

// Generate Smeta Summary HTML
const generateSmetaSummaryHTML = (project, sections) => {
  const currentDate = format(new Date(), 'dd.MM.yyyy');

  let totalSmeta = 0;
  const sectionRows = sections.map((section, index) => {
    totalSmeta += section.total_cost || 0;
    return `
      <tr>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 8px;">${section.code || ''}</td>
        <td style="border: 1px solid #000; padding: 8px;">${section.name || ''}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${(section.total_cost || 0).toLocaleString()}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${section.status || 'draft'}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Smeta xulosasi - ${project.name}</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          font-size: 12pt;
          line-height: 1.5;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 18pt;
          margin-bottom: 10px;
        }
        .project-info {
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          border: 1px solid #000;
          padding: 10px;
          background-color: #e0e0e0;
          font-weight: bold;
        }
        .total-row {
          font-weight: bold;
          background-color: #d0e8ff;
        }
        @media print {
          body { padding: 0; }
          @page { margin: 20mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SMETA XULOSASI</h1>
        <p>${project.name}</p>
      </div>

      <div class="project-info">
        <p><strong>Loyiha kodi:</strong> ${project.code}</p>
        <p><strong>Buyurtmachi:</strong> ${project.client_name || '-'}</p>
        <p><strong>Manzil:</strong> ${[project.address, project.city, project.region].filter(Boolean).join(', ') || '-'}</p>
        <p><strong>Shartnoma summasi:</strong> ${(project.contract_amount || 0).toLocaleString()} ${project.currency || 'UZS'}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;">№</th>
            <th style="width: 80px;">Kod</th>
            <th>Bo'lim nomi</th>
            <th style="width: 150px;">Summa</th>
            <th style="width: 100px;">Holat</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRows}
          <tr class="total-row">
            <td colspan="3" style="border: 1px solid #000; padding: 10px; text-align: right;">JAMI SMETA:</td>
            <td style="border: 1px solid #000; padding: 10px; text-align: right;">${totalSmeta.toLocaleString()} ${project.currency || 'UZS'}</td>
            <td style="border: 1px solid #000; padding: 10px;"></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 30px;">
        <p><strong>Smeta - Shartnoma farqi:</strong> ${(totalSmeta - (project.contract_amount || 0)).toLocaleString()} ${project.currency || 'UZS'}</p>
      </div>

      <p style="text-align: right; margin-top: 50px;">
        <strong>Tuzilgan sana:</strong> ${currentDate}
      </p>
    </body>
    </html>
  `;
};

// Generate Progress Report HTML
const generateProgressReportHTML = (project, buildings, sections) => {
  const currentDate = format(new Date(), 'dd.MM.yyyy');

  const buildingRows = buildings.map((building, index) => `
    <tr>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${index + 1}</td>
      <td style="border: 1px solid #000; padding: 8px;">${building.name || ''}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${building.building_type || '-'}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: right;">${building.total_area || 0} m²</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${building.floors_count || '-'}</td>
      <td style="border: 1px solid #000; padding: 8px; text-align: center;">${building.status || 'planned'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Progress hisoboti - ${project.name}</title>
      <style>
        body {
          font-family: 'Times New Roman', serif;
          font-size: 12pt;
          line-height: 1.5;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #333;
        }
        .header h1 {
          font-size: 20pt;
          margin-bottom: 10px;
          color: #333;
        }
        .progress-box {
          text-align: center;
          padding: 20px;
          margin: 20px 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 10px;
        }
        .progress-value {
          font-size: 48pt;
          font-weight: bold;
        }
        .summary-grid {
          display: flex;
          gap: 20px;
          margin: 20px 0;
        }
        .summary-card {
          flex: 1;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 8px;
          text-align: center;
        }
        .summary-value {
          font-size: 24pt;
          font-weight: bold;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          border: 1px solid #000;
          padding: 10px;
          background-color: #333;
          color: white;
          font-weight: bold;
        }
        @media print {
          body { padding: 0; }
          @page { margin: 20mm; }
          .progress-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PROGRESS HISOBOTI</h1>
        <h2>${project.name}</h2>
        <p>Kod: ${project.code}</p>
      </div>

      <div class="progress-box">
        <div class="progress-value">${project.progress_percent || 0}%</div>
        <div>Umumiy bajarilish</div>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">${buildings.length}</div>
          <div>Binolar soni</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${sections.length}</div>
          <div>Smeta bo'limlari</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${(project.contract_amount || 0).toLocaleString()}</div>
          <div>Shartnoma summasi</div>
        </div>
      </div>

      <h3>Binolar ro'yxati</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">№</th>
            <th>Bino nomi</th>
            <th style="width: 100px;">Turi</th>
            <th style="width: 100px;">Maydon</th>
            <th style="width: 80px;">Qavatlar</th>
            <th style="width: 100px;">Holat</th>
          </tr>
        </thead>
        <tbody>
          ${buildingRows || '<tr><td colspan="6" style="text-align: center; padding: 20px;">Binolar mavjud emas</td></tr>'}
        </tbody>
      </table>

      <div style="margin-top: 30px; padding: 15px; background-color: #f5f5f5; border-radius: 8px;">
        <h4>Loyiha vaqt jadvali</h4>
        <p><strong>Rejadagi boshlanish:</strong> ${project.planned_start_date ? format(new Date(project.planned_start_date), 'dd.MM.yyyy') : '-'}</p>
        <p><strong>Rejadagi tugash:</strong> ${project.planned_end_date ? format(new Date(project.planned_end_date), 'dd.MM.yyyy') : '-'}</p>
        <p><strong>Haqiqiy boshlanish:</strong> ${project.actual_start_date ? format(new Date(project.actual_start_date), 'dd.MM.yyyy') : '-'}</p>
      </div>

      <p style="text-align: right; margin-top: 50px;">
        <strong>Hisobot sanasi:</strong> ${currentDate}
      </p>
    </body>
    </html>
  `;
};

// Print or download report
const printReport = (htmlContent, title) => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
};

// Report Generator Component
export function ReportGenerator({ project, sections = [], items = [], buildings = [] }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState({
    periodStart: '',
    periodEnd: '',
    contractNumber: '',
    contractDate: '',
    actNumber: '',
    contractorName: '',
  });

  const handleGenerateReport = () => {
    if (!selectedReport) {
      toast.error('Hisobot turini tanlang');
      return;
    }

    let htmlContent = '';

    switch (selectedReport) {
      case 'ks2':
        htmlContent = generateKS2HTML(project, sections, items, reportData);
        break;
      case 'smeta_summary':
        htmlContent = generateSmetaSummaryHTML(project, sections);
        break;
      case 'progress_report':
        htmlContent = generateProgressReportHTML(project, buildings, sections);
        break;
      default:
        toast.error('Bu hisobot turi hali tayyor emas');
        return;
    }

    printReport(htmlContent, REPORT_TYPES[selectedReport].name);
    setShowModal(false);
  };

  return (
    <>
      <Button onClick={() => setShowModal(true)} variant="outline">
        <FileText className="w-4 h-4 mr-2" />
        Hisobot yaratish
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hisobot yaratish</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Report Type Selection */}
            <div>
              <Label className="mb-3 block">Hisobot turi</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(REPORT_TYPES).map((report) => {
                  const Icon = report.icon;
                  return (
                    <Card
                      key={report.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedReport === report.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedReport(report.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${report.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{report.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{report.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Additional fields for KS-2 */}
            {selectedReport === 'ks2' && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium">KS-2 ma'lumotlari</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hisobot davri (boshlanishi)</Label>
                    <Input
                      type="date"
                      value={reportData.periodStart}
                      onChange={(e) => setReportData({ ...reportData, periodStart: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Hisobot davri (tugashi)</Label>
                    <Input
                      type="date"
                      value={reportData.periodEnd}
                      onChange={(e) => setReportData({ ...reportData, periodEnd: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Shartnoma raqami</Label>
                    <Input
                      value={reportData.contractNumber}
                      onChange={(e) => setReportData({ ...reportData, contractNumber: e.target.value })}
                      placeholder="№123"
                    />
                  </div>
                  <div>
                    <Label>Shartnoma sanasi</Label>
                    <Input
                      type="date"
                      value={reportData.contractDate}
                      onChange={(e) => setReportData({ ...reportData, contractDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Dalolatnoma raqami</Label>
                    <Input
                      value={reportData.actNumber}
                      onChange={(e) => setReportData({ ...reportData, actNumber: e.target.value })}
                      placeholder="№1"
                    />
                  </div>
                  <div>
                    <Label>Pudratchi nomi</Label>
                    <Input
                      value={reportData.contractorName}
                      onChange={(e) => setReportData({ ...reportData, contractorName: e.target.value })}
                      placeholder="OOO Building Corp"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleGenerateReport} disabled={!selectedReport}>
              <Printer className="w-4 h-4 mr-2" />
              Chop etish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReportGenerator;
