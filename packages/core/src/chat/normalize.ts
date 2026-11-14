const HAN = /[一-鿿]/;

export function normalizeInput(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}$.%\s]/gu, ' ')
    .replace(/(?<![\p{N}$])\.|\.(?![\p{N}])/gu, ' ')
    .replace(/([a-z])\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokensOf(text: string): string[] {
  return text === '' ? [] : text.split(' ');
}

export function isLatinWord(token: string): boolean {
  return /^[a-z]+$/.test(token) && !HAN.test(token);
}

export function squash(word: string): string {
  return word.replace(/([a-z])\1+/g, '$1');
}
