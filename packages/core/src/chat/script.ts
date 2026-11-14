import type { ChatLanguage } from './types.js';

const TRADITIONAL_ONLY =
  '們這個為說會來時學開關點後麼還過對實現發見認讓應當從師錢買賣貴價單訂營業檔蘭飲雞豬魚蝦鮮湯飯無質麩圖書長門間問題難熱號灣車輛錯鐘鍵館預檢驗級紙經結給網線練總該話讀調論誰謝識記設許請諸課費資賬賽趕輸運遠邊選醫鐵銀隊陽雙雜離電霧風飛養馬驚鳥麗麵嘅咗啲唔冇嘢睇俾哋乜咩嚟';

const SIMPLIFIED_ONLY =
  '们这个为说会来时学开关点么还过对实现发见认让应当从师钱买卖贵价单订营业档兰饮鸡猪鱼虾鲜汤饭无质麸图书长门间问题难热号湾车辆错钟键馆预检验级纸经结给网线练总该话读调论谁谢识记设许请诸课费资账赛赶输运远边选医铁银队阳双杂离电雾风飞养马惊鸟丽';

export const TRADITIONAL_CHARACTERS: ReadonlySet<string> = new Set([...TRADITIONAL_ONLY]);
export const SIMPLIFIED_CHARACTERS: ReadonlySet<string> = new Set([...SIMPLIFIED_ONLY]);

const HAN = /[一-鿿]/;

export function hasHan(text: string): boolean {
  return HAN.test(text);
}

export function chineseVariant(text: string): 'zh_HK' | 'zh_CN' | null {
  let traditional = 0;
  let simplified = 0;
  for (const character of text) {
    if (TRADITIONAL_CHARACTERS.has(character)) traditional += 1;
    else if (SIMPLIFIED_CHARACTERS.has(character)) simplified += 1;
  }
  if (traditional === simplified) return null;
  return traditional > simplified ? 'zh_HK' : 'zh_CN';
}

export function resolveChatLanguage(
  selected: ChatLanguage | null | undefined,
  text: string,
): ChatLanguage {
  if (selected) return selected;
  if (!hasHan(text)) return 'en';
  return chineseVariant(text) ?? 'zh_HK';
}
