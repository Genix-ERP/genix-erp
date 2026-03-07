import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Printer,
  Search,
  Package,
  Settings,
  Barcode,
  QrCode,
} from "lucide-react";

import { useInventory } from "@/components/contexts/InventoryContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

// Label template configurations
const LABEL_TEMPLATE_KEYS = {
  small_30x20: { nameKey: "label_30x20", width: 30, height: 20, fontSize: 7, showBarcode: true, showQR: false, showPrice: true, showName: true, showSKU: true },
  small_40x30: { nameKey: "label_40x30", width: 40, height: 30, fontSize: 8, showBarcode: true, showQR: false, showPrice: true, showName: true, showSKU: true },
  medium_58x40: { nameKey: "label_58x40", width: 58, height: 40, fontSize: 10, showBarcode: true, showQR: false, showPrice: true, showName: true, showSKU: true },
  medium_60x40: { nameKey: "label_60x40", width: 60, height: 40, fontSize: 10, showBarcode: true, showQR: false, showPrice: true, showName: true, showSKU: true },
  large_80x50: { nameKey: "label_80x50", width: 80, height: 50, fontSize: 12, showBarcode: true, showQR: true, showPrice: true, showName: true, showSKU: true },
  shelf_100x70: { nameKey: "label_100x70", width: 100, height: 70, fontSize: 14, showBarcode: true, showQR: true, showPrice: true, showName: true, showSKU: true },
  custom: { nameKey: "label_custom", width: 0, height: 0, fontSize: 10, showBarcode: true, showQR: false, showPrice: true, showName: true, showSKU: true },
};

// Barcode generator (simplified SVG barcode)
const generateBarcodeSVG = (code, width = 100, height = 30) => {
  const bars = [];
  let x = 0;
  const barWidth = width / (code.length * 7 + 10);

  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const pattern = (charCode % 2 === 0) ? "101101011" : "110100101";

    for (let j = 0; j < pattern.length; j++) {
      if (pattern[j] === "1") {
        bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`);
      }
      x += barWidth;
    }
    x += barWidth;
  }

  return `<svg width="${width}" height="${height + 12}" xmlns="http://www.w3.org/2000/svg">
    ${bars.join("")}
    <text x="${width/2}" y="${height + 10}" text-anchor="middle" font-size="8" font-family="monospace">${code}</text>
  </svg>`;
};

const generateQRSVG = (data, size = 50) => {
  const modules = 21;
  const moduleSize = size / modules;
  const rects = [];

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      const isCorner = (row < 7 && col < 7) ||
                       (row < 7 && col >= modules - 7) ||
                       (row >= modules - 7 && col < 7);
      const hash = (data.charCodeAt(row % data.length) + col * row) % 3;
      const isData = !isCorner && hash === 0;

      if (isCorner || isData) {
        rects.push(`<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`);
      }
    }
  }

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="white"/>
    ${rects.join("")}
  </svg>`;
};

export default function PriceLabelPrinting() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { products, items, categories } = useInventory();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [printDialog, setPrintDialog] = useState(null); // { product } or null
  const [printTemplate, setPrintTemplate] = useState("medium_58x40");
  const [printQuantity, setPrintQuantity] = useState(1);

  useEffect(() => {
    return () => {
      setShowSettings(false);
      setPrintDialog(null);
    };
  }, []);

  const getInitialSettings = () => {
    const defaultSettings = {
      showBarcode: true,
      showQR: false,
      showPrice: true,
      showName: true,
      showSKU: true,
      showCategory: false,
      showStock: false,
      currency: "UZS",
      priceFormat: "full",
      customWidth: 50,
      customHeight: 30,
      customFontSize: 10,
    };
    try {
      const saved = localStorage.getItem('genix_label_settings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading label settings:', e);
    }
    return defaultSettings;
  };

  const [customSettings, setCustomSettings] = useState(getInitialSettings);

  const LABEL_TEMPLATES = Object.fromEntries(
    Object.entries(LABEL_TEMPLATE_KEYS).map(([key, config]) => {
      if (key === 'custom') {
        return [key, {
          ...config,
          name: `${t(config.nameKey)} (${customSettings.customWidth}x${customSettings.customHeight}mm)`,
          width: customSettings.customWidth,
          height: customSettings.customHeight,
          fontSize: customSettings.customFontSize,
        }];
      }
      return [key, { ...config, name: t(config.nameKey) }];
    })
  );

  useEffect(() => {
    try {
      localStorage.setItem('genix_label_settings', JSON.stringify(customSettings));
    } catch (e) {
      console.error('Error saving label settings:', e);
    }
  }, [customSettings]);

  const allProducts = products.map(product => {
    const inventory = items.find(item => item.product_id === product.id);
    const categoryName = typeof product.category === 'string'
      ? product.category
      : (product.category?.name || categories.find(c => c.id === product.category_id)?.name || '');
    return {
      ...product,
      category: categoryName,
      current_stock: inventory?.current_stock || 0,
      sale_price: product.list_price || product.sale_price || product.unit_price || product.cost_price || 0,
    };
  });

  const filteredProducts = allProducts.filter(product =>
    product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price) => {
    if (customSettings.priceFormat === "rounded") {
      return Math.round(price).toLocaleString();
    }
    return price.toLocaleString();
  };

  const openPrintDialog = (product) => {
    setPrintDialog({ product });
    setPrintQuantity(1);
  };

  const handlePrint = () => {
    if (!printDialog) return;
    const { product } = printDialog;
    const template = LABEL_TEMPLATES[printTemplate];
    const printWindow = window.open("", "_blank");
    const barcode = product.barcode || product.sku || `P${product.id}`;

    let labelsHTML = "";
    for (let i = 0; i < printQuantity; i++) {
      labelsHTML += `
        <div class="label" style="
          width: ${template.width}mm;
          height: ${template.height}mm;
          border: 1px dashed #ccc;
          padding: 2mm;
          margin: 1mm;
          display: inline-block;
          vertical-align: top;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          font-size: ${template.fontSize}px;
          overflow: hidden;
        ">
          ${customSettings.showName ? `<div style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</div>` : ""}
          ${customSettings.showSKU ? `<div style="font-size: ${template.fontSize - 2}px; color: #666;">${barcode}</div>` : ""}
          ${customSettings.showCategory && product.category ? `<div style="font-size: ${template.fontSize - 2}px; color: #888;">${product.category}</div>` : ""}
          ${customSettings.showPrice ? `<div style="font-size: ${template.fontSize + 4}px; font-weight: bold; color: #000; margin-top: 2mm;">${formatPrice(product.sale_price)} ${customSettings.currency}</div>` : ""}
          ${customSettings.showBarcode ? `<div style="margin-top: 2mm;">${generateBarcodeSVG(barcode, template.width * 2.5, 20)}</div>` : ""}
          ${customSettings.showQR && template.showQR ? `<div style="position: absolute; right: 2mm; top: 2mm;">${generateQRSVG(barcode, 15)}</div>` : ""}
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${t('price_labels')} - Genix ERP</title>
        <style>
          @page { size: A4; margin: 5mm; }
          @media print { body { margin: 0; } .no-print { display: none; } }
          body { font-family: Arial, sans-serif; padding: 5mm; }
          .label { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 10px; padding: 10px; background: #f0f0f0;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
            ${t('print')}
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; margin-left: 10px;">
            ${t('close')}
          </button>
        </div>
        ${labelsHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    setPrintDialog(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">
            {t('print_price_labels')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('select_products_print_labels')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-4 h-4 mr-2" />
          {t('settings')}
        </Button>
      </div>

      {/* Products List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">{t('products')}</CardTitle>
            <div className="relative flex-1 sm:w-64 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('product')}</TableHead>
                  <TableHead>SKU/Barcode</TableHead>
                  <TableHead className="text-right">{t('price')}</TableHead>
                  <TableHead className="w-32 text-center">{t('action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      {t('no_products_found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.slice(0, 20).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Package className="w-8 h-8 text-slate-400" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        {product.category && (
                          <div className="text-xs text-slate-500">{product.category}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {product.barcode || product.sku || `P${product.id}`}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(product.sale_price)} {customSettings.currency}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Button
                            size="sm"
                            onClick={() => openPrintDialog(product)}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            {t('print')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredProducts.length > 20 && (
            <p className="text-center text-sm text-slate-500 mt-3">
              {t('showing')}: 20 / {filteredProducts.length}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Print Dialog */}
      <Dialog open={!!printDialog} onOpenChange={(open) => !open && setPrintDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('print_price_labels')}</DialogTitle>
          </DialogHeader>
          {printDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="font-medium">{printDialog.product.name}</div>
                <div className="text-sm text-slate-500">
                  {formatPrice(printDialog.product.sale_price)} {customSettings.currency}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('template')}</Label>
                <Select value={printTemplate} onValueChange={setPrintTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABEL_TEMPLATES).map(([key, template]) => (
                      <SelectItem key={key} value={key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('quantity')}</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                />
              </div>

              {/* Preview */}
              <div className="flex justify-center p-3 bg-slate-100 rounded-lg">
                <div
                  className="border-2 border-dashed border-slate-300 rounded p-2 bg-white"
                  style={{
                    width: `${LABEL_TEMPLATES[printTemplate].width * 2}px`,
                    minHeight: `${LABEL_TEMPLATES[printTemplate].height * 2}px`,
                  }}
                >
                  {customSettings.showName && (
                    <div className="font-bold text-xs truncate">{printDialog.product.name}</div>
                  )}
                  {customSettings.showSKU && (
                    <div className="text-[10px] text-slate-500">
                      {printDialog.product.barcode || printDialog.product.sku || `P${printDialog.product.id}`}
                    </div>
                  )}
                  {customSettings.showPrice && (
                    <div className="font-bold text-sm mt-1">
                      {formatPrice(printDialog.product.sale_price)} {customSettings.currency}
                    </div>
                  )}
                  {customSettings.showBarcode && (
                    <div className="mt-1 flex justify-center">
                      <Barcode className="w-16 h-6 text-slate-700" />
                    </div>
                  )}
                  {customSettings.showQR && LABEL_TEMPLATES[printTemplate].showQR && (
                    <div className="absolute top-1 right-1">
                      <QrCode className="w-4 h-4 text-slate-700" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPrintDialog(null)}>
                  {t('close')}
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  {t('print')} ({printQuantity})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('label_settings')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('display_information')}</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showName" className="text-sm">{t('product_name')}</Label>
                  <Checkbox
                    id="showName"
                    checked={customSettings.showName}
                    onCheckedChange={(checked) =>
                      setCustomSettings(prev => ({ ...prev, showName: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showSKU" className="text-sm">SKU/Barcode</Label>
                  <Checkbox
                    id="showSKU"
                    checked={customSettings.showSKU}
                    onCheckedChange={(checked) =>
                      setCustomSettings(prev => ({ ...prev, showSKU: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showPrice" className="text-sm">{t('price')}</Label>
                  <Checkbox
                    id="showPrice"
                    checked={customSettings.showPrice}
                    onCheckedChange={(checked) =>
                      setCustomSettings(prev => ({ ...prev, showPrice: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showCategory" className="text-sm">{t('category')}</Label>
                  <Checkbox
                    id="showCategory"
                    checked={customSettings.showCategory}
                    onCheckedChange={(checked) =>
                      setCustomSettings(prev => ({ ...prev, showCategory: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showBarcode" className="text-sm">{t('barcode')}</Label>
                  <Checkbox
                    id="showBarcode"
                    checked={customSettings.showBarcode}
                    onCheckedChange={(checked) =>
                      setCustomSettings(prev => ({ ...prev, showBarcode: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showQR" className="text-sm">{t('qr_code')}</Label>
                  <Checkbox
                    id="showQR"
                    checked={customSettings.showQR}
                    onCheckedChange={(checked) =>
                      setCustomSettings(prev => ({ ...prev, showQR: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('currency')}</Label>
              <Select
                value={customSettings.currency}
                onValueChange={(value) => setCustomSettings(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">{t('uzs_som')}</SelectItem>
                  <SelectItem value="USD">{t('usd_dollar')}</SelectItem>
                  <SelectItem value="EUR">{t('eur_euro')}</SelectItem>
                  <SelectItem value="RUB">{t('rub_ruble')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('price_format')}</Label>
              <Select
                value={customSettings.priceFormat}
                onValueChange={(value) => setCustomSettings(prev => ({ ...prev, priceFormat: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t('full_format')}</SelectItem>
                  <SelectItem value="rounded">{t('rounded_format')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Label Size */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-medium">{t('custom_label_size')}</Label>
              <p className="text-xs text-slate-500">{t('custom_label_size_desc')}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="customWidth" className="text-xs text-slate-500">{t('width')} (mm)</Label>
                  <Input
                    id="customWidth"
                    type="number"
                    min="20"
                    max="200"
                    value={customSettings.customWidth}
                    onChange={(e) => setCustomSettings(prev => ({
                      ...prev,
                      customWidth: Math.max(20, Math.min(200, parseInt(e.target.value) || 50))
                    }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customHeight" className="text-xs text-slate-500">{t('height')} (mm)</Label>
                  <Input
                    id="customHeight"
                    type="number"
                    min="15"
                    max="150"
                    value={customSettings.customHeight}
                    onChange={(e) => setCustomSettings(prev => ({
                      ...prev,
                      customHeight: Math.max(15, Math.min(150, parseInt(e.target.value) || 30))
                    }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customFontSize" className="text-xs text-slate-500">{t('font_size')} (px)</Label>
                  <Input
                    id="customFontSize"
                    type="number"
                    min="6"
                    max="24"
                    value={customSettings.customFontSize}
                    onChange={(e) => setCustomSettings(prev => ({
                      ...prev,
                      customFontSize: Math.max(6, Math.min(24, parseInt(e.target.value) || 10))
                    }))}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                {t('close')}
              </Button>
              <Button onClick={() => setShowSettings(false)}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
