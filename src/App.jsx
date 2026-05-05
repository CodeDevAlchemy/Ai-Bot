import React, { useState, useEffect } from 'react';
import { Trash2, MessageSquarePlus, Menu, X, Sun, Moon } from 'lucide-react';
import ChatBox from './components/ChatBox';
import ErrorBoundary from './components/ErrorBoundary';

const STORAGE_KEY_USER = 'onebite_user';
const STORAGE_KEY_CHATS = 'onebite_chats';

const defaultChats = [{ id: Date.now(), title: 'New Chat', messages: [] }];

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return defaultChats;
}

function App() {
  const [userName, setUserName] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('onebite_theme') || 'dark');

  const [chats, setChats] = useState(() => loadChats());
  const [activeChatId, setActiveChatId] = useState(() => {
    const loaded = loadChats();
    return loaded[0]?.id || Date.now();
  });

  // Load user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUser) {
      setUserName(storedUser);
      setIsReady(true);
    }
  }, []);

  // Apply theme
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('onebite_theme', theme);
  }, [theme]);

  // Persist chats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
    } catch (_) {}
  }, [chats]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (tempName.trim()) {
      const name = tempName.trim();
      setUserName(name);
      localStorage.setItem(STORAGE_KEY_USER, name);
      setIsReady(true);
    }
  };

  const handleDeleteUserClick = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_CHATS);
    const freshChat = { id: Date.now(), title: 'New Chat', messages: [] };
    setUserName('');
    setChats([freshChat]);
    setActiveChatId(freshChat.id);
    setIsReady(false);
    setShowDeleteConfirm(false);
    setTempName('');
  };

  const handleSetNewChat = () => {
    const newId = Date.now();
    setChats(prev => [{ id: newId, title: 'New Chat', messages: [] }, ...prev]);
    setActiveChatId(newId);
    setSidebarOpen(false);
  };

  const handleUpdateSession = (newId, newMessages, newTitle) => {
    setChats(prev => {
      const exists = prev.some(c => c.id === newId);
      if (exists) {
        return prev.map(c => c.id === newId ? {
          ...c,
          messages: newMessages,
          title: newTitle || c.title
        } : c);
      }
      return prev;
    });
  };

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation();
    setChats(prev => {
      const updated = prev.filter(c => c.id !== chatId);
      if (updated.length === 0) {
        const fresh = { id: Date.now(), title: 'New Chat', messages: [] };
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (chatId === activeChatId) setActiveChatId(updated[0].id);
      return updated;
    });
  };

  return (
    <div className="app-container">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {!isReady && (
        <div className="onboarding-overlay">
          <div className="onboarding-modal">
            <h2>Welcome to Onebite</h2>
            <p>A premium culinary AI concierge experience. What should I call you?</p>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Enter your name..."
                autoFocus
              />
              <button type="submit">Enter</button>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="onboarding-overlay" style={{ zIndex: 1100 }}>
          <div className="onboarding-modal" style={{ border: '1px solid #ff4d4d' }}>
            <h2 style={{ background: 'linear-gradient(135deg, #ff4d4d, #cc0000)', WebkitBackgroundClip: 'text' }}>
              Delete Account?
            </h2>
            <p>This will erase your name and all chat history permanently. Are you sure?</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="delete-confirm-btn" onClick={confirmDelete}>Delete Everything</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="logo">
          <span>🍽️ Onebite</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={20} />
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleSetNewChat}>
          <MessageSquarePlus size={20} />
          New Chat
        </button>

        <div className="chat-history">
          <h3>Recent Chats</h3>
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => handleSelectChat(chat.id)}
            >
              <span className="history-text">{chat.title}</span>
              <button
                className="delete-chat-btn"
                onClick={(e) => handleDeleteChat(e, chat.id)}
                title="Delete chat"
                aria-label="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {userName && (
          <div className="user-profile">
            <div className="user-info">
              <div className="user-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="user-name-display">{userName}</span>
            </div>
            <div className="user-actions">
              <button 
                className="theme-toggle-btn" 
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="delete-user-btn" onClick={handleDeleteUserClick} title="Delete Account">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="chat-area">
        <div className="chat-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="bot-status">
            <h2>Onebite</h2>
            <span><span className="online-dot"></span> Concierge Online</span>
          </div>
        </div>

        <ErrorBoundary>
          {isReady && (
            <ChatBox
              key={activeChatId}
              userName={userName}
              activeChatId={activeChatId}
              initialMessages={chats.find(c => c.id === activeChatId)?.messages || []}
              onUpdateSession={handleUpdateSession}
              onSetNewChatId={setActiveChatId}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
