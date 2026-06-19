"use strict";

const form = document.querySelector("#work-item-form");
const statusEl = document.querySelector("#form-status");
const emptyState = document.querySelector("#empty-state");
const resultSummary = document.querySelector("#result-summary");
const submitButton = form.querySelector("button[type='submit']");

const fields = {
  id: document.querySelector("#result-id"),
  type: document.querySelector("#result-type"),
  status: document.querySelector("#result-status"),
  title: document.querySelector("#result-title-value"),
  detection: document.querySelector("#result-detection"),
  storage: document.querySelector("#result-storage"),
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setStatus("正在创建...", false);

  const data = new FormData(form);
  const payload = {
    raw_request: String(data.get("raw_request") || ""),
    title: String(data.get("title") || ""),
    type: String(data.get("type") || "auto"),
  };

  try {
    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "创建失败");
    }

    renderResult(body.work_item, body.storage);
    setStatus("已创建。", false);
    form.reset();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});

function renderResult(workItem, storage) {
  const detection = workItem.metadata?.type_detection || {};
  const typeLabel = workItem.type === "bug_fix" ? "Bug 修复" : "功能需求";
  const confidence = detection.confidence ? `，${detection.confidence}` : "";
  const mode = detection.mode || "unknown";

  fields.id.textContent = workItem.id;
  fields.type.textContent = `${typeLabel} (${workItem.type})`;
  fields.status.textContent = workItem.status;
  fields.title.textContent = workItem.title || workItem.goal;
  fields.detection.textContent = `${mode}${confidence}${lowConfidenceText(detection)}`;
  fields.storage.textContent = storage.path;

  emptyState.classList.add("hidden");
  resultSummary.classList.remove("hidden");
}

function lowConfidenceText(detection) {
  if (detection.confidence === "low") {
    return "，需要确认";
  }
  return "";
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
}
