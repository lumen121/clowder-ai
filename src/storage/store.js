#!/usr/bin/env node
/**
 * store.js — 通用 JSON 文件 CRUD Store
 *
 * 每个实例绑定 data/ 下的一个 JSON 文件，提供：
 *  - create(item)          新增记录（自动生成 id 和时间戳）
 *  - read(id)              按 id 读取
 *  - update(id, patch)     部分更新
 *  - delete(id)            删除
 *  - list(filter?)         列表，支持可选过滤
 *  - count()               记录总数
 *
 * 写入采用原子策略：先写 .tmp 再 rename，避免写入中断导致文件损坏。
 * 所有读写显式使用 UTF-8。
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── 工具 ──────────────────────────────────────────────────────────────

/** 生成 kebab-case 风格的短 id */
function generateId(prefix = "") {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(3).toString("hex");
  return prefix ? `${prefix}-${ts}${rand}` : `${ts}${rand}`;
}

/** 确保目录存在 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ── Store 类 ──────────────────────────────────────────────────────────

class Store {
  /**
   * @param {string} name       - 模型名称，对应 data/<name>.json
   * @param {string} dataDir    - 持久化根目录，默认 data/
   * @param {object} [options]
   * @param {string} [options.idPrefix] - id 前缀，如 "wi" / "task"
   */
  constructor(name, dataDir = "data", options = {}) {
    this.name = name;
    this.dataDir = dataDir;
    this.idPrefix = options.idPrefix || "";
    this.filePath = path.join(dataDir, `${name}.json`);
    this._cache = null;
  }

  // ── 内部读写 ──────────────────────────────────────────────────────

  /** 加载全部记录（惰性 + 缓存） */
  _load() {
    if (this._cache !== null) return this._cache;
    ensureDir(this.dataDir);
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      this._cache = JSON.parse(raw);
      if (!Array.isArray(this._cache)) this._cache = [];
    } catch (err) {
      if (err.code === "ENOENT") {
        this._cache = [];
      } else {
        throw new Error(`读取 ${this.filePath} 失败: ${err.message}`);
      }
    }
    return this._cache;
  }

  /** 原子写回磁盘 */
  _save() {
    ensureDir(this.dataDir);
    const tmpPath = this.filePath + ".tmp";
    const json = JSON.stringify(this._cache, null, 2);
    fs.writeFileSync(tmpPath, json, "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }

  /** 使缓存失效（调试/测试用） */
  _invalidate() {
    this._cache = null;
  }

  // ── 内部工具 ──────────────────────────────────────────────────────

  /**
   * 深拷贝，彻底断开与内部缓存的引用。
   * 使用 structuredClone（Node 17+），不支持的类型回退为 JSON 往返。
   */
  _copy(record) {
    try {
      return structuredClone(record);
    } catch {
      // structuredClone 不支持的类型（极少）回退 JSON
      return JSON.parse(JSON.stringify(record));
    }
  }

  // ── CRUD API ───────────────────────────────────────────────────────

  /**
   * 创建记录
   * @param {object} data - 记录字段
   * @returns {object} 完整记录（含 id、created_at、updated_at），深拷贝
   */
  create(data) {
    const records = this._load();
    const now = new Date().toISOString();
    // 深拷贝输入，防止调用方后续修改 input 对象污染缓存
    const safeData = this._copy(data);
    const record = {
      id: generateId(this.idPrefix),
      created_at: now,
      updated_at: now,
      ...safeData,
    };
    records.push(record);
    this._save();
    return this._copy(record);
  }

  /**
   * 按 id 读取
   * @param {string} id
   * @returns {object|undefined} 深拷贝，外部修改不会污染缓存
   */
  read(id) {
    const record = this._load().find((r) => r.id === id);
    return record ? this._copy(record) : undefined;
  }

  /**
   * 部分更新
   * @param {string} id
   * @param {object} patch - 要合并的字段
   * @returns {object|null} 更新后的记录，深拷贝
   */
  update(id, patch) {
    const records = this._load();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    // 深拷贝 patch，防止调用方后续修改 patch 对象污染缓存
    const safePatch = this._copy(patch);
    records[idx] = {
      ...records[idx],
      ...safePatch,
      id: records[idx].id,              // id 不可变
      created_at: records[idx].created_at, // created_at 不可变
      updated_at: new Date().toISOString(),
    };
    this._save();
    return this._copy(records[idx]);
  }

  /**
   * 删除记录
   * @param {string} id
   * @returns {boolean} 是否成功删除
   */
  delete(id) {
    const records = this._load();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    records.splice(idx, 1);
    this._save();
    return true;
  }

  /**
   * 列表查询
   * @param {function} [filter] - 可选过滤函数
   * @returns {object[]} 深拷贝数组，外部修改不会污染缓存
   */
  list(filter) {
    const records = this._load();
    if (!filter) {
      return records.map((r) => this._copy(r));
    }
    // 过滤回调传入深拷贝，防止回调内部修改参数污染缓存
    const selected = records.filter((r) => filter(this._copy(r)));
    return selected.map((r) => this._copy(r));
  }

  /** 记录总数 */
  count() {
    return this._load().length;
  }

  /** 清空所有记录（危险，仅测试用） */
  _clear() {
    this._cache = [];
    this._save();
  }
}

module.exports = { Store, generateId };
