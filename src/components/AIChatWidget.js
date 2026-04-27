'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import styles from './AIChatWidget.module.css';

const PREWRITTEN_QUESTIONS = [
  "Summarize my active leads.",
  "Which properties are currently available?",
  "Do I have any follow-ups today?"
];

export default function AIChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI Assistant. How can I help you with your CRM today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [crmContext, setCrmContext] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      if (!crmContext && user) fetchContext();
    }
  }, [isOpen, messages]);

  const fetchContext = async () => {
    try {
      const { data: leads } = await supabase.from('leads').select('status').eq('user_id', user.id);
      const { data: props } = await supabase.from('properties').select('status, title').eq('user_id', user.id);
      const { data: followups } = await supabase.from('follow_ups').select('follow_up_date, title').eq('user_id', user.id);
      
      const activeLeads = leads?.filter(l => l.status !== 'won' && l.status !== 'lost').length || 0;
      const totalLeads = leads?.length || 0;
      const availableProps = props?.filter(p => p.status === 'available').length || 0;
      
      const today = new Date().toDateString();
      const todaysFollowups = followups?.filter(f => new Date(f.follow_up_date).toDateString() === today).length || 0;

      const summary = `
- Total Leads: ${totalLeads}
- Active Leads: ${activeLeads}
- Available Properties: ${availableProps}
- Follow-ups scheduled for today: ${todaysFollowups}
      `;
      setCrmContext(summary);
    } catch (err) {
      console.error("Failed to fetch CRM context for AI", err);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.slice(1), userMsg], // skip initial greeting
          context: crmContext
        })
      });

      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I ran into an error." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI service." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.widgetContainer}>
      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div className={styles.headerTitle}>
              <span>✨</span> AI Assistant
            </div>
            <button className={styles.closeButton} onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          <div className={styles.chatMessages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.message} ${styles[m.role]}`}>
                {m.content}
              </div>
            ))}
            
            {messages.length === 1 && (
              <div className={styles.prewrittenContainer}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Try asking:</p>
                {PREWRITTEN_QUESTIONS.map((q, i) => (
                  <button 
                    key={i} 
                    className={styles.prewrittenBtn}
                    onClick={() => sendMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <div className={styles.typingIndicator}>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.chatInputArea}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
              disabled={isLoading}
            />
            <button 
              className={styles.sendButton} 
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button className={styles.fab} onClick={() => setIsOpen(true)}>
          ✨
        </button>
      )}
    </div>
  );
}
