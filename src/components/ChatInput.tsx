import { Send, Cpu, Paperclip, X, Folder } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';
import { FileAttachment } from '../types';
import { FolderUploadModal } from './FolderUploadModal';
import { uploadFile } from '../lib/supabase';

interface ChatInputProps {
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  disabled: boolean;
  currentModel: string;
  onOpenModelSelector: () => void;
}

export function ChatInput({ onSend, disabled, currentModel, onOpenModelSelector }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const getModelDisplayName = (model: string) => {
    if (model === 'auto') return 'Auto';
    if (model.startsWith('grok-4')) return 'Grok 4';
    if (model.startsWith('grok-3')) return 'Grok 3';
    if (model.startsWith('grok-2')) return 'Grok 2';
    if (model === 'grok-code-fast-1') return 'Code';
    return model;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    await processFiles(files);
    
    // Reset input
    e.target.value = '';
  };

  const handleFolderSelect = () => {
    setIsFolderModalOpen(true);
  };

  const handleFolderConfirm = (processedFiles: FileAttachment[]) => {
    setAttachments(prev => [...prev, ...processedFiles]);
    setIsFolderModalOpen(false);
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      // Skip hidden files and system files
      if (file.name.startsWith('.') || file.name.startsWith('~')) {
        continue;
      }

      try {
        // Upload to Supabase storage
        const userId = await getUserId(); // Assume imported or available
        if (!userId) {
          alert('User not authenticated. Please refresh.');
          continue;
        }

        const url = await uploadFile(file, userId);
        if (!url) {
          alert(`Failed to upload "${file.name}".`);
          continue;
        }

        const attachment: FileAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          url, // Use URL from storage
        };
        
        setAttachments(prev => [...prev, attachment]);
      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Failed to upload "${file.name}".`);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 content
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !disabled) {
      onSend(input.trim(), attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="border-t bg-white p-4">
        <div className="max-w-4xl mx-auto">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 font-medium">
                  {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
                </p>
                <button
                  type="button"
                  onClick={() => setAttachments([])}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear all
                </button>
              </div>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                >
                  <Paperclip size={16} className="text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)} • {attachment.type || 'Unknown type'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    aria-label="Remove attachment"
                  >
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={onOpenModelSelector}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              disabled={disabled}
            >
              <Cpu size={16} />
              <span>{getModelDisplayName(currentModel)}</span>
            </button>
            
            <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Paperclip size={16} />
              <span>Attach</span>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={disabled}
                className="hidden"
                accept="*/*"
              />
            </label>
            
            <button
              type="button"
              onClick={handleFolderSelect}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              disabled={disabled}
            >
              <Folder size={16} />
              <span>Folder</span>
            </button>
          </div>
          
          <div className="flex gap-3">
            <div
              className={`relative flex-1 min-h-[52px] rounded-lg border-2 border-dashed border-gray-300 ${isDragOver ? 'border-blue-500 bg-blue-50' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isDragOver ? 'Drop files or folders here...' : 'Type your message... (Shift + Enter for new line)'}
                disabled={disabled}
                rows={1}
                className="flex-1 px-4 py-3 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-all w-full h-full bg-transparent"
                style={{ minHeight: '52px', maxHeight: '200px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '52px';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-blue-50/80 rounded-lg">
                  <Paperclip size={24} className="text-blue-600 mr-2" />
                  <span className="text-blue-600 font-medium">Drop files or folders to attach</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={disabled || (!input.trim() && attachments.length === 0)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
            >
              <Send size={20} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </form>

      <FolderUploadModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onConfirm={handleFolderConfirm}
      />
    </>
  );
}