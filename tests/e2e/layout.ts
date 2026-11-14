import type { Page } from '@playwright/test';

export async function findViolations(page: Page, label: string): Promise<string[]> {
  return page.evaluate((where) => {
    const found: string[] = [];
    const width = window.innerWidth;
    const root = document.documentElement;
    if (root.scrollWidth > width + 1) {
      found.push(`${where}: the page is ${root.scrollWidth}px wide in a ${width}px window`);
    }
    const insideScroller = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const overflow = getComputedStyle(parent).overflowX;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') return true;
      }
      return false;
    };
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (style.display === 'none') continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;
      const name = `<${element.tagName.toLowerCase()} class="${String(element.className).slice(0, 60)}">`;
      if (style.position === 'fixed') {
        if (box.left < -1 || box.right > width + 1)
          found.push(`${where}: fixed ${name} leaves the window`);
      } else if (box.right > width + 1 && !insideScroller(element)) {
        found.push(`${where}: ${name} ends at ${Math.round(box.right)}px`);
      }
      if (found.length >= 6) break;
    }
    const banner = document.querySelector('[role="note"]');
    if (banner === null) {
      found.push(`${where}: the yellow banner is missing`);
    } else {
      const box = banner.getBoundingClientRect();
      if (banner.scrollWidth > banner.clientWidth + 1)
        found.push(`${where}: the banner text is clipped`);
      if (box.left < -1 || box.right > width + 1)
        found.push(`${where}: the banner leaves the window`);
    }
    return found;
  }, label);
}
