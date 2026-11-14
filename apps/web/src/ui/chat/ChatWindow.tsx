import {
  CHAT_LANGUAGES,
  chatUiText,
  type ChatLanguage,
  type ChatReply,
  type ChatSuggestion,
} from '@app/core';
import { Button } from '../primitives';

export type ChatMessage =
  | { id: number; from: 'user'; text: string }
  | { id: number; from: 'bot'; reply: ChatReply };

const LANGUAGE_LABELS: Record<ChatLanguage, string> = {
  en: 'EN',
  zh_HK: '繁',
  zh_CN: '简',
};

export interface ChatWindowProps {
  language: ChatLanguage;
  messages: readonly ChatMessage[];
  input: string;
  busy: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  onSuggestion: (suggestion: ChatSuggestion) => void;
  onLanguage: (language: ChatLanguage) => void;
  onClose: () => void;
}

function lastSuggestions(messages: readonly ChatMessage[]): readonly ChatSuggestion[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.from === 'bot') return message.reply.suggestions;
  }
  return [];
}

export function ChatWindow(props: ChatWindowProps): React.JSX.Element {
  const text = chatUiText(props.language);
  const suggestions = lastSuggestions(props.messages);
  return (
    <section
      role="dialog"
      aria-label={text.title}
      data-chat-window
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl border border-navy/15 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[26rem] sm:rounded-2xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-navy/15 px-4 py-2.5">
        <h2 className="text-sm font-semibold">{text.title}</h2>
        <div className="flex items-center gap-1" role="group" aria-label="Language">
          {CHAT_LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              data-chat-language={language}
              aria-pressed={props.language === language}
              onClick={() => props.onLanguage(language)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                props.language === language
                  ? 'bg-navy text-cream'
                  : 'border border-navy/60 text-navy'
              }`}
            >
              {LANGUAGE_LABELS[language]}
            </button>
          ))}
          <button
            type="button"
            data-chat-close
            aria-label={text.close}
            onClick={props.onClose}
            className="ml-1 rounded-md px-2 py-1 text-sm text-navy hover:bg-navy/10"
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
        {props.messages.map((message) =>
          message.from === 'user' ? (
            <p
              key={message.id}
              data-chat-message="user"
              className="ml-auto w-fit max-w-[85%] rounded-xl bg-navy px-3 py-2 text-cream"
            >
              {message.text}
            </p>
          ) : (
            <div
              key={message.id}
              data-chat-message="bot"
              className="max-w-[92%] space-y-2 rounded-xl bg-cream px-3 py-2"
            >
              {message.reply.lines.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
              {message.reply.items.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {message.reply.items.map((item) => (
                    <li key={item.id} data-chat-item={item.id}>
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ),
        )}
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-2" data-chat-suggestions>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.query}
              type="button"
              data-chat-suggestion
              disabled={props.busy}
              onClick={() => props.onSuggestion(suggestion)}
              className="rounded-full border border-navy/60 bg-white px-3 py-1.5 text-left text-xs font-medium hover:bg-navy/10 disabled:opacity-50"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="px-4 pb-2 text-[11px] leading-snug text-muted" data-chat-privacy>
        {text.privacy}
      </p>

      <form
        className="flex gap-2 border-t border-navy/15 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSend();
        }}
      >
        <input
          data-chat-input
          value={props.input}
          onChange={(event) => props.onInput(event.target.value)}
          placeholder={text.placeholder}
          aria-label={text.placeholder}
          maxLength={300}
          className="min-w-0 flex-1 rounded-md border border-navy/60 px-3 py-2 text-sm"
        />
        <Button type="submit" data-chat-send disabled={props.busy || props.input.trim() === ''}>
          {text.send}
        </Button>
      </form>
    </section>
  );
}
