import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Trash2, 
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { 
  NovaMessage, 
  sendNovaMessage, 
  selectPatientProfile 
} from '@/lib/nova/novaService';
import { PatientSelectCard } from './PatientSelectCard';
import { PatientSummaryCard } from './PatientSummaryCard';
import { RichMarkdownContent } from './RichMarkdownContent';

interface PrescriptoNovaProps {
  clinicId?: string;
}

const QUICK_PROMPTS = [
  { label: 'Search Patient', prompt: 'Search patient ' },
  { label: 'What’s new in v1.4?', prompt: 'What are the new features in v1.4?' },
  { label: 'Print Prescription Guide', prompt: 'How to print a prescription from print queue?' },
  { label: 'TV Display Chime', prompt: 'How does TV display token chime work?' },
  { label: 'Register Patient', prompt: 'How to register a new patient?' },
];

const STORAGE_SESSION_KEY = 'prescripto_nova_active_session';
const STORAGE_OPEN_KEY = 'prescripto_nova_active_open';
const STORAGE_RELOAD_HANDLED_KEY = 'prescripto_nova_reload_handled';

// Unique instance ID for this specific page lifecycle
const PAGE_INSTANCE_ID = (typeof window !== 'undefined' && (window as any).__prescripto_page_instance) ||
  (() => {
    const id = Math.random().toString(36).substring(2, 9);
    if (typeof window !== 'undefined') (window as any).__prescripto_page_instance = id;
    return id;
  })();

// Check if this was a fresh browser reload (F5 / browser refresh)
// If so, clear previous session ONCE per document reload
(() => {
  try {
    const nav = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const isHardReload = nav.length > 0 && nav[0].type === 'reload';
    const lastHandledInstance = sessionStorage.getItem(STORAGE_RELOAD_HANDLED_KEY);

    if (isHardReload && lastHandledInstance !== PAGE_INSTANCE_ID) {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
      sessionStorage.removeItem(STORAGE_OPEN_KEY);
      sessionStorage.setItem(STORAGE_RELOAD_HANDLED_KEY, PAGE_INSTANCE_ID);
    }
  } catch {}
})();

export const PrescriptoNova: React.FC<PrescriptoNovaProps> = ({ clinicId }) => {
  const { user, profile, roles } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();

  const doctorName = profile?.full_name ? profile.full_name : 'Doctor';
  const initialGreeting: NovaMessage = {
    id: 'init-1',
    sender: 'assistant',
    text: `Good day, ${doctorName}. Nova by Zevox is ready to assist with clinical records, patient search, and system navigation.`,
    timestamp: new Date()
  };

  // 1. Open State - persists across in-app navigation and tab switches
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_OPEN_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // 2. Chat Messages - persists across in-app navigation and tab switching, resets only on F5 refresh
  const [messages, setMessages] = useState<NovaMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      }
    } catch {}
    return [initialGreeting];
  });

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeClinicId = clinicId || profile?.clinic_id;

  // Persist session to sessionStorage across in-app navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_OPEN_KEY, String(isOpen));
    } catch {}
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isTyping) return;

    const userMsg: NovaMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendNovaMessage(
        text,
        {
          clinicId: activeClinicId,
          slug,
          userRole: profile?.role || roles[0],
          doctorName: profile?.full_name
        },
        messages
      );

      setMessages(prev => [...prev, response]);
    } catch (err) {
      console.error('[Nova UI] Error sending query:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Encountered a temporary issue processing your query. Please try again.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSelectPatient = async (patientId: string) => {
    setIsTyping(true);
    try {
      const response = await selectPatientProfile(patientId, activeClinicId, slug);
      setMessages(prev => [...prev, response]);
    } catch (err) {
      console.error('[Nova UI] Error selecting patient:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    const freshInit: NovaMessage[] = [
      {
        id: `init-${Date.now()}`,
        sender: 'assistant',
        text: `Chat cleared. Nova by Zevox is ready for your next query, ${doctorName}.`,
        timestamp: new Date()
      }
    ];
    setMessages(freshInit);
    try {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {}
  };

  return (
    <>
      {/* Floating Action Button (FAB) - Clean Nova by Zevox with generous edge margin */}
      <div className="fixed bottom-24 right-6 sm:right-10 md:bottom-8 md:right-16 lg:right-24 xl:right-28 z-40 select-none">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Open Nova by Zevox"
          className="relative group flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl border border-slate-700/50 dark:border-slate-200/50 backdrop-blur-xl"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold tracking-tight">
            Nova
          </span>
        </motion.button>
      </div>

      {/* Slide-out Window with generous breathing room from right edge */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="fixed bottom-24 right-6 sm:right-10 md:right-16 lg:right-24 xl:right-28 md:bottom-22 z-50 w-[calc(100vw-3rem)] sm:w-[395px] max-w-[420px] h-[580px] max-h-[80vh] flex flex-col rounded-3xl bg-white/98 dark:bg-slate-950/98 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden font-sans"
          >
            {/* Header: Clean Nova by Zevox Branding */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                      Nova
                    </h3>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      by Zevox
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Clinical Operations & Intelligence
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  title="Close Nova"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Prompt Suggestions - Scrollbar fully hidden */}
            <div className="px-3 py-2 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/40 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex items-center gap-1.5 shrink-0">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (qp.prompt.endsWith(' ')) {
                      setInputValue(qp.prompt);
                      inputRef.current?.focus();
                    } else {
                      handleSendMessage(qp.prompt);
                    }
                  }}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-xl whitespace-nowrap bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 hover:border-slate-400 dark:hover:border-slate-500 transition-all active:scale-95 shrink-0"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`${msg.sender === 'user' ? 'max-w-[85%]' : 'max-w-[94%]'} p-3.5 rounded-2xl leading-relaxed break-words ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-br-xs shadow-sm font-medium whitespace-pre-wrap'
                        : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-bl-xs border border-slate-200/70 dark:border-slate-700/70'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      msg.text
                    ) : (
                      <RichMarkdownContent content={msg.text} slug={slug} />
                    )}
                  </div>

                  {/* Candidate Patient Selection Cards */}
                  {msg.patientCards && msg.patientCards.length > 0 && (
                    <div className="w-full mt-2.5 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Select Matching Patient:
                      </p>
                      {msg.patientCards.map((p) => (
                        <PatientSelectCard
                          key={p.id}
                          patient={p}
                          onSelect={handleSelectPatient}
                          disabled={isTyping}
                        />
                      ))}
                    </div>
                  )}

                  {/* Patient Detailed Profile Card */}
                  {msg.patientDetail && (
                    <div className="w-full mt-2.5">
                      <PatientSummaryCard
                        detail={msg.patientDetail}
                        slug={slug}
                        onClose={() => setIsOpen(false)}
                      />
                    </div>
                  )}

                  {/* Action Navigation Link */}
                  {msg.actionLink && (
                    <button
                      onClick={() => {
                        navigate(msg.actionLink!.path);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-[11px] font-bold transition-all border border-slate-300 dark:border-slate-700"
                    >
                      <span>{msg.actionLink.label}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}

                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Typing Loader */}
              {isTyping && (
                <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                  <div className="flex gap-1 items-center bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 dark:bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 dark:bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 dark:bg-slate-300 animate-bounce" />
                  </div>
                  <span className="text-[10px] italic">Nova is thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-2.5 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/70 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question or search patient..."
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
