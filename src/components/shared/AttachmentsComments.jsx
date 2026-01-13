import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Paperclip,
  MessageSquare,
  Upload,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  Download,
  Trash2,
  MoreVertical,
  Send,
  User,
  Calendar,
  X,
  Eye,
  Plus,
} from "lucide-react";
import { format } from "date-fns";

// File type icons mapping
const FILE_ICONS = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  default: File,
};

const getFileIcon = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// Attachments Hook
export function useAttachments(entityType, entityId) {
  const [attachments, setAttachments] = useState(() => {
    const stored = localStorage.getItem(`genix_attachments_${entityType}_${entityId}`);
    return stored ? JSON.parse(stored) : [];
  });

  const saveAttachments = (newAttachments) => {
    localStorage.setItem(
      `genix_attachments_${entityType}_${entityId}`,
      JSON.stringify(newAttachments)
    );
    setAttachments(newAttachments);
  };

  const addAttachment = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newAttachment = {
          id: `att-${Date.now()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          data: reader.result,
          uploadedBy: "Current User",
          uploadedAt: new Date().toISOString(),
        };
        const updated = [...attachments, newAttachment];
        saveAttachments(updated);
        resolve(newAttachment);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (attachmentId) => {
    const updated = attachments.filter((a) => a.id !== attachmentId);
    saveAttachments(updated);
  };

  const downloadAttachment = (attachment) => {
    const link = document.createElement("a");
    link.href = attachment.data;
    link.download = attachment.name;
    link.click();
  };

  return {
    attachments,
    addAttachment,
    removeAttachment,
    downloadAttachment,
  };
}

// Comments Hook
export function useComments(entityType, entityId) {
  const [comments, setComments] = useState(() => {
    const stored = localStorage.getItem(`genix_comments_${entityType}_${entityId}`);
    return stored ? JSON.parse(stored) : [];
  });

  const saveComments = (newComments) => {
    localStorage.setItem(
      `genix_comments_${entityType}_${entityId}`,
      JSON.stringify(newComments)
    );
    setComments(newComments);
  };

  const addComment = (text, isInternal = false) => {
    const newComment = {
      id: `comment-${Date.now()}`,
      text,
      isInternal,
      author: "Current User",
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    const updated = [...comments, newComment];
    saveComments(updated);
    return newComment;
  };

  const updateComment = (commentId, newText) => {
    const updated = comments.map((c) =>
      c.id === commentId
        ? { ...c, text: newText, updatedAt: new Date().toISOString() }
        : c
    );
    saveComments(updated);
  };

  const deleteComment = (commentId) => {
    const updated = comments.filter((c) => c.id !== commentId);
    saveComments(updated);
  };

  return {
    comments,
    addComment,
    updateComment,
    deleteComment,
  };
}

// Attachments Panel Component
export function AttachmentsPanel({
  attachments = [],
  onAdd,
  onRemove,
  onDownload,
  readOnly = false,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = "*",
}) {
  const fileInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (files) => {
    for (const file of files) {
      if (attachments.length >= maxFiles) {
        alert(`Maksimum ${maxFiles} ta fayl yuklash mumkin`);
        break;
      }
      if (file.size > maxFileSize) {
        alert(`Fayl hajmi ${formatFileSize(maxFileSize)} dan oshmasligi kerak`);
        continue;
      }
      if (onAdd) {
        await onAdd(file);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Biriktirmalar
          <Badge variant="outline">{attachments.length}</Badge>
        </h4>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1" />
            Yuklash
          </Button>
        )}
      </div>

      {/* Drop Zone */}
      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 hover:border-slate-300"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Fayllarni bu yerga tashlang yoki{" "}
            <button
              className="text-blue-600 hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              tanlang
            </button>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Maksimum {formatFileSize(maxFileSize)}, {maxFiles} ta fayl
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        className="hidden"
        onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
      />

      {/* File List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((file) => {
            const Icon = getFileIcon(file.name);
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>|</span>
                    <span>{format(new Date(file.uploadedAt), "dd.MM.yyyy")}</span>
                    {file.uploadedBy && (
                      <>
                        <span>|</span>
                        <span>{file.uploadedBy}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {file.type?.startsWith("image/") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewFile(file)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDownload?.(file)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => onRemove?.(file.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && (
        <div className="text-center py-6 text-slate-400">
          <Paperclip className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Biriktirmalar yo'q</p>
        </div>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="flex justify-center">
              <img
                src={previewFile.data}
                alt={previewFile.name}
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Comments Panel Component
export function CommentsPanel({
  comments = [],
  onAdd,
  onUpdate,
  onDelete,
  readOnly = false,
  showInternalOption = true,
}) {
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");

  const handleSubmit = () => {
    if (newComment.trim() && onAdd) {
      onAdd(newComment.trim(), isInternal);
      setNewComment("");
      setIsInternal(false);
    }
  };

  const handleEdit = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.text);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onUpdate && editingComment) {
      onUpdate(editingComment, editText.trim());
      setEditingComment(null);
      setEditText("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Izohlar
          <Badge variant="outline">{comments.length}</Badge>
        </h4>
      </div>

      {/* Comment Input */}
      {!readOnly && (
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Izoh yozing..."
            rows={3}
          />
          <div className="flex items-center justify-between">
            {showInternalOption && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-600">Ichki izoh (faqat xodimlar ko'radi)</span>
              </label>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim()}
            >
              <Send className="w-4 h-4 mr-1" />
              Yuborish
            </Button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`p-4 rounded-lg ${
              comment.isInternal ? "bg-yellow-50 border border-yellow-200" : "bg-slate-50"
            }`}
          >
            {editingComment === comment.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    Saqlash
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingComment(null)}
                  >
                    Bekor qilish
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                      {comment.author?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{comment.author}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(comment.createdAt), "dd.MM.yyyy HH:mm")}
                        {comment.updatedAt && (
                          <span className="text-slate-400">(tahrirlangan)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {comment.isInternal && (
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                        Ichki
                      </Badge>
                    )}
                    {!readOnly && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(comment)}>
                            Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete?.(comment.id)}
                            className="text-red-600"
                          >
                            O'chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {comment.text}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {comments.length === 0 && (
        <div className="text-center py-6 text-slate-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Izohlar yo'q</p>
        </div>
      )}
    </div>
  );
}

// Combined Attachments & Comments Card
export function AttachmentsCommentsCard({
  entityType,
  entityId,
  title = "Qo'shimcha ma'lumotlar",
}) {
  const { attachments, addAttachment, removeAttachment, downloadAttachment } =
    useAttachments(entityType, entityId);
  const { comments, addComment, updateComment, deleteComment } =
    useComments(entityType, entityId);

  const [activeTab, setActiveTab] = useState("comments");

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-4">
          <button
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
              activeTab === "comments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("comments")}
          >
            <MessageSquare className="w-4 h-4" />
            Izohlar
            <Badge variant="outline" className="text-xs">
              {comments.length}
            </Badge>
          </button>
          <button
            className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
              activeTab === "attachments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("attachments")}
          >
            <Paperclip className="w-4 h-4" />
            Biriktirmalar
            <Badge variant="outline" className="text-xs">
              {attachments.length}
            </Badge>
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === "comments" ? (
          <CommentsPanel
            comments={comments}
            onAdd={addComment}
            onUpdate={updateComment}
            onDelete={deleteComment}
          />
        ) : (
          <AttachmentsPanel
            attachments={attachments}
            onAdd={addAttachment}
            onRemove={removeAttachment}
            onDownload={downloadAttachment}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default {
  useAttachments,
  useComments,
  AttachmentsPanel,
  CommentsPanel,
  AttachmentsCommentsCard,
};
