import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Printer,
  FileText,
  Download,
  Settings,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";

// Document templates
export const DOCUMENT_TEMPLATES = {
  invoice: {
    title: "Hisob-faktura",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: true,
    showBarcode: false,
  },
  receipt: {
    title: "Kvitansiya",
    orientation: "portrait",
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: false,
    showBarcode: true,
  },
  order: {
    title: "Buyurtma",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: true,
    showBarcode: false,
  },
  report: {
    title: "Hisobot",
    orientation: "landscape",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showCompanyLogo: false,
    showSignature: false,
    showStamp: false,
    showBarcode: false,
  },
  contract: {
    title: "Shartnoma",
    orientation: "portrait",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: true,
    showBarcode: false,
  },
  payslip: {
    title: "Oylik varaqasi",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: true,
    showBarcode: false,
  },
  delivery: {
    title: "Yuk xati",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: true,
    showBarcode: true,
  },
  production: {
    title: "Ishlab chiqarish buyurtmasi",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showCompanyLogo: true,
    showSignature: true,
    showStamp: false,
    showBarcode: true,
  },
};

// Company info placeholder
const getCompanyInfo = () => {
  return {
    name: localStorage.getItem("company_name") || "Yuksalish ERP",
    address: localStorage.getItem("company_address") || "Toshkent, O'zbekiston",
    phone: localStorage.getItem("company_phone") || "+998 XX XXX XX XX",
    email: localStorage.getItem("company_email") || "info@genix.uz",
    inn: localStorage.getItem("company_inn") || "123456789",
    logo: localStorage.getItem("company_logo") || null,
  };
};

// Generate PDF document
export const generateDocumentPDF = (config) => {
  const {
    template = "invoice",
    title,
    documentNumber,
    documentDate,
    dateLabel = "Sana",
    headerFields = [],
    tableColumns = [],
    tableData = [],
    footerFields = [],
    totals = [],
    notes = "",
    customCompany = null,
  } = config;

  const templateConfig = DOCUMENT_TEMPLATES[template] || DOCUMENT_TEMPLATES.invoice;
  const company = customCompany || getCompanyInfo();
  const margins = templateConfig.margins;

  const doc = new jsPDF({
    orientation: config.orientation || templateConfig.orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margins.left - margins.right;

  let yPos = margins.top;

  // ═══════════════════════════════════════════
  // TOP HEADER: Company info (left) + Doc number (right)
  // ═══════════════════════════════════════════

  // Company logo
  if (templateConfig.showCompanyLogo && company.logo) {
    try {
      doc.addImage(company.logo, "PNG", margins.left, yPos, 25, 12);
    } catch (e) {
      console.warn("Logo qo'shishda xatolik:", e);
    }
  }

  // Company name - top left
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, margins.left, yPos + 6);

  // Document number - top right, colored
  if (documentNumber) {
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(documentNumber, pageWidth - margins.right, yPos + 6, { align: "right" });
  }

  // Company details - second line
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100, 116, 139);
  const companyDetails = [company.address, `info@genix.uz`, `INN: ${company.inn}`].filter(Boolean).join("  |  ");
  doc.text(companyDetails, margins.left, yPos + 12);

  // Date - right side under doc number
  if (documentDate) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(documentDate, pageWidth - margins.right, yPos + 12, { align: "right" });
  }

  yPos += 20;

  // ═══════════════════════════════════════════
  // BLUE TITLE BAR
  // ═══════════════════════════════════════════
  const barHeight = 10;
  doc.setFillColor(37, 99, 235);
  doc.rect(margins.left, yPos, contentWidth, barHeight, 'F');
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title || templateConfig.title, pageWidth / 2, yPos + 7, { align: "center" });

  yPos += barHeight + 6;

  // ═══════════════════════════════════════════
  // HEADER FIELDS (2 columns, clean layout)
  // ═══════════════════════════════════════════
  if (headerFields.length > 0) {
    doc.setFontSize(9);
    const colWidth = contentWidth / 2;
    const rows = Math.ceil(headerFields.length / 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const idx = row * 2 + col;
        if (idx >= headerFields.length) continue;
        const field = headerFields[idx];
        const x = margins.left + col * colWidth;
        const y = yPos + row * 8;

        // Label
        doc.setFont(undefined, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`${field.label}`, x, y);
        // Value
        doc.setFont(undefined, "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(String(field.value || "-"), x, y + 4.5);
      }
    }

    yPos += rows * 8 + 4;

    // Thin separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    yPos += 5;
  }

  // ═══════════════════════════════════════════
  // TABLE
  // ═══════════════════════════════════════════
  if (tableColumns.length > 0 && tableData.length > 0) {
    const tableHeaders = tableColumns.map((col) => col.label);
    const tableRows = tableData.map((row) =>
      tableColumns.map((col) => {
        const value = col.render ? col.render(row[col.key]) : row[col.key];
        return String(value ?? "");
      })
    );

    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: yPos,
      margin: { left: margins.left, right: margins.right },
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
        cellPadding: 4,
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: tableColumns.reduce((acc, col, index) => {
        if (col.align) {
          acc[index] = { halign: col.align };
        }
        if (col.width) {
          acc[index] = { ...acc[index], cellWidth: col.width };
        }
        return acc;
      }, {}),
    });

    yPos = doc.lastAutoTable.finalY + 6;
  }

  // ═══════════════════════════════════════════
  // TOTALS (right-aligned, clean lines)
  // ═══════════════════════════════════════════
  if (totals.length > 0) {
    const totalBlockWidth = 100;
    const totalBlockX = pageWidth - margins.right - totalBlockWidth;
    const lineX = totalBlockX;
    const valueX = pageWidth - margins.right;

    // Separator before totals
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(totalBlockX, yPos, pageWidth - margins.right, yPos);
    yPos += 4;

    totals.forEach((total, idx) => {
      const isLast = idx === totals.length - 1;

      if (isLast && total.bold) {
        // Grand total - blue bar
        yPos += 2;
        const barH = 9;
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(margins.left, yPos - 1, contentWidth, barH, 1.5, 1.5, 'F');
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`${total.label}:`, margins.left + 4, yPos + 5.5);
        doc.text(String(total.value), pageWidth - margins.right - 4, yPos + 5.5, { align: "right" });
        yPos += barH + 4;
      } else {
        doc.setFontSize(9);
        doc.setFont(undefined, total.bold ? "bold" : "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`${total.label}:`, lineX + 2, yPos + 2);
        doc.setTextColor(15, 23, 42);
        doc.text(String(total.value), valueX, yPos + 2, { align: "right" });
        yPos += 7;
      }
    });
    yPos += 4;
  }

  // ═══════════════════════════════════════════
  // FOOTER FIELDS
  // ═══════════════════════════════════════════
  if (footerFields.length > 0) {
    doc.setFontSize(9);
    footerFields.forEach((field) => {
      doc.setFont(undefined, "bold");
      doc.setTextColor(71, 85, 105);
      doc.text(`${field.label}:`, margins.left, yPos);
      doc.setFont(undefined, "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(String(field.value || "-"), margins.left + 30, yPos);
      yPos += 5;
    });
    yPos += 5;
  }

  // Notes
  if (notes) {
    doc.setFontSize(8);
    doc.setFont(undefined, "italic");
    doc.setTextColor(100, 116, 139);
    const splitNotes = doc.splitTextToSize(notes, contentWidth);
    doc.text(splitNotes, margins.left, yPos);
    yPos += splitNotes.length * 4 + 5;
  }

  // ═══════════════════════════════════════════
  // SIGNATURE SECTION
  // ═══════════════════════════════════════════
  if (templateConfig.showSignature) {
    yPos += 15;

    doc.setDrawColor(150, 150, 150);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);

    // Left signature - Topshirdi
    doc.setFont(undefined, "bold");
    doc.text("Topshirdi:", margins.left, yPos);
    doc.setLineWidth(0.3);
    doc.line(margins.left, yPos + 14, margins.left + 55, yPos + 14);
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("(imzo)", margins.left + 18, yPos + 19);

    // Stamp placeholder in center
    if (templateConfig.showStamp) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineDash([2, 2]);
      doc.setLineWidth(0.4);
      doc.circle(pageWidth / 2, yPos + 9, 14);
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text("M.O.", pageWidth / 2, yPos + 10, { align: "center" });
      doc.setLineDash([]);
    }

    // Right signature - Qabul qildi
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Qabul qildi:", pageWidth - margins.right - 55, yPos);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margins.right - 55, yPos + 14, pageWidth - margins.right, yPos + 14);
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("(imzo)", pageWidth - margins.right - 37, yPos + 19);

    yPos += 28;
  } else if (templateConfig.showStamp) {
    yPos += 10;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDash([2, 2]);
    doc.setLineWidth(0.4);
    doc.circle(pageWidth / 2, yPos + 9, 14);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text("M.O.", pageWidth / 2, yPos + 10, { align: "center" });
    doc.setLineDash([]);
  }

  // Barcode placeholder
  if (templateConfig.showBarcode && documentNumber) {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`||||| ${documentNumber} |||||`, pageWidth - margins.right - 30, pageHeight - 12);
  }

  // Footer with generation info
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `${company.name} | Yaratilgan: ${format(new Date(), "dd.MM.yyyy HH:mm")}`,
    margins.left,
    pageHeight - 8
  );

  return doc;
};

// Print document directly
export const printDocument = (config) => {
  const doc = generateDocumentPDF(config);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
};

// Download document as PDF
export const downloadDocument = (config, filename = "document") => {
  const doc = generateDocumentPDF(config);
  doc.save(`${filename}.pdf`);
};

// Quick print button component
export function PrintButton({ onClick, size = "sm", variant = "outline", label = "Chop etish" }) {
  return (
    <Button variant={variant} size={size} onClick={onClick}>
      <Printer className="w-4 h-4 mr-1" />
      {label}
    </Button>
  );
}

// Print preview modal
export function PrintPreviewModal({
  open,
  onClose,
  config,
  filename = "document",
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const iframeRef = useRef(null);

  React.useEffect(() => {
    if (open && config) {
      setIsLoading(true);
      try {
        const doc = generateDocumentPDF(config);
        const url = doc.output("bloburl");
        setPdfUrl(url);
      } catch (error) {
        console.error("PDF yaratishda xatolik:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setPdfUrl(null);
    }
  }, [open, config]);

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, "_blank");
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print();
        });
      }
    }
  };

  const handleDownload = () => {
    if (config) {
      downloadDocument(config, filename);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Hujjatni ko'rish
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Yuklab olish
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" />
                Chop etish
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-slate-100 rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : pdfUrl ? (
            <iframe
              ref={iframeRef}
              src={`${pdfUrl}#page=1&view=FitH&toolbar=1`}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              PDF yuklanmadi
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Print settings modal
export function PrintSettingsModal({
  open,
  onClose,
  onPrint,
  defaultTemplate = "invoice",
}) {
  const [template, setTemplate] = useState(defaultTemplate);
  const [copies, setCopies] = useState(1);
  const [options, setOptions] = useState({
    showLogo: true,
    showSignature: true,
    showStamp: true,
    showBarcode: false,
  });

  const handlePrint = () => {
    onPrint({
      template,
      copies,
      options,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Chop etish sozlamalari
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Shablon</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Shablon tanlang" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TEMPLATES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nusxalar soni</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={copies}
              onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-3">
            <Label>Qo'shimcha</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.showLogo}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, showLogo: checked })
                  }
                />
                <span className="text-sm">Kompaniya logosini ko'rsatish</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.showSignature}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, showSignature: checked })
                  }
                />
                <span className="text-sm">Imzo joyini ko'rsatish</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.showStamp}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, showStamp: checked })
                  }
                />
                <span className="text-sm">Muhr joyini ko'rsatish</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.showBarcode}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, showBarcode: checked })
                  }
                />
                <span className="text-sm">Shtrix kodni ko'rsatish</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              Chop etish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Batch print component
export function BatchPrintModal({
  open,
  onClose,
  documents = [],
  generateConfig,
  entityName = "Hujjatlar",
}) {
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    if (open) {
      setSelectedDocs(documents.map((d) => d.id));
    }
  }, [open, documents]);

  const toggleDoc = (id) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBatchPrint = async () => {
    setIsPrinting(true);
    setProgress(0);

    const selectedItems = documents.filter((d) => selectedDocs.includes(d.id));
    const totalDocs = selectedItems.length;

    for (let i = 0; i < totalDocs; i++) {
      const doc = selectedItems[i];
      const config = generateConfig(doc);
      downloadDocument(config, `${entityName}_${doc.id}`);
      setProgress(((i + 1) / totalDocs) * 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsPrinting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Bir nechta hujjatni chop etish
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">
              {selectedDocs.length} / {documents.length} tanlangan
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelectedDocs(
                  selectedDocs.length === documents.length
                    ? []
                    : documents.map((d) => d.id)
                )
              }
            >
              {selectedDocs.length === documents.length
                ? "Barchasini bekor qilish"
                : "Barchasini tanlash"}
            </Button>
          </div>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-slate-50"
              >
                <Checkbox
                  checked={selectedDocs.includes(doc.id)}
                  onCheckedChange={() => toggleDoc(doc.id)}
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">{doc.name || doc.number || `#${doc.id}`}</p>
                  {doc.date && (
                    <p className="text-xs text-slate-500">{doc.date}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {isPrinting && (
            <div className="space-y-2">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-center text-slate-600">
                Yuklanmoqda... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isPrinting}>
              Bekor qilish
            </Button>
            <Button
              onClick={handleBatchPrint}
              disabled={isPrinting || selectedDocs.length === 0}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Yuklanmoqda...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" />
                  PDF yuklab olish ({selectedDocs.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default {
  DOCUMENT_TEMPLATES,
  generateDocumentPDF,
  printDocument,
  downloadDocument,
  PrintButton,
  PrintPreviewModal,
  PrintSettingsModal,
  BatchPrintModal,
};
