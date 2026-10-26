import { describe, expect, it } from 'vitest';
import { parseInline, parseSummary } from './summary-markdown';

describe('parseInline', () => {
  it('splits out bold runs', () => {
    expect(parseInline('Spent **€200.10** on **groceries**.')).toEqual([
      { text: 'Spent ' },
      { text: '€200.10', bold: true },
      { text: ' on ' },
      { text: 'groceries', bold: true },
      { text: '.' },
    ]);
  });

  it('drops links, code and italic markers but keeps the words', () => {
    expect(parseInline('See [the plan](https://example.com) and `this`, *really*.')).toEqual([
      { text: 'See the plan and this, really.' },
    ]);
  });

  it('leaves HTML as text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ text: '<img src=x onerror=alert(1)>' }]);
  });
});

describe('parseSummary', () => {
  it('reads headings, paragraphs and lists', () => {
    const blocks = parseSummary([
      '### Overview',
      'You spent most on groceries.',
      'Tesco came top.',
      '',
      '**Where to save:**',
      '- Buy own brand',
      '- Batch cook',
      '  on Sundays',
      '',
      '1. First',
      '2. Second',
    ].join('\n'));

    expect(blocks).toEqual([
      { type: 'heading', content: [{ text: 'Overview' }] },
      { type: 'paragraph', content: [{ text: 'You spent most on groceries. Tesco came top.' }] },
      { type: 'heading', content: [{ text: 'Where to save' }] },
      { type: 'list', ordered: false, items: [[{ text: 'Buy own brand' }], [{ text: 'Batch cook on Sundays' }]] },
      { type: 'list', ordered: true, items: [[{ text: 'First' }], [{ text: 'Second' }]] },
    ]);
  });

  it('ends a list at an unindented line', () => {
    expect(parseSummary('- One\nAfter')).toEqual([
      { type: 'list', ordered: false, items: [[{ text: 'One' }]] },
      { type: 'paragraph', content: [{ text: 'After' }] },
    ]);
  });

  it('is empty for an empty string', () => {
    expect(parseSummary('')).toEqual([]);
  });
});
