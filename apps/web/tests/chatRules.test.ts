import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HALAL_NONE_CONFIRMED_TEXT, formatWaitText, notVerifiedText } from '@app/core';
import { describe, expect, it } from 'vitest';
import { formatWaitRange, HALAL_EMPTY_TEXT } from '../src/ui/dashboard/viewModel';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const chatDirectories = [
  join(webRoot, 'src', 'ui', 'chat'),
  join(webRoot, '..', '..', 'packages', 'core', 'src', 'chat'),
];

function sources(directory: string): { path: string; text: string }[] {
  return readdirSync(directory).map((name) => {
    const path = join(directory, name);
    return { path, text: readFileSync(path, 'utf8') };
  });
}

const FORBIDDEN = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'sendBeacon',
  'WebSocket',
  'XMLHttpRequest',
  'EventSource',
  'process.env',
  'import.meta.env',
  'http://',
  'https://',
  "'POST'",
  '"POST"',
  "'PUT'",
  "'PATCH'",
  "'DELETE'",
  'api/chat',
  'ANTHROPIC',
  'API_KEY',
];

describe('the chat has no network, storage or secrets beyond reading the student APIs', () => {
  it('uses none of the forbidden browser or server features in any chat source file', () => {
    for (const directory of chatDirectories) {
      for (const file of sources(directory)) {
        for (const token of FORBIDDEN) {
          expect(file.text.includes(token), `${file.path} contains ${token}`).toBe(false);
        }
      }
    }
  });

  it('calls fetch in exactly one place, and that place is a GET of a checked path', () => {
    const calls = chatDirectories.flatMap((directory) =>
      sources(directory).filter((file) => /\bfetch\(|fetcher\(/.test(file.text)),
    );
    expect(calls.map((file) => file.path.split(/[\\/]/).pop()).sort()).toEqual([
      'ChatPanel.tsx',
      'chatData.ts',
    ]);
    const data = readFileSync(join(chatDirectories[0] ?? '', 'chatData.ts'), 'utf8');
    expect(data).toContain("method: 'GET'");
    expect(data).toContain('isAllowedChatPath(request.path)');
  });

  it('has no chat route', () => {
    expect(existsSync(join(webRoot, 'src', 'app', 'api', 'chat'))).toBe(false);
  });
});

describe('the chat uses the same wording as the rest of the app', () => {
  it('says the same halal sentence as the dashboard', () => {
    expect(HALAL_NONE_CONFIRMED_TEXT).toBe(HALAL_EMPTY_TEXT);
  });

  it('writes English wait ranges like the dashboard cards', () => {
    for (const [low, high] of [
      [4.7, 8.8],
      [0, 0.4],
      [7, 7],
      [11.2, 21.9],
    ] as const) {
      expect(formatWaitText('en', low, high)).toBe(formatWaitRange(low, high));
    }
  });

  it('writes Not verified the way the dashboard chip does, with the Chinese first in Chinese', () => {
    expect(notVerifiedText('en')).toBe('Not verified');
    expect(notVerifiedText('zh_HK').startsWith('未驗證')).toBe(true);
    expect(notVerifiedText('zh_CN').startsWith('未验证')).toBe(true);
  });
});
