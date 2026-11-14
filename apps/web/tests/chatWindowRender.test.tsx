import { buildReply, matchIntent, type ChatLanguage } from '@app/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatWindow, type ChatMessage } from '../src/ui/chat/ChatWindow';

const noop = (): void => undefined;

function window(language: ChatLanguage, messages: ChatMessage[], busy = false): string {
  return renderToStaticMarkup(
    <ChatWindow
      language={language}
      messages={messages}
      input=""
      busy={busy}
      onInput={noop}
      onSend={noop}
      onSuggestion={noop}
      onLanguage={noop}
      onClose={noop}
    />,
  );
}

const greeting = (language: ChatLanguage): ChatMessage => ({
  id: 1,
  from: 'bot',
  reply: buildReply(matchIntent('hello'), { nowMs: 0 }, language),
});

describe('ChatWindow when it first opens', () => {
  it('shows five suggestion buttons in the chat language, before anything is typed', () => {
    for (const [language, sample] of [
      ['en', 'Which places are open now?'],
      ['zh_HK', '現在有哪些檔口營業？'],
      ['zh_CN', '现在哪些档口营业？'],
    ] as const) {
      const html = window(language, [greeting(language)]);
      expect(html.match(/data-chat-suggestion="true"/g)).toHaveLength(5);
      expect(html).toContain(sample);
    }
  });

  it('has a language switcher that marks the chosen language, and a privacy line', () => {
    const html = window('zh_HK', [greeting('zh_HK')]);
    expect(html).toContain('data-chat-language="en"');
    expect(html).toContain('data-chat-language="zh_HK"');
    expect(html).toContain('data-chat-language="zh_CN"');
    expect(html).toMatch(
      /aria-pressed="true"[^>]*>繁|data-chat-language="zh_HK"[^>]*aria-pressed="true"/,
    );
    expect(html).toContain('不會被儲存或傳送到任何地方');
  });
});

describe('ChatWindow messages', () => {
  it('shows what the student asked, the answer lines and the answer items', () => {
    const reply = buildReply(
      matchIntent('food under 40'),
      {
        nowMs: 0,
        foods: {
          emptyState: null,
          items: [
            {
              id: 'i1',
              name: 'Noodles',
              vendorName: 'Main Canteen',
              priceHkd: 32,
              tagsStatus: 'unverified',
              wait: { lowMinutes: 5, highMinutes: 9 },
              leaveAt: 0,
              leaveNow: true,
            },
          ],
        },
      },
      'zh_CN',
    );
    const html = window('zh_CN', [
      { id: 1, from: 'user', text: '40元以内有什么吃' },
      { id: 2, from: 'bot', reply },
    ]);
    expect(html).toContain('data-chat-message="user"');
    expect(html).toContain('40元以内有什么吃');
    expect(html).toContain('data-chat-item="i1"');
    expect(html).toContain('未验证 (Not verified)');
    expect(html.match(/data-chat-suggestion="true"/g)).toHaveLength(3);
  });

  it('disables the suggestion buttons and the send button while an answer is loading', () => {
    const html = window('en', [greeting('en')], true);
    expect(html.match(/data-chat-suggestion="true"[^>]*disabled=""/g)).toHaveLength(5);
    expect(html).toMatch(
      /data-chat-send="true"[^>]*disabled=""|disabled=""[^>]*data-chat-send="true"/,
    );
  });
});
