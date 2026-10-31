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

export class SetContainer extends Deque {
  push_back(v) { if (!this.items.includes(v)) this.items.push(v); }
  push_front(v) { if (!this.items.includes(v)) this.items.unshift(v); }
  insert(i, v) { if (!this.items.includes(v)) super.insert(i, v); }
  fill(v) { this.items = [v]; }
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