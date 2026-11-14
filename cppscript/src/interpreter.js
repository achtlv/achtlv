// interpreter.js
import { err, fail } from './errors.js';
import { Deque, ListContainer, SetContainer, MultiSetContainer, MapContainer, MultiMapContainer } from './containers.js';
import { doRequest, normalizeReturnUrl } from './request.js';
import { assertSafeUrl } from './sandbox.js';

/* ---------- 引用 Box ---------- */
class RefBox {
  constructor(getter, setter, type, readonly = false) {
    this._get = getter;
    this._set = setter;
    this.type = type;
    this.readonly = readonly;
  }
  get() { return this._get(); }
  set(v) {
    if (this.readonly) fail(400, 'cannot modify readonly binding', 'E49');
    this._set(v);
  }
}

class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.vars = new Map();
  }
  has(name) {
    if (this.vars.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }
  set(name, v) {
    if (this.vars.has(name)) { this.vars.set(name, v); return true; }
    if (this.parent) return this.parent.set(name, v);
    return false;
  }
  declare(name, v) { this.vars.set(name, v); }
  delete(name) {
    if (this.vars.has(name)) { this.vars.delete(name); return true; }
    if (this.parent) return this.parent.delete(name);
    return false;
  }
}

class ReturnSignal {
  constructor(value, mods) { this.value = value; this.mods = mods; }
}
class BreakSignal {}
class ContinueSignal {}

const MAX_LOOP = 10000;
const MAX_RECURSION = 100;
const MAX_FETCH = 20;
const MAX_OUT = 1024 * 1024;

/**
 * with 修饰符由「前面的函数」定义含义。
 * key = 修饰符 kind；value = 说明（仅文档/报错用）
 * 未列出的函数不得带 with → E52
 */
const WITH_SUPPORT = {
  get: {
    param: 'query parameters',
    header: 'request headers',
    ua: 'User-Agent',
    proxy: 'proxy URL prefix',
    worker: 'send request via Worker proxy',
  },
  post: {
    param: 'query parameters',
    header: 'request headers',
    ua: 'User-Agent',
    proxy: 'proxy URL prefix',
    worker: 'send request via Worker proxy',
  },
  get_all: {
    param: 'query parameters',
    header: 'request headers',
    ua: 'User-Agent',
    proxy: 'proxy URL prefix',
    worker: 'send request via Worker proxy',
  },
  post_all: {
    param: 'query parameters',
    header: 'request headers',
    ua: 'User-Agent',
    proxy: 'proxy URL prefix',
    worker: 'send request via Worker proxy',
  },
  return: {
    status: 'HTTP status code',
    header: 'response headers',
    proxy: 'redirect URL proxy prefix',
    redirectMode: 'auto or confirm redirect',
  },
};

class ThrowSignal {
  constructor(value) { this.value = value; }
}


export class Interpreter {
  constructor(ast, ctx) {
    this.ast = ast;
    this.ctx = ctx; // { url, env, inputStream, onChunk? }
    this.global = new Scope();
    this.scope = this.global;
    this.functions = new Map();
    this.structs = new Map();
    this.output = '';
    this.fetchCount = 0;
    this.recursionDepth = 0;
    this.lastStatus = 0;
    this.lastHeaders = null;
    this._builtins = null;
  }

  checkAbort() {
    if (this.ctx && this.ctx.abortSignal && this.ctx.abortSignal.aborted) {
      err('E60', 'execution aborted');
    }
  }

  ensureInputUI() {
    if (this.ctx && typeof this.ctx.onNeedInput === 'function') {
      this.ctx.onNeedInput();
    }
  }

  async run() {
    for (const node of this.ast.body) {
      if (node.type === 'StructDecl') this.structs.set(node.name, node);
      if (node.type === 'FuncDecl') this.functions.set(node.name, node);
    }
    this.checkStructCycles();
    this.initBuiltins();

    for (const node of this.ast.body) {
      if (node.type === 'FuncDecl' || node.type === 'StructDecl') continue;
      await this.execTopDecl(node);
    }

    const main = this.functions.get('main');
    if (!main) err('E14', 'missing main()');
    // main 可为任意返回类型（含 auto/void）；参数仍须为空
    if (main.params.length !== 0) err('E14', 'main must have no parameters');
    this.mainReturnType = main.returnType || { kind: 'auto' };

    const saved = this.scope;
    this.scope = new Scope(this.global);
    let retSignal = null;
    try {
      for (const stmt of main.body) await this.execStmt(stmt);
    } catch (e) {
      if (e instanceof ReturnSignal) retSignal = e;
      else if (e && e.code === 'E60') {
        // 强行停止：视为 main 正常结束
        retSignal = null;
        this._abortedClean = true;
      } else throw e;
    } finally {
      this.scope = saved;
    }
    return await this.finish(retSignal);
  }

  checkStructCycles() {
    const visit = (name, path) => {
      if (path.includes(name)) err('E40', `struct ${name} has circular reference`);
      const s = this.structs.get(name);
      if (!s) return;
      for (const f of s.fields) {
        if (f.type.kind === 'struct') visit(f.type.name, [...path, name]);
      }
    };
    for (const name of this.structs.keys()) visit(name, []);
  }

  initBuiltins() {
    const url = this.ctx.url;
    const q = (n) => { const v = url.searchParams.get(n); return v == null ? '' : String(v).trim(); };
    const p = (n) => {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[n - 1] ? decodeURIComponent(parts[n - 1]) : '';
    };
    this.global.declare('keyword', q('keyword'));
    this.global.declare('repoPath', q('repoPath'));
    this.global.declare('tag', q('tag') || 'latest');
    this.global.declare('selector', q('selector') || '1');
    this.global.declare('prerelease', q('prerelease'));
    for (let i = 1; i <= 4; i++) this.global.declare(`p${i}`, p(i));
    this.global.declare('key', this.collectKeyFromUrl(url));
    for (const name of ['keyword', 'repoPath', 'tag', 'selector', 'prerelease', 'p1', 'p2', 'p3', 'p4', 'key']) {
      const v = this.global.vars.get(name);
      this.global.vars.set(name, { __readonly: true, value: v });
    }
  }

  /**
   * 解析 ?key= 参数：
   * - 普通字符串 → string
   * - {1,"abc",false} 形式 → deque（元素可为 number / string / bool）
   *   · 直接访问 key 等价于 key[0]
   *   · key[i] / key.size() / for-in key 使用完整 deque
   */
  parseKeyParam(raw) {
    if (raw == null) return '';
    let s = String(raw).trim();
    if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1).trim();
    if (!s) {
      const d = new Deque();
      return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
    }
    const parts = this.splitKeyTokens(s);
    if (!parts.length) return '';
    const rawStr = String(raw);
    if (parts.length === 1 && !rawStr.includes(',') && !rawStr.includes('\n') && !rawStr.trim().startsWith('{')) {
      return parts[0];
    }
    const d = new Deque();
    for (const v of parts) d.push_back(v);
    return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
  }

  splitKeyTokens(s) {
    const parts = [];
    let i = 0;
    const n = s.length;
    const isSep = (c) => c === ',' || c === '\n' || c === '\r' || c === ' ' || c === '\t';
    while (i < n) {
      while (i < n && isSep(s[i])) i++;
      if (i >= n) break;
      if (s[i] === '"' || s[i] === "'") {
        const quote = s[i++];
        let val = '';
        while (i < n && s[i] !== quote) {
          if (s[i] === '\\' && i + 1 < n) { val += s[i + 1]; i += 2; }
          else val += s[i++];
        }
        if (i < n) i++;
        parts.push(val);
      } else {
        let tok = '';
        while (i < n && !isSep(s[i])) tok += s[i++];
        tok = tok.trim();
        if (!tok) continue;
        if (tok === 'true') parts.push(true);
        else if (tok === 'false') parts.push(false);
        else if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(tok)) parts.push(Number(tok));
        else parts.push(tok);
      }
    }
    return parts;
  }

  collectKeyFromUrl(url) {
    const sp = url.searchParams;
    const indexed = [];
    for (const [k, v] of sp.entries()) {
      const m = /^key(\d+)$/.exec(k);
      if (m) indexed.push([parseInt(m[1], 10), String(v).trim()]);
    }
    indexed.sort((a, b) => a[0] - b[0]);
    if (indexed.length) {
      const map = new Map(indexed);
      if (map.has(0)) {
        const max = indexed[indexed.length - 1][0];
        const arr = [];
        for (let i = 0; i <= max; i++) arr.push(map.has(i) ? map.get(i) : '');
        return this.parseKeyParam(arr.map((x) => {
          if (typeof x === 'string' && /[",\n]/.test(x)) return JSON.stringify(x);
          return x;
        }).join(','));
      }
      return this.parseKeyParam(indexed.map(([, v]) => v).join(','));
    }
    const all = sp.getAll('key').map((v) => String(v).trim());
    if (all.length > 1) return this.parseKeyParam(all.join(','));
    if (all.length === 1) return this.parseKeyParam(all[0]);
    return '';
  }

  async execTopDecl(node) {
    switch (node.type) {
      case 'VarDecl': return await this.execVarDecl(node);
      case 'RefDecl': return await this.execRefDecl(node);
      case 'ContainerGroupDecl': return await this.execContainerGroupDecl(node);
      case 'ContainerInitDecl': return await this.execContainerInitDecl(node);
      case 'NativeArrayDecl': return await this.execNativeArrayDecl(node);
      case 'ExprStmt': return await this.evalExpr(node.expr);
      default: err('E03', `unknown top-level node: ${node.type}`);
    }
  }

  async execVarDecl(node) {
    let value;
    if (node.init === null) {
      // 容器 / struct 默认构造为空对象；标量仍视为未初始化直至赋值
      const k = node.varType && node.varType.kind;
      if (k === 'deque' || k === 'list' || k === 'set' || k === 'multiset' || k === 'map' || k === 'multimap' || k === 'struct' || k === 'pair' || k === 'tuple') {
        value = this.defaultValue(node.varType);
      } else {
        value = { __uninit: true, type: node.varType };
      }
    } else {
      value = await this.evalExpr(node.init);
      value = this.coerce(value, node.varType, node.name);
    }
    const existing = this.scope.vars.get(node.name);
    if (existing && existing.__readonly) err('E07', `cannot redeclare built-in ${node.name}`);
    if (existing) err('E06', `duplicate declaration: ${node.name}`);
    this.scope.declare(node.name, value);
  }

  async execRefDecl(node) {
    const target = await this.evalLValue(node.init);
    const box = new RefBox(
      () => target.get(),
      (v) => target.set(v),
      node.varType,
    );
    this.scope.declare(node.name, { __ref: box });
  }

  async execContainerGroupDecl(node) {
    const size = this.toNum(await this.evalExpr(node.size));
    if (size < 0) err('E23', 'container group size must be >= 0');
    const arr = [];
    for (let i = 0; i < size; i++) arr.push(this.makeContainer(node.varType));
    this.scope.declare(node.name, { __group: arr, __elemType: node.varType });
  }

  async execContainerInitDecl(node) {
    const size = this.toNum(await this.evalExpr(node.size));
    if (size < 0) err('E23', 'container size must be >= 0');
    const c = this.makeContainer(node.varType);
    const def = this.defaultValue(node.varType.elem || { kind: 'auto' });
    for (let i = 0; i < size; i++) c.push_back(def);
    this.scope.declare(node.name, { __container: c, __elemType: node.varType });
  }

  async execNativeArrayDecl(node) {
    const dims = [];
    for (const d of node.dims) dims.push(this.toNum(await this.evalExpr(d)));
    const build = (depth) => {
      if (depth === dims.length - 1) {
        const arr = [];
        const def = this.defaultValue(node.elemType);
        for (let i = 0; i < dims[depth]; i++) arr.push(def);
        return arr;
      }
      const arr = [];
      for (let i = 0; i < dims[depth]; i++) arr.push(build(depth + 1));
      return arr;
    };
    const arr = build(0);
    this.scope.declare(node.name, { __native: arr, __elemType: node.elemType, __dims: dims });
  }

  makeContainer(type) {
    if (type.kind === 'deque') return new Deque();
    if (type.kind === 'list') return new ListContainer();
    if (type.kind === 'set') return new SetContainer();
    if (type.kind === 'multiset') return new MultiSetContainer();
    if (type.kind === 'map') return new MapContainer();
    if (type.kind === 'multimap') return new MultiMapContainer();
    err('E10', `cannot make container of ${type.kind}`);
  }

  async execStmt(node) {
    switch (node.type) {
      case 'Block': return await this.execBlock(node);
      case 'VarDecl': return await this.execVarDecl(node);
      case 'RefDecl': return await this.execRefDecl(node);
      case 'ContainerGroupDecl': return await this.execContainerGroupDecl(node);
      case 'ContainerInitDecl': return await this.execContainerInitDecl(node);
      case 'NativeArrayDecl': return await this.execNativeArrayDecl(node);
      case 'ExprStmt': await this.evalExpr(node.expr); return;
      case 'If': return await this.execIf(node);
      case 'For': return await this.execFor(node);
      case 'RangeFor': return await this.execRangeFor(node);
      case 'While': return await this.execWhile(node);
      case 'Switch': return await this.execSwitch(node);
      case 'Break': throw new BreakSignal();
      case 'Continue': throw new ContinueSignal();
      case 'Return': {
        // 防御：若 value 仍是 WithExpr（旧 AST / 边界情况），拆到 mods
        let valueNode = node.value;
        let mods = node.mods ? [...node.mods] : [];
        while (valueNode && valueNode.type === 'WithExpr') {
          mods = [...valueNode.mods, ...mods];
          valueNode = valueNode.base;
        }
        const value = valueNode ? await this.evalExpr(valueNode) : null;
        throw new ReturnSignal(value, mods);
      }
      case 'Delete': return await this.execDelete(node);
      case 'In': return await this.execIn(node);
      case 'Try': return await this.execTry(node);
      case 'Throw': {
        const v = await this.evalExpr(node.value);
        throw new ThrowSignal(v);
      }
      default: err('E03', `unknown statement: ${node.type}`);
    }
  }

  async execTry(node) {
    try {
      await this.execStmt(node.body);
    } catch (e) {
      if (e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal) throw e;
      if (e instanceof ThrowSignal || (e && e.code) || e instanceof Error) {
        const msg = e instanceof ThrowSignal
          ? (typeof e.value === 'string' ? e.value : this.toStr(e.value))
          : (e.message || String(e));
        const saved = this.scope;
        this.scope = new Scope(saved);
        try {
          if (node.catchName) this.scope.declare(node.catchName, msg);
          await this.execStmt(node.catchBody);
        } finally {
          this.scope = saved;
        }
        return;
      }
      throw e;
    }
  }

  async execBlock(node) {
    const saved = this.scope;
    this.scope = new Scope(saved);
    try {
      for (const stmt of node.body) await this.execStmt(stmt);
    } finally {
      this.scope = saved;
    }
  }

  async execIf(node) {
    const cond = this.toBool(await this.evalExpr(node.cond));
    if (cond) await this.execStmt(node.then);
    else if (node.else) await this.execStmt(node.else);
  }

  async execFor(node) {
    const saved = this.scope;
    this.scope = new Scope(saved);
    try {
      if (node.init) {
        if (node.init.type === 'VarDecl') await this.execVarDecl(node.init);
        else await this.evalExpr(node.init);
      }
      let iters = 0;
      while (true) {
        if (node.cond && !this.toBool(await this.evalExpr(node.cond))) break;
        this.checkAbort();
        if (++iters > MAX_LOOP) err('E21', 'loop iteration exceeds 10000');
        try {
          await this.execStmt(node.body);
        } catch (e) {
          if (e instanceof BreakSignal) break;
          if (!(e instanceof ContinueSignal)) throw e;
        }
        if (node.update) await this.evalExpr(node.update);
      }
    } finally {
      this.scope = saved;
    }
  }

  async execRangeFor(node) {
    const it = node.iterable.type === 'Ident'
      ? this.lookupIdent(node.iterable.name, { asContainer: true })
      : await this.evalExpr(node.iterable);
    const saved = this.scope;
    this.scope = new Scope(saved);
    try {
      const items = this.iterableValues(it);
      let iters = 0;
      for (const v of items) {
        if (++iters > MAX_LOOP) err('E21', 'loop iteration exceeds 10000');
        this.scope.declare(node.varName, this.cloneValue(v));
        try {
          await this.execStmt(node.body);
        } catch (e) {
          if (e instanceof BreakSignal) break;
          if (!(e instanceof ContinueSignal)) throw e;
        }
      }
    } finally {
      this.scope = saved;
    }
  }

  async execWhile(node) {
    let iters = 0;
    while (this.toBool(await this.evalExpr(node.cond))) {
      if (++iters > MAX_LOOP) err('E21', 'loop iteration exceeds 10000');
      try {
        await this.execStmt(node.body);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (!(e instanceof ContinueSignal)) throw e;
      }
    }
  }

  async execSwitch(node) {
    const v = await this.evalExpr(node.expr);
    let matched = false;
    for (const c of node.cases) {
      if (!matched && c.kind === 'case') {
        if (this.looseEq(v, await this.evalExpr(c.value))) matched = true;
      }
      if (matched) {
        try {
          for (const s of c.body) await this.execStmt(s);
        } catch (e) {
          if (e instanceof BreakSignal) return;
          throw e;
        }
      }
    }
    if (!matched) {
      for (const c of node.cases) {
        if (c.kind === 'default') {
          try {
            for (const s of c.body) await this.execStmt(s);
          } catch (e) {
            if (e instanceof BreakSignal) return;
            throw e;
          }
          break;
        }
      }
    }
  }

  async execDelete(node) {
    const t = node.target;
    if (t.type === 'Ident') {
      const v = this.scope.get(t.name);
      if (v && v.__readonly) err('E49', `cannot delete readonly ${t.name}`);
      const ok = this.scope.delete(t.name);
      if (!ok) err('E05', `unknown variable: ${t.name}`);
      return;
    }
    if (t.type === 'Index') {
      const container = await this.evalExpr(t.target);
      const idx = await this.evalExpr(t.index);
      if (container && container.__container) {
        const c = container.__container;
        if (c instanceof MapContainer) c.erase(this.toKey(idx));
        else c.erase(this.toNum(idx));
        return;
      }
      if (container && container.__native) err('E32', 'cannot delete element of native array');
      err('E10', 'delete target is not indexable');
    }
    err('E10', `cannot delete ${t.type}`);
  }

  async execIn(node) {
    if (this.ctx.onNeedInput) this.ctx.onNeedInput();
    const token = await this.ctx.inputStream.readToken();
    // EOF：仍写入默认值，避免 string name; in(name); 后 name 未初始化
    if (token === null) {
      if (!this.scope.has(node.name)) {
        this.scope.declare(node.name, '');
        return;
      }
      const cur = this.scope.get(node.name);
      if (cur && cur.__uninit) {
        const k = cur.type && cur.type.kind;
        if (k === 'number') this.scope.set(node.name, 0);
        else if (k === 'bool') this.scope.set(node.name, false);
        else this.scope.set(node.name, '');
        return;
      }
      if (typeof cur === 'number') this.scope.set(node.name, 0);
      else if (typeof cur === 'boolean') this.scope.set(node.name, false);
      else if (typeof cur === 'string' || cur === undefined || cur.__uninit) this.scope.set(node.name, '');
      return;
    }
    if (!this.scope.has(node.name)) {
      this.scope.declare(node.name, { __uninit: true, type: { kind: 'auto' } });
    }
    const cur = this.scope.get(node.name);
    if (cur && !cur.__uninit) {
      if (typeof cur === 'number') { this.scope.set(node.name, this.toNum(token)); return; }
      if (typeof cur === 'string') { this.scope.set(node.name, token); return; }
      if (typeof cur === 'boolean') { this.scope.set(node.name, token !== '' && token !== '0'); return; }
    }
    const numRe = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
    if (numRe.test(token)) this.scope.set(node.name, Number(token));
    else this.scope.set(node.name, token);
  }

  async evalExpr(node) {
    switch (node.type) {
      case 'Number': return node.value;
      case 'String': return node.value;
      case 'Char': return { __char: true, value: node.value };
      case 'Bool': return node.value;
      case 'Ident': return this.lookupIdent(node.name);
      case 'Binary': return await this.evalBinary(node);
      case 'Unary': return await this.evalUnary(node);
      case 'Cast': return await this.evalCast(node);
      case 'Assign': return await this.evalAssign(node);
      case 'PrefixInc': return await this.evalIncDec(node, true);
      case 'PostfixInc': return await this.evalIncDec(node, false);
      case 'Index': return await this.evalIndex(node);
      case 'Member': return await this.evalMember(node);
      case 'Call': return await this.evalCall(node);
      case 'WithExpr': return await this.evalWithExpr(node);
      case 'ContainerLiteral': return await this.evalContainerLiteral(node);
      case 'MapLiteral': return await this.evalMapLiteral(node);
      default: err('E03', `unknown expression: ${node.type}`);
    }
  }

  /**
   * @param {{ asContainer?: boolean }} opts
   *   asContainer=true：key 保持为完整 deque（用于 key[i] / key.size()）
   *   默认：key 若为 deque，直接访问等价于 key[0]
   */
  lookupIdent(name, opts = {}) {
    // 运行中可改的 key：每次从 getQueryParam 重读
    if (name === 'key' && this.ctx.getQueryParam) {
      const raw = this.resolveQueryParam('key');
      const parsed = this.parseKeyParam(raw);
      if (!opts.asContainer && parsed && parsed.__container) {
        const c = parsed.__container;
        return c.size() > 0 ? c.get(0) : '';
      }
      return parsed;
    }
    const v = this.scope.get(name);
    if (v === undefined) err('E05', `unknown variable: ${name}`);
    let val = v;
    if (v.__readonly) val = v.value;
    else if (v.__uninit) err('E36', `use of uninitialized variable '${name}'`);
    else if (v.__ref) val = v.__ref.get();

    // key 直接访问默认取 key[0]
    if (name === 'key' && val && val.__container && !opts.asContainer) {
      const c = val.__container;
      if (c.size() === 0) return '';
      return c.get(0);
    }
    return val;
  }

  async evalBinary(node) {
    const { op } = node;
    if (op === '&&') {
      const l = await this.evalExpr(node.left);
      if (!this.toBool(l)) return false;
      return this.toBool(await this.evalExpr(node.right));
    }
    if (op === '||') {
      const l = await this.evalExpr(node.left);
      if (this.toBool(l)) return true;
      return this.toBool(await this.evalExpr(node.right));
    }
    const l = await this.evalExpr(node.left);
    const r = await this.evalExpr(node.right);
    switch (op) {
      case '+': {
        if ((l && l.__char) || (r && r.__char) || typeof l === 'string' || typeof r === 'string') {
          return this.toStr(l) + this.toStr(r);
        }
        return this.toNum(l) + this.toNum(r);
      }
      case '-': return this.toNum(l) - this.toNum(r);
      case '*': return this.toNum(l) * this.toNum(r);
      case '/': { const d = this.toNum(r); if (d === 0) err('E34', 'division by zero'); return this.toNum(l) / d; }
      case '%': { const d = this.toNum(r); if (d === 0) err('E34', 'modulo by zero'); return this.toNum(l) % d; }
      case '<<': return this.bitOp(l, r, (a, b) => a << b);
      case '>>': return this.bitOp(l, r, (a, b) => a >> b);
      case '&': return this.bitOp(l, r, (a, b) => a & b);
      case '|': return this.bitOp(l, r, (a, b) => a | b);
      case '^': return this.bitOp(l, r, (a, b) => a ^ b);
      case '==': return this.looseEq(l, r);
      case '!=': return !this.looseEq(l, r);
      case '<': return this.compare(l, r) < 0;
      case '<=': return this.compare(l, r) <= 0;
      case '>': return this.compare(l, r) > 0;
      case '>=': return this.compare(l, r) >= 0;
      default: err('E11', `unknown operator: ${op}`);
    }
  }

  bitOp(l, r, f) {
    const a = this.toInt(l);
    const b = this.toInt(r);
    const res = f(a, b);
    if (res < -0x80000000 || res > 0x7fffffff) err('E34', 'bit operation out of int32 range');
    return res;
  }

  toInt(v) {
    const n = this.toNum(v);
    if (n !== Math.floor(n)) err('E34', `bit operation requires integer, got ${n}`);
    if (n < -0x80000000 || n > 0x7fffffff) err('E34', `bit operation out of int32 range: ${n}`);
    return n | 0;
  }

  async evalCast(node) {
    const v = await this.evalExpr(node.expr);
    const k = node.varType && node.varType.kind;
    if (k === 'string') return this.toStr(v);
    if (k === 'number') return this.toNum(v);
    if (k === 'bool') return this.toBool(v);
    if (k === 'char') return this.toChar(v);
    if (k === 'auto') return v;
    err('E10', `unsupported cast to ${k}`);
  }

  async evalUnary(node) {
    const v = await this.evalExpr(node.expr);
    switch (node.op) {
      case '!': return !this.toBool(v);
      case '~': return ~this.toInt(v);
      case '-': return -this.toNum(v);
      default: err('E11', `unknown unary: ${node.op}`);
    }
  }

  async evalAssign(node) {
    const target = await this.evalLValue(node.target);
    if (node.op === '=') {
      const v = await this.evalExpr(node.value);
      target.set(v);
      return target.get();
    }
    const cur = target.get();
    const rhs = await this.evalExpr(node.value);
    const binOp = node.op.slice(0, -1);

    if (typeof cur === 'boolean' && ['+', '-', '*', '/', '%', '<<', '>>', '&', '|', '^'].includes(binOp)) {
      const a = cur ? 1 : 0;
      const b = this.toNum(rhs);
      let r;
      switch (binOp) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/': if (b === 0) err('E34', 'division by zero'); r = a / b; break;
        case '%': if (b === 0) err('E34', 'modulo by zero'); r = a % b; break;
        case '<<': case '>>': case '&': case '|': case '^': {
          const ai = this.toInt(a), bi = this.toInt(b);
          if (binOp === '<<') r = ai << bi;
          else if (binOp === '>>') r = ai >> bi;
          else if (binOp === '&') r = ai & bi;
          else if (binOp === '|') r = ai | bi;
          else r = ai ^ bi;
          if (r < -0x80000000 || r > 0x7fffffff) err('E34', 'bit op out of range');
          break;
        }
      }
      target.set(r !== 0);
      return target.get();
    }

    let result;
    if (binOp === '+' && typeof cur === 'string') result = cur + this.toStr(rhs);
    else result = this.binOpValue(binOp, cur, rhs);
    target.set(result);
    return target.get();
  }

  binOpValue(op, l, r) {
    switch (op) {
      case '+': if (typeof l === 'string' || typeof r === 'string') return this.toStr(l) + this.toStr(r); return this.toNum(l) + this.toNum(r);
      case '-': return this.toNum(l) - this.toNum(r);
      case '*': return this.toNum(l) * this.toNum(r);
      case '/': { const d = this.toNum(r); if (d === 0) err('E34', 'division by zero'); return this.toNum(l) / d; }
      case '%': { const d = this.toNum(r); if (d === 0) err('E34', 'modulo by zero'); return this.toNum(l) % d; }
      case '<<': return this.bitOp(l, r, (a, b) => a << b);
      case '>>': return this.bitOp(l, r, (a, b) => a >> b);
      case '&': return this.bitOp(l, r, (a, b) => a & b);
      case '|': return this.bitOp(l, r, (a, b) => a | b);
      case '^': return this.bitOp(l, r, (a, b) => a ^ b);
      default: err('E11', `unknown op: ${op}`);
    }
  }

  async evalIncDec(node, isPrefix) {
    const target = await this.evalLValue(node.target);
    const cur = target.get();
    const isIncrement = node.op === '++';

    if (typeof cur === 'boolean') {
      const old = cur;
      target.set(!cur);
      return isPrefix ? target.get() : old;
    }
    if (typeof cur === 'number') {
      const old = cur;
      target.set(isIncrement ? cur + 1 : cur - 1);
      return isPrefix ? target.get() : old;
    }
    err('E45', `${node.op} requires number/bool lvalue`);
  }

  async evalLValue(node) {
    if (node.type === 'Ident') {
      const name = node.name;
      const existing = this.scope.get(name);
      if (existing && existing.__readonly) err('E49', `cannot assign to readonly ${name}`);
      if (existing && existing.__ref) return existing.__ref;
      return new RefBox(
        () => {
          const cur = this.scope.get(name);
          if (cur && cur.__uninit) err('E36', `use of uninitialized variable '${name}'`);
          return cur;
        },
        (v) => this.scope.set(name, v),
        { kind: 'auto' },
      );
    }
    if (node.type === 'Index') {
      const target = node.target.type === 'Ident'
        ? this.lookupIdent(node.target.name, { asContainer: true })
        : await this.evalExpr(node.target);
      const idx = await this.evalExpr(node.index);
      if (target && target.__tuple) {
        const i = this.toNum(idx);
        return new RefBox(
          () => {
            if (i < 0 || i >= target.items.length) err('E23', `tuple index ${i} out of range`);
            return target.items[i];
          },
          (v) => {
            if (i < 0 || i >= target.items.length) err('E23', `tuple index ${i} out of range`);
            target.items[i] = v;
          },
          { kind: 'auto' },
        );
      }
      if (target && target.__container) {
        const c = target.__container;
        if (c instanceof MapContainer || c instanceof MultiMapContainer) {
          const k = this.toKey(idx);
          return new RefBox(
            () => c.has(k) ? c.get(k) : this.defaultValue((target.__elemType && target.__elemType.val) || { kind: 'auto' }),
            (v) => {
              if (c instanceof MultiMapContainer) c.insert(k, v);
              else c.set(k, v);
            },
            (target.__elemType && target.__elemType.val) || { kind: 'auto' },
          );
        }
        const i = this.toNum(idx);
        return new RefBox(
          () => c.get(i),
          (v) => {
            const et = this.containerElemType(target);
            if (typeof c.set === 'function') {
              c.set(i, (!et || et.kind === 'auto') ? v : this.coerce(v, et, 'index'));
            } else err('E10', 'cannot index-assign this container');
          },
          this.containerElemType(target),
        );
      }
      if (target && target.__group) {
        const arr = target.__group;
        const i = this.toNum(idx);
        return new RefBox(
          () => {
            if (i < 0 || i >= arr.length) err('E23', `group index ${i} out of range`);
            return { __container: arr[i], __elemType: target.__elemType };
          },
          (v) => {
            if (v && v.__container) arr[i] = v.__container;
            else err('E10', 'cannot assign non-container to group element');
          },
          target.__elemType,
        );
      }
      if (target && target.__native) {
        const i = this.toNum(idx);
        if (i < 0 || i >= target.__native.length) err('E23', `index ${i} out of range`);
        return new RefBox(
          () => target.__native[i],
          (v) => { target.__native[i] = v; },
          target.__elemType,
        );
      }
      err('E10', 'index target is not a container/array');
    }
    if (node.type === 'Member') {
      const target = node.target.type === 'Ident'
        ? this.lookupIdent(node.target.name, { asContainer: true })
        : await this.evalExpr(node.target);
      if (target && target.__pair && (node.name === 'first' || node.name === 'second')) {
        const key = node.name;
        return new RefBox(
          () => target[key],
          (v) => { target[key] = v; },
          { kind: 'auto' },
        );
      }
      if (target && typeof target === 'object') {
        const name = node.name;
        return new RefBox(
          () => target[name],
          (v) => { target[name] = v; },
          { kind: 'auto' },
        );
      }
      err('E33', 'member target is not an object');
    }
    err('E33', `not an lvalue: ${node.type}`);
  }

  async evalIndex(node) {
    const target = node.target.type === 'Ident'
      ? this.lookupIdent(node.target.name, { asContainer: true })
      : await this.evalExpr(node.target);
    const index = await this.evalExpr(node.index);
    if (target && target.__tuple) {
      const i = this.toNum(index);
      if (i < 0 || i >= target.items.length) err('E23', `tuple index ${i} out of range`);
      return target.items[i];
    }
    if (target && target.__container) {
      const c = target.__container;
      if (c instanceof MapContainer || c instanceof MultiMapContainer) {
        const k = this.toKey(index);
        if (!c.has(k)) return this.defaultValue((target.__elemType && target.__elemType.val) || { kind: 'auto' });
        return c.get(k);
      }
      if (typeof c.get === 'function') return c.get(this.toNum(index));
      err('E10', 'index not supported on this container');
    }
    if (target && target.__group) {
      const arr = target.__group;
      const i = this.toNum(index);
      if (i < 0 || i >= arr.length) err('E23', `group index ${i} out of range`);
      return { __container: arr[i], __elemType: target.__elemType };
    }
    if (target && target.__native) {
      return this.indexNative(target.__native, this.toNum(index), target.__elemType);
    }
    err('E10', 'index target is not a container/array');
  }

  indexNative(arr, i, elemType) {
    if (!Array.isArray(arr)) err('E32', 'not a native array');
    if (i < 0 || i >= arr.length) err('E23', `index ${i} out of range`);
    const v = arr[i];
    if (Array.isArray(v)) return { __native: v, __elemType: elemType };
    return v;
  }

  async evalMember(node) {
    const target = node.target.type === 'Ident'
      ? this.lookupIdent(node.target.name, { asContainer: true })
      : await this.evalExpr(node.target);
    if (target && target.__pair) {
      if (node.name === 'first' || node.name === 'second') return target[node.name];
      err('E10', `pair has no member ${node.name}`);
    }
    if (target && target.__tuple) {
      err('E10', 'use tget(tuple, i) or tuple[i] for tuple elements');
    }
    if (target && (target.__container || target.__group || target.__native || target.__struct)) {
      return { __methodRef: { target, name: node.name } };
    }
    if (target && typeof target === 'object' && node.name in target) {
      return target[node.name];
    }
    err('E10', `unknown member: ${node.name}`);
  }


  /**
   * scanf(fmt, v1, v2, ...) / sscanf(str, fmt, v1, ...)
   * 格式支持：%d %i %f %g %s %c %% ；变量参数须为标识符（写入该变量）
   * 返回成功赋值的项数
   */
  async execScanf(kind, args) {
    if (!args || args.length < 1) err('E09', kind + ' requires format');
    let text;
    let fmtExpr;
    let varArgs;
    if (kind === 'sscanf') {
      if (args.length < 2) err('E09', 'sscanf requires string and format');
      text = this.toStr(await this.evalExpr(args[0]));
      fmtExpr = args[1];
      varArgs = args.slice(2);
    } else {
      // 从输入流读足够文本：按行累积直到 fmt 能吃完或 EOF
      fmtExpr = args[0];
      varArgs = args.slice(1);
      const parts = [];
      // 读至少一行；若还有 % 未满足继续读行
      for (;;) {
        const line = await this.readLineFromInput();
        if (line === null) break;
        parts.push(line);
        // 粗略：有一行就先 parse，不够再读
        break;
      }
      text = parts.join('\n');
    }
    const fmt = this.toStr(await this.evalExpr(fmtExpr));
    const tokens = this.scanfTokenize(text);
    let ti = 0;
    let vi = 0;
    let assigned = 0;
    for (let i = 0; i < fmt.length; i++) {
      if (fmt[i] !== '%') continue;
      if (i + 1 < fmt.length && fmt[i + 1] === '%') { i++; continue; }
      const sp = i + 1 < fmt.length ? fmt[i + 1] : '';
      i++;
      if (!varArgs[vi]) break;
      const argNode = varArgs[vi++];
      if (!argNode || argNode.type !== 'Ident') {
        err('E09', kind + ' variable args must be identifiers');
      }
      const name = argNode.name;
      if (ti >= tokens.length && sp !== 'c') break;
      let val;
      if (sp === 'd' || sp === 'i') {
        val = parseInt(tokens[ti++], 10);
        if (Number.isNaN(val)) break;
      } else if (sp === 'f' || sp === 'g') {
        val = parseFloat(tokens[ti++]);
        if (Number.isNaN(val)) break;
      } else if (sp === 's') {
        val = tokens[ti++];
      } else if (sp === 'c') {
        // 单字符：从当前 token 或原始剩余
        const tok = tokens[ti] !== undefined ? tokens[ti++] : '';
        val = tok ? tok[0] : '';
      } else {
        continue;
      }
      if (!this.scope.has(name)) this.scope.declare(name, val);
      else this.scope.set(name, val);
      assigned++;
    }
    return assigned;
  }

  scanfTokenize(text) {
    const s = String(text ?? '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (i >= s.length) break;
      let j = i;
      while (j < s.length && !/\s/.test(s[j])) j++;
      out.push(s.slice(i, j));
      i = j;
    }
    return out;
  }

  async readLineFromInput() {
    this.ensureInputUI();
    const stream = this.ctx.inputStream;
    if (!stream) return null;
    // 若有 readToken 路径：拼一行到 \\n 或 EOF
    let line = '';
    for (;;) {
      const cp = await stream.getchar();
      if (cp === -1) return line.length ? line : null;
      const ch = String.fromCodePoint(cp);
      if (ch === '\n') return line;
      if (ch !== '\r') line += ch;
    }
  }


  /** printf/sprintf 格式化：支持 flags (-+0 #)、width、*、.precision、长度 hh h l ll、转换 diouxXeEfFgGaAcspn% */
  formatPrintf(fmt, args) {
    let ai = 0;
    let out = '';
    const s = String(fmt);
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== '%') { out += s[i]; continue; }
      if (i + 1 < s.length && s[i + 1] === '%') { out += '%'; i++; continue; }
      i++;
      let flags = '';
      while (i < s.length && '-+0 #'.includes(s[i])) { flags += s[i]; i++; }
      let width = null;
      if (i < s.length && s[i] === '*') {
        width = Math.trunc(this.toNum(args[ai++]));
        i++;
      } else {
        const m = /^(\d+)/.exec(s.slice(i));
        if (m) { width = parseInt(m[1], 10); i += m[1].length; }
      }
      let prec = null;
      if (i < s.length && s[i] === '.') {
        i++;
        if (i < s.length && s[i] === '*') {
          prec = Math.trunc(this.toNum(args[ai++]));
          i++;
        } else {
          const m = /^(\d*)/.exec(s.slice(i));
          prec = m[1] === '' ? 0 : parseInt(m[1], 10);
          i += m[1].length;
        }
      }
      // length modifiers (ignored for value, we only have number/string)
      if (i < s.length && (s[i] === 'h' || s[i] === 'l' || s[i] === 'L' || s[i] === 'z' || s[i] === 'j' || s[i] === 't')) {
        if ((s[i] === 'h' || s[i] === 'l') && i + 1 < s.length && s[i + 1] === s[i]) i += 2;
        else i++;
      }
      if (i >= s.length) break;
      const sp = s[i];
      const arg = args[ai++];
      let piece = '';
      if (sp === 's') {
        piece = this.toStr(arg);
        if (prec != null) piece = piece.slice(0, prec);
      } else if (sp === 'c') {
        const str = this.toStr(arg);
        piece = str ? str[0] : String.fromCharCode(this.toNum(arg) || 0);
      } else if (sp === 'd' || sp === 'i') {
        let n = Math.trunc(this.toNum(arg));
        const neg = n < 0;
        n = Math.abs(n);
        piece = n.toString(10);
        if (prec != null) piece = piece.padStart(prec, '0');
        if (neg) piece = '-' + piece;
        else if (flags.includes('+')) piece = '+' + piece;
        else if (flags.includes(' ')) piece = ' ' + piece;
      } else if (sp === 'u') {
        let n = Math.trunc(this.toNum(arg));
        if (n < 0) n = 0;
        piece = n.toString(10);
        if (prec != null) piece = piece.padStart(prec, '0');
      } else if (sp === 'o') {
        let n = Math.trunc(this.toNum(arg));
        if (n < 0) n = 0;
        piece = n.toString(8);
        if (prec != null) piece = piece.padStart(prec, '0');
        if (flags.includes('#') && piece !== '0') piece = '0' + piece;
      } else if (sp === 'x' || sp === 'X') {
        let n = Math.trunc(this.toNum(arg));
        if (n < 0) n = 0;
        piece = n.toString(16);
        if (sp === 'X') piece = piece.toUpperCase();
        if (prec != null) piece = piece.padStart(prec, '0');
        if (flags.includes('#') && n !== 0) piece = (sp === 'X' ? '0X' : '0x') + piece;
      } else if ('fFeEgGaA'.includes(sp)) {
        const n = this.toNum(arg);
        const p = prec != null ? prec : 6;
        if (sp === 'f' || sp === 'F') piece = n.toFixed(p);
        else if (sp === 'e' || sp === 'E') {
          piece = n.toExponential(p);
          if (sp === 'E') piece = piece.toUpperCase();
        } else if (sp === 'g' || sp === 'G') {
          piece = n.toPrecision(p > 0 ? p : 1);
          if (sp === 'G') piece = piece.toUpperCase();
        } else {
          piece = String(n);
        }
        if (flags.includes('+') && n >= 0) piece = '+' + piece;
        else if (flags.includes(' ') && n >= 0 && !piece.startsWith('-')) piece = ' ' + piece;
      } else if (sp === 'p') {
        piece = '0x' + Math.trunc(this.toNum(arg)).toString(16);
      } else if (sp === 'n') {
        // 写入已输出长度到变量——无指针，忽略
        piece = '';
        ai--; // 不消耗？C 中 %n 写指针；这里跳过参数若有
      } else {
        piece = '%' + sp;
        ai--;
      }
      if (width != null && width !== 0) {
        const left = flags.includes('-');
        const pad = flags.includes('0') && !left && prec == null && !'s'.includes(sp) ? '0' : ' ';
        if (piece.length < Math.abs(width)) {
          const padLen = Math.abs(width) - piece.length;
          const pads = pad.repeat(padLen);
          piece = left ? piece + pads : pads + piece;
        }
      }
      out += piece;
    }
    return out;
  }

  resolveQueryParam(name) {
    if (this.ctx.getQueryParam) {
      const v = this.ctx.getQueryParam(name);
      if (v !== undefined && v !== null) return String(v);
    }
    return this.ctx.url.searchParams.get(name) ?? '';
  }

  async evalCall(node) {
    if (node.callee.type === 'Ident') {
      const name = node.callee.name;
      // scanf / sscanf：后续参数按标识符写入（类似 & 变量）
      if (name === 'scanf' || name === 'sscanf') {
        return await this.execScanf(name, node.args);
      }
      const builtins = this.builtinFunctions;
      const builtin = builtins[name];
      if (builtin) {
        const args = [];
        for (const a of node.args) args.push(await this.evalExpr(a));
        return await builtin(args, node);
      }
      const fn = this.functions.get(name);
      if (fn) {
        const args = [];
        for (const a of node.args) args.push(await this.evalExpr(a));
        return await this.callFunction(fn, args);
      }
      err('E08', `unknown function: ${name}`);
    }
    if (node.callee.type === 'Member') {
      const target = node.callee.target.type === 'Ident'
        ? this.lookupIdent(node.callee.target.name, { asContainer: true })
        : await this.evalExpr(node.callee.target);
      const name = node.callee.name;
      const args = [];
      for (const a of node.args) args.push(await this.evalExpr(a));
      return this.callMethod(target, name, args);
    }
    err('E08', 'invalid function call');
  }

  callMethod(target, name, args) {
    if (target && target.__container) return this.callContainerMethod(target, name, args);
    if (target && target.__native) {
      if (['size', 'len'].includes(name)) return target.__native.length;
      err('E32', `native array does not have method ${name}`);
    }
    if (target && target.__group) {
      if (name === 'size') return target.__group.length;
      err('E31', `container group does not have method ${name}`);
    }
    err('E10', `cannot call method ${name}`);
  }

  /**
   * 容器方法。deque<auto> / set<auto>：push/insert 时按实参值决定元素运行时类型，不做强制转换。
   * deque<number> 等：写入时 coerce 到元素类型。
   */
  callContainerMethod(target, name, args) {
    const c = target.__container;
    const elemType = this.containerElemType(target);
    const isMap = c instanceof MapContainer;
    const isMultiMap = c instanceof MultiMapContainer;
    const isMultiSet = c instanceof MultiSetContainer;
    const isSeq = c instanceof Deque || c instanceof ListContainer; // deque/list/set
    const coerceElem = (v) => {
      if (!elemType || elemType.kind === 'auto') return v;
      return this.coerce(v, elemType, name);
    };
    switch (name) {
      case 'size': return c.size();
      case 'clear': c.clear(); return;
      case 'find': {
        if (isMap || isMultiMap) return c.has(this.toKey(args[0])) ? 1 : -1;
        if (c.find) return c.find(args[0]);
        return -1;
      }
      case 'count': {
        if (isMultiSet) return c.count(args[0]);
        if (isMultiMap) return c.count(this.toKey(args[0]));
        if (isMap) return c.has(this.toKey(args[0])) ? 1 : 0;
        if (c.items) {
          let n = 0;
          for (const x of c.items) if (x === args[0] || Object.is(x, args[0])) n++;
          return n;
        }
        err('E10', 'count not supported');
      }
      case 'front': return c.front ? c.front() : err('E10', 'no front');
      case 'back': return c.back ? c.back() : err('E10', 'no back');
      case 'push_back':
        if (!c.push_back) err('E10', 'push_back not supported');
        c.push_back(coerceElem(args[0]));
        return;
      case 'push_front':
        if (!c.push_front) err('E10', 'push_front not supported');
        c.push_front(coerceElem(args[0]));
        return;
      case 'pop_back':
        if (!c.pop_back) err('E10', 'pop_back not supported');
        return c.pop_back();
      case 'pop_front':
        if (!c.pop_front) err('E10', 'pop_front not supported');
        return c.pop_front();
      case 'erase': {
        if (isMap || isMultiMap) { c.erase(this.toKey(args[0])); return; }
        if (isMultiSet) {
          // erase(value) 删一个；erase(value, true) 或第二参数 "all" 全删
          if (args.length > 1 && (args[1] === true || this.toStr(args[1]) === 'all')) {
            return c.eraseAll(args[0]);
          }
          return c.erase(args[0]);
        }
        // deque/list/set：按索引
        c.erase(this.toNum(args[0]));
        return;
      }
      case 'insert': {
        if (isMap) {
          c.set(this.toKey(args[0]), coerceElem(args[1]));
          return;
        }
        if (isMultiMap) {
          c.insert(this.toKey(args[0]), coerceElem(args[1]));
          return;
        }
        if (isMultiSet) {
          c.insert(coerceElem(args[0]));
          return;
        }
        // set 的 insert(value) 单参；deque/list 的 insert(index, value)
        if (args.length === 1 && c instanceof SetContainer) {
          c.insertValue(coerceElem(args[0]));
          return;
        }
        c.insert(this.toNum(args[0]), coerceElem(args[1]));
        return;
      }
      case 'fill':
        if (!c.fill) err('E10', 'fill not supported');
        c.fill(coerceElem(args[0]));
        return;
      case 'has':
        if (isMap || isMultiMap) return c.has(this.toKey(args[0]));
        err('E10', 'has only on map/multimap');
      case 'keys': {
        if (!isMap && !isMultiMap) err('E10', 'keys only on map/multimap');
        const d = new Deque();
        for (const k of c.keysList()) d.push_back(k);
        return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
      }
      case 'values': {
        if (!isMap && !isMultiMap) err('E10', 'values only on map/multimap');
        const d = new Deque();
        for (const v of c.valuesList()) d.push_back(v);
        return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
      }
      case 'equal_range': {
        // multimap: 返回该 key 的全部 value 组成的 deque
        if (!isMultiMap) err('E10', 'equal_range only on multimap');
        const d = new Deque();
        for (const v of c.equalRange(this.toKey(args[0]))) d.push_back(v);
        return { __container: d, __elemType: { kind: 'deque', elem: elemType || { kind: 'auto' } } };
      }
      default: err('E10', `unknown container method: ${name}`);
    }
  }

  /** 取出容器元素类型：支持 {kind:'deque',elem} 或旧的 {kind:'auto'} */
  containerElemType(target) {
    const t = target && target.__elemType;
    if (!t) return { kind: 'auto' };
    if (t.kind === 'deque' || t.kind === 'list' || t.kind === 'set' || t.kind === 'multiset') {
      return t.elem || { kind: 'auto' };
    }
    if (t.kind === 'map' || t.kind === 'multimap') return t.val || { kind: 'auto' };
    return t;
  }

  async callFunction(fn, args) {
    if (this.recursionDepth >= MAX_RECURSION) err('E22', 'recursion depth exceeds 100');
    this.recursionDepth++;
    const saved = this.scope;
    this.scope = new Scope(this.global);

    try {
      if (fn.params.length !== args.length) err('E09', `function ${fn.name}: expected ${fn.params.length} args, got ${args.length}`);
      for (let i = 0; i < fn.params.length; i++) {
        const p = fn.params[i];
        const val = args[i];
        if (p.isRef) {
          if (!val) err('E33', `parameter ${p.name} requires lvalue`);
          if (val.__ref) this.scope.declare(p.name, val);
          else this.scope.declare(p.name, { __ref: val });
        } else {
          this.scope.declare(p.name, this.coerce(val, p.type, p.name));
        }
      }

      let ret = null;
      try {
        for (const stmt of fn.body) await this.execStmt(stmt);
      } catch (e) {
        if (e instanceof ReturnSignal) ret = e;
        else throw e;
      }

      const kind = fn.returnType.kind;
      if (kind === 'void' || kind === 'auto') {
        // void / auto：允许无 return；有 return 则返回值（auto 不强制类型）
        if (ret && ret.value !== null && kind === 'auto') return ret.value;
        return null;
      }
      if (!ret || ret.value === null) err('E18', `function ${fn.name} missing return value`);
      return this.coerce(ret.value, fn.returnType, fn.name);
    } finally {
      this.scope = saved;
      this.recursionDepth--;
    }
  }

  /**
   * 校验 mods 是否被「with 前的函数」支持；不支持则 E52
   */
  assertWithMods(fnName, mods) {
    const support = WITH_SUPPORT[fnName];
    if (!support) {
      err('E52', `function '${fnName}' does not support with modifiers`);
    }
    for (const m of mods) {
      if (!support[m.kind]) {
        const allowed = Object.keys(support).join(', ');
        err(
          'E52',
          `with ${m.kind} is not defined for ${fnName}(); allowed: ${allowed || '(none)'}`,
        );
      }
    }
  }

  async evalWithExpr(node) {
    // with 的含义由「紧邻的函数调用」定义（get/post）；
    // return ... with N 在 returnStmt / execStmt 里处理，不应走到这里。
    let base = node.base;
    // 兼容异常嵌套
    while (base && base.type === 'WithExpr') {
      node = { type: 'WithExpr', base: base.base, mods: [...base.mods, ...node.mods] };
      base = node.base;
    }

    if (base && base.type === 'Call' && base.callee && base.callee.type === 'Ident') {
      const fnName = base.callee.name;
      this.assertWithMods(fnName, node.mods);

      if (fnName === 'get' || fnName === 'post') {
        return await this.evalRequestWithMods(base, node.mods);
      }
      if (fnName === 'get_all' || fnName === 'post_all') {
        return await this.evalRequestAllWithMods(base, node.mods, fnName);
      }
      err('E52', `with modifiers for ${fnName}() are declared but not implemented`);
    }

    // 常见误用：字符串/变量 with 302 却不在 return 里
    const hint = base && base.type ? ` (got ${base.type})` : '';
    err(
      'E52',
      `with modifiers must follow get()/post() or return${hint}; ` +
        `for redirects use: return <url> with 302;`,
    );
  }

  async evalRequestWithMods(call, mods) {
    const args = [];
    for (const a of call.args) args.push(await this.evalExpr(a));
    const url = this.toStr(args[0]);
    const body = args.length > 1 && call.callee.name === 'post' ? this.toStr(args[1]) : null;
    const method = call.callee.name === 'post' ? 'POST' : 'GET';

    const opts = { method, proxy: null, ua: null, headers: {}, params: {}, useWorker: false };
    for (const m of mods) {
      switch (m.kind) {
        case 'param':
          for (const p of m.value) opts.params[p.key] = this.toStr(await this.evalExpr(p.value));
          break;
        case 'header':
          for (const h of m.value) opts.headers[h.key] = this.toStr(await this.evalExpr(h.value));
          break;
        case 'ua': opts.ua = this.toStr(await this.evalExpr(m.value)); break;
        case 'proxy': opts.proxy = this.toStr(await this.evalExpr(m.value)); break;
        case 'worker': opts.useWorker = true; break;
        default:
          err('E52', `with ${m.kind} is not defined for ${call.callee.name}()`);
      }
    }
    return await this.doHttpGet(method, url, body, opts);
  }

  async doHttpGet(method, url, body, opts) {
    this.checkAbort();
    if (++this.fetchCount > MAX_FETCH) err('E24', 'fetch count exceeds 20');
    const env = { ...(this.ctx.env || {}) };
    // 仅 with worker 时使用 FETCH_VIA；默认浏览器/本地直连
    if (!opts.useWorker) delete env.FETCH_VIA;
    const r = await doRequest(url, {
      method,
      body,
      headers: opts.headers,
      ua: opts.ua,
      proxy: opts.proxy,
      params: opts.params,
      signal: this.ctx.abortSignal,
    }, env);
    this.lastStatus = r.status;
    this.lastHeaders = r.headers;
    return r.body;
  }

  async evalContainerLiteral(node) {
    const items = [];
    for (const it of node.items) items.push(await this.evalExpr(it));
    const d = new Deque();
    for (const v of items) d.push_back(v);
    return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
  }

  async evalMapLiteral(node) {
    const m = new MapContainer();
    for (const e of node.entries) {
      const k = this.toKey(await this.evalExpr(e.key));
      const v = await this.evalExpr(e.value);
      m.set(k, v);
    }
    return { __container: m, __elemType: { kind: 'map' } };
  }

  toNum(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') { const n = Number(v); return Number.isNaN(n) ? 0 : n; }
    if (v && v.__ref) return this.toNum(v.__ref.get());
    err('E10', `cannot convert to number: ${JSON.stringify(v)}`);
  }
  toStr(v) {
    if (v && v.__char) return v.value;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v && v.__ref) return this.toStr(v.__ref.get());
    return '';
  }
  toChar(v) {
    if (v && v.__char) return v;
    const s = this.toStr(v);
    const chars = [...s];
    if (!chars.length) return { __char: true, value: '\0' };
    return { __char: true, value: chars[0] };
  }
  toBool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v !== '';
    return false;
  }
  toKey(v) { return String(v); }
  looseEq(a, b) {
    if (typeof a === 'string' || typeof b === 'string') return this.toStr(a) === this.toStr(b);
    if (typeof a === typeof b) return a === b;
    return this.toStr(a) === this.toStr(b);
  }
  compare(a, b) {
    if ((a && a.__char) || (b && b.__char) || typeof a === 'string' || typeof b === 'string') {
      const sa = this.toStr(a), sb = this.toStr(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    }
    return this.toNum(a) - this.toNum(b);
  }
  defaultValue(type) {
    if (!type) return 0;
    switch (type.kind) {
      case 'number': return 0;
      case 'string': return '';
      case 'char': return { __char: true, value: '\0' };
      case 'bool': return false;
      case 'auto': return 0;
      case 'struct': {
        const s = this.structs.get(type.name);
        if (!s) err('E40', `unknown struct: ${type.name}`);
        const obj = {};
        for (const f of s.fields) obj[f.name] = this.defaultValue(f.type);
        return { __struct: type.name, ...obj };
      }
      case 'deque': return { __container: new Deque(), __elemType: type };
      case 'list': return { __container: new ListContainer(), __elemType: type };
      case 'set': return { __container: new SetContainer(), __elemType: type };
      case 'multiset': return { __container: new MultiSetContainer(), __elemType: type };
      case 'map': return { __container: new MapContainer(), __elemType: type };
      case 'multimap': return { __container: new MultiMapContainer(), __elemType: type };
      case 'pair':
        return {
          __pair: true,
          first: this.defaultValue(type.first),
          second: this.defaultValue(type.second),
          __pairType: type,
        };
      case 'tuple':
        return {
          __tuple: true,
          items: (type.elems || []).map((e) => this.defaultValue(e)),
          __tupleType: type,
        };
      default: return 0;
    }
  }
  cloneValue(v) {
    if (typeof v === 'object' && v) {
      if (v.__container || v.__native || v.__group) return v;
      return { ...v };
    }
    return v;
  }
  iterableValues(v) {
    if (v && v.__container) {
      const c = v.__container;
      if (c instanceof MapContainer) return c.keysList();
      const out = [];
      for (let i = 0; i < c.size(); i++) out.push(c.get(i));
      return out;
    }
    if (v && v.__native) return v.__native;
    if (v && v.__group) return v.__group;
    err('E10', 'not iterable');
  }
  coerce(v, type, name) {
    if (!type) return v;
    if (type.kind === 'number') return this.toNum(v);
    if (type.kind === 'string') return this.toStr(v).trim();
    if (type.kind === 'bool') return this.toBool(v);
    if (type.kind === 'char') return this.toChar(v);
    if (type.kind === 'auto') return v;
    return v;
  }

  async finish(signal) {
    if (!signal) {
      return {
        status: 200,
        body: this.output,
        redirect: false,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      };
    }
    const { value, mods } = signal;
    // return 的 with 含义由 return 定义：status / header / proxy
    if (mods && mods.length) this.assertWithMods('return', mods);

    let statusCode = null;
    let proxy = null;
    let redirectMode = 'auto';
    const customHeaders = {};
    const FORBIDDEN = new Set(['location', 'content-length', 'transfer-encoding']);

    for (const m of mods) {
      if (m.kind === 'status') statusCode = this.toNum(await this.evalExpr(m.value));
      else if (m.kind === 'proxy') proxy = this.toStr(await this.evalExpr(m.value));
      else if (m.kind === 'redirectMode') {
        redirectMode = typeof m.value === 'string' ? m.value : 'auto';
      } else if (m.kind === 'header') {
        for (const h of m.value) {
          const k = h.key.toLowerCase();
          if (FORBIDDEN.has(k)) err('E53', `forbidden response header: ${h.key}`);
          customHeaders[h.key] = this.toStr(await this.evalExpr(h.value));
        }
      } else {
        err('E52', `with ${m.kind} is not defined for return`);
      }
    }

    const plainHeaders = { 'Content-Type': 'text/plain; charset=utf-8', ...customHeaders };

    if (value === null) {
      return {
        status: statusCode !== null ? statusCode : 200,
        body: this.output,
        redirect: false,
        headers: plainHeaders,
      };
    }
    // 按 main 声明类型强制转换
    const mrt = this.mainReturnType || { kind: 'auto' };
    let outVal = value;
    if (mrt.kind === 'bool') outVal = this.toBool(value);
    else if (mrt.kind === 'number') outVal = this.toNum(value);
    else if (mrt.kind === 'string') outVal = this.toStr(value);
    else if (mrt.kind === 'char') outVal = this.toChar(value);
    else if (mrt.kind === 'void') outVal = null;

    // 仅 auto main 且返回 string 才视为 URL 跳转
    if (mrt.kind === 'auto' && typeof outVal === 'string') {
      if (statusCode !== null && (statusCode < 300 || statusCode >= 400)) {
        err('E44', 'cannot return body; use out() + return with N');
      }
      let target = normalizeReturnUrl(outVal);
      if (proxy) target = proxy.replace(/\/+$/, '') + '/' + target;
      assertSafeUrl(target, this.ctx.env);
      return {
        status: statusCode !== null ? statusCode : 302,
        redirect: true,
        redirectMode,
        url: target,
        body: this.output,
        headers: customHeaders,
      };
    }

    if (outVal === null || mrt.kind === 'void') {
      return {
        status: statusCode !== null ? statusCode : 200,
        body: this.output,
        redirect: false,
        headers: plainHeaders,
      };
    }
    if (typeof outVal === 'number' || typeof outVal === 'boolean' || (outVal && outVal.__char)) {
      // 非 URL：写入输出可选；状态码优先
      return {
        status: statusCode !== null ? statusCode : 200,
        body: this.output,
        redirect: false,
        headers: plainHeaders,
        value: outVal,
      };
    }
    if (typeof outVal === 'string') {
      // string main：返回字符串不跳转，可当 body 追加
      if (this.output) {
        return { status: statusCode !== null ? statusCode : 200, body: this.output, redirect: false, headers: plainHeaders };
      }
      return {
        status: statusCode !== null ? statusCode : 200,
        body: outVal,
        redirect: false,
        headers: plainHeaders,
      };
    }
    err('E13', 'return type mismatch');
  }


  /** 取出可排序/遍历的底层数组（deque / 原生数组） */
  unwrapSeq(v, name = 'container') {
    if (v && v.__container) {
      const c = v.__container;
      if (c instanceof MapContainer || c instanceof MultiMapContainer) {
        err('E10', `${name}: map/multimap not supported here, use keys()/values()`);
      }
      if (Array.isArray(c.items)) return c.items;
    }
    if (v && v.__native && Array.isArray(v.__native)) return v.__native;
    if (Array.isArray(v)) return v;
    err('E10', `${name}: expected deque or array`);
  }

  defaultLess(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a < b;
    // 数字字符串按数值
    if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b))) {
      return a < Number(b);
    }
    if (typeof b === 'number' && typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a))) {
      return Number(a) < b;
    }
    return String(a) < String(b);
  }

  defaultEqual(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
    return String(a) === String(b);
  }

  get builtinFunctions() {
    if (this._builtins) return this._builtins;
    const self = this;
    this._builtins = {
      get: async (args) => {
        return await self.doHttpGet('GET', self.toStr(args[0]), null, {
          headers: {}, params: {}, ua: null, proxy: null, useWorker: false,
        });
      },
      post: async (args) => {
        const body = args.length > 1 ? self.toStr(args[1]) : '';
        return await self.doHttpGet('POST', self.toStr(args[0]), body, {
          headers: {}, params: {}, ua: null, proxy: null, useWorker: false,
        });
      },
      get_all: async (args) => {
        const urls = self.unwrapSeq(args[0], 'get_all');
        const tasks = urls.map((u) => self.doHttpGet('GET', self.toStr(u), null, {
          headers: {}, params: {}, ua: null, proxy: null, useWorker: false,
        }));
        const bodies = await Promise.all(tasks);
        const d = new Deque();
        for (const b of bodies) d.push_back(b);
        return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'string' } } };
      },
      post_all: async (args) => {
        const urls = self.unwrapSeq(args[0], 'post_all');
        const bodies = self.unwrapSeq(args[1], 'post_all bodies');
        if (urls.length !== bodies.length) err('E09', 'post_all length mismatch');
        const tasks = urls.map((u, i) => self.doHttpGet('POST', self.toStr(u), self.toStr(bodies[i]), {
          headers: {}, params: {}, ua: null, proxy: null, useWorker: false,
        }));
        const results = await Promise.all(tasks);
        const d = new Deque();
        for (const b of results) d.push_back(b);
        return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'string' } } };
      },
      modal: async (args) => {
        const msg = self.toStr(args[0] ?? '');
        if (self.ctx && typeof self.ctx.showModal === 'function') {
          return await self.ctx.showModal(msg);
        }
        return true;
      },
      // string / cstring 风格
      strlen: (args) => [...self.toStr(args[0])].length,
      strcmp: (args) => {
        const a = self.toStr(args[0]), b = self.toStr(args[1]);
        return a < b ? -1 : a > b ? 1 : 0;
      },
      strncmp: (args) => {
        const n = Math.max(0, Math.trunc(self.toNum(args[2])));
        const a = self.toStr(args[0]).slice(0, n);
        const b = self.toStr(args[1]).slice(0, n);
        return a < b ? -1 : a > b ? 1 : 0;
      },
      strcat: (args) => self.toStr(args[0]) + self.toStr(args[1]),
      strcpy: (args) => self.toStr(args[1]),
      strstr: (args) => {
        const hay = self.toStr(args[0]), needle = self.toStr(args[1]);
        const i = hay.indexOf(needle);
        return i < 0 ? '' : hay.slice(i);
      },
      substr: (args) => {
        const s = self.toStr(args[0]);
        const start = Math.trunc(self.toNum(args[1]));
        if (args.length > 2) return s.slice(start, start + Math.trunc(self.toNum(args[2])));
        return s.slice(start);
      },
      char_at: (args) => {
        const s = self.toStr(args[0]);
        const i = Math.trunc(self.toNum(args[1]));
        const chars = [...s];
        if (i < 0 || i >= chars.length) return { __char: true, value: '\0' };
        return { __char: true, value: chars[i] };
      },

      sleep: async (args) => {
        let ms = self.toNum(args[0]);
        if (ms < 0) ms = 0;
        if (ms > 60000) ms = 60000;
        const signal = self.ctx.abortSignal;
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, ms);
          if (signal) {
            if (signal.aborted) {
              clearTimeout(t);
              reject(Object.assign(new Error('execution aborted'), { code: 'E60' }));
              return;
            }
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(Object.assign(new Error('execution aborted'), { code: 'E60' }));
            }, { once: true });
          }
        });
        return null;
      },
      status: () => self.lastStatus,
      // ★ 流式 out：每次调用触发 onChunk
      out: (args) => {
        const s = self.toStr(args[0]);
        if (self.output.length + s.length > MAX_OUT) err('E51', 'output exceeds 1MB');
        self.output += s;
        if (self.ctx.onChunk) self.ctx.onChunk(s);
        return null;
      },
      getchar: async () => {
        if (self.ctx.onNeedInput) self.ctx.onNeedInput();
        return await self.ctx.inputStream.getchar();
      },
      q_get: (args) => self.resolveQueryParam(self.toStr(args[0])),
      json_str: (args) => self.jsonGet(args[0], args[1], 'string'),
      json_num: (args) => self.jsonGet(args[0], args[1], 'number'),
      json_bool: (args) => self.jsonGet(args[0], args[1], 'bool'),
      json_len: (args) => self.jsonLen(args[0], args[1]),
      urlencode: (args) => encodeURIComponent(self.toStr(args[0])),
      replace: (args) => self.toStr(args[0]).split(self.toStr(args[1])).join(self.toStr(args[2])),
      contains: (args) => self.toStr(args[0]).includes(self.toStr(args[1])),
      startsWith: (args) => self.toStr(args[0]).startsWith(self.toStr(args[1])),
      endsWith: (args) => self.toStr(args[0]).endsWith(self.toStr(args[1])),
      len: (args) => self.toStr(args[0]).length,
      to_num: (args) => { const n = Number(self.toStr(args[0])); return Number.isNaN(n) ? 0 : n; },
      to_str: (args) => self.toStr(args[0]),
      regex: (args) => {
        try {
          const m = new RegExp(self.toStr(args[1])).exec(self.toStr(args[0]));
          return m ? (m[1] !== undefined ? m[1] : m[0]) : '';
        } catch { err('E10', 'invalid regex'); }
      },

      // ---- <algorithm> 风格（对 deque / 原生数组就地或返回值）----
      sort: (args) => {
        const arr = self.unwrapSeq(args[0], 'sort');
        const desc = args.length > 1 && (self.toStr(args[1]) === 'desc' || self.toStr(args[1]) === 'greater');
        arr.sort((a, b) => {
          if (self.defaultEqual(a, b)) return 0;
          const less = self.defaultLess(a, b);
          return desc ? (less ? 1 : -1) : (less ? -1 : 1);
        });
        return null;
      },
      reverse: (args) => {
        self.unwrapSeq(args[0], 'reverse').reverse();
        return null;
      },
      unique: (args) => {
        // 去掉连续重复（与 C++ unique 类似，通常先 sort）
        const arr = self.unwrapSeq(args[0], 'unique');
        if (!arr.length) return 0;
        let w = 1;
        for (let r = 1; r < arr.length; r++) {
          if (!self.defaultEqual(arr[r], arr[w - 1])) arr[w++] = arr[r];
        }
        arr.length = w;
        return w;
      },
      find: (args) => {
        const arr = self.unwrapSeq(args[0], 'find');
        const x = args[1];
        for (let i = 0; i < arr.length; i++) {
          if (self.defaultEqual(arr[i], x)) return i;
        }
        return -1;
      },
      count: (args) => {
        const arr = self.unwrapSeq(args[0], 'count');
        const x = args[1];
        let n = 0;
        for (const v of arr) if (self.defaultEqual(v, x)) n++;
        return n;
      },
      min_element: (args) => {
        const arr = self.unwrapSeq(args[0], 'min_element');
        if (!arr.length) err('E23', 'min_element on empty');
        let m = arr[0];
        for (let i = 1; i < arr.length; i++) if (self.defaultLess(arr[i], m)) m = arr[i];
        return m;
      },
      max_element: (args) => {
        const arr = self.unwrapSeq(args[0], 'max_element');
        if (!arr.length) err('E23', 'max_element on empty');
        let m = arr[0];
        for (let i = 1; i < arr.length; i++) if (self.defaultLess(m, arr[i])) m = arr[i];
        return m;
      },
      binary_search: (args) => {
        const arr = self.unwrapSeq(args[0], 'binary_search');
        const x = args[1];
        let lo = 0, hi = arr.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (self.defaultLess(arr[mid], x)) lo = mid + 1;
          else hi = mid;
        }
        return lo < arr.length && self.defaultEqual(arr[lo], x);
      },
      lower_bound: (args) => {
        const arr = self.unwrapSeq(args[0], 'lower_bound');
        const x = args[1];
        let lo = 0, hi = arr.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (self.defaultLess(arr[mid], x)) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      upper_bound: (args) => {
        const arr = self.unwrapSeq(args[0], 'upper_bound');
        const x = args[1];
        let lo = 0, hi = arr.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (!self.defaultLess(x, arr[mid])) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      fill_n: (args) => {
        // fill_n(d, n, value) 从 0 写 n 个；若 d 更短则扩展
        const arr = self.unwrapSeq(args[0], 'fill_n');
        const n = self.toNum(args[1]);
        const val = args[2];
        if (n < 0) err('E10', 'fill_n: n < 0');
        while (arr.length < n) arr.push(val);
        for (let i = 0; i < n; i++) arr[i] = val;
        return null;
      },
      iota: (args) => {
        // iota(d, start) 顺序填 start, start+1, ...
        const arr = self.unwrapSeq(args[0], 'iota');
        let v = self.toNum(args[1]);
        for (let i = 0; i < arr.length; i++) arr[i] = v++;
        return null;
      },
      accumulate: (args) => {
        const arr = self.unwrapSeq(args[0], 'accumulate');
        let sum = args.length > 1 ? self.toNum(args[1]) : 0;
        for (const x of arr) sum += self.toNum(x);
        return sum;
      },
      swap_ranges: (args) => {
        // swap(d, i, j) 交换下标
        const arr = self.unwrapSeq(args[0], 'swap');
        const i = self.toNum(args[1]);
        const j = self.toNum(args[2]);
        if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) err('E23', 'swap index out of range');
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        return null;
      },
      next_permutation: (args) => {
        const arr = self.unwrapSeq(args[0], 'next_permutation');
        // 标准 next_permutation
        let i = arr.length - 2;
        while (i >= 0 && !self.defaultLess(arr[i], arr[i + 1])) i--;
        if (i < 0) {
          arr.reverse();
          return false;
        }
        let j = arr.length - 1;
        while (!self.defaultLess(arr[i], arr[j])) j--;
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        let lo = i + 1, hi = arr.length - 1;
        while (lo < hi) {
          const u = arr[lo];
          arr[lo] = arr[hi];
          arr[hi] = u;
          lo++;
          hi--;
        }
        return true;
      },
      prev_permutation: (args) => {
        const arr = self.unwrapSeq(args[0], 'prev_permutation');
        let i = arr.length - 2;
        while (i >= 0 && !self.defaultLess(arr[i + 1], arr[i])) i--;
        if (i < 0) {
          arr.reverse();
          return false;
        }
        let j = arr.length - 1;
        while (!self.defaultLess(arr[j], arr[i])) j--;
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        let lo = i + 1, hi = arr.length - 1;
        while (lo < hi) {
          const u = arr[lo];
          arr[lo] = arr[hi];
          arr[hi] = u;
          lo++;
          hi--;
        }
        return true;
      },
      is_sorted: (args) => {
        const arr = self.unwrapSeq(args[0], 'is_sorted');
        for (let i = 1; i < arr.length; i++) {
          if (self.defaultLess(arr[i], arr[i - 1])) return false;
        }
        return true;
      },


      // ---- pair / tuple ----
      make_pair: (args) => {
        if (args.length !== 2) err('E09', 'make_pair requires 2 arguments');
        return { __pair: true, first: args[0], second: args[1] };
      },
      make_tuple: (args) => {
        return { __tuple: true, items: [...args] };
      },
      tget: (args) => {
        // tget(tuple, i) 或 tget(pair, 0|1) — 避免与 HTTP get() 重名
        const t = args[0];
        const i = self.toNum(args[1]);
        if (t && t.__tuple) {
          if (i < 0 || i >= t.items.length) err('E23', `tuple tget index ${i} out of range`);
          return t.items[i];
        }
        if (t && t.__pair) {
          if (i === 0) return t.first;
          if (i === 1) return t.second;
          err('E23', 'pair tget index must be 0 or 1');
        }
        err('E10', 'tget expects pair or tuple');
      },
      // ---- <cmath> ----
      abs: (args) => Math.abs(self.toNum(args[0])),
      fabs: (args) => Math.abs(self.toNum(args[0])),
      sqrt: (args) => Math.sqrt(self.toNum(args[0])),
      cbrt: (args) => Math.cbrt(self.toNum(args[0])),
      hypot: (args) => Math.hypot(...args.map((a) => self.toNum(a))),
      exp: (args) => Math.exp(self.toNum(args[0])),
      exp2: (args) => Math.pow(2, self.toNum(args[0])),
      log: (args) => Math.log(self.toNum(args[0])),
      log10: (args) => Math.log10(self.toNum(args[0])),
      log2: (args) => Math.log2(self.toNum(args[0])),
      sin: (args) => Math.sin(self.toNum(args[0])),
      cos: (args) => Math.cos(self.toNum(args[0])),
      tan: (args) => Math.tan(self.toNum(args[0])),
      asin: (args) => Math.asin(self.toNum(args[0])),
      acos: (args) => Math.acos(self.toNum(args[0])),
      atan: (args) => Math.atan(self.toNum(args[0])),
      atan2: (args) => Math.atan2(self.toNum(args[0]), self.toNum(args[1])),
      sinh: (args) => Math.sinh(self.toNum(args[0])),
      cosh: (args) => Math.cosh(self.toNum(args[0])),
      tanh: (args) => Math.tanh(self.toNum(args[0])),
      round: (args) => Math.round(self.toNum(args[0])),
      trunc: (args) => Math.trunc(self.toNum(args[0])),
      fmod: (args) => {
        const x = self.toNum(args[0]);
        const y = self.toNum(args[1]);
        if (y === 0) err('E34', 'fmod by zero');
        return x % y;
      },
      copysign: (args) => {
        const mag = Math.abs(self.toNum(args[0]));
        const sgn = self.toNum(args[1]);
        return sgn < 0 ? -mag : mag;
      },
      // ---- <cstdio> 子集 ----
      puts: (args) => {
        const s = self.toStr(args[0]) + '\n';
        if (self.output.length + s.length > MAX_OUT) err('E51', 'output exceeds 1MB');
        self.output += s;
        if (self.ctx.onChunk) self.ctx.onChunk(s);
        return 0;
      },
      printf: (args) => {
        const out = self.formatPrintf(self.toStr(args[0]), args.slice(1));
        if (self.output.length + out.length > MAX_OUT) err('E51', 'output exceeds 1MB');
        self.output += out;
        if (self.ctx.onChunk) self.ctx.onChunk(out);
        return out.length;
      },
      sprintf: (args) => self.formatPrintf(self.toStr(args[0]), args.slice(1)),

      min: (args) => (self.toNum(args[0]) < self.toNum(args[1]) ? args[0] : args[1]),
      max: (args) => (self.toNum(args[0]) > self.toNum(args[1]) ? args[0] : args[1]),
      pow: (args) => Math.pow(self.toNum(args[0]), self.toNum(args[1])),
      rand: (args) => {
        if (args.length === 0) return Math.random();
        const n = self.toNum(args[0]);
        if (n <= 0) err('E10', 'rand(n) requires positive n');
        return Math.floor(Math.random() * n);
      },
      ceil: (args) => Math.ceil(self.toNum(args[0])),
      floor: (args) => Math.floor(self.toNum(args[0])),
    };
    return this._builtins;
  }

  jsonGet(body, path, type) {
    const data = this.parseJson(this.toStr(body));
    const v = this.jsonPath(data, this.toStr(path));
    if (type === 'string') {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }
    if (type === 'number') {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    }
    if (type === 'bool') {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'string') return v !== '' && v !== '0' && v !== 'false';
      return false;
    }
  }

  jsonLen(body, path) {
    const data = this.parseJson(this.toStr(body));
    const v = this.jsonPath(data, this.toStr(path));
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === 'object') return Object.keys(v).length;
    if (typeof v === 'string') return v.length;
    return 0;
  }

  parseJson(text) {
    try { return JSON.parse(text); } catch { err('E20', 'invalid JSON'); }
  }

  jsonPath(data, path) {
    if (path === '$') return data;
    const p = path.replace(/^\$\./, '').replace(/^\$/, '');
    if (!p) return data;
    const tokens = [];
    let i = 0;
    while (i < p.length) {
      if (p[i] === '.') { i++; continue; }
      if (p[i] === '[') {
        const end = p.indexOf(']', i);
        if (end < 0) return null;
        const inner = p.slice(i + 1, end);
        if (inner === '*') tokens.push({ star: true });
        else tokens.push({ idx: parseInt(inner, 10) });
        i = end + 1;
        continue;
      }
      const dot = p.indexOf('.', i);
      const br = p.indexOf('[', i);
      const nextStop = [dot, br].filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? p.length;
      const key = p.slice(i, nextStop);
      if (key) tokens.push({ key });
      i = nextStop;
    }
    let cur = data;
    for (const t of tokens) {
      if (cur == null) return null;
      if (t.star) continue;
      if (t.key !== undefined) cur = cur[t.key];
      else if (t.idx !== undefined) cur = cur[t.idx];
    }
    return cur;
  }
}

export { MAX_LOOP, MAX_RECURSION, MAX_FETCH };