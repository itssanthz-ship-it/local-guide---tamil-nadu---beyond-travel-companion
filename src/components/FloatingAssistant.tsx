import React, { useState } from 'react';
import { MessageCircle, X, Send, Compass } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface FloatingAssistantProps {
  language: Language;
  currentDistrict: string;
  travelGroupLabel: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
}

export default function FloatingAssistant({
  language,
  currentDistrict,
  travelGroupLabel,
}: FloatingAssistantProps) {
  const t = TRANSLATIONS[language];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: t.assistantWelcome },
  ]);

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || loading) return;
    if (!textToSend) setInput('');

    const nextHistory: ChatMsg[] = [...messages, { role: 'user', text: content }];
    setMessages(nextHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          language,
          currentDistrict,
          travelGroup: travelGroupLabel,
          history: nextHistory,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            data.reply ||
            (language === 'ta'
              ? 'தற்போது பதில் கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.'
              : 'Unable to respond right now. Please try again.'),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            language === 'ta'
              ? 'ஆஃப்லைன் நிலை: மேலே உள்ள ஆஃப்லைன் தேடல் மூலம் சேமிக்கப்பட்ட இடங்களைக் காணலாம்.'
              : 'Offline right now. Use the Offline Cache filter above to search saved stays, hospitals, and attractions.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts =
    language === 'ta'
      ? [
          'பயணம் 2 மணி நேரம் தாமதம்; திட்டத்தை மாற்று',
          'அருகிலுள்ள மருத்துவமனைகள் & உணவகங்கள்',
          'குடும்பத்திற்கு ஏற்ற அமைதியான இடங்கள்',
        ]
      : [
          'Delayed by 2 hours — adjust today',
          'Nearby hospitals & family food',
          'Suggest quieter spots near me',
        ];

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 flex h-[460px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[380px]">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{t.assistantTitle}</p>
                <p className="text-[11px] text-slate-300">
                  {currentDistrict || 'Tamil Nadu'} · {language === 'ta' ? 'தமிழ்' : 'EN'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close AI companion"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-blue-800 text-white'
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="max-w-[70%] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-500">
                {language === 'ta' ? 'சிந்திக்கிறது...' : 'Checking local guide data...'}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-slate-200 bg-white px-3 py-2">
            {quickPrompts.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => sendMessage(qp)}
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                {qp}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.assistantPlaceholder}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-800 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={t.assistantSend}
              className="rounded-lg bg-blue-800 p-2 text-white hover:bg-blue-900 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.assistantTitle}
        className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] hover:bg-blue-900"
      >
        <MessageCircle className="h-5 w-5 text-amber-400" />
        <span className="hidden sm:inline whitespace-nowrap">{t.assistantTitle}</span>
      </button>
    </div>
  );
}
