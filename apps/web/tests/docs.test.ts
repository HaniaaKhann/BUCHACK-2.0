import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { accuracySchema } from '../src/server/accuracy';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8');

const readme = read('README.md');
const docFiles = readdirSync(join(root, 'docs'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => join('docs', name));
const allDocs = ['README.md', ...docFiles];

function section(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return text.slice(from, to);
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return entry === 'route.ts' ? [path] : [];
  });
}

const snake = (name: string): string =>
  name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

describe('README accuracy section', () => {
  const data = accuracySchema.parse(JSON.parse(read('apps', 'web', 'public', 'accuracy.json')));
  const names = new Map(data.models.map((model) => [model.id, model.name]));
  const accuracy = section(readme, '## Accuracy', '## Architecture').replace(/ {2,}/g, ' ');

  const rows = (
    metrics: typeof data.overall.trueReady,
    weekLabel?: string,
  ): { cells: string[] }[] =>
    (['historical', 'backlog', 'full'] as const).map((id) => {
      const entry = metrics[id];
      const cells = [
        ...(weekLabel === undefined ? [] : [weekLabel]),
        names.get(id) ?? id,
        String(entry.n),
        (entry.maeMinutes ?? 0).toFixed(2),
        `${((entry.onTimeRate ?? 0) * 100).toFixed(1)}%`,
      ];
      return { cells };
    });

  const expected = [
    ...rows(data.overall.trueReady),
    ...rows(data.overall.tap),
    ...data.byWeekType.flatMap((week) =>
      rows(week.trueReady, week.weekType === 'exam' ? 'Exam week' : 'Teaching week'),
    ),
  ];

  it('shows exactly the numbers in accuracy.json, row by row', () => {
    for (const row of expected) {
      expect(accuracy, row.cells.join(' | ')).toContain(`| ${row.cells.join(' | ')} |`);
    }
    expect(expected.length).toBe(12);
  });

  it('says in plain words that the data is simulated and that no real measurements exist', () => {
    expect(accuracy).toContain(
      'These numbers come from simulated data, not real canteen measurements.',
    );
    expect(accuracy).toContain('There are no real measurements yet');
  });
});

describe('README claims', () => {
  it('links both cited sources', () => {
    expect(readme).toContain(
      'https://dailybruin.com/post/students-air-frustrations-with-ucla-dinings-switch-to-mobile-ordering',
    );
    expect(readme).toContain('https://nyunews.com/opinion/2023/03/10/awful-wait-times-nyu-eats');
    expect(readme).toContain('Not affiliated with HKBU Estates Office or its caterers.');
  });

  it('marks every unfinished item as a placeholder', () => {
    for (const marker of ['[DEMO_VIDEO_LINK]', '[DEMO_GIF]', '[TEAM_SIZE_AND_SKILLS]']) {
      expect(readme, marker).toContain(`\`${marker}\` (placeholder`);
    }
    for (const marker of ['[SURVEY_RESULTS]', '[THEME]', '[LICENSE]']) {
      expect(readme, marker).not.toContain(marker);
    }
  });

  it('states the theme, the survey position and the licence', () => {
    expect(readme).toContain('Theme: data driven apps. UniBowl combines');
    expect(readme).toContain(
      'We have not run a student survey yet, so no student numbers are claimed.',
    );
    expect(readme).toContain('stopwatch sample');
    expect(readme).toContain('Team ByteNBite.');
    expect(readme).toContain('MIT. See [`LICENSE`](LICENSE).');
    expect(read('LICENSE')).toContain('MIT License');
    expect(read('LICENSE')).toContain('Copyright (c) 2026 ByteNBite');
  });

  it('uses the product name UniBowl and the old name nowhere', () => {
    expect(readme.startsWith('# UniBowl\n')).toBe(true);
    for (const file of [...allDocs, 'CONTRIBUTING.md', join('apps', 'web', 'src', 'brand.ts')]) {
      expect(read(file), file).not.toMatch(/readyby/i);
    }
  });

  it('keeps unbuilt features out of the feature list and in the roadmap', () => {
    const features = section(readme, '## What it does today', '## How it differs');
    for (const word of [
      'photo import',
      'web push',
      'promotion',
      'reward',
      'insights',
      'back in stock',
      'platform sync',
    ]) {
      expect(features.toLowerCase(), word).not.toContain(word);
    }
    const roadmap = readme.slice(readme.indexOf('## Roadmap'));
    for (const word of [
      'Menu photo import',
      'web push',
      'promotions',
      'rewards',
      'vendor insights',
      'back in stock',
    ]) {
      expect(roadmap, word).toContain(word);
    }
  });

  it('has no leftover template text or broken badge', () => {
    expect(readme).not.toContain('OWNER/REPO');
    expect(readme).not.toContain('milestone M0');
    expect(readme).toContain('github.com/HaniaaKhann/BUCHACK-2.0/actions/workflows/ci.yml');
  });
});

describe('every document', () => {
  it('does not mention the tools, notes or briefs used to build the project', () => {
    for (const file of allDocs) {
      expect(read(file), file).not.toMatch(/claude|\.private|the brief|ai coding|AI_USAGE/i);
    }
  });

  it('only links to files that exist', () => {
    for (const file of allDocs) {
      const text = read(file);
      for (const match of text.matchAll(/\]\((?!https?:|#|mailto:)([^)]+)\)/g)) {
        const target = resolve(root, dirname(file), (match[1] ?? '').split('#')[0] ?? '');
        expect(existsSync(target), `${file} links to ${relative(root, target)}`).toBe(true);
      }
    }
  });

  it('puts mermaid diagrams only in fenced blocks that close', () => {
    for (const file of allDocs) {
      const text = read(file);
      const opens = (text.match(/```mermaid/g) ?? []).length;
      const fences = (text.match(/^```/gm) ?? []).length;
      expect(fences % 2, file).toBe(0);
      expect(opens, file).toBeLessThanOrEqual(fences / 2);
    }
    expect(read('docs', 'ARCHITECTURE.md')).toContain('```mermaid');
  });
});

describe('docs/API.md', () => {
  const api = read('docs', 'API.md');
  const apiRoot = join(root, 'apps', 'web', 'src', 'app', 'api');

  it('mentions every route file that exists', () => {
    for (const file of routeFiles(apiRoot)) {
      const route = relative(apiRoot, dirname(file)).replace(/\\/g, '/');
      const path =
        route === 'auth/[...all]'
          ? '/api/auth/'
          : `/api/${route.replace(/\[([a-zA-Z]+)\]/g, ':$1')}`;
      const words = path.replace(
        '/api/vendor/:id/orders/:orderId/:action',
        '/api/vendor/:id/orders/:orderId/:action',
      );
      expect(api, words).toContain(words);
    }
  });

  it('documents no route that does not exist', () => {
    const existing = new Set(
      routeFiles(apiRoot).map(
        (file) =>
          `/api/${relative(apiRoot, dirname(file))
            .replace(/\\/g, '/')
            .replace(/\[([a-zA-Z]+)\]/g, ':$1')}`,
      ),
    );
    existing.add('/api/auth/sign-up/email');
    existing.add('/api/auth/sign-in/email');
    existing.add('/api/auth/sign-out');
    existing.add('/api/auth/get-session');
    existing.add('/api/auth/delete-user');
    for (const match of api.matchAll(/`(?:GET|POST|PATCH|PUT|DELETE) (\/api\/[^` ?]+)/g)) {
      expect(existing.has(match[1] ?? ''), `${match[1]} is not a route`).toBe(true);
    }
  });
});

describe('docs/PRIVACY.md', () => {
  const privacy = read('docs', 'PRIVACY.md');
  const schema = read('packages', 'db', 'prisma', 'schema.prisma');

  it('names every table in the schema', () => {
    const tables = [...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((match) => match[1] ?? '');
    expect(tables.length).toBeGreaterThan(20);
    for (const table of tables) expect(privacy, table).toContain(table);
  });

  it('names every column of the tables that hold personal data', () => {
    const personal = [
      'User',
      'Account',
      'Session',
      'StudentProfile',
      'FreeWindow',
      'Order',
      'OrderItem',
      'WalletLedger',
      'Notification',
    ];
    for (const model of personal) {
      const body = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      const fields = body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^[a-z][A-Za-z]*\s/.test(line) && !line.includes('@relation'))
        .map((line) => line.split(/\s+/)[0] ?? '')
        .filter((field) => !/^[A-Z]/.test(field));
      const scalars = fields.filter(
        (field) => !body.includes(`${field} ${field[0]?.toUpperCase()}${field.slice(1)}[]`),
      );
      for (const field of scalars) {
        if (
          [
            'sessions',
            'accounts',
            'orders',
            'items',
            'memberships',
            'notifications',
            'walletLedger',
            'freeWindows',
            'profile',
          ].includes(field)
        )
          continue;
        expect(privacy, `${model}.${field}`).toContain(snake(field));
      }
    }
  });

  it('says what deletion removes and that past orders are deleted, not anonymised', () => {
    expect(privacy).toContain('Past orders are deleted, not anonymised.');
    expect(privacy).toContain('cannot be deleted at all');
  });
});
