import { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Settings } from '../types';
import { getUserId, supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { useNavigate } from 'react-router-dom';

function ClearDataButton({ onDataCleared }: { onDataCleared?: () => void }) {
  const navigate = useNavigate();

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all local and cloud data? This will remove all conversations, messages, and settings.')) {
      return;
    }

    try {
      const userId = await getUserId();
      if (!userId) {
        alert('No user session found.');
        return;
      }

      // Delete conversations (cascades to messages)
      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', userId);

      if (convError) throw convError;

      // Delete user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId);

      if (settingsError) throw settingsError;

      // Clear any localStorage fallbacks
      localStorage.removeItem('grok-chat-settings');
      localStorage.removeItem('grok-user-id');

      // Sign out to reset session
      await supabase.auth.signOut();

      if (onDataCleared) onDataCleared();

      alert('Data cleared successfully. Reloading...');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Check console for details.');
    }
  };

  const getStorageInfo = async () => {
    try {
      const userId = await getUserId();
      if (!userId) return 'No user session - Supabase cloud storage';
      
      // Fetch latest conversation ID safely with limit(1) and maybeSingle to avoid PGRST116 on multiple rows
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convError) {
        console.warn('Conversation fetch error in storage info:', convError);
        return 'Supabase cloud storage (no conversations yet)';
      }

      const convId = convData?.id;
      if (!convId) {
        return '0 messages stored in Supabase (no conversations yet)';
      }

      // Count messages for that conversation
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convId);

      if (error) {
        console.warn('Message count query failed:', error);
        return 'Supabase cloud storage (query error)';
      }
      
      return `${count || 0} messages stored in Supabase`;
    } catch (error) {
      console.error('Error fetching storage info:', error);
      return 'Supabase cloud storage';
    }
  };

  const [storageInfo, setStorageInfo] = useState('Loading...');

  useEffect(() => {
    getStorageInfo().then(setStorageInfo);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{storageInfo}</span>
      </div>
      <button
        type="button"
        onClick={handleClearData}
        className="text-sm text-red-600 hover:text-red-700 underline"
      >
        Clear All Data
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { settings, setSettings, isLoading: isLoadingSettings } = useSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSettings = {
      apiKey: formData.get('apiKey') as string,
      baseUrl: formData.get('baseUrl') as string,
      model: formData.get('model') as string,
    };
    
    try {
      await setSettings(newSettings);
      // Optionally navigate back after save
      // navigate('/');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header with back button */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg shadow-sm p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Get your xAI API key:</p>
            <a
              href="https://console.x.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-600"
            >
              console.x.ai
            </a>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Cloud Storage</p>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Settings and messages are stored in Supabase and synced across devices.
            </p>
            <ClearDataButton />
          </div>

          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              defaultValue={settings.apiKey}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your xAI API key"
              required
            />
          </div>

          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Base URL
            </label>
            <input
              type="text"
              id="baseUrl"
              name="baseUrl"
              defaultValue={settings.baseUrl}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="https://api.x.ai"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Default: https://api.x.ai</p>
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <select
              id="model"
              name="model"
              defaultValue={settings.model}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
              required
            >
              <option value="auto">Auto (Best Model)</option>
              <optgroup label="Grok 4">
                <option value="grok-4">Grok 4 (Latest)</option>
                <option value="grok-4-fast-reasoning">Grok 4 Fast (Reasoning)</option>
                <option value="grok-4-fast-non-reasoning">Grok 4 Fast (Non-Reasoning)</option>
              </optgroup>
              <optgroup label="Specialized">
                <option value="grok-code-fast-1">Grok Code Fast 1</option>
              </optgroup>
              <optgroup label="Grok 3">
                <option value="grok-3">Grok 3</option>
                <option value="grok-3-fast">Grok 3 Fast</option>
                <option value="grok-3-mini">Grok 3 Mini</option>
                <option value="grok-3-mini-fast">Grok 3 Mini Fast</option>
              </optgroup>
              <optgroup label="Grok 2">
                <option value="grok-2-latest">Grok 2 (Latest)</option>
                <option value="grok-2-1212">Grok 2 (December 2024)</option>
              </optgroup>
              <optgroup label="Legacy">
                <option value="grok-beta">Grok Beta</option>
              </optgroup>
            </select>
            <p className="text-xs text-gray-500 mt-1">Auto selects the best available model</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Chat
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}