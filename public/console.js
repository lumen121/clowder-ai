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

// ── 升级确认 ──────────────────────────────────────────────────────────

const escalationsLoading = document.querySelector("#escalations-loading");
const escalationsEmpty = document.querySelector("#escalations-empty");
const escalationsList = document.querySelector("#escalations-list");

async function loadEscalations() {
  try {
    const resp = await fetch("/api/console/escalations");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderEscalations(data.escalations || []);
  } catch (err) {
    escalationsLoading.classList.remove("hidden");
    escalationsLoading.innerHTML = `<p>无法加载待确认项：${esc(err.message)}</p>`;
  }
}

function renderEscalations(records) {
  escalationsLoading.classList.add("hidden");
  escalationsList.innerHTML = "";

  if (!records.length) {
    escalationsEmpty.classList.remove("hidden");
    escalationsList.classList.add("hidden");
    return;
  }

  escalationsEmpty.classList.add("hidden");
  for (const record of records) {
    escalationsList.appendChild(buildEscalationItem(record));
  }
  escalationsList.classList.remove("hidden");
}

function buildEscalationItem(record) {
  const article = document.createElement("article");
  article.className = "escalation-item";
  article.dataset.escalationId = record.id;

  const options = (record.options || []).map((option) =>
    `<li>${esc(option)}</li>`
  ).join("");

  article.innerHTML = `
    <div class="escalation-header">
      <div>
        <p class="eyebrow">${esc(record.blocked_gate || record.trigger_type || "escalation")}</p>
        <h3>${esc(record.what_happened || record.id)}</h3>
      </div>
      <span class="status-badge status-review">${esc(record.status)}</span>
    </div>
    <dl class="escalation-details">
      <div><dt>WorkItem</dt><dd>${esc(record.work_item_id)}</dd></div>
      <div><dt>触发规则</dt><dd>${esc(record.trigger_rule)}</dd></div>
      <div><dt>风险</dt><dd>${esc(record.risks)}</dd></div>
      <div><dt>建议下一步</dt><dd>${esc(record.recommended_next_step)}</dd></div>
    </dl>
    <div class="escalation-options">
      <span>可选动作</span>
      <ul>${options || "<li>等待人工判断</li>"}</ul>
    </div>
    <form class="escalation-decision-form">
      <div class="form-grid console-form-grid">
        <div class="field">
          <label for="decision-${esc(record.id)}">处理结果</label>
          <select id="decision-${esc(record.id)}" name="decision">
            <option value="confirm">确认继续</option>
            <option value="reject">拒绝继续</option>
            <option value="request_info">补充信息</option>
          </select>
        </div>
        <div class="field">
          <label for="decider-${esc(record.id)}">确认人</label>
          <input id="decider-${esc(record.id)}" name="decided_by" value="user" />
        </div>
      </div>
      <div class="field">
        <label for="detail-${esc(record.id)}">说明</label>
        <textarea id="detail-${esc(record.id)}" name="detail" rows="3" placeholder="记录确认理由、拒绝原因或需要补充的信息"></textarea>
      </div>
      <div class="form-actions">
        <button type="submit">写回确认</button>
        <p class="escalation-status" role="status" aria-live="polite"></p>
      </div>
    </form>
  `;

  article.querySelector(".escalation-decision-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitEscalationDecision(record.id, article);
  });
  return article;
}

async function submitEscalationDecision(escalationId, container) {
  const form = container.querySelector(".escalation-decision-form");
  const status = container.querySelector(".escalation-status");
  const button = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const payload = {
    decision: String(formData.get("decision") || ""),
    decided_by: String(formData.get("decided_by") || "user"),
    detail: String(formData.get("detail") || ""),
  };

  button.disabled = true;
  status.textContent = "正在写回...";
  status.classList.remove("error");

  try {
    const resp = await fetch(`/api/console/escalations/${encodeURIComponent(escalationId)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(body.error || "写回失败");
    status.textContent = `已写回 (${body.escalation.status})。`;
    addRecentRecord({
      id: body.escalation.id,
      created_at: body.escalation.updated_at,
      response: `${body.escalation.user_decision}: ${body.escalation.decision_detail}`,
    });
    await loadEscalations();
  } catch (err) {
    status.textContent = err.message;
    status.classList.add("error");
  } finally {
    button.disabled = false;
  }
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
loadEscalations();
initRelatedTasks();
