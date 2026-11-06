// interpreter.js
import { err, fail } from './errors.js';
import { Deque, SetContainer, MapContainer } from './containers.js';
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
  },
  post: {
    param: 'query parameters',
    header: 'request headers',
    ua: 'User-Agent',
    proxy: 'proxy URL prefix',
  },
  return: {
    status: 'HTTP status code',
    header: 'response headers',
    proxy: 'redirect URL proxy prefix',
  },
};

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
    if (!main) err('E14', 'missing auto main()');
    // auto main（推荐）或 void main（兼容）；return 可返回 URL / 状态码 / 空
    if (main.returnType.kind !== 'auto' && main.returnType.kind !== 'void') {
      err('E14', 'main must be auto (or void for compatibility)');
    }
    if (main.params.length !== 0) err('E14', 'main must have no parameters');

    // 直接执行 main 体，保留 ReturnSignal（含 mods），供 finish 处理
    const saved = this.scope;
    this.scope = new Scope(this.global);
    let retSignal = null;
    try {
      for (const stmt of main.body) await this.execStmt(stmt);
    } catch (e) {
      if (e instanceof ReturnSignal) retSignal = e;
      else throw e;
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
    const q = (n) => url.searchParams.get(n) ?? '';
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
    this.global.declare('key', this.parseKeyParam(q('key')));
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
    if (raw == null || raw === '') return '';
    const s = String(raw).trim();
    if (!(s.startsWith('{') && s.endsWith('}'))) return s;

    const inner = s.slice(1, -1).trim();
    const d = new Deque();
    if (!inner) {
      return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
    }

    // 按逗号拆分，尊重引号
    const parts = [];
    let i = 0;
    while (i < inner.length) {
      while (i < inner.length && /\s/.test(inner[i])) i++;
      if (i >= inner.length) break;
      if (inner[i] === '"' || inner[i] === "'") {
        const quote = inner[i++];
        let val = '';
        while (i < inner.length && inner[i] !== quote) {
          if (inner[i] === '\\' && i + 1 < inner.length) {
            val += inner[i + 1];
            i += 2;
          } else {
            val += inner[i++];
          }
        }
        if (i < inner.length) i++; // closing quote
        parts.push({ kind: 'string', value: val });
      } else {
        let start = i;
        while (i < inner.length && inner[i] !== ',') i++;
        const tok = inner.slice(start, i).trim();
        if (tok === 'true') parts.push({ kind: 'bool', value: true });
        else if (tok === 'false') parts.push({ kind: 'bool', value: false });
        else if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(tok)) parts.push({ kind: 'number', value: Number(tok) });
        else parts.push({ kind: 'string', value: tok });
      }
      while (i < inner.length && /\s/.test(inner[i])) i++;
      if (i < inner.length && inner[i] === ',') i++;
    }

    for (const part of parts) d.push_back(part.value);
    return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
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
      value = { __uninit: true, type: node.varType };
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
    if (type.kind === 'set') return new SetContainer();
    if (type.kind === 'map') return new MapContainer();
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
      default: err('E03', `unknown statement: ${node.type}`);
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
    const token = this.ctx.inputStream.readToken();
    if (token === null) return;
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
      case 'Bool': return node.value;
      case 'Ident': return this.lookupIdent(node.name);
      case 'Binary': return await this.evalBinary(node);
      case 'Unary': return await this.evalUnary(node);
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
        if (typeof l === 'string' || typeof r === 'string') return this.toStr(l) + this.toStr(r);
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
      if (target && target.__container) {
        const c = target.__container;
        if (c instanceof MapContainer) {
          const k = this.toKey(idx);
          return new RefBox(
            () => c.has(k) ? c.get(k) : this.defaultValue(target.__elemType.val),
            (v) => c.set(k, v),
            target.__elemType,
          );
        }
        const i = this.toNum(idx);
        return new RefBox(
          () => c.get(i),
          (v) => {
            const et = this.containerElemType(target);
            c.set(i, (!et || et.kind === 'auto') ? v : this.coerce(v, et, 'index'));
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
      const target = await this.evalExpr(node.target);
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
    if (target && target.__container) {
      const c = target.__container;
      if (c instanceof MapContainer) {
        const k = this.toKey(index);
        if (!c.has(k)) return this.defaultValue(target.__elemType.val);
        return c.get(k);
      }
      return c.get(this.toNum(index));
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
    if (target && (target.__container || target.__group || target.__native || target.__struct)) {
      return { __methodRef: { target, name: node.name } };
    }
    if (target && typeof target === 'object' && node.name in target) {
      return target[node.name];
    }
    err('E10', `unknown member: ${node.name}`);
  }

  async evalCall(node) {
    if (node.callee.type === 'Ident') {
      const name = node.callee.name;
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
    const coerceElem = (v) => {
      if (!elemType || elemType.kind === 'auto') return v;
      return this.coerce(v, elemType, name);
    };
    switch (name) {
      case 'size': return c.size();
      case 'find': return c.find ? c.find(args[0]) : -1;
      case 'front': return c.front ? c.front() : err('E10', 'no front');
      case 'back': return c.back ? c.back() : err('E10', 'no back');
      case 'push_back': c.push_back(coerceElem(args[0])); return;
      case 'push_front': c.push_front(coerceElem(args[0])); return;
      case 'pop_back': c.pop_back(); return;
      case 'pop_front': c.pop_front(); return;
      case 'erase': isMap ? c.erase(this.toKey(args[0])) : c.erase(this.toNum(args[0])); return;
      case 'insert':
        if (isMap) c.set(this.toKey(args[0]), coerceElem(args[1]));
        else c.insert(this.toNum(args[0]), coerceElem(args[1]));
        return;
      case 'clear': c.clear(); return;
      case 'fill': c.fill(coerceElem(args[0])); return;
      case 'has': if (isMap) return c.has(this.toKey(args[0])); err('E10', 'has only on map');
      case 'keys': {
        if (!isMap) err('E10', 'keys only on map');
        const d = new Deque();
        for (const k of c.keysList()) d.push_back(k);
        return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
      }
      case 'values': {
        if (!isMap) err('E10', 'values only on map');
        const d = new Deque();
        for (const v of c.valuesList()) d.push_back(v);
        return { __container: d, __elemType: { kind: 'deque', elem: { kind: 'auto' } } };
      }
      default: err('E10', `unknown container method: ${name}`);
    }
  }

  /** 取出容器元素类型：支持 {kind:'deque',elem} 或旧的 {kind:'auto'} */
  containerElemType(target) {
    const t = target && target.__elemType;
    if (!t) return { kind: 'auto' };
    if (t.kind === 'deque' || t.kind === 'set') return t.elem || { kind: 'auto' };
    if (t.kind === 'map') return t.val || { kind: 'auto' };
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

    const opts = { method, proxy: null, ua: null, headers: {}, params: {} };
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
        default:
          err('E52', `with ${m.kind} is not defined for ${call.callee.name}()`);
      }
    }
    return await this.doHttpGet(method, url, body, opts);
  }

  async doHttpGet(method, url, body, opts) {
    if (++this.fetchCount > MAX_FETCH) err('E24', 'fetch count exceeds 20');
    const r = await doRequest(url, {
      method,
      body,
      headers: opts.headers,
      ua: opts.ua,
      proxy: opts.proxy,
      params: opts.params,
    }, this.ctx.env);
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
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v && v.__ref) return this.toStr(v.__ref.get());
    return '';
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
    if (typeof a === 'string' || typeof b === 'string') {
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
      case 'set': return { __container: new SetContainer(), __elemType: type };
      case 'map': return { __container: new MapContainer(), __elemType: type };
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
    if (type.kind === 'string') return this.toStr(v);
    if (type.kind === 'bool') return this.toBool(v);
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
    const customHeaders = {};
    const FORBIDDEN = new Set(['location', 'content-length', 'transfer-encoding']);

    for (const m of mods) {
      if (m.kind === 'status') statusCode = this.toNum(await this.evalExpr(m.value));
      else if (m.kind === 'proxy') proxy = this.toStr(await this.evalExpr(m.value));
      else if (m.kind === 'header') {
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
    if (typeof value === 'number') {
      return {
        status: statusCode !== null ? statusCode : value,
        body: this.output,
        redirect: false,
        headers: plainHeaders,
      };
    }
    if (typeof value === 'string') {
      if (statusCode !== null && (statusCode < 300 || statusCode >= 400)) {
        err('E44', 'cannot return body; use out() + return with N');
      }
      let target = normalizeReturnUrl(value);
      if (proxy) target = proxy.replace(/\/+$/, '') + '/' + target;
      assertSafeUrl(target, this.ctx.env);
      return {
        status: statusCode !== null ? statusCode : 302,
        redirect: true,
        url: target,
        headers: customHeaders,
      };
    }
    err('E13', 'return type mismatch');
  }

  get builtinFunctions() {
    if (this._builtins) return this._builtins;
    const self = this;
    this._builtins = {
      get: async (args) => {
        if (++self.fetchCount > MAX_FETCH) err('E24', 'fetch count exceeds 20');
        const url = self.toStr(args[0]);
        const r = await doRequest(url, { method: 'GET' }, self.ctx.env);
        self.lastStatus = r.status;
        self.lastHeaders = r.headers;
        return r.body;
      },
      post: async (args) => {
        if (++self.fetchCount > MAX_FETCH) err('E24', 'fetch count exceeds 20');
        const url = self.toStr(args[0]);
        const body = args.length > 1 ? self.toStr(args[1]) : '';
        const r = await doRequest(url, { method: 'POST', body }, self.ctx.env);
        self.lastStatus = r.status;
        self.lastHeaders = r.headers;
        return r.body;
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
      getchar: () => self.ctx.inputStream.getchar(),
      q_get: (args) => self.ctx.url.searchParams.get(self.toStr(args[0])) ?? '',
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