import { describe, expect, it } from 'vitest';
import {
  SIMPLIFIED_CHARACTERS,
  TRADITIONAL_CHARACTERS,
  chineseVariant,
  hasHan,
  resolveChatLanguage,
} from '../../src/chat/script.js';

describe('script detection', () => {
  it('tells Chinese from other text', () => {
    expect(hasHan('我有20分鐘')).toBe(true);
    expect(hasHan('I have 20 min')).toBe(false);
    expect(hasHan('')).toBe(false);
  });

  it('tells Traditional from Simplified by the characters that differ', () => {
    expect(chineseVariant('現在有哪些檔口營業？')).toBe('zh_HK');
    expect(chineseVariant('现在哪些档口营业？')).toBe('zh_CN');
    expect(chineseVariant('我嘅單好咗未')).toBe('zh_HK');
  });

  it('does not guess when the text is the same in both scripts or has no Chinese', () => {
    expect(chineseVariant('清真')).toBeNull();
    expect(chineseVariant('hello')).toBeNull();
    expect(chineseVariant('')).toBeNull();
  });

  it('uses the more common of the two when the text mixes them', () => {
    expect(chineseVariant('現在 现在 營業')).toBe('zh_HK');
  });

  it('keeps the two character lists apart', () => {
    for (const character of TRADITIONAL_CHARACTERS) {
      expect(SIMPLIFIED_CHARACTERS.has(character)).toBe(false);
    }
    expect(TRADITIONAL_CHARACTERS.size).toBeGreaterThan(100);
    expect(SIMPLIFIED_CHARACTERS.size).toBeGreaterThan(100);
  });

  it('answers in the selected or profile language first and detects only when there is none', () => {
    expect(resolveChatLanguage('en', '你好嗎')).toBe('en');
    expect(resolveChatLanguage('zh_CN', 'hello')).toBe('zh_CN');
    expect(resolveChatLanguage(null, 'hello')).toBe('en');
    expect(resolveChatLanguage(undefined, '现在哪些档口营业')).toBe('zh_CN');
    expect(resolveChatLanguage(null, '現在哪些檔口營業')).toBe('zh_HK');
    expect(resolveChatLanguage(null, '清真')).toBe('zh_HK');
  });
});
