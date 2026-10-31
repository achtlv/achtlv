// lexer.js
import { err } from './errors.js';

const KEYWORDS = new Set([
  'number', 'string', 'bool', 'auto', 'void', 'struct',
  'if', 'else', 'switch', 'case', 'default',
  'for', 'while', 'break', 'continue',
  'return', 'delete', 'in', 'out', 'getchar',
  'true', 'false',
  'with', 'param', 'header', 'proxy', 'UA',
]);

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const push = (type, value) => {
    tokens.push({ type, value, line, col });
  };

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') { line++; col = 1; }
      else col++;
      i++;
    }
  };

  while (i < src.length) {
    const ch = src[i];

    // whitespace
    if (/\s/.test(ch)) { advance(); continue; }

    // comments
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') advance();
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      advance(2);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) advance();
      if (i >= src.length) err('E01', 'unclosed block comment');
      advance(2);
      continue;
    }

    // strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance();
      let value = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') {
          const next = src[i + 1];
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '/': '/' };
          if (map[next] !== undefined) { value += map[next]; advance(2); }
          else { value += next; advance(2); }
        } else {
          value += src[i];
          advance();
        }
      }
      if (i >= src.length) err('E01', 'unclosed string');
      advance();
      push('STRING', value);
      continue;
    }

    // numbers
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(src[i + 1]))) {
      let j = i;
      if (src[j] === '-') j++;
      while (j < src.length && /[0-9.eE+\-]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (Number.isNaN(value)) err('E02', `invalid number: ${raw}`);
      push('NUMBER', value);
      advance(j - i);
      continue;
    }

    // identifiers / keywords
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const value = src.slice(i, j);
      push(KEYWORDS.has(value) ? 'KEYWORD' : 'IDENT', value);
      advance(j - i);
      continue;
    }

    // multi-char operators
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    const multi = ['<<=', '>>=', '...'];
    if (multi.includes(three)) { push('OP', three); advance(3); continue; }

    const twoOps = [
      '==', '!=', '<=', '>=', '&&', '||', '<<', '>>',
      '++', '--', '+=', '-=', '*=', '/=', '%=',
      '&=', '|=', '^=',
    ];
    if (twoOps.includes(two)) { push('OP', two); advance(2); continue; }

    // single-char operators / punctuation
    if ('+-*/%<>!=&|^~(){}[];,.:?'.includes(ch)) {
      push('OP', ch);
      advance();
      continue;
    }

    err('E02', `illegal character: ${ch}`);
  }

  push('EOF', null);
  return tokens;
}