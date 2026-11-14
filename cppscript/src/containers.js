// containers.js
import { err } from './errors.js';

export class Deque {
  constructor() { this.items = []; }
  size() { return this.items.length; }
  get(i) { this._check(i); return this.items[i]; }
  set(i, v) { this._check(i); this.items[i] = v; }
  push_back(v) { this.items.push(v); }
  push_front(v) { this.items.unshift(v); }
  pop_back() { this._requireNonEmpty(); return this.items.pop(); }
  pop_front() { this._requireNonEmpty(); return this.items.shift(); }
  front() { this._requireNonEmpty(); return this.items[0]; }
  back() { this._requireNonEmpty(); return this.items[this.items.length - 1]; }
  find(v) { return this.items.indexOf(v); }
  erase(i) { this._check(i); this.items.splice(i, 1); }
  insert(i, v) { if (i < 0 || i > this.items.length) err('E23', 'insert out of range'); this.items.splice(i, 0, v); }
  clear() { this.items.length = 0; }
  fill(v) { for (let i = 0; i < this.items.length; i++) this.items[i] = v; }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
  _check(i) { if (i < 0 || i >= this.items.length) err('E23', `index ${i} out of range`); }
  _requireNonEmpty() { if (!this.items.length) err('E23', 'empty container'); }
}

/** list：接口与 deque 相同（双向序列） */
export class ListContainer extends Deque {}

export class SetContainer extends Deque {
  push_back(v) { if (!this.items.includes(v)) this.items.push(v); }
  push_front(v) { if (!this.items.includes(v)) this.items.unshift(v); }
  insert(i, v) { if (!this.items.includes(v)) super.insert(i, v); }
  /** 集合风格 insert(value) */
  insertValue(v) { if (!this.items.includes(v)) this.items.push(v); }
  fill(v) { this.items = [v]; }
}

/**
 * multiset：允许重复，插入时保持升序（默认 number/string 比较）
 */
export class MultiSetContainer {
  constructor() { this.items = []; }
  size() { return this.items.length; }
  clear() { this.items.length = 0; }
  front() { if (!this.items.length) err('E23', 'empty multiset'); return this.items[0]; }
  back() { if (!this.items.length) err('E23', 'empty multiset'); return this.items[this.items.length - 1]; }
  get(i) {
    if (i < 0 || i >= this.items.length) err('E23', `index ${i} out of range`);
    return this.items[i];
  }
  count(v) {
    let n = 0;
    for (const x of this.items) if (Object.is(x, v) || x === v) n++;
    return n;
  }
  find(v) {
    for (let i = 0; i < this.items.length; i++) {
      if (Object.is(this.items[i], v) || this.items[i] === v) return i;
    }
    return -1;
  }
  /** 有序插入 */
  insert(v) {
    let lo = 0, hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this._less(this.items[mid], v)) lo = mid + 1;
      else hi = mid;
    }
    this.items.splice(lo, 0, v);
  }
  /** 删除一个等于 v 的元素；返回是否删除 */
  erase(v) {
    const i = this.find(v);
    if (i < 0) return false;
    this.items.splice(i, 1);
    return true;
  }
  eraseAll(v) {
    const before = this.items.length;
    this.items = this.items.filter((x) => !(Object.is(x, v) || x === v));
    return before - this.items.length;
  }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
  _less(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a < b;
    return String(a) < String(b);
  }
}

export class MapContainer {
  constructor() { this.keys = []; this.values = new Map(); }
  size() { return this.keys.length; }
  has(k) { return this.values.has(k); }
  get(k) { return this.values.get(k); }
  set(k, v) {
    if (!this.values.has(k)) this.keys.push(k);
    this.values.set(k, v);
  }
  erase(k) {
    if (this.values.has(k)) {
      this.values.delete(k);
      this.keys = this.keys.filter((x) => x !== k);
    }
  }
  clear() { this.keys.length = 0; this.values.clear(); }
  keysList() { return [...this.keys]; }
  valuesList() { return this.keys.map((k) => this.values.get(k)); }
  [Symbol.iterator]() { return this.keys[Symbol.iterator](); }
}

/**
 * multimap：同一 key 可对应多个 value，按插入顺序保存在数组中
 */
export class MultiMapContainer {
  constructor() {
    this.keys = []; // 首次出现顺序
    this.values = new Map(); // key -> array
  }
  size() {
    let n = 0;
    for (const arr of this.values.values()) n += arr.length;
    return n;
  }
  has(k) { return this.values.has(k) && this.values.get(k).length > 0; }
  /** 返回该 key 下第一个 value；无则 undefined */
  get(k) {
    const arr = this.values.get(k);
    return arr && arr.length ? arr[0] : undefined;
  }
  count(k) {
    const arr = this.values.get(k);
    return arr ? arr.length : 0;
  }
  /** 追加一对 */
  insert(k, v) {
    if (!this.values.has(k)) {
      this.keys.push(k);
      this.values.set(k, [v]);
    } else {
      this.values.get(k).push(v);
    }
  }
  set(k, v) {
    // 与 insert 相同（多值）
    this.insert(k, v);
  }
  /** 删除该 key 的全部值 */
  erase(k) {
    if (this.values.has(k)) {
      this.values.delete(k);
      this.keys = this.keys.filter((x) => x !== k);
    }
  }
  clear() { this.keys.length = 0; this.values.clear(); }
  keysList() { return [...this.keys]; }
  valuesList() {
    const out = [];
    for (const k of this.keys) {
      for (const v of this.values.get(k) || []) out.push(v);
    }
    return out;
  }
  /** 某 key 下全部 value 的副本数组 */
  equalRange(k) {
    return [...(this.values.get(k) || [])];
  }
  [Symbol.iterator]() { return this.keys[Symbol.iterator](); }
}

export function makeDeque(init = []) {
  const d = new Deque();
  for (const v of init) d.push_back(v);
  return d;
}

export function makeSet(init = []) {
  const s = new SetContainer();
  for (const v of init) s.push_back(v);
  return s;
}

export function makeMap(entries = []) {
  const m = new MapContainer();
  for (const [k, v] of entries) m.set(k, v);
  return m;
}
