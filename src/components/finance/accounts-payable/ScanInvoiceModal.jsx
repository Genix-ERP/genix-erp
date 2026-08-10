import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { aiService } from '@/api/services';

// Scan a vendor invoice and pre-fill the create form from what the model reads.
//
// All four pieces of extraction state (file, result, error, in-flight) live
// here rather than in the AP screen: nothing outside this dialog ever needed
// them, and they were four of the twenty-odd useState calls that made the
// parent unreadable.
//
// onApply receives the extracted fields already shaped for the create form.
export default function ScanInvoiceModal({ open, onOpenChange, onApply }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionError, setExtractionError] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const reset = () => {
    setSelectedFile(null);
    setExtractedData(null);
    setExtractionError(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
      setExtractionError(null);
    }
  };

  const handleAIExtract = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        // Strip the data-URL prefix ("data:image/png;base64,").
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      setExtractedData(await aiService.extractInvoice(base64, selectedFile.type));
    } catch (err) {
      console.error('AI extraction failed:', err);
      setExtractionError(err.response?.data?.message || err.message || t('ai_extraction_failed') || 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApply = () => {
    const data = extractedData?.extracted_data;
    if (!data) return;
    onApply({
      // The vendor is left blank on purpose: the model returns a name, and
      // guessing which contact it means would silently bill the wrong one.
      partner_id: '',
      invoice_number: data.invoice_number || '',
      invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date || '',
      total_amount: data.total_amount || 0,
      tax_amount: data.tax_amount || 0,
      subtotal: data.subtotal || 0,
    });
    reset();
  };

  const extracted = extractedData?.extracted_data;

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-600" />
            {t('scan_invoice') || 'Scan Invoice'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            selectedFile ? 'border-purple-400 bg-purple-50' : 'border-slate-300 hover:border-purple-300'
          }`}>
            {!selectedFile ? (
              <>
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-3">
                  {t('upload_invoice_description') || 'Upload vendor invoice (PDF, Image)'}
                </p>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="cursor-pointer max-w-xs mx-auto"
                  onChange={handleFileSelect}
                />
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-8 h-8 text-purple-600" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  {t('change_file') || 'Change file'}
                </Button>
              </div>
            )}
          </div>

          {extractionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {extractionError}
              </p>
            </div>
          )}

          {extracted && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <CheckCircle className="w-4 h-4" />
                {t('data_extracted') || 'Data extracted successfully'}
                {extracted.confidence > 0 && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 ml-auto">
                    {Math.round(extracted.confidence * 100)}% {t('confidence') || 'confidence'}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">{t('vendor')}:</span> <span className="ml-2 font-medium">{extracted.vendor_name || '-'}</span></div>
                <div><span className="text-slate-500">{t('invoice_number')}:</span> <span className="ml-2 font-medium">{extracted.invoice_number || '-'}</span></div>
                <div><span className="text-slate-500">{t('invoice_date')}:</span> <span className="ml-2 font-medium">{extracted.invoice_date || '-'}</span></div>
                <div><span className="text-slate-500">{t('due_date')}:</span> <span className="ml-2 font-medium">{extracted.due_date || '-'}</span></div>
                <div>
                  <span className="text-slate-500">{t('subtotal')}:</span>
                  <span className="ml-2 font-medium">{extracted.subtotal?.toLocaleString() || '0'} {extracted.currency || 'UZS'}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t('total')}:</span>
                  <span className="ml-2 font-medium text-green-700">{extracted.total_amount?.toLocaleString() || '0'} {extracted.currency || 'UZS'}</span>
                </div>
              </div>
              {extractedData.model === 'demo' && (
                <p className="text-xs text-amber-600 mt-2">
                  {t('demo_mode_note') || 'Demo mode - Configure AI provider for real extraction'}
                </p>
              )}
            </div>
          )}

          {!extracted && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>{t('supported_formats') || 'Supported formats'}:</strong> PDF, PNG, JPG, JPEG, WebP
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isExtracting}>
              {t('cancel')}
            </Button>
            {!extracted ? (
              <Button
                onClick={handleAIExtract}
                disabled={!selectedFile || isExtracting}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isExtracting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('extracting') || 'Extracting...'}</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" />{t('extract_data') || 'Extract Data'}</>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleApply}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('use_extracted_data') || 'Use Extracted Data'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
