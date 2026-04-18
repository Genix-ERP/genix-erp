import React, { useState, useEffect, useCallback, useRef } from 'react';
import { constructionService } from '@/api/services/construction';
import { UploadFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Camera, Plus, Trash2, Upload, X, Loader2, Calendar, Search } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const API_HOST = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8080';

const PhotoReportsTab = ({ project }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Upload form
  const [description, setDescription] = useState('');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadPhotos = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await constructionService.listPhotoReports(project.id, params);
      setPhotos(data || []);
    } catch (e) {
      console.error('Failed to load photo reports:', e);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [project?.id, dateFrom, dateTo]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const openCreate = () => {
    setDescription('');
    setUploadFiles([]);
    setError(null);
    setShowModal(true);
  };

  const handleFileSelect = (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    setUploadFiles(prev => [...prev, ...imageFiles]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeUploadFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (uploadFiles.length === 0) {
      setError(t('validation_photo_required') || 'Kamida bitta rasm tanlang');
      return;
    }
    setSaving(true);
    setUploading(true);
    setError(null);
    try {
      for (const file of uploadFiles) {
        // Upload the file first
        const uploadResult = await UploadFile(file);
        const fileUrl = uploadResult?.url || uploadResult?.file_url || uploadResult;

        // Create photo report entry
        await constructionService.createPhotoReport(project.id, {
          photos: [{ url: fileUrl, filename: file.name }],
          description: description || '',
          report_date: new Date().toISOString().split('T')[0],
        });
      }
      setShowModal(false);
      toast.success(t('photo_uploaded_success') || 'Foto muvaffaqiyatli yuklandi');
      loadPhotos();
    } catch (e) {
      setError(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await constructionService.deletePhotoReport(deleteTarget.id);
      setDeleteTarget(null);
      toast.success(t('photo_deleted') || "Foto o'chirildi");
      loadPhotos();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Xatolik yuz berdi');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {t('photo_reports') || 'Foto hisobotlar'}
            <Badge variant="outline" className="text-xs">{photos.length}</Badge>
          </CardTitle>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_photo') || "Foto qo'shish"}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Date range filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Label className="text-sm text-slate-500">{t('date_from') || 'Dan'}:</Label>
              <Input
                type="date"
                className="w-[160px] h-8"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-500">{t('date_to') || 'Gacha'}:</Label>
              <Input
                type="date"
                className="w-[160px] h-8"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                <X className="w-4 h-4 mr-1" />
                {t('clear') || 'Tozalash'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photo Gallery Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t('no_photo_reports') || "Foto hisobotlar yo'q"}</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_first_photo') || "Birinchi fotoni qo'shing"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden group relative">
              <div
                className="aspect-square bg-slate-100 cursor-pointer overflow-hidden"
                onClick={() => setLightboxPhoto(photo)}
              >
                <img
                  src={`${API_HOST}${(photo.photos && photo.photos[0]?.url) || photo.photo_url || ''}`}
                  alt={photo.description || 'Photo'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { e.target.src = ''; e.target.alt = 'Rasm yuklanmadi'; }}
                />
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {photo.description && (
                      <p className="text-sm text-slate-700 truncate" title={photo.description}>
                        {photo.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(photo.report_date || photo.created_at)}
                    </p>
                    {photo.user_name && (
                      <p className="text-xs text-slate-400">{photo.user_name}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(photo); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxPhoto(null)}
          >
            <X className="w-6 h-6" />
          </Button>
          <img
            src={lightboxPhoto.photo_url}
            alt={lightboxPhoto.description || 'Photo'}
            className="max-w-full max-h-full object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxPhoto.description && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded text-sm max-w-lg text-center">
              {lightboxPhoto.description}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('upload_photos') || 'Foto yuklash'}</DialogTitle>
            <DialogDescription className="sr-only">{t('upload_photos') || 'Foto yuklash'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

            {/* Drag and drop area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">
                {t('drag_drop_photos') || "Rasmlarni shu yerga tashlang yoki bosing"}
              </p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {/* Preview selected files */}
            {uploadFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploadFiles.map((file, idx) => (
                  <div key={idx} className="relative aspect-square bg-slate-100 rounded overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 w-6 h-6 p-0 bg-black/50 text-white hover:bg-black/70 rounded-full"
                      onClick={() => removeUploadFile(idx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('photo_description_placeholder') || 'Foto haqida qisqacha izoh...'}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button onClick={handleSave} disabled={saving || uploadFiles.length === 0}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('uploading') || 'Yuklanmoqda...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {t('upload') || 'Yuklash'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_photo_title') || "Fotoni o'chirish"}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_photo_desc') || "Bu foto hisobot o'chiriladi. Davom etasizmi?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t('delete') || "O'chirish"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PhotoReportsTab;
