// input.js
import { fail } from './errors.js';
import { assertSafeUrl } from './sandbox.js';

/**
 * 输入流来源（优先级）：
 * 1. ?in= 参数（URL 或文本）
 * 2. POST/PUT/PATCH body
 * 3. 空
 */
export async function resolveInput(request, url, env) {
  const inParam = url.searchParams.get('in');

  if (inParam !== null) {
    if (/^https?:\/\//i.test(inParam)) {
      assertSafeUrl(inParam, env);
      const res = await fetch(inParam, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) fail(502, `in URL fetch failed: ${res.status}`);
      const text = await res.text();
      if (text.length > 1024 * 1024) fail(502, 'in exceeds 1MB', 'E51');
      return text;
    }
    return inParam;
  }

  const m = request.method.toUpperCase();
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    const text = await request.text();
    if (text.length > 1024 * 1024) fail(502, 'body exceeds 1MB', 'E51');
    return text;
  }

  return '';
}

/** 预填文本的输入流 */
export class InputStream {
  constructor(text = '') {
    this.text = String(text ?? '');
    this.pos = 0;
  }

  async getchar() {
    if (this.pos >= this.text.length) return -1;
    const cp = this.text.codePointAt(this.pos);
    this.pos += cp > 0xffff ? 2 : 1;
    return cp;
  }

  async readToken() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos++;
    if (this.pos >= this.text.length) return null;
    const start = this.pos;
    while (this.pos < this.text.length && !/\s/.test(this.text[this.pos])) this.pos++;
    return this.text.slice(start, this.pos);
  }
}

/**
 * 交互式输入流
 * - pushLine / finish / abort
 */
export class InteractiveInputStream {
  constructor(initial = '') {
    this.buf = String(initial ?? '');
    this.pos = 0;
    this.eof = false;
    this.aborted = false;
    this._resolvers = [];
  }

  pushLine(line) {
    if (this.aborted) return;
    const s = String(line ?? '');
    this.buf += s.endsWith('\n') ? s : s + '\n';
    this._wake();
  }

  pushText(text) {
    if (this.aborted) return;
    this.buf += String(text ?? '');
    this._wake();
  }

  finish() {
    this.eof = true;
    this._wake();
  }

  /** 强行停止：EOF + 唤醒，并标记 aborted */
  abort() {
    this.aborted = true;
    this.eof = true;
    this._wake();
  }

  _wake() {
    const rs = this._resolvers.splice(0);
    for (const r of rs) r();
  }

  _wait() {
    return new Promise((resolve) => this._resolvers.push(resolve));
  }

  async getchar() {
    while (this.pos >= this.buf.length) {
      if (this.aborted) {
        const e = new Error('execution aborted');
        e.code = 'E60';
        throw e;
      }
      if (this.eof) return -1;
      await this._wait();
    }
    if (this.aborted) {
      const e = new Error('execution aborted');
      e.code = 'E60';
      throw e;
    }
    const cp = this.buf.codePointAt(this.pos);
    this.pos += cp > 0xffff ? 2 : 1;
    return cp;
  }

  async readToken() {
    for (;;) {
      if (this.aborted) {
        const e = new Error('execution aborted');
        e.code = 'E60';
        throw e;
      }
      while (this.pos < this.buf.length && /\s/.test(this.buf[this.pos])) this.pos++;
      if (this.pos < this.buf.length) break;
      if (this.eof) return null;
      await this._wait();
    }
    const start = this.pos;
    while (this.pos < this.buf.length && !/\s/.test(this.buf[this.pos])) this.pos++;
    return this.buf.slice(start, this.pos);
  }
}
