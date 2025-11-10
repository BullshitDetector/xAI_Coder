import { useRef, useEffect, useState } from 'react';
import { Settings as SettingsIcon, Loader2, AlertCircle, Menu, X } from 'lucide-react';
import { Message, FileAttachment } from './types';
import { useSettings } from './hooks/useSettings';
import { useMessages } from './hooks/useMessages';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { ProjectsList } from './components/ProjectsList';
import { ConversationsList } from './components/ConversationsList';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { SettingsPage } from './components/SettingsPage';
import { useLocation, useNavigate, Routes, Route, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { settings, setSettings, isLoading: isLoadingSettings } = useSettings();
  const { messages, conversations, currentConv, projects, currentProject, addMessage, isLoading: isLoadingMessages, switchConversation, switchProject, createConversation, createProject, deleteConversation, updateConversationTitle } = useMessages(currentConvId, currentProjectId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isSettingsPage = location.pathname === '/settings';

  // Initialize anonymous auth on mount (with graceful error handling)
  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.warn('Anonymous auth failed (likely disabled in dashboard):', error.message);
            // Fallback: Proceed without auth (app may show loading/errors on DB ops)
            // User must enable anonymous sign-ins in Supabase dashboard for full functionality
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Optionally redirect or clear state
        window.location.reload();
      }
      // Re-trigger hooks on auth change if needed
      if (isLoadingSettings || isLoadingMessages) return;
      // Settings/Messages hooks will re-run via getUserId()
    });

    return () => subscription.unsubscribe();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCreateNewProject = () => {
    createProject();
  };

  const handleSelectProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    setCurrentConvId(null); // Reset conv when switching projects
    setIsSidebarOpen(false); // Close on mobile
  };

  const handleCreateNewConv = () => {
    createConversation();
  };

  const handleSelectConv = (convId: string) => {
    setCurrentConvId(convId);
    setIsSidebarOpen(false); // Close on mobile
  };

  const handleDeleteConv = (convId: string) => {
    deleteConversation(convId);
  };

  const handleUpdateTitle = (itemId: string, newTitle: string, isProject: boolean) => {
    if (isProject) {
      // Update project title
      console.log('Update project title:', itemId, newTitle);
    } else {
      updateConversationTitle(itemId, newTitle);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('Delete this project? All conversations will be unassigned to the default project.')) {
      // Implement deletion: Delete project, set convs project_id to null or default
      console.log('Delete project:', projectId); // Placeholder - add API call
    }
  };

  const handleUpdateProjectTitle = (projectId: string, newTitle: string) => {
    // Implement API call to update project title
    console.log('Update project title:', projectId, newTitle); // Placeholder
  };

  const sendMessage = async (content: string, attachments?: FileAttachment[]) => {
    if (!settings.apiKey) {
      setError('Please configure your API key in settings');
      navigate('/settings');
      return;
    }

    if (!currentConv) {
      setError('No active conversation. Please select one.');
      return;
    }

    const userMessage: Omit<Message, 'id'> = {
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments,
    };

    try {
      await addMessage(userMessage);
    } catch (err) {
      console.error('Failed to add user message:', err);
      setError('Failed to send message');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = `${settings.baseUrl}/v1/chat/completions`;

      // Auto-select best model if "auto" is chosen
      const modelToUse = settings.model === 'auto' ? 'grok-2-latest' : settings.model;

      // Prepare messages for API (exclude attachments, use content only)
      const apiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add current message with attachments description if any
      let currentMessageContent = content;
      if (attachments && attachments.length > 0) {
        currentMessageContent += `\n\nAttached files (${attachments.length}):\n`;
        for (const attachment of attachments) {
          currentMessageContent += `- ${attachment.name} (${attachment.type}, ${attachment.size} bytes)\n`;
          
          // For text files, include content
          if (attachment.type.startsWith('text/') || 
              attachment.type === 'application/json' ||
              attachment.name.endsWith('.md') ||
              attachment.name.endsWith('.txt') ||
              attachment.name.endsWith('.js') ||
              attachment.name.endsWith('.ts') ||
              attachment.name.endsWith('.jsx') ||
              attachment.name.endsWith('.tsx') ||
              attachment.name.endsWith('.css') ||
              attachment.name.endsWith('.html') ||
              attachment.name.endsWith('.xml') ||
              attachment.name.endsWith('.yaml') ||
              attachment.name.endsWith('.yml')) {
            try {
              let textContent = '';
              if (attachment.url) {
                const response = await fetch(attachment.url);
                if (response.ok) {
                  textContent = await response.text();
                } else {
                  textContent = 'Unable to load file content';
                }
              } else if (attachment.content) {
                textContent = atob(attachment.content);
              } else {
                textContent = 'No content available';
              }
              currentMessageContent += `\nContent of ${attachment.name}:\n\`\`\`\n${textContent.substring(0, 500)}\n\`\`\`\n`;
            } catch (error) {
              console.error('Error decoding text file:', error);
              currentMessageContent += `\nContent of ${attachment.name}: (Unable to load content)\n`;
            }
          }
        }
      }

      const payload = {
        model: modelToUse,
        messages: [...apiMessages, { role: 'user', content: currentMessageContent }],
      };

      console.log('API Request:', { url: apiUrl, model: modelToUse });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);
        const errorMsg = errorData.error?.message || errorData.message || response.statusText;
        throw new Error(
          `${response.status} Error: ${errorMsg}`
        );
      }

      const data = await response.json();
      console.log('API Response:', data);

      const assistantMessage: Omit<Message, 'id'> = {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || 'No response from AI',
        timestamp: Date.now(),
      };

      await addMessage(assistantMessage);
    } catch (err) {
      console.error('Request failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const hasApiKey = Boolean(settings.apiKey);

  if (isLoadingSettings || isLoadingMessages) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {!isSettingsPage && (
        <header className="bg-white border-b shadow-sm flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Grok Chat</h1>
              <p className="text-sm text-gray-500">Powered by xAI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isSettingsPage && (
              <Link
                to="/settings"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open settings"
              >
                <SettingsIcon size={24} className="text-gray-600" />
              </Link>
            )}
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`fixed md:static inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-200 ease-in-out w-64 bg-white border-r border-gray-200`}>
          <div className="flex h-full">
            {/* Projects Sidebar */}
            <ProjectsList
              currentProjectId={currentProjectId}
              projects={projects}
              onSelectProject={handleSelectProject}
              onCreateNew={handleCreateNewProject}
              onDeleteProject={handleDeleteProject}
              onUpdateTitle={handleUpdateProjectTitle}
            />
            {/* Conversations Sidebar */}
            <ConversationsList
              currentConvId={currentConvId}
              conversations={conversations}
              onSelectConv={handleSelectConv}
              onCreateNew={handleCreateNewConv}
              onDeleteConv={handleDeleteConv}
              onUpdateTitle={handleUpdateTitle}
            />
          </div>
        </div>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!isSettingsPage && (
            <div className="border-b border-gray-200 bg-white">
              <div className="max-w-4xl mx-auto px-4 py-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentConv?.title || 'New Conversation'}
                </h2>
              </div>
            </div>
          )}

          <Routes>
            <Route
              path="/"
              element={
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-4xl mx-auto px-4 py-6">
                    {messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                            <span className="text-white font-bold text-3xl">G</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Start a conversation</h2>
                          <p className="text-gray-500 max-w-md">
                            Ask me anything! I'm Grok, powered by xAI's advanced language model.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {messages.map((message, index) => (
                          <ChatMessage key={message.id || index} message={message} />
                        ))}
                        {isLoading && (
                          <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                              <Loader2 size={18} className="text-white animate-spin" />
                            </div>
                            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </div>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>

          {!isSettingsPage && (
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading || !hasApiKey}
              currentModel={settings.model}
              onOpenModelSelector={() => setIsModelSelectorOpen(true)}
              currentProjectId={currentProjectId}
            />
          )}
        </div>
      </div>

      {!isSettingsPage && !hasApiKey && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3 text-yellow-800">
            <AlertCircle size={20} />
            <p className="text-sm">
              Please configure your API key in settings to start chatting.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="ml-auto text-yellow-600 hover:text-yellow-700 font-medium text-sm underline"
            >
              Go to Settings
            </button>
          </div>
        </div>
      )}

      {!isSettingsPage && error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3 text-red-800">
            <AlertCircle size={20} />
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-700 font-medium text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        onClose={() => setIsModelSelectorOpen(false)}
        currentModel={settings.model}
        onSelectModel={(model) => {
          setSettings({ ...settings, model });
        }}
      />
    </div>
  );
}

export default App;