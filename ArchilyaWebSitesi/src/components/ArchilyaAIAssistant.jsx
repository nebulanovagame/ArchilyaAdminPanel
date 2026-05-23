import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Sparkles, Loader2, ChevronDown, Bot, RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';

const SALES_CONTACT_PHONE = '0 (282) 606 06 39';
const SALES_CONTACT_EMAIL = 'info@nebulanovagames.com';

const WELCOME_MESSAGE = 'Merhaba, ben Archilya satış asistanı. Archilya paketleri, özellikleri, AI Studio ve proje süreçleri konusunda hızlı yönlendirme sağlayabilirim. Özel teklif ihtiyacınız varsa sizi doğrudan satış ekibimize yönlendiririm.';

const QUICK_QUESTIONS = [
  'Paketler hakkında bilgi alabilir miyim?',
  'Studio paketi ne sunuyor?',
  'VR hizmetiniz nasıl çalışır?',
  'Abonelik fiyatları neler?',
];

const SALES_FALLBACK_MESSAGE = `Size en doğru yönlendirmeyi satış ekibimiz sağlayacaktır. Demo, teklif ve genel bilgi talepleriniz için ${SALES_CONTACT_EMAIL} veya ${SALES_CONTACT_PHONE} üzerinden bize ulaşabilirsiniz.`;

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/20">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}

      <div
        className={clsx(
          'max-w-[82%] whitespace-pre-wrap rounded-sm px-3.5 py-2.5 text-xs leading-relaxed',
          isUser
            ? 'rounded-tr-none border border-primary/25 bg-primary/15 text-gray-100'
            : 'rounded-tl-none border border-white/8 bg-white/5 text-gray-300'
        )}
      >
        {msg.text}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/20">
        <Sparkles className="h-3 w-3 text-primary" />
      </div>

      <div className="rounded-sm rounded-tl-none border border-white/8 bg-white/5 px-3.5 py-2.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-primary/60"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: index * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ArchilyaAIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'model', text: WELCOME_MESSAGE }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const responseTimerRef = useRef(null);

  const clearResponseTimer = useCallback(() => {
    if (responseTimerRef.current) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResponseTimer, [clearResponseTimer]);

  useEffect(() => {
    if (!open) return undefined;

    setUnread(false);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 280);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const resetChat = useCallback(() => {
    clearResponseTimer();
    setMessages([{ role: 'model', text: WELCOME_MESSAGE }]);
    setInput('');
    setLoading(false);
  }, [clearResponseTimer]);

  const sendMessage = useCallback((overrideText) => {
    const trimmed = (overrideText ?? input).trim();

    if (!trimmed || loading) {
      return;
    }

    clearResponseTimer();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setLoading(true);

    responseTimerRef.current = window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'model', text: SALES_FALLBACK_MESSAGE }]);
      setLoading(false);
      responseTimerRef.current = null;
    }, 450);
  }, [clearResponseTimer, input, loading]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 right-5 z-[9997] h-[520px] w-[340px] sm:w-[380px]"
          >
            <div className="glass-card flex h-full flex-col overflow-hidden rounded-sm border border-white/10 bg-background/95 shadow-[0_8px_60px_rgba(0,0,0,0.55)]">
              <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary/30 bg-primary/15">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>

                  <div>
                      <p className="text-xs font-bold tracking-wide text-white">Archilya Asistanı</p>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[9px] uppercase tracking-widest text-gray-500">Satış Yönlendirmesi</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={resetChat}
                    title="Sohbeti sıfırla"
                    className="flex h-7 w-7 items-center justify-center rounded-sm text-gray-600 transition-colors hover:bg-white/5 hover:text-gray-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-sm text-gray-600 transition-colors hover:bg-white/5 hover:text-gray-300"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((msg, index) => (
                  <MessageBubble key={`${msg.role}-${index}`} msg={msg} />
                ))}

                {loading && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </div>

              {messages.length === 1 && !loading && (
                <div className="flex flex-shrink-0 flex-wrap gap-1.5 px-4 pb-2">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendMessage(question)}
                      className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[9px] uppercase tracking-wider text-primary transition-all hover:bg-primary/15"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-shrink-0 border-t border-white/8 px-3 py-3">
                <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 transition-colors focus-within:border-primary/40">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mesajınızı yazın..."
                    disabled={loading}
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-gray-600 focus:outline-none disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-primary transition-colors hover:text-white disabled:opacity-30"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <p className="mt-1.5 text-center text-[8px] uppercase tracking-widest text-gray-700">
                  Archilya Asistanı · Satış ekibine yönlendirme sağlar
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={clsx(
          'fixed bottom-5 right-5 z-[9997] flex h-14 w-14 items-center justify-center rounded-sm border shadow-[0_4px_30px_rgba(198,168,124,0.35)] transition-colors duration-300',
          open
            ? 'border-white/20 bg-white/10'
            : 'border-primary/60 bg-primary hover:bg-primary/90'
        )}
        aria-label="Archilya Asistanı"
        data-cursor="Yardım"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <Bot className="h-6 w-6 text-black" />
              {unread && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
