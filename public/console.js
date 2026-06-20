"use strict";

// ── 状态看板 ──────────────────────────────────────────────────────────

const statusTable = document.querySelector("#status-table");
const statusTbody = document.querySelector("#status-tbody");
const statusLoading = document.querySelector("#status-loading");
const statusError = document.querySelector("#status-error");
const statusErrorText = document.querySelector("#status-error-text");

async function loadStatus() {
  try {
    const resp = await fetch("/api/console/status");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderStatus(data.tasks || []);
  } catch (err) {
    statusLoading.classList.add("hidden");
    statusError.classList.remove("hidden");
    statusErrorText.textContent = `无法加载状态数据：${err.message}`;
  }
}

function renderStatus(tasks) {
  statusLoading.classList.add("hidden");
  if (!tasks.length) {
    statusError.classList.remove("hidden");
    statusErrorText.textContent = "状态板无数据。";
    return;
  }

  statusTbody.innerHTML = "";
  for (const t of tasks) {
    const tr = document.createElement("tr");
    tr.className = statusRowClass(t.status);
    tr.innerHTML = [
      `<td class="cell-task"><span class="task-id">${esc(t.id)}</span></td>`,
      `<td><span class="status-badge status-${cssClass(t.status)}">${esc(t.status)}</span></td>`,
      `<td>${esc(t.owner)}</td>`,
      `<td class="cell-link">${formatLink(t.review)}</td>`,
      `<td>${esc(t.blocked)}</td>`,
      `<td class="cell-next">${esc(t.next_step)}</td>`,
    ].join("");
    statusTbody.appendChild(tr);
  }

  statusTable.classList.remove("hidden");
}

function statusRowClass(status) {
  if (status === "已完成") return "row-done";
  if (status === "阻塞") return "row-blocked";
  if (status === "待 Review" || status === "修复中") return "row-active";
  return "";
}

function cssClass(status) {
  if (status === "已完成") return "done";
  if (status === "阻塞") return "blocked";
  if (status === "开发中" || status === "自检中") return "active";
  if (status === "待 Review" || status === "修复中") return "review";
  return "pending";
}

// ── 启动包 ────────────────────────────────────────────────────────────

const packagesLoading = document.querySelector("#packages-loading");
const packagesList = document.querySelector("#packages-list");

async function loadPackages() {
  try {
    const resp = await fetch("/api/console/start-packages");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderPackages(data.packages || []);
  } catch (err) {
    packagesLoading.innerHTML = `<p>无法加载启动包：${esc(err.message)}</p>`;
  }
}

function renderPackages(packages) {
  packagesLoading.classList.add("hidden");
  if (!packages.length) {
    packagesLoading.innerHTML = "<p>暂无启动包。</p>";
    packagesLoading.classList.remove("hidden");
    return;
  }

  packagesList.innerHTML = "";
  for (const pkg of packages) {
    const li = document.createElement("li");
    li.innerHTML = `<a href="/${esc(pkg.path)}" target="_blank" class="package-link">
      <span class="package-id">${esc(pkg.task_id)}</span>
      <span class="package-title">${esc(pkg.title)}</span>
    </a>`;
    packagesList.appendChild(li);
  }
  packagesList.classList.remove("hidden");
}

// ── 用户录入 ──────────────────────────────────────────────────────────

const inputForm = document.querySelector("#user-input-form");
const inputStatus = document.querySelector("#input-status");
const inputSubmit = inputForm.querySelector("button[type='submit']");
const relatedTaskSelect = document.querySelector("#input-related-task");
const recordsList = document.querySelector("#records-list");

// 加载状态数据后，填充关联任务下拉框
async function initRelatedTasks() {
  try {
    const resp = await fetch("/api/console/status");
    if (!resp.ok) return;
    const data = await resp.json();
    for (const t of data.tasks || []) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.id} (${t.status})`;
      relatedTaskSelect.appendChild(opt);
    }
  } catch {
    // 静默降级
  }
}

inputForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setInputBusy(true);
  setInputStatus("正在提交...", false);

  const formData = new FormData(inputForm);
  const payload = {
    content: String(formData.get("content") || ""),
    context_type: String(formData.get("context_type") || "general"),
    related_task: String(formData.get("related_task") || ""),
  };

  try {
    const resp = await fetch("/api/console/user-input", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(body.error || "提交失败");

    setInputStatus(`已保存 (${body.record.id})。`, false);
    inputForm.reset();
    addRecentRecord(body.record);
  } catch (err) {
    setInputStatus(err.message, true);
  } finally {
    setInputBusy(false);
  }
});

function addRecentRecord(record) {
  const li = document.createElement("li");
  const ts = record.created_at ? new Date(record.created_at).toLocaleString("zh-CN") : "";
  li.innerHTML = `<span class="record-ts">${esc(ts)}</span>
    <span class="record-id">${esc(record.id)}</span>
    <span class="record-text">${esc(truncate(record.response || record.claim_or_request || "", 120))}</span>`;
  recordsList.insertBefore(li, recordsList.firstChild);

  // 最多保留 20 条
  while (recordsList.children.length > 20) {
    recordsList.removeChild(recordsList.lastChild);
  }

  document.querySelector("#recent-records").open = true;
}

// ── 工具函数 ──────────────────────────────────────────────────────────

function formatLink(text) {
  const m = String(text || "").match(/\[([^\]]*)\]\(([^)]+)\)/);
  if (m) return `<a href="${esc(m[2])}" target="_blank">${esc(m[1])}</a>`;
  return esc(text);
}

function esc(s) {
  const str = String(s == null ? "" : s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;");
}

function truncate(s, max) {
  const str = String(s || "");
  return str.length <= max ? str : str.slice(0, max) + "...";
}

function setInputStatus(message, isError) {
  inputStatus.textContent = message;
  inputStatus.classList.toggle("error", Boolean(isError));
}

function setInputBusy(isBusy) {
  inputSubmit.disabled = isBusy;
}

// ── 启动 ──────────────────────────────────────────────────────────────

loadStatus();
loadPackages();
initRelatedTasks();
