import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  ArrowRight,
  Loader2,
  Eye,
  Settings,
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// Export formats
export const EXPORT_FORMATS = {
  xlsx: { label: "Excel (.xlsx)", icon: FileSpreadsheet, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  csv: { label: "CSV (.csv)", icon: FileSpreadsheet, mimeType: "text/csv" },
  pdf: { label: "PDF (.pdf)", icon: FileText, mimeType: "application/pdf" },
};

// Parse Excel/CSV file
export const parseSpreadsheetFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // First row is headers
        const headers = jsonData[0] || [];
        const rows = jsonData.slice(1).map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });

        resolve({ headers, rows, rawData: jsonData });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

// Export to Excel (styled with ExcelJS)
export const exportToExcel = async (data, columns, filename) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GenixERP';
  wb.created = new Date();
  const ws = wb.addWorksheet('Data');

  // Header row
  const headerRow = ws.addRow(columns.map(col => col.label));
  headerRow.height = 28;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2563EB' } },
      bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
      left: { style: 'thin', color: { argb: 'FF2563EB' } },
      right: { style: 'thin', color: { argb: 'FF2563EB' } },
    };
  });

  // Data rows
  data.forEach((row, rowIdx) => {
    const values = columns.map(col => {
      const val = col.render ? col.render(row[col.key]) : row[col.key];
      return val ?? '';
    });
    const dataRow = ws.addRow(values);
    dataRow.height = 22;
    const isEven = rowIdx % 2 === 0;
    dataRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  // Auto-fit column widths
  columns.forEach((col, i) => {
    const colData = data.map(row => {
      const val = col.render ? col.render(row[col.key]) : row[col.key];
      return String(val ?? '');
    });
    const maxLen = Math.max(col.label.length, ...colData.map(v => v.length));
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  // Auto-filter
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xlsx`;
  link.click();
};

// Export to CSV
export const exportToCSV = (data, columns, filename) => {
  const headers = columns.map((col) => col.label).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = col.render ? col.render(row[col.key]) : row[col.key];
        // Escape quotes and wrap in quotes if contains comma
        const strValue = String(value ?? "");
        if (strValue.includes(",") || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      })
      .join(",")
  );

  const csv = [headers, ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

// Export to PDF
export const exportToPDF = (data, columns, filename, title = "Report") => {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // Date
  doc.setFontSize(10);
  doc.text(`Yaratilgan: ${new Date().toLocaleDateString("uz-UZ")}`, 14, 22);

  // Table
  const tableData = data.map((row) =>
    columns.map((col) => {
      const value = col.render ? col.render(row[col.key]) : row[col.key];
      return String(value ?? "");
    })
  );

  doc.autoTable({
    head: [columns.map((col) => col.label)],
    body: tableData,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${filename}.pdf`);
};

// Export to JSON
export const exportToJSON = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.json`;
  link.click();
};

// Import Modal Component
export function ImportModal({
  open,
  onClose,
  onImport,
  columns = [],
  entityName = "Ma'lumotlar",
  templateColumns = null,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);

    try {
      const result = await parseSpreadsheetFile(selectedFile);
      setParsedData(result);

      // Auto-map columns by matching names
      const autoMapping = {};
      result.headers.forEach((header) => {
        const matchedCol = columns.find(
          (col) =>
            col.key.toLowerCase() === header.toLowerCase() ||
            col.label.toLowerCase() === header.toLowerCase()
        );
        if (matchedCol) {
          autoMapping[header] = matchedCol.key;
        }
      });
      setMapping(autoMapping);
      setStep(2);
    } catch (error) {
      setErrors([t('file_read_error') + ": " + error.message]);
    } finally {
      setIsProcessing(false);
    }
  };

  const validateData = () => {
    const validationErrors = [];
    const requiredFields = columns.filter((col) => col.required);

    parsedData?.rows.forEach((row, index) => {
      requiredFields.forEach((field) => {
        const mappedHeader = Object.entries(mapping).find(
          ([, value]) => value === field.key
        )?.[0];
        if (mappedHeader && !row[mappedHeader]) {
          validationErrors.push(
            `${t('row')} ${index + 2}: "${field.label}" ${t('field_is_empty')}`
          );
        }
      });
    });

    return validationErrors;
  };

  const handleImport = async () => {
    const validationErrors = validateData();
    if (validationErrors.length > 0) {
      setErrors(validationErrors.slice(0, 10));
      return;
    }

    setIsProcessing(true);

    try {
      // Transform data according to mapping
      const transformedData = parsedData.rows
        .filter((row) => Object.values(row).some((v) => v != null && v !== ""))
        .map((row) => {
          const obj = {};
          Object.entries(mapping).forEach(([header, fieldKey]) => {
            obj[fieldKey] = row[header];
          });
          return obj;
        });

      await onImport(transformedData);
      handleClose();
    } catch (error) {
      setErrors([t('import_error') + ": " + error.message]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setMapping({});
    setErrors([]);
    setStep(1);
    onClose();
  };

  const downloadTemplate = async () => {
    const templateCols = templateColumns || columns;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'GenixERP';
    wb.created = new Date();
    const ws = wb.addWorksheet('Template');

    // Header row with styling
    const headerRow = ws.addRow(templateCols.map(col => col.label));
    headerRow.height = 30;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF2563EB' } },
        bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
        left: { style: 'thin', color: { argb: 'FF2563EB' } },
        right: { style: 'thin', color: { argb: 'FF2563EB' } },
      };
    });

    // Add example row with light gray styling
    const exampleValues = templateCols.map(col => {
      if (col.key === 'name') return 'Misol mahsulot';
      if (col.key === 'barcode') return '4901234567890';
      if (col.key === 'category') return 'Elektronika';
      if (col.key === 'tags') return 'yangi, mashhur';
      if (col.key === 'cost_price') return 50000;
      if (col.key === 'list_price') return 75000;
      return '';
    });
    const exRow = ws.addRow(exampleValues);
    exRow.height = 22;
    exRow.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 };
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });

    // Add a few empty rows with light borders for user to fill
    for (let i = 0; i < 10; i++) {
      const row = ws.addRow(templateCols.map(() => ''));
      row.height = 22;
      row.eachCell((cell) => {
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
        if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }

    // Auto-fit column widths
    templateCols.forEach((col, i) => {
      ws.getColumn(i + 1).width = Math.max(col.label.length + 6, 16);
    });

    // Required fields note
    const requiredCols = templateCols.filter(c => c.required).map(c => c.label);
    if (requiredCols.length > 0) {
      ws.addRow([]);
      const noteRow = ws.addRow([`* Majburiy maydonlar: ${requiredCols.join(', ')}`]);
      noteRow.getCell(1).font = { italic: true, color: { argb: 'FFEF4444' }, size: 9 };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${entityName}_template.xlsx`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t('import')} {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4">
            <div
              className={`flex items-center gap-2 ${
                step >= 1 ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 1 ? "bg-blue-600 text-white" : "bg-slate-200"
                }`}
              >
                1
              </div>
              <span className="text-sm font-medium">{t('select_file')}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div
              className={`flex items-center gap-2 ${
                step >= 2 ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200"
                }`}
              >
                2
              </div>
              <span className="text-sm font-medium">{t('map_columns')}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div
              className={`flex items-center gap-2 ${
                step >= 3 ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 3 ? "bg-blue-600 text-white" : "bg-slate-200"
                }`}
              >
                3
              </div>
              <span className="text-sm font-medium">{t('import')}</span>
            </div>
          </div>

          {/* Step 1: File Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg font-medium">{t('select_excel_or_csv')}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {t('supported_formats')}
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFileSelect(selected);
                }}
              />

              <div className="flex justify-center">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  {t('download_template')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && parsedData && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm">
                  <strong>{file?.name}</strong> - {parsedData.rows.length} {t('rows_found')}
                </p>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('file_column')}</TableHead>
                      <TableHead>
                        <ArrowRight className="w-4 h-4" />
                      </TableHead>
                      <TableHead>{t('system_field')}</TableHead>
                      <TableHead>{t('sample')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.headers.map((header) => (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping[header] || "skip"}
                            onValueChange={(value) =>
                              setMapping({ ...mapping, [header]: value })
                            }
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder={t('select')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">{t('skip')}</SelectItem>
                              {columns.map((col) => (
                                <SelectItem key={col.key} value={col.key}>
                                  {col.label}
                                  {col.required && " *"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {parsedData.rows[0]?.[header] ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">{t('errors')}:</span>
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  {t('back')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    isProcessing ||
                    Object.values(mapping).filter((v) => v !== "skip").length === 0
                  }
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('importing')}...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t('import')} ({parsedData.rows.length} {t('rows')})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export Modal Component
export function ExportModal({
  open,
  onClose,
  data = [],
  columns = [],
  entityName = "Ma'lumotlar",
  title = "Report",
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [format, setFormat] = useState("xlsx");
  const [selectedColumns, setSelectedColumns] = useState(
    columns.map((col) => col.key)
  );
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const exportColumns = columns.filter((col) =>
        selectedColumns.includes(col.key)
      );
      const filename = `${entityName}_${new Date().toISOString().split("T")[0]}`;

      switch (format) {
        case "xlsx":
          await exportToExcel(data, exportColumns, filename);
          break;
        case "csv":
          exportToCSV(data, exportColumns, filename);
          break;
        case "pdf":
          exportToPDF(data, exportColumns, filename, title);
          break;
        case "json":
          exportToJSON(data, filename);
          break;
      }

      onClose();
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {t('export')} {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>{t('format') || 'Format'}</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(EXPORT_FORMATS).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      format === key
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setFormat(key)}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs">{key.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('columns') || 'Ustunlar'}</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedColumns(
                    selectedColumns.length === columns.length
                      ? []
                      : columns.map((col) => col.key)
                  )
                }
              >
                {selectedColumns.length === columns.length
                  ? t('deselect_all') || "Barchasini bekor qilish"
                  : t('select_all') || "Barchasini tanlash"}
              </Button>
            </div>
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 bg-slate-50 rounded-lg text-sm">
            <strong>{data.length}</strong> {t('rows') || 'qator'},{" "}
            <strong>{selectedColumns.length}</strong> {t('columns_will_be_exported') || 'ustun eksport qilinadi'}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || selectedColumns.length === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('exporting') || 'Eksport qilinmoqda...'}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {t('export') || 'Eksport qilish'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quick Export/Import Buttons
export function ImportExportButtons({
  onImport,
  onExport,
  importDisabled = false,
  exportDisabled = false,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="flex items-center gap-2">
      {onImport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onImport}
          disabled={importDisabled}
        >
          <Upload className="w-4 h-4 mr-1" />
          {t('import') || 'Import'}
        </Button>
      )}
      {onExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={exportDisabled}
        >
          <Download className="w-4 h-4 mr-1" />
          {t('export') || 'Export'}
        </Button>
      )}
    </div>
  );
}

export default {
  EXPORT_FORMATS,
  parseSpreadsheetFile,
  exportToExcel,
  exportToCSV,
  exportToPDF,
  exportToJSON,
  ImportModal,
  ExportModal,
  ImportExportButtons,
};
