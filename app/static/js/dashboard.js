/**
 * Dashboard controller: renders counter cards, handles create/edit/delete,
 * increments, history and the stats bar. Vanilla JS, no dependencies.
 */
"use strict";

(() => {
  const PALETTE = [
    "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
  ];

  const grid = document.getElementById("counter-grid");
  const emptyState = document.getElementById("empty-state");
  const toastEl = document.getElementById("toast");

  const modal = document.getElementById("counter-modal");
  const form = document.getElementById("counter-form");
  const modalTitle = document.getElementById("modal-title");
  const fName = document.getElementById("f-name");
  const fStep = document.getElementById("f-step");
  const fTarget = document.getElementById("f-target");
  const swatchBox = document.getElementById("color-swatches");
  const formError = document.getElementById("form-error");

  const historyModal = document.getElementById("history-modal");
  const historyTitle = document.getElementById("history-title");
  const historyStreaks = document.getElementById("history-streaks");
  const historyList = document.getElementById("history-list");

  let counters = [];
  let editingId = null; // null = creating
  let selectedColor = PALETTE[0];
  let toastTimer = null;

  /* ---------------- helpers ---------------- */

  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatWhen(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  /* ---------------- rendering ---------------- */

  function renderSwatches() {
    swatchBox.textContent = "";
    for (const color of PALETTE) {
      const button = el("button", "swatch");
      button.type = "button";
      button.style.background = color;
      button.setAttribute("aria-label", `Color ${color}`);
      if (color === selectedColor) button.classList.add("selected");
      button.addEventListener("click", () => {
        selectedColor = color;
        renderSwatches();
      });
      swatchBox.appendChild(button);
    }
  }

  function renderCounters() {
    grid.textContent = "";
    emptyState.hidden = counters.length > 0;

    for (const counter of counters) {
      grid.appendChild(buildCard(counter));
    }
  }

  function buildCard(counter) {
    const card = el("article", "counter-card");
    card.style.borderTopColor = counter.color;
    card.dataset.id = counter.id;

    // Header: name + actions
    const top = el("div", "counter-top");
    top.appendChild(el("h3", "counter-name", counter.name));

    const menu = el("div", "counter-menu");
    const editBtn = el("button", "icon-btn", "✎");
    editBtn.title = "Edit";
    editBtn.addEventListener("click", () => openEdit(counter));
    const histBtn = el("button", "icon-btn", "🕘");
    histBtn.title = "History";
    histBtn.addEventListener("click", () => openHistory(counter));
    const resetBtn = el("button", "icon-btn", "↺");
    resetBtn.title = "Reset to zero";
    resetBtn.addEventListener("click", () => resetCounter(counter));
    const delBtn = el("button", "icon-btn", "🗑");
    delBtn.title = "Delete";
    delBtn.addEventListener("click", () => removeCounter(counter));
    menu.append(editBtn, histBtn, resetBtn, delBtn);
    top.appendChild(menu);
    card.appendChild(top);

    // Value row: − [value] +
    const row = el("div", "counter-value-row");
    const minus = el("button", "count-btn minus", "−");
    minus.setAttribute("aria-label", `Decrease ${counter.name}`);
    minus.addEventListener("click", () => changeValue(counter, -counter.step));
    const valueEl = el("div", "counter-value", String(counter.value));
    const plus = el("button", "count-btn plus", "+");
    plus.setAttribute("aria-label", `Increase ${counter.name}`);
    plus.addEventListener("click", () => changeValue(counter, counter.step));
    row.append(minus, valueEl, plus);
    card.appendChild(row);

    // Progress toward target (only when a target is set)
    if (counter.target) {
      const wrap = el("div", "counter-progress");
      const track = el("div", "progress-track");
      const fill = el("div", "progress-fill");
      const percent = Math.min(100, (counter.value / counter.target) * 100);
      fill.style.width = `${percent}%`;
      fill.style.background = counter.color;
      track.appendChild(fill);

      const label = el("div", "progress-label");
      label.appendChild(el("span", null, `${counter.value} / ${counter.target}`));
      if (counter.value >= counter.target) {
        label.appendChild(el("span", "done", "Target reached ✓"));
      }
      wrap.append(track, label);
      card.appendChild(wrap);
    }

    return card;
  }

  function renderOverview(data) {
    document.getElementById("stat-today").textContent = data.today_total;
    document.getElementById("stat-streak").textContent = data.current_streak;
    document.getElementById("stat-best").textContent = data.best_streak;

    const chart = document.getElementById("daily-chart");
    chart.textContent = "";
    const max = Math.max(1, ...data.daily.map((d) => d.total));
    for (const day of data.daily) {
      const bar = el("div", "bar" + (day.total === 0 ? " empty" : ""));
      const height = day.total === 0 ? 2 : Math.max(4, Math.round((day.total / max) * 44));
      bar.style.height = `${height}px`;
      bar.title = `${day.date}: ${day.total}`;
      chart.appendChild(bar);
    }
  }

  /* ---------------- data operations ---------------- */

  async function refreshAll() {
    try {
      const [countersRes, overviewRes] = await Promise.all([
        Api.listCounters(),
        Api.overview(),
      ]);
      counters = countersRes.counters;
      renderCounters();
      renderOverview(overviewRes);
    } catch (error) {
      toast(error.message);
    }
  }

  async function refreshOverview() {
    try {
      renderOverview(await Api.overview());
    } catch (_) {
      /* non-critical; card state is already correct */
    }
  }

  async function changeValue(counter, delta) {
    try {
      const result = await Api.increment(counter.id, delta);
      const index = counters.findIndex((c) => c.id === counter.id);
      if (index !== -1) counters[index] = result.counter;
      renderCounters();
      if (result.counter.target && result.counter.value === result.counter.target && delta > 0) {
        toast(`🎯 Target reached for “${result.counter.name}”!`);
      }
      refreshOverview();
    } catch (error) {
      toast(error.message);
    }
  }

  async function resetCounter(counter) {
    if (counter.value === 0) return;
    const confirmed = window.confirm(`Reset “${counter.name}” to zero?`);
    if (!confirmed) return;
    try {
      const result = await Api.reset(counter.id);
      const index = counters.findIndex((c) => c.id === counter.id);
      if (index !== -1) counters[index] = result.counter;
      renderCounters();
      refreshOverview();
      toast("Counter reset.");
    } catch (error) {
      toast(error.message);
    }
  }

  async function removeCounter(counter) {
    const confirmed = window.confirm(
      `Delete “${counter.name}” and its full history? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await Api.deleteCounter(counter.id);
      counters = counters.filter((c) => c.id !== counter.id);
      renderCounters();
      refreshOverview();
      toast("Counter deleted.");
    } catch (error) {
      toast(error.message);
    }
  }

  /* ---------------- create / edit modal ---------------- */

  function openCreate() {
    editingId = null;
    modalTitle.textContent = "New counter";
    fName.value = "";
    fStep.value = "1";
    fTarget.value = "";
    selectedColor = PALETTE[0];
    formError.hidden = true;
    renderSwatches();
    modal.showModal();
    fName.focus();
  }

  function openEdit(counter) {
    editingId = counter.id;
    modalTitle.textContent = "Edit counter";
    fName.value = counter.name;
    fStep.value = String(counter.step);
    fTarget.value = counter.target === null ? "" : String(counter.target);
    selectedColor = PALETTE.includes(counter.color) ? counter.color : PALETTE[0];
    formError.hidden = true;
    renderSwatches();
    modal.showModal();
    fName.focus();
  }

  function readForm() {
    const name = fName.value.trim();
    const step = parseInt(fStep.value, 10);
    const targetRaw = fTarget.value.trim();
    const target = targetRaw === "" ? null : parseInt(targetRaw, 10);

    if (!name) return { error: "Name is required." };
    if (!Number.isInteger(step) || step < 1) return { error: "Step must be a positive number." };
    if (target !== null && (!Number.isInteger(target) || target < 1)) {
      return { error: "Target must be a positive number or empty." };
    }
    return { payload: { name, step, target, color: selectedColor } };
  }

  async function submitForm(event) {
    event.preventDefault();
    const { payload, error } = readForm();
    if (error) {
      formError.textContent = error;
      formError.hidden = false;
      return;
    }

    try {
      if (editingId === null) {
        const result = await Api.createCounter(payload);
        counters.push(result.counter);
        toast("Counter created.");
      } else {
        const result = await Api.updateCounter(editingId, payload);
        const index = counters.findIndex((c) => c.id === editingId);
        if (index !== -1) counters[index] = result.counter;
        toast("Counter updated.");
      }
      renderCounters();
      refreshOverview();
      modal.close();
    } catch (apiError) {
      formError.textContent = apiError.message;
      formError.hidden = false;
    }
  }

  /* ---------------- history modal ---------------- */

  async function openHistory(counter) {
    try {
      const data = await Api.history(counter.id);
      historyTitle.textContent = `History — ${data.counter.name}`;
      historyStreaks.textContent =
        `Current streak: ${data.current_streak} day(s) · Best: ${data.best_streak} day(s)`;

      historyList.textContent = "";
      if (data.events.length === 0) {
        historyList.appendChild(el("li", "history-empty", "No activity yet."));
      }
      for (const eventItem of data.events) {
        const li = document.createElement("li");
        const deltaClass = eventItem.delta > 0 ? "delta-pos" : "delta-neg";
        const deltaText = (eventItem.delta > 0 ? "+" : "") + eventItem.delta;
        li.appendChild(el("span", deltaClass, deltaText));
        li.appendChild(el("span", null, `→ ${eventItem.value_after}`));
        li.appendChild(el("span", "when", formatWhen(eventItem.created_at)));
        historyList.appendChild(li);
      }
      historyModal.showModal();
    } catch (error) {
      toast(error.message);
    }
  }

  /* ---------------- wiring ---------------- */

  document.getElementById("new-counter-btn").addEventListener("click", openCreate);
  document.getElementById("modal-cancel").addEventListener("click", () => modal.close());
  document.getElementById("history-close").addEventListener("click", () => historyModal.close());
  form.addEventListener("submit", submitForm);

  refreshAll();
})();
