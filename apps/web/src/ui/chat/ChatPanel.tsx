'use client';

import {
  buildReply,
  chatUiText,
  dataErrorReply,
  matchIntent,
  requestsFor,
  type ChatLanguage,
  type ChatReply,
  type ChatSuggestion,
} from '@app/core';
import { useRef, useState } from 'react';
import { loadChatData } from './chatData';
import { ChatWindow, type ChatMessage } from './ChatWindow';

type NewMessage = { from: 'user'; text: string } | { from: 'bot'; reply: ChatReply };

function greeting(language: ChatLanguage): ChatReply {
  return buildReply(matchIntent('hello'), { nowMs: 0 }, language);
}

export function ChatPanel({
  initialLanguage,
}: {
  initialLanguage?: ChatLanguage;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<ChatLanguage>(initialLanguage ?? 'en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);

  const push = (message: NewMessage): void => {
    const id = nextId.current;
    nextId.current += 1;
    setMessages((current) => [...current, { ...message, id }]);
  };

  function toggle(): void {
    if (!open && messages.length === 0) push({ from: 'bot', reply: greeting(language) });
    setOpen(!open);
  }

  function changeLanguage(next: ChatLanguage): void {
    setLanguage(next);
    if (messages.length === 1 && messages[0]?.from === 'bot') {
      setMessages([{ id: messages[0].id, from: 'bot', reply: greeting(next) }]);
    }
  }

  async function ask(question: string): Promise<void> {
    const text = question.trim();
    if (text === '' || busy) return;
    setInput('');
    push({ from: 'user', text });
    setBusy(true);
    const match = matchIntent(text);
    let reply: ChatReply;
    try {
      const data = await loadChatData(
        requestsFor(match),
        (path, init) => fetch(path, init),
        Date.now(),
      );
      reply = buildReply(match, data, language);
    } catch {
      reply = dataErrorReply(language);
    }
    push({ from: 'bot', reply });
    setBusy(false);
  }

  const label = chatUiText(language).open;

  return (
    <>
      {open ? null : (
        <button
          type="button"
          data-chat-open
          onClick={toggle}
          className="fixed bottom-4 right-4 z-30 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-neutral-700"
        >
          {label}
        </button>
      )}
      {open ? (
        <ChatWindow
          language={language}
          messages={messages}
          input={input}
          busy={busy}
          onInput={setInput}
          onSend={() => void ask(input)}
          onSuggestion={(suggestion: ChatSuggestion) => void ask(suggestion.query)}
          onLanguage={changeLanguage}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
