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
  // 参数：?in=（不是 txtin）
  const inParam = url.searchParams.get('in');

  if (inParam !== null) {
    // 先判 URL
    if (/^https?:\/\//i.test(inParam)) {
      assertSafeUrl(inParam, env);
      let res;
      try {
        res = await fetch(inParam, {
          headers: { 'User-Agent': 'CppScript/14' },
          signal: AbortSignal.timeout(10000),
        });
      } catch (e) {
        fail(502, `in fetch error: ${e.message}`, 'E50');
      }
      if (!res.ok) fail(502, `in fetch failed: ${res.status}`, 'E50');
      const text = await res.text();
      if (text.length > 1024 * 1024) fail(502, 'in exceeds 1MB', 'E51');
      return text;
    }
    // 否则当作文本
    if (inParam.length > 1024 * 1024) fail(502, 'in exceeds 1MB', 'E51');
    return inParam;
  }

  // 回退 POST body
  const m = request.method.toUpperCase();
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    const text = await request.text();
    if (text.length > 1024 * 1024) fail(502, 'body exceeds 1MB', 'E51');
    return text;
  }

  return '';
}

export class InputStream {
  constructor(text) {
    this.text = text;
    this.pos = 0;
  }

  getchar() {
    if (this.pos >= this.text.length) return -1;
    const cp = this.text.codePointAt(this.pos);
    this.pos += cp > 0xffff ? 2 : 1;
    return cp;
  }

  readToken() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos++;
    if (this.pos >= this.text.length) return null;
    const start = this.pos;
    while (this.pos < this.text.length && !/\s/.test(this.text[this.pos])) this.pos++;
    return this.text.slice(start, this.pos);
  }
}