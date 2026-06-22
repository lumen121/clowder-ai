"use strict";

const state = {
  workspace: null,
  selectedId: null,
};

const els = {
  workspaceLoading: document.querySelector("#workspace-loading"),
  workspaceError: document.querySelector("#workspace-error"),
  workspaceGrid: document.querySelector("#workspace-grid"),
  workItemList: document.querySelector("#work-item-list"),
  workListCount: document.querySelector("#work-list-count"),
  selectedEmpty: document.querySelector("#selected-empty"),
  selectedDetail: document.querySelector("#selected-detail"),
  detailKicker: document.querySelector("#detail-kicker"),
  detailTitle: document.querySelector("#detail-title"),
  detailStatus: document.querySelector("#detail-status"),
  detailMeta: document.querySelector("#detail-meta"),
  keyConclusion: document.querySelector("#key-conclusion"),
  taskList: document.querySelector("#task-list"),
  timelineList: document.querySelector("#timeline-list"),
  pendingList: document.querySelector("#pending-list"),
  reviewSummary: document.querySelector("#review-summary"),
  qualitySummary: document.querySelector("#quality-summary"),
  deliverySummary: document.querySelector("#delivery-summary"),
  retrospectiveSummary: document.querySelector("#retrospective-summary"),
  createForm: document.querySelector("#create-work-item-form"),
  createStatus: document.querySelector("#create-status"),
  inputForm: document.querySelector("#user-input-form"),
  inputStatus: document.querySelector("#input-status"),
  statusLoading: document.querySelector("#status-loading"),
  statusTable: document.querySelector("#status-table"),
  statusTbody: document.querySelector("#status-tbody"),
  packagesLoading: document.querySelector("#packages-loading"),
  packagesList: document.querySelector("#packages-list"),
};

async function loadWorkspace(workItemId) {
  setWorkspaceLoading(true);
  try {
    const query = workItemId ? `?work_item_id=${encodeURIComponent(workItemId)}` : "";
    const response = await fetch(`/api/console/workspace${query}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    state.workspace = body;
    state.selectedId = body.selected_work_item ? body.selected_work_item.id : null;
    renderWorkspace();
  } catch (error) {
    els.workspaceError.textContent = `无法加载操作台：${error.message}`;
    els.workspaceError.classList.remove("hidden");
    els.workspaceGrid.classList.add("hidden");
  } finally {
    setWorkspaceLoading(false);
  }
}

function renderWorkspace() {
  const workspace = state.workspace;
  if (!workspace) return;

  els.workspaceError.classList.add("hidden");
  els.workspaceGrid.classList.remove("hidden");
  renderWorkItemList(workspace.work_items || []);
  renderSelectedWorkItem(workspace.selected_work_item);
}

function renderWorkItemList(items) {
  els.workListCount.textContent = items.length ? `${items.length} 个工作项` : "暂无工作项";
  els.workItemList.innerHTML = "";

  if (!items.length) {
    els.workItemList.innerHTML = `<div class="empty-state small">暂无工作项</div>`;
    return;
  }

  for (const item of items) {
    const latest = item.latest_key_conclusion || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = `work-item-button ${item.id === state.selectedId ? "selected" : ""}`;
    button.dataset.workItemId = item.id;
    button.innerHTML = `
      <span class="work-title">${esc(item.title || item.id)}</span>
      <span class="work-meta">
        <span class="status-dot ${statusClass(item.status)}"></span>
        ${esc(item.status)} · ${esc(item.type)}
      </span>
      <span class="work-conclusion">${esc(latest.summary || "待形成")}</span>
    `;
    els.workItemList.appendChild(button);
  }
}

function renderSelectedWorkItem(item) {
  if (!item) {
    els.selectedEmpty.classList.remove("hidden");
    els.selectedDetail.classList.add("hidden");
    renderNoSelectionSidebars();
    return;
  }

  els.selectedEmpty.classList.add("hidden");
  els.selectedDetail.classList.remove("hidden");
  els.detailKicker.textContent = `${item.id} · ${item.type}`;
  els.detailTitle.textContent = item.title || item.id;
  els.detailStatus.textContent = item.status;
  els.detailStatus.className = `status-badge ${statusClass(item.status)}`;
  renderMeta(item);
  renderKeyConclusion(item.latest_key_conclusion);
  renderTasks(item.tasks || []);
  renderTimeline(item.timeline || []);
  renderPendingConfirmations(item.pending_confirmations || []);
  renderReviewSummary(item.review_summary || {});
  renderQualitySummary(item.quality_gate_summary || {});
  renderDeliverySummary(item.delivery_summary || {});
  renderRetrospectiveSummary(item.retrospective_summary);
}

function renderMeta(item) {
  const rows = [
    ["目标", item.goal || "未记录"],
    ["负责人", joinOrPending(item.owners)],
    ["Review 方", joinOrPending(item.reviewers)],
    ["协作者", joinOrPending(item.collaborators)],
    ["依赖", joinOrPending(item.dependencies)],
    ["MiniMax 体验 Review", item.minimax_experience_review.status],
  ];
  els.detailMeta.innerHTML = rows.map(([label, value]) => `
    <div>
      <dt>${esc(label)}</dt>
      <dd>${esc(value)}</dd>
    </div>
  `).join("");
}

function renderKeyConclusion(conclusion) {
  const data = conclusion || {};
  els.keyConclusion.innerHTML = `
    <span class="key-source">${esc(sourceLabel(data.source))}</span>
    ${esc(data.summary || "待形成")}
    ${data.at ? `<span class="time-muted">${esc(formatDate(data.at))}</span>` : ""}
  `;
}

function renderTasks(tasks) {
  if (!tasks.length) {
    els.taskList.innerHTML = `<div class="empty-state small">任务拆解待形成</div>`;
    return;
  }
  els.taskList.innerHTML = tasks.map((task) => `
    <article class="compact-item">
      <div>
        <strong>${esc(task.title || task.id)}</strong>
        <p>${esc(task.boundary || "边界待补充")}</p>
      </div>
      <dl>
        <div><dt>Owner</dt><dd>${esc(task.owner_agent || "待定")}</dd></div>
        <div><dt>Reviewer</dt><dd>${esc(task.reviewer_agent || "待定")}</dd></div>
        <div><dt>状态</dt><dd>${esc(task.status)}</dd></div>
      </dl>
    </article>
  `).join("");
}

function renderTimeline(events) {
  if (!events.length) {
    els.timelineList.innerHTML = `<li class="empty-state small">暂无时间线事件</li>`;
    return;
  }
  els.timelineList.innerHTML = events.map((event) => `
    <li class="timeline-item">
      <div class="timeline-marker ${statusClass(event.status)}"></div>
      <div class="timeline-card">
        <div class="timeline-head">
          <span>${esc(kindLabel(event.kind))}</span>
          <time>${esc(formatDate(event.at))}</time>
        </div>
        <h4>${esc(event.title || event.kind)}</h4>
        <p>${esc(event.summary || "已记录")}</p>
        <div class="timeline-foot">
          <span>${esc(event.actor || "system")}</span>
          <span>${esc(event.status || "recorded")}</span>
        </div>
      </div>
    </li>
  `).join("");
}

function renderPendingConfirmations(records) {
  if (!records.length) {
    els.pendingList.innerHTML = `<div class="empty-state small">当前没有待确认项</div>`;
    return;
  }

  els.pendingList.innerHTML = records.map((record) => `
    <article class="stack-item" data-escalation-id="${esc(record.id)}">
      <div class="stack-head">
        <strong>${esc(record.trigger_rule || record.blocked_gate || "人工确认")}</strong>
        <span class="status-badge ${statusClass(record.status)}">${esc(record.status)}</span>
      </div>
      <p>${esc(record.what_happened || record.recommended_next_step)}</p>
      <small>${esc(record.risks || "风险待补充")}</small>
      <form class="decision-form">
        <select name="decision" aria-label="处理结果">
          <option value="confirm">确认继续</option>
          <option value="reject">拒绝继续</option>
          <option value="request_info">补充信息</option>
        </select>
        <textarea name="detail" rows="3" placeholder="说明理由或补充信息"></textarea>
        <button type="submit">写回</button>
        <p class="inline-status" role="status" aria-live="polite"></p>
      </form>
    </article>
  `).join("");
}

function renderReviewSummary(summary) {
  renderSummaryList(els.reviewSummary, [
    ["总数", summary.total || 0],
    ["通过", summary.approved || 0],
    ["未解决", summary.unresolved || 0],
    ["最近", summary.latest ? `${summary.latest.result} · ${summary.latest.reviewer_agent}` : "暂无"],
  ]);
}

function renderQualitySummary(summary) {
  const failures = Array.isArray(summary.failures) && summary.failures.length
    ? summary.failures.map((failure) => failure.failure_summary).filter(Boolean).join("; ")
    : "无失败记录";
  renderSummaryList(els.qualitySummary, [
    ["总数", summary.total || 0],
    ["通过", summary.passed || 0],
    ["失败/阻塞", (summary.failed || 0) + (summary.blocked || 0)],
    ["失败摘要", failures],
  ]);
}

function renderDeliverySummary(summary) {
  const latest = summary.latest
    ? `${summary.latest.result} · ${summary.latest.push_status}`
    : "暂无";
  renderSummaryList(els.deliverySummary, [
    ["总数", summary.total || 0],
    ["通过", summary.passed || 0],
    ["阻塞", summary.blocked || 0],
    ["最近", latest],
  ]);
}

function renderRetrospectiveSummary(summary) {
  if (!summary) {
    els.retrospectiveSummary.innerHTML = `<div class="empty-state small">复盘记录待形成</div>`;
    return;
  }
  renderSummaryList(els.retrospectiveSummary, [
    ["结论", summary.conclusion || "已记录"],
    ["参与 Agent", joinOrPending(summary.facts && summary.facts.participating_agents)],
    ["返工次数", summary.facts ? summary.facts.rework_count : 0],
    ["流程建议", joinOrPending(summary.suggestions && summary.suggestions.process)],
  ]);
}

function renderNoSelectionSidebars() {
  const empty = `<div class="empty-state small">请选择或创建工作项</div>`;
  els.pendingList.innerHTML = empty;
  els.reviewSummary.innerHTML = empty;
  els.qualitySummary.innerHTML = empty;
  els.deliverySummary.innerHTML = empty;
  els.retrospectiveSummary.innerHTML = empty;
}

function renderSummaryList(container, rows) {
  container.innerHTML = rows.map(([label, value]) => `
    <div class="summary-row">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join("");
}

async function submitCreateWorkItem(event) {
  event.preventDefault();
  const button = els.createForm.querySelector("button[type='submit']");
  const formData = new FormData(els.createForm);
  const payload = {
    raw_request: String(formData.get("raw_request") || ""),
    type: String(formData.get("type") || "auto"),
    title: String(formData.get("title") || ""),
  };

  setButtonBusy(button, true);
  setInlineStatus(els.createStatus, "正在创建...", false);
  try {
    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    els.createForm.reset();
    setInlineStatus(els.createStatus, `已创建 ${body.work_item.id}`, false);
    await loadWorkspace(body.work_item.id);
  } catch (error) {
    setInlineStatus(els.createStatus, error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
}

async function submitUserInput(event) {
  event.preventDefault();
  if (!state.selectedId) {
    setInlineStatus(els.inputStatus, "请先选择工作项。", true);
    return;
  }

  const button = els.inputForm.querySelector("button[type='submit']");
  const formData = new FormData(els.inputForm);
  const payload = {
    work_item_id: state.selectedId,
    content: String(formData.get("content") || ""),
    context_type: String(formData.get("context_type") || "general"),
    related_task: state.selectedId,
  };

  setButtonBusy(button, true);
  setInlineStatus(els.inputStatus, "正在提交...", false);
  try {
    const response = await fetch("/api/console/user-input", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    els.inputForm.reset();
    setInlineStatus(els.inputStatus, `已保存 ${body.record.id}`, false);
    await loadWorkspace(state.selectedId);
  } catch (error) {
    setInlineStatus(els.inputStatus, error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
}

async function submitDecision(form) {
  const item = form.closest("[data-escalation-id]");
  const escalationId = item ? item.dataset.escalationId : "";
  const status = form.querySelector(".inline-status");
  const button = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const payload = {
    decision: String(formData.get("decision") || ""),
    decided_by: "user",
    detail: String(formData.get("detail") || ""),
  };

  setButtonBusy(button, true);
  setInlineStatus(status, "正在写回...", false);
  try {
    const response = await fetch(`/api/console/escalations/${encodeURIComponent(escalationId)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    setInlineStatus(status, `已写回 ${body.escalation.status}`, false);
    await loadWorkspace(state.selectedId);
  } catch (error) {
    setInlineStatus(status, error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
}

async function loadStatus() {
  try {
    const response = await fetch("/api/console/status");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    renderStatus(body.tasks || []);
  } catch (error) {
    els.statusLoading.textContent = `无法加载状态数据：${error.message}`;
  }
}

function renderStatus(tasks) {
  els.statusLoading.classList.add("hidden");
  els.statusTbody.innerHTML = tasks.map((task) => `
    <tr>
      <td>${esc(task.id)}</td>
      <td><span class="status-badge ${statusClass(task.status)}">${esc(task.status)}</span></td>
      <td>${esc(task.owner)}</td>
      <td>${esc(task.blocked)}</td>
      <td>${esc(task.next_step)}</td>
    </tr>
  `).join("");
  els.statusTable.classList.remove("hidden");
}

async function loadPackages() {
  try {
    const response = await fetch("/api/console/start-packages");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    renderPackages(body.packages || []);
  } catch (error) {
    els.packagesLoading.textContent = `无法加载启动包：${error.message}`;
  }
}

function renderPackages(packages) {
  els.packagesLoading.classList.add("hidden");
  els.packagesList.innerHTML = packages.map((pkg) => `
    <li>
      <a href="/${esc(pkg.path)}" target="_blank" class="package-link">
        <span class="package-id">${esc(pkg.task_id)}</span>
        <span class="package-title">${esc(pkg.title)}</span>
      </a>
    </li>
  `).join("");
  els.packagesList.classList.remove("hidden");
}

function setWorkspaceLoading(isLoading) {
  els.workspaceLoading.classList.toggle("hidden", !isLoading);
}

function setButtonBusy(button, isBusy) {
  button.disabled = isBusy;
}

function setInlineStatus(element, message, isError) {
  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
}

function joinOrPending(values) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return list.length ? list.join(", ") : "待形成";
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (["completed", "passed", "approved", "confirmed", "已完成"].includes(value)) return "status-good";
  if (["blocked", "failed", "rejected", "阻塞"].includes(value)) return "status-danger";
  if (["pending_review", "pending_user_confirmation", "needs_more_info", "changes_requested"].includes(value)) return "status-warn";
  if (["in_development", "ready_for_development", "pushed", "开发中"].includes(value)) return "status-info";
  return "status-neutral";
}

function sourceLabel(source) {
  const labels = {
    a2a: "A2A",
    review: "Review",
    quality_gate: "门禁",
    escalation: "确认",
    retrospective: "复盘",
    delivery: "交付",
    work_item: "工作项",
  };
  return labels[source] || source || "结论";
}

function kindLabel(kind) {
  const labels = {
    work_item: "工作项",
    task: "任务",
    a2a: "A2A",
    review: "Review",
    quality_gate: "门禁",
    escalation: "确认",
    delivery: "交付",
    retrospective: "复盘",
  };
  return labels[kind] || kind;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

els.workItemList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-work-item-id]");
  if (!button) return;
  loadWorkspace(button.dataset.workItemId);
});

els.pendingList.addEventListener("submit", (event) => {
  const form = event.target.closest(".decision-form");
  if (!form) return;
  event.preventDefault();
  submitDecision(form);
});

els.createForm.addEventListener("submit", submitCreateWorkItem);
els.inputForm.addEventListener("submit", submitUserInput);

loadWorkspace();
loadStatus();
loadPackages();
