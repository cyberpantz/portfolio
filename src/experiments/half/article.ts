/**
 * Reads article.md into blocks, and renders a field's text as React.
 *
 * The format is described at the top of article.md. The renderer accepts a
 * short list of HTML tags and two of its own (<cite>, <signers>); anything
 * else throws, naming the tag, so a typo fails the suite instead of shipping.
 * No dangerouslySetInnerHTML: every element is built by React.
 */
import { createElement, Fragment, type ReactNode } from 'react';

export type Block = { kind: string; id: string | null; fields: Record<string, string> };

/* A field line starts with one of these names. Anything else is text. */
const FIELDS = new Set([
  'kicker', 'title', 'body', 'figure', 'interactive', 'standfirst', 'credit', 'heading', 'term',
  'trigger', 'caption', 'pledgers', 'paidOut', 'carried', 'scoredOne',
]);

export function parseArticle(raw: string): Block[] {
  const text = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n');
  const blocks: Block[] = [];
  let block: Block | null = null;
  let field: string | null = null;
  for (const line of text.split('\n')) {
    const head = line.match(/^===\s+(\S+)(?:\s+(\S+))?\s*$/);
    if (head) {
      block = { kind: head[1], id: head[2] ?? null, fields: {} };
      blocks.push(block);
      field = null;
      continue;
    }
    const f = line.match(/^([a-zA-Z]+):\s?(.*)$/);
    if (f && FIELDS.has(f[1])) {
      if (!block) throw new Error(`article.md: field "${f[1]}" before any === block`);
      field = f[1];
      block.fields[field] = f[2];
      continue;
    }
    if (block && field) block.fields[field] += '\n' + line;
    else if (line.trim()) throw new Error(`article.md: stray text outside a field: "${line.slice(0, 60)}"`);
  }
  for (const b of blocks) for (const k of Object.keys(b.fields)) b.fields[k] = b.fields[k].trim();
  return blocks;
}

/* ---------------------------------------------------------------- values */

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace {name} and {name|cap}. An unknown name throws. */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z]\w*)(\|cap)?\}/g, (_, name: string, cap?: string) => {
    if (!(name in values)) throw new Error(`article.md: no value named {${name}} — add it to values.ts`);
    const v = values[name];
    return escape(cap ? v.replace(/^\w/, (c) => c.toUpperCase()) : v);
  });
}

/* ------------------------------------------------------------------ HTML */

/* Allowed tags and, for each, the attributes it may carry. */
const TAGS: Record<string, string[]> = {
  em: [], strong: [], b: [], i: [], code: [], q: [], sup: [], sub: [], small: [], br: [],
  a: ['href', 'title'], abbr: ['title'],
};
const VOID = new Set(['br']);

export type Custom = {
  cite: (src: string, key: string) => ReactNode;
  signers?: (key: string) => ReactNode;
};

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(1).replace(/^x/i, ''), e[1] === 'x' || e[1] === 'X' ? 16 : 10))
  : ENT[e] ?? m);

type Node = { tag: string; attrs: Record<string, string>; kids: (Node | string)[] };

function tree(html: string): Node {
  const root: Node = { tag: '#root', attrs: {}, kids: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)|(<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[5] != null) { top.kids.push(decode(m[5])); continue; }
    if (m[6] != null) throw new Error(`article.md: a bare "<" — write &lt; — near "${html.slice(m.index, m.index + 40)}"`);
    const [, close, name, attrText, selfClose] = m;
    const tag = name.toLowerCase();
    if (close) {
      if (top.tag !== tag) throw new Error(`article.md: </${tag}> closes <${top.tag}> near "${html.slice(m.index, m.index + 40)}"`);
      stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of attrText.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? '');
    const node: Node = { tag, attrs, kids: [] };
    top.kids.push(node);
    if (!selfClose && !VOID.has(tag) && tag !== 'cite' && tag !== 'signers') stack.push(node);
  }
  if (stack.length > 1) throw new Error(`article.md: <${stack[stack.length - 1].tag}> is never closed`);
  return root;
}

function build(n: Node | string, key: string, custom: Custom): ReactNode {
  if (typeof n === 'string') return n;
  const kids = n.kids.map((k, i) => build(k, `${key}.${i}`, custom));
  if (n.tag === '#root') return createElement(Fragment, { key }, ...kids);
  if (n.tag === 'cite') {
    if (!n.attrs.src) throw new Error('article.md: <cite> needs src="source-id"');
    return custom.cite(n.attrs.src, key);
  }
  if (n.tag === 'signers') {
    if (!custom.signers) throw new Error('article.md: <signers/> is only allowed in the pledge note');
    return custom.signers(key);
  }
  const allowed = TAGS[n.tag];
  if (!allowed) throw new Error(`article.md: <${n.tag}> is not an allowed tag`);
  const props: Record<string, string> = { key };
  for (const [k, v] of Object.entries(n.attrs)) {
    if (!allowed.includes(k)) throw new Error(`article.md: <${n.tag} ${k}=…> is not an allowed attribute`);
    if (k === 'href' && /^\s*javascript:/i.test(v)) throw new Error('article.md: javascript: links are not allowed');
    props[k] = v;
  }
  if (n.tag === 'a' && /^https?:/.test(n.attrs.href ?? '')) props.rel = 'noopener';
  return createElement(n.tag, props, ...(VOID.has(n.tag) ? [] : kids));
}

/** One field's text, inline: values filled, tags turned into elements. */
export function inline(text: string, values: Record<string, string>, custom: Custom, key = 'r'): ReactNode {
  return build(tree(fill(text, values)), key, custom);
}

/**
 * A body: blank lines separate paragraphs. A paragraph that is only a block
 * component (<signers/>) is rendered as that component, not inside a <p>.
 */
export function paragraphs(text: string, values: Record<string, string>, custom: Custom, key = 'p'): ReactNode[] {
  return text.split(/\n\s*\n/).map((para, i) => {
    const t = para.trim().replace(/\s*\n\s*/g, ' ');
    if (/^<signers\s*\/?>$/.test(t)) {
      if (!custom.signers) throw new Error('article.md: <signers/> is only allowed in the pledge note');
      return custom.signers(`${key}${i}`);
    }
    return createElement('p', { key: `${key}${i}` }, inline(t, values, custom, `${key}${i}`));
  });
}

/* --------------------------------------------------------------- lookups */

export function one(blocks: Block[], kind: string): Block {
  const b = blocks.filter((x) => x.kind === kind);
  if (b.length !== 1) throw new Error(`article.md: expected one "=== ${kind}" block, found ${b.length}`);
  return b[0];
}
export function need(b: Block, field: string): string {
  const v = b.fields[field];
  if (v == null || v === '') throw new Error(`article.md: "=== ${b.kind}${b.id ? ' ' + b.id : ''}" needs a "${field}:" field`);
  return v;
}
