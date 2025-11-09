import { useState } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { Conversation } from '../types';
import { DeleteConversationModal } from './DeleteConversationModal';

interface ConversationsListProps {
  currentConvId: string | null;
  conversations: Conversation[];
  onSelectConv: (convId: string) => void;
  onCreateNew: () => void;
  onDeleteConv: (convId: string) => void;
  onUpdateTitle: (convId: string, title: string) => void;
}

export function ConversationsList({ 
  currentConvId, 
  conversations, 
  onSelectConv, 
  onCreateNew, 
  onDeleteConv, 
  onUpdateTitle 
}: ConversationsListProps) {
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  const handleEditStart = (conv: Conversation) => {
    setEditingConvId(conv.id);
    setEditTitle(conv.title);
  };

  const handleEditSave = (convId: string) => {
    if (editTitle.trim()) {
      onUpdateTitle(convId, editTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleDelete = (convId: string) => {
    setDeletingConvId(convId);
  };

  const confirmDelete = () => {
    if (deletingConvId) {
      onDeleteConv(deletingConvId);
      setDeletingConvId(null);
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Chats</h2>
        <button
          onClick={onCreateNew}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="New conversation"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-200">
          {conversations.map((conv) => (
            <li key={conv.id} className="relative">
              <div className={`p-4 hover:bg-gray-50 transition-colors flex items-center justify-between ${currentConvId === conv.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}>
                <div className="flex-1 min-w-0 mr-2">
                  <button
                    onClick={() => onSelectConv(conv.id)}
                    className="w-full text-left focus:outline-none"
                    aria-label={`Switch to ${conv.title}`}
                  >
                    {editingConvId === conv.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleEditSave(conv.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(conv.id);
                          if (e.key === 'Escape') setEditingConvId(null);
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    ) : (
                      <div className="truncate text-sm font-medium text-gray-900">
                        {conv.title}
                      </div>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEditStart(conv)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    aria-label="Edit title"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Empty state */}
      {conversations.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <div className="text-gray-500">
            <p className="text-sm font-medium mb-2">No conversations yet</p>
            <button
              onClick={onCreateNew}
              className="text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Start a new chat
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <DeleteConversationModal
        isOpen={!!deletingConvId}
        onClose={() => setDeletingConvId(null)}
        onConfirm={confirmDelete}
        conversationName={conversations.find(c => c.id === deletingConvId)?.title || 'this conversation'}
      />
    </div>
  );
}