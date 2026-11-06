// parser.js
import { err } from './errors.js';
import { tokenize } from './lexer.js';

export function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = (o = 0) => tokens[pos + o] || tokens[tokens.length - 1];
  const next = () => tokens[pos++];
  const check = (type, value) => {
    const t = peek();
    return t.type === type && (value === undefined || t.value === value);
  };
  const match = (type, value) => (check(type, value) ? next() : null);
  const expect = (type, value) => {
    if (!check(type, value)) {
      const t = peek();
      err('E03', `expected ${value || type}, got ${t.value ?? t.type}`, t.line, t.col);
    }
    return next();
  };

  /** 关键字不可作变量名；若误用则明确报错 */
  const expectIdentName = (what = 'identifier') => {
    const t = peek();
    if (t.type === 'IDENT') return next().value;
    if (t.type === 'KEYWORD') {
      err(
        'E03',
        `'${t.value}' is a reserved keyword and cannot be used as a ${what}; rename the variable`,
        t.line,
        t.col,
      );
    }
    err('E03', `expected ${what}, got ${t.value ?? t.type}`, t.line, t.col);
  };

  /* ---------- 类型 ---------- */
  const isTypeStart = () => {
    const t = peek();
    if (t.type === 'KEYWORD') {
      return ['number', 'string', 'bool', 'auto', 'void', 'deque', 'set', 'map'].includes(t.value);
    }
    // struct 名作为类型：IDENT 后跟 IDENT 或 &
    if (t.type === 'IDENT' && (peek(1).type === 'IDENT' || (peek(1).type === 'OP' && peek(1).value === '&'))) {
      return true;
    }
    return false;
  };

  const parseType = () => {
    const t = peek();
    if (t.type === 'IDENT') {
      next();
      return { kind: 'struct', name: t.value };
    }
    if (t.type !== 'KEYWORD') err('E10', `expected type, got ${t.value ?? t.type}`, t.line, t.col);

    if (['number', 'string', 'bool', 'auto', 'void'].includes(t.value)) {
      next();
      return { kind: t.value };
    }
    if (t.value === 'deque' || t.value === 'set') {
      next();
      expect('OP', '<');
      const elem = parseType();
      expect('OP', '>');
      return { kind: t.value, elem };
    }
    if (t.value === 'map') {
      next();
      expect('OP', '<');
      const key = parseType();
      expect('OP', ',');
      const val = parseType();
      expect('OP', '>');
      return { kind: 'map', key, val };
    }
    err('E10', `unknown type: ${t.value}`, t.line, t.col);
  };

  /* ---------- 顶层 ---------- */
  const program = () => {
    const body = [];
    while (!check('EOF')) body.push(topLevel());
    return { type: 'Program', body };
  };

  const topLevel = () => {
    if (check('KEYWORD', 'struct')) return structDecl();
    if (isTypeStart()) return funcOrGlobal();
    return statement();
  };

  const structDecl = () => {
    expect('KEYWORD', 'struct');
    const name = expect('IDENT').value;
    expect('OP', '{');
    const fields = [];
    while (!check('OP', '}')) {
      const type = parseType();
      const fname = expectIdentName('field name');
      expect('OP', ';');
      fields.push({ type, name: fname });
    }
    expect('OP', '}');
    expect('OP', ';');
    return { type: 'StructDecl', name, fields };
  };

  // 可能是函数声明或全局变量声明
  const funcOrGlobal = () => {
    const save = pos;
    const type = parseType();

    // 引用声明：type& name = ...
    if (check('OP', '&')) {
      next();
      const name = expectIdentName('variable name');
      expect('OP', '=');
      const init = expression();
      expect('OP', ';');
      return { type: 'RefDecl', varType: type, name, init, scope: 'global' };
    }

    // 函数：type name(...
    if (check('IDENT') && peek(1).type === 'OP' && peek(1).value === '(') {
      const fname = next().value;
      expect('OP', '(');
      const params = [];
      while (!check('OP', ')')) {
        const ptype = parseType();
        let isRef = false;
        if (check('OP', '&')) { next(); isRef = true; }
        const pname = expectIdentName('parameter name');
        params.push({ type: ptype, name: pname, isRef });
        if (!check('OP', ')')) expect('OP', ',');
      }
      expect('OP', ')');
      expect('OP', '{');
      const body = [];
      while (!check('OP', '}')) body.push(statement());
      expect('OP', '}');
      return { type: 'FuncDecl', returnType: type, name: fname, params, body };
    }

    // 全局变量声明
    return varDeclFromType(type, 'global');
  };

  // 从类型开始解析变量声明（全局或局部）
  const varDeclFromType = (type, scope = 'local') => {
    // 容器组 / 普通声明 都需要先看 name
    const name = expectIdentName('variable name');

    // 原生数组：number a[5];  或者 number m[3][4];
    // 但容器组：deque<number> a[5];
    // 区分：type 是 deque/set/map 时为容器组，否则为原生数组
    if (check('OP', '[')) {
      if (type.kind === 'deque' || type.kind === 'set') {
        // 容器组
        next();
        const size = expression();
        expect('OP', ']');
        expect('OP', ';');
        return { type: 'ContainerGroupDecl', varType: type, name, size };
      }
      if (type.kind === 'map') {
        err('E19', 'map does not support container group', peek().line, peek().col);
      }
      // 原生数组
      const dims = [];
      while (check('OP', '[')) {
        next();
        dims.push(expression());
        expect('OP', ']');
      }
      expect('OP', ';');
      return { type: 'NativeArrayDecl', elemType: type, name, dims };
    }

    // 容器初始化 a(n)
    if ((type.kind === 'deque' || type.kind === 'set') && check('OP', '(')) {
      next();
      const size = expression();
      expect('OP', ')');
      expect('OP', ';');
      return { type: 'ContainerInitDecl', varType: type, name, size };
    }

    // 普通声明
    let init = null;
    if (match('OP', '=')) {
      init = expression();
    }
    expect('OP', ';');
    return { type: 'VarDecl', varType: type, name, init, scope };
  };

  /* ---------- 语句 ---------- */
  const statement = () => {
    if (check('OP', '{')) return block();
    if (check('KEYWORD', 'if')) return ifStmt();
    if (check('KEYWORD', 'for')) return forStmt();
    if (check('KEYWORD', 'while')) return whileStmt();
    if (check('KEYWORD', 'switch')) return switchStmt();
    if (check('KEYWORD', 'return')) return returnStmt();
    if (check('KEYWORD', 'break')) { next(); expect('OP', ';'); return { type: 'Break' }; }
    if (check('KEYWORD', 'continue')) { next(); expect('OP', ';'); return { type: 'Continue' }; }
    if (check('KEYWORD', 'delete')) return deleteStmt();
    if (check('KEYWORD', 'in')) return inStmt();
    if (check('KEYWORD', 'struct')) err('E03', 'struct must be declared at top level', peek().line, peek().col);

    // 局部声明
    if (isTypeStart()) {
      const save = pos;
      try {
        const type = parseType();
        if (check('OP', '&')) {
          // 引用声明
          next();
          const name = expectIdentName('variable name');
          expect('OP', '=');
          const init = expression();
          expect('OP', ';');
          return { type: 'RefDecl', varType: type, name, init, scope: 'local' };
        }
        if (check('IDENT')) {
          // 各种声明形式
          if (peek(1).type === 'OP' && ['[', '(', '=', ';'].includes(peek(1).value)) {
            return varDeclFromType(type, 'local');
          }
        } else if (peek().type === 'KEYWORD') {
          // string UA = ... → 关键字当变量名
          const t = peek();
          // 仅当后面像声明时再报，避免误伤
          if (peek(1).type === 'OP' && ['[', '(', '=', ';'].includes(peek(1).value)) {
            err(
              'E03',
              `'${t.value}' is a reserved keyword and cannot be used as a variable name; rename the variable`,
              t.line,
              t.col,
            );
          }
        }
        pos = save;
      } catch (e) {
        // 关键字当变量名等明确语法错误：不要吞掉
        if (e && (e.code === 'E03' || e.status === 400)) throw e;
        pos = save;
      }
    }

    // 表达式语句
    const expr = expression();
    expect('OP', ';');
    return { type: 'ExprStmt', expr };
  };

  const block = () => {
    expect('OP', '{');
    const body = [];
    while (!check('OP', '}')) body.push(statement());
    expect('OP', '}');
    return { type: 'Block', body };
  };

  const ifStmt = () => {
    expect('KEYWORD', 'if');
    expect('OP', '(');
    const cond = expression();
    expect('OP', ')');
    const then = statement();
    let elseBranch = null;
    if (check('KEYWORD', 'else')) { next(); elseBranch = statement(); }
    return { type: 'If', cond, then, else: elseBranch };
  };

  const forStmt = () => {
    expect('KEYWORD', 'for');
    expect('OP', '(');

    // 尝试范围 for：for (type x in expr)
    const save = pos;
    if (isTypeStart()) {
      try {
        const varType = parseType();
        if (check('IDENT')) {
          const varName = next().value;
          if (check('KEYWORD', 'in')) {
            next();
            const iterable = expression();
            expect('OP', ')');
            const body = statement();
            return { type: 'RangeFor', varType, varName, iterable, body };
          }
        }
        pos = save;
      } catch {
        pos = save;
      }
    }

    // C 风格 for
    let init = null;
    if (!check('OP', ';')) {
      if (isTypeStart()) {
        const type = parseType();
        const name = expect('IDENT').value;
        let vinit = null;
        if (match('OP', '=')) vinit = expression();
        init = { type: 'VarDecl', varType: type, name, init: vinit, scope: 'local' };
      } else {
        init = expression();
      }
    }
    expect('OP', ';');

    const cond = check('OP', ';') ? null : expression();
    expect('OP', ';');

    const update = check('OP', ')') ? null : expression();
    expect('OP', ')');

    const body = statement();
    return { type: 'For', init, cond, update, body };
  };

  const whileStmt = () => {
    expect('KEYWORD', 'while');
    expect('OP', '(');
    const cond = expression();
    expect('OP', ')');
    const body = statement();
    return { type: 'While', cond, body };
  };

  const switchStmt = () => {
    expect('KEYWORD', 'switch');
    expect('OP', '(');
    const expr = expression();
    expect('OP', ')');
    expect('OP', '{');
    const cases = [];
    while (!check('OP', '}')) {
      if (check('KEYWORD', 'case')) {
        next();
        const value = primary();
        expect('OP', ':');
        const body = [];
        while (!check('KEYWORD', 'case') && !check('KEYWORD', 'default') && !check('OP', '}')) {
          body.push(statement());
        }
        cases.push({ kind: 'case', value, body });
      } else if (check('KEYWORD', 'default')) {
        next();
        expect('OP', ':');
        const body = [];
        while (!check('KEYWORD', 'case') && !check('KEYWORD', 'default') && !check('OP', '}')) {
          body.push(statement());
        }
        cases.push({ kind: 'default', body });
      } else {
        err('E03', 'expected case or default', peek().line, peek().col);
      }
    }
    expect('OP', '}');
    return { type: 'Switch', expr, cases };
  };

  const returnStmt = () => {
    expect('KEYWORD', 'return');

    let value = null;
    if (!check('OP', ';') && !check('KEYWORD', 'with')) {
      // expression() 的 postfix 可能把 "url" with 301 收成 WithExpr
      value = expression();
    }

    const mods = [];
    // 把被 expression 吞掉的 with 拆回 return 的 mods
    if (value && value.type === 'WithExpr') {
      for (const m of value.mods) mods.push(m);
      value = value.base;
    }

    while (check('KEYWORD', 'with')) {
      next();
      if (check('KEYWORD', 'header')) {
        next();
        expect('OP', '{');
        const headers = headerLiteral();
        mods.push({ kind: 'header', value: headers });
      } else if (check('KEYWORD', 'proxy')) {
        next();
        mods.push({ kind: 'proxy', value: unary() });
      } else if (check('KEYWORD', 'param') || check('KEYWORD', 'UA')) {
        const t = peek();
        err('E52', `with ${t.value} not allowed in return`, t.line, t.col);
      } else if (check('OP', '{')) {
        err('E52', 'with { ... } not allowed in return; use with param', peek().line, peek().col);
      } else {
        // 状态码：with 301
        mods.push({ kind: 'status', value: unary() });
      }
    }

    // return 只允许 status / header / proxy
    for (const m of mods) {
      if (m.kind !== 'status' && m.kind !== 'header' && m.kind !== 'proxy') {
        err('E52', `with ${m.kind} is not defined for return; allowed: status, header, proxy`);
      }
    }

    expect('OP', ';');
    return { type: 'Return', value, mods };
  };

  const deleteStmt = () => {
    expect('KEYWORD', 'delete');
    const target = postfix();
    expect('OP', ';');
    return { type: 'Delete', target };
  };

  const inStmt = () => {
    expect('KEYWORD', 'in');
    expect('OP', '(');
    if (!check('IDENT')) err('E48', 'in() requires a variable name', peek().line, peek().col);
    const name = next().value;
    expect('OP', ')');
    expect('OP', ';');
    return { type: 'In', name };
  };

  /* ---------- 表达式 ---------- */
  const expression = () => assignment();

  const assignment = () => {
    // with 优先级低于二元运算，高于赋值：
    //   "a" + b with 302  →  (a+b) with 302
    //   get(url) with UA "x"  →  WithExpr(Call, ua)
    const left = withExpr();

    const assignOps = ['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^='];
    for (const op of assignOps) {
      if (check('OP', op)) {
        next();
        const right = assignment();
        return { type: 'Assign', op, target: left, value: right };
      }
    }
    return left;
  };

  /** with 修饰层：绑定到完整左侧表达式，而不是 postfix 原子 */
  const withExpr = () => {
    let expr = logicalOr();
    const mods = [];
    while (check('KEYWORD', 'with')) {
      next();
      if (check('KEYWORD', 'param')) {
        next();
        expect('OP', '{');
        const params = headerLiteral();
        mods.push({ kind: 'param', value: params });
      } else if (check('KEYWORD', 'header')) {
        next();
        expect('OP', '{');
        const headers = headerLiteral();
        mods.push({ kind: 'header', value: headers });
      } else if (check('KEYWORD', 'UA')) {
        next();
        mods.push({ kind: 'ua', value: unary() });
      } else if (check('KEYWORD', 'proxy')) {
        next();
        mods.push({ kind: 'proxy', value: unary() });
      } else if (check('OP', '{')) {
        next();
        const params = headerLiteral();
        mods.push({ kind: 'param', value: params });
      } else {
        // 状态码 with 302
        mods.push({ kind: 'status', value: unary() });
      }
    }
    if (mods.length > 0) {
      return { type: 'WithExpr', base: expr, mods };
    }
    return expr;
  };

  const logicalOr = () => {
    let left = logicalAnd();
    while (check('OP', '||')) {
      next();
      left = { type: 'Binary', op: '||', left, right: logicalAnd() };
    }
    return left;
  };

  const logicalAnd = () => {
    let left = bitOr();
    while (check('OP', '&&')) {
      next();
      left = { type: 'Binary', op: '&&', left, right: bitOr() };
    }
    return left;
  };

  const bitOr = () => {
    let left = bitXor();
    while (check('OP', '|')) {
      next();
      left = { type: 'Binary', op: '|', left, right: bitXor() };
    }
    return left;
  };

  const bitXor = () => {
    let left = bitAnd();
    while (check('OP', '^')) {
      next();
      left = { type: 'Binary', op: '^', left, right: bitAnd() };
    }
    return left;
  };

  const bitAnd = () => {
    let left = equality();
    while (check('OP', '&')) {
      next();
      left = { type: 'Binary', op: '&', left, right: equality() };
    }
    return left;
  };

  const equality = () => {
    let left = relational();
    while (check('OP', '==') || check('OP', '!=')) {
      const op = next().value;
      left = { type: 'Binary', op, left, right: relational() };
    }
    return left;
  };

  const relational = () => {
    let left = shift();
    while (['<', '<=', '>', '>='].some((op) => check('OP', op))) {
      const op = next().value;
      left = { type: 'Binary', op, left, right: shift() };
    }
    return left;
  };

  const shift = () => {
    let left = additive();
    while (check('OP', '<<') || check('OP', '>>')) {
      const op = next().value;
      left = { type: 'Binary', op, left, right: additive() };
    }
    return left;
  };

  const additive = () => {
    let left = multiplicative();
    while (check('OP', '+') || check('OP', '-')) {
      const op = next().value;
      left = { type: 'Binary', op, left, right: multiplicative() };
    }
    return left;
  };

  const multiplicative = () => {
    let left = unary();
    while (['*', '/', '%'].some((op) => check('OP', op))) {
      const op = next().value;
      left = { type: 'Binary', op, left, right: unary() };
    }
    return left;
  };

  const unary = () => {
    if (['!', '~', '-'].some((op) => check('OP', op))) {
      const op = next().value;
      return { type: 'Unary', op, expr: unary() };
    }
    if (check('OP', '++') || check('OP', '--')) {
      const op = next().value;
      return { type: 'PrefixInc', op, target: unary() };
    }
    return postfix();
  };

  const postfix = () => {
    // 仅 () [] . ++ --；with 在 withExpr 层处理（更低优先级）
    let expr = primary();
    while (true) {
      if (check('OP', '(')) {
        next();
        const args = [];
        while (!check('OP', ')')) {
          args.push(expression());
          if (!check('OP', ')')) expect('OP', ',');
        }
        expect('OP', ')');
        expr = { type: 'Call', callee: expr, args };
      } else if (check('OP', '[')) {
        next();
        const index = expression();
        expect('OP', ']');
        expr = { type: 'Index', target: expr, index };
      } else if (check('OP', '.')) {
        next();
        const name = expect('IDENT').value;
        expr = { type: 'Member', target: expr, name };
      } else if (check('OP', '++') || check('OP', '--')) {
        const op = next().value;
        expr = { type: 'PostfixInc', op, target: expr };
      } else {
        break;
      }
    }
    return expr;
  };

  const primary = () => {
    const t = peek();
    if (t.type === 'NUMBER') { next(); return { type: 'Number', value: t.value }; }
    if (t.type === 'STRING') { next(); return { type: 'String', value: t.value }; }
    if (t.type === 'KEYWORD' && t.value === 'true') { next(); return { type: 'Bool', value: true }; }
    if (t.type === 'KEYWORD' && t.value === 'false') { next(); return { type: 'Bool', value: false }; }

    // 字面量：{...} 容器 / map / struct
    if (check('OP', '{')) {
      next();
      if (check('OP', '}')) {
        next();
        return { type: 'ContainerLiteral', items: [] };
      }
      const items = [];
      let isMap = false;
      while (true) {
        const first = expression();
        if (check('OP', ':')) {
          next();
          const second = expression();
          items.push({ key: first, value: second });
          isMap = true;
        } else {
          items.push(first);
        }
        if (!check('OP', ',')) break;
        next();
        if (check('OP', '}')) break; // 尾随逗号
      }
      expect('OP', '}');
      return isMap ? { type: 'MapLiteral', entries: items } : { type: 'ContainerLiteral', items };
    }

    if (check('OP', '(')) {
      next();
      const e = expression();
      expect('OP', ')');
      return e;
    }

    if (t.type === 'IDENT') {
      next();
      return { type: 'Ident', name: t.value };
    }

    // 内置函数关键字作为标识符（不可作变量名，但可作调用）
    if (t.type === 'KEYWORD' && ['getchar', 'out'].includes(t.value)) {
      next();
      return { type: 'Ident', name: t.value };
    }

    err('E03', `unexpected token: ${t.value ?? t.type}`, t.line, t.col);
  };

  // header/param 字面量：{ "K": expr, ... }
  const headerLiteral = () => {
    const list = [];
    while (!check('OP', '}')) {
      if (!check('STRING')) err('E10', 'header key must be string literal', peek().line, peek().col);
      const key = next().value;
      expect('OP', ':');
      const value = expression();
      list.push({ key, value });
      if (!check('OP', '}')) expect('OP', ',');
    }
    expect('OP', '}');
    return list;
  };

  return program();
}