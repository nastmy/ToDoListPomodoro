/* app.js — To-Do Dashboard + Pomodoro (separate file) */
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "todo_dashboard_v1";
  const WORK_TIME = 25 * 60;
  const BRAKE_TIME = 5 * 60;

  const defaultState = {
    columns: [
      { id: "col-todo", name: "Todo" },
      { id: "col-done", name: "Done" },
    ],
    tasks: [],
    timer: {
      activeTaskId: null,
      running: false,
      session: "work",
      remainingSec: WORK_TIME,
      endTime: null,
    },
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const s = JSON.stringify(defaultState);
        localStorage.setItem(STORAGE_KEY, s);
        return JSON.parse(s);
      }
      const parsed = JSON.parse(raw);
      if (!parsed.columns) parsed.columns = defaultState.columns;
      if (!parsed.tasks) parsed.tasks = [];
      if (!parsed.timer) parsed.timer = defaultState.timer;
      return parsed;
    } catch (e) {
      console.error("Load state error", e);
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(prefix = "id") {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }

  function formatTime(sec) {
    if (sec < 0) sec = 0;
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  /* state + interval */
  let state = loadState();
  let timerInterval = null;

  /* elements */
  const boardEl = document.getElementById("board");
  const addColumnBtn = document.getElementById("add-column");
  const newColumnName = document.getElementById("new-column-name");
  const addTaskBtn = document.getElementById("add-task-btn");
  const taskTitle = document.getElementById("task-title");
  const taskDesc = document.getElementById("task-desc");
  const filterSelect = document.getElementById("filter");
  const clearStorageBtn = document.getElementById("clear-storage");

  const timerModeEl = document.getElementById("timer-mode");
  const timerDisplayEl = document.getElementById("timer-display");
  const startTimerBtn = document.getElementById("start-timer");
  const pauseTimerBtn = document.getElementById("pause-timer");
  const resetTimerBtn = document.getElementById("reset-timer");
  const timerTaskIdEl = document.getElementById("timer-task-id");
  const selectedTaskNameEl = document.getElementById("selected-task-name");

  function setTimeTitle() {
    const timeTitle = document.getElementById("time-title");
    timeTitle.innerText =
      WORK_TIME / 60 + " хв робота / " + BRAKE_TIME / 60 + " хв перерва";
  }

  /* render */
  function render() {
    setTimeTitle();
    boardEl.innerHTML = "";
    const cols = state.columns;
    const f = filterSelect.value;
    for (const col of cols) {
      const colEl = document.createElement("div");
      colEl.className = "column";
      colEl.dataset.colId = col.id;

      const header = document.createElement("div");
      header.className = "col-header";
      const titleWrap = document.createElement("div");
      titleWrap.style.display = "flex";
      titleWrap.style.gap = "8px";
      titleWrap.style.alignItems = "center";
      const title = document.createElement("div");
      title.textContent = col.name;
      title.style.fontWeight = "700";
      titleWrap.appendChild(title);

      const colControls = document.createElement("div");
      colControls.className = "col-controls";
      if (col.id !== "col-todo" && col.id !== "col-done") {
        const renameBtn = document.createElement("button");
        renameBtn.className = "icon-btn";
        renameBtn.title = "Rename";
        renameBtn.innerHTML = "✏️";
        renameBtn.onclick = () => renameColumn(col.id);
        const delBtn = document.createElement("button");
        delBtn.className = "icon-btn delete-col";
        delBtn.title = "Delete";
        delBtn.innerHTML = "🗑️";
        delBtn.onclick = () => deleteColumn(col.id);
        colControls.appendChild(renameBtn);
        colControls.appendChild(delBtn);
      }
      header.appendChild(titleWrap);
      header.appendChild(colControls);
      colEl.appendChild(header);

      const tasksWrap = document.createElement("div");
      tasksWrap.className = "tasks";
      tasksWrap.dataset.colId = col.id;
      tasksWrap.ondragover = (e) => {
        e.preventDefault();
      };
      tasksWrap.ondrop = (e) => onDropToColumn(e, col.id);

      const tasks = state.tasks
        .filter((t) => t.columnId === col.id)
        .filter((t) => {
          if (f === "all") return true;
          if (f === "active") return !t.completed;
          if (f === "completed") return t.completed;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      for (const t of tasks) {
        const tEl = document.createElement("div");
        tEl.className = "task";
        tEl.draggable = true;
        tEl.dataset.taskId = t.id;
        tEl.ondragstart = (e) => onDragStart(e, t.id);
        tEl.ondragend = onDragEnd;

        if (t.completed) {
          const doneBadge = document.createElement("div");
          doneBadge.className = "done-badge";
          doneBadge.textContent = "Done";
          tEl.appendChild(doneBadge);
        }

        const top = document.createElement("div");
        top.className = "task-top";
        const left = document.createElement("div");
        left.style.flex = "1";
        const titleEl = document.createElement("div");
        titleEl.className = "task-title";
        titleEl.textContent = t.title;
        const descEl = document.createElement("div");
        descEl.className = "small muted";
        descEl.style.color = "var(--muted)";
        descEl.textContent = t.desc || "";
        left.appendChild(titleEl);
        left.appendChild(descEl);

        const actions = document.createElement("div");
        actions.className = "task-actions";
        const completeBtn = document.createElement("button");
        completeBtn.title = "Toggle complete";
        completeBtn.className = "icon-btn";
        completeBtn.innerHTML = t.completed ? "↺" : "✅";
        completeBtn.onclick = () => toggleComplete(t.id);
        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn";
        editBtn.innerHTML = "✏️";
        editBtn.title = "Edit";
        editBtn.onclick = () => editTask(t.id);
        const delBtn = document.createElement("button");
        delBtn.className = "icon-btn";
        delBtn.innerHTML = "🗑️";
        delBtn.title = "Delete";
        delBtn.onclick = () => deleteTask(t.id);
        const timerBtn = document.createElement("button");
        timerBtn.className = "icon-btn";
        timerBtn.innerHTML = "⏱️";
        timerBtn.title = "Start Pomodoro";
        timerBtn.onclick = () => selectTaskForTimer(t.id);

        actions.appendChild(timerBtn);
        actions.appendChild(completeBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        top.appendChild(left);
        top.appendChild(actions);

        tEl.appendChild(top);

        const meta = document.createElement("div");
        meta.className = "task-meta";
        meta.innerHTML = `<span class="small">${new Date(
          t.createdAt
        ).toLocaleString()}</span>`;
        tEl.appendChild(meta);

        tasksWrap.appendChild(tEl);
      }

      const addWrap = document.createElement("div");
      addWrap.className = "add-task";
      const atitle = document.createElement("input");
      atitle.placeholder = "Нова задача";
      atitle.className = "input";
      atitle.style.flex = "1";
      const aadd = document.createElement("button");
      aadd.className = "btn";
      aadd.textContent = "Add";
      aadd.onclick = () => {
        if (!atitle.value.trim()) return;
        const newTask = {
          id: uid("task"),
          title: atitle.value.trim(),
          desc: "",
          columnId: col.id,
          completed: false,
          createdAt: Date.now(),
          order: state.tasks.filter((x) => x.columnId === col.id).length,
        };
        state.tasks.push(newTask);
        saveState();
        render();
        atitle.value = "";
      };
      addWrap.appendChild(atitle);
      addWrap.appendChild(aadd);

      colEl.appendChild(tasksWrap);
      colEl.appendChild(addWrap);
      boardEl.appendChild(colEl);
    }

    updateTimerUI();
  }

  /* column functions */
  function addColumn() {
    const name = newColumnName.value.trim();
    if (!name) return alert("Введіть імʼя колонки");
    const doneIndex = state.columns.findIndex((c) => c.id === "col-done");
    const newCol = { id: uid("col"), name };
    state.columns.splice(doneIndex, 0, newCol);
    saveState();
    newColumnName.value = "";
    render();
  }

  function renameColumn(colId) {
    const col = state.columns.find((c) => c.id === colId);
    const newName = prompt("Нова назва для колонки", col.name);
    if (newName && newName.trim()) {
      col.name = newName.trim();
      saveState();
      render();
    }
  }

  function deleteColumn(colId) {
    if (!confirm("Видалити колонку і всі завдання в ній?")) return;
    const todoId = "col-todo";
    state.tasks.forEach((t) => {
      if (t.columnId === colId) t.columnId = todoId;
    });
    state.columns = state.columns.filter((c) => c.id !== colId);
    saveState();
    render();
  }

  /* tasks */
  function addTaskToTodo() {
    const title = taskTitle.value.trim();
    if (!title) return alert("Введіть назву завдання");
    const t = {
      id: uid("task"),
      title,
      desc: taskDesc.value.trim(),
      columnId: "col-todo",
      completed: false,
      createdAt: Date.now(),
      order: state.tasks.filter((x) => x.columnId === "col-todo").length,
    };
    state.tasks.push(t);
    taskTitle.value = "";
    taskDesc.value = "";
    saveState();
    render();
  }

  function editTask(taskId) {
    const t = state.tasks.find((x) => x.id === taskId);
    const newTitle = prompt("Назва", t.title);
    if (newTitle && newTitle.trim()) {
      t.title = newTitle.trim();
    }
    const newDesc = prompt("Опис", t.desc || "");
    if (newDesc !== null) t.desc = newDesc;
    saveState();
    render();
  }

  function deleteTask(taskId) {
    if (!confirm("Видалити задачу?")) return;
    state.tasks = state.tasks.filter((t) => t.id !== taskId);
    if (state.timer.activeTaskId === taskId) {
      stopTimer();
      state.timer.activeTaskId = null;
    }
    saveState();
    render();
  }

  function toggleComplete(taskId) {
    const t = state.tasks.find((x) => x.id === taskId);
    t.completed = !t.completed;
    saveState();
    render();
  }

  /* drag & drop */
  let draggedTaskId = null;
  function onDragStart(e, taskId) {
    draggedTaskId = taskId;
    e.dataTransfer.effectAllowed = "move";
    e.target.classList.add("dragging");
  }

  function onDragEnd(e) {
    const els = document.querySelectorAll(".task.dragging");
    els.forEach((el) => el.classList.remove("dragging"));
    draggedTaskId = null;
  }

  function onDropToColumn(e, destColId) {
    e.preventDefault();
    if (!draggedTaskId) return;
    const task = state.tasks.find((t) => t.id === draggedTaskId);
    if (!task) return;
    task.columnId = destColId;
    task.order = state.tasks.filter((x) => x.columnId === destColId).length;
    saveState();
    render();
  }

  /* timer */

  function updateTimerUI() {
    const timer = state.timer;
    const activeTask = state.tasks.find((t) => t.id === timer.activeTaskId);
    selectedTaskNameEl.textContent = activeTask
      ? activeTask.title
      : "Немає завдання";
    timerTaskIdEl.textContent = timer.activeTaskId || "—";
    timerModeEl.textContent = timer.running
      ? timer.session === "work"
        ? "Work"
        : "Break"
      : "Ready";
    timerDisplayEl.textContent = formatTime(timer.remainingSec);
    startTimerBtn.disabled = timer.running && timer.activeTaskId;
    pauseTimerBtn.disabled = !timer.running;
  }

  function selectTaskForTimer(taskId) {
    state.timer.activeTaskId = taskId;
    state.timer.session = "work";
    state.timer.remainingSec = WORK_TIME;
    state.timer.running = false;
    state.timer.endTime = null;
    saveState();
    render();
    startTimer();
  }

  function startTimer() {
    if (!state.timer.activeTaskId) {
      alert("Виберіть завдання для таймера (натисніть ⏱️ біля задачі).");
      return;
    }
    if (state.timer.running) return;
    state.timer.endTime = Date.now() + state.timer.remainingSec * 1000;
    state.timer.running = true;
    saveState();
    tickTimer();
    timerInterval = setInterval(tickTimer, 1000);
    updateTimerUI();
  }

  function pauseTimer() {
    if (!state.timer.running) return;
    const rem = Math.round((state.timer.endTime - Date.now()) / 1000);
    state.timer.remainingSec = rem > 0 ? rem : 0;
    state.timer.running = false;
    state.timer.endTime = null;
    saveState();
    clearInterval(timerInterval);
    updateTimerUI();
  }

  function resetTimer() {
    state.timer.running = false;
    state.timer.endTime = null;
    state.timer.session = "work";
    state.timer.remainingSec = WORK_TIME;
    saveState();
    clearInterval(timerInterval);
    updateTimerUI();
  }

  function stopTimer() {
    state.timer.running = false;
    state.timer.endTime = null;
    state.timer.activeTaskId = null;
    state.timer.remainingSec = WORK_TIME;
    state.timer.session = "work";
    saveState();
    clearInterval(timerInterval);
    updateTimerUI();
  }

  function tickTimer() {
    if (state.timer.running && state.timer.endTime) {
      const rem = Math.round((state.timer.endTime - Date.now()) / 1000);
      if (rem <= 0) {
        clearInterval(timerInterval);
        state.timer.running = false;
        state.timer.endTime = null;
        if (state.timer.session === "work") {
          state.timer.session = "break";
          state.timer.remainingSec = BRAKE_TIME;
          state.timer.endTime = Date.now() + state.timer.remainingSec * 1000;
          state.timer.running = true;
        } else {
          state.timer.session = "work";
          state.timer.remainingSec = WORK_TIME;
          state.timer.endTime = Date.now() + state.timer.remainingSec * 1000;
          state.timer.running = true;
        }
        saveState();
        timerInterval = setInterval(tickTimer, 1000);
        updateTimerUI();
        return;
      } else {
        state.timer.remainingSec = rem;
        updateTimerUI();
        return;
      }
    } else if (!state.timer.running && state.timer.endTime) {
      const rem = Math.round((state.timer.endTime - Date.now()) / 1000);
      state.timer.remainingSec = rem > 0 ? rem : 0;
      if (rem > 0) {
        state.timer.running = true;
        timerInterval = setInterval(tickTimer, 1000);
      } else {
        state.timer.endTime = null;
        state.timer.running = false;
      }
      saveState();
      updateTimerUI();
    } else {
      updateTimerUI();
    }
  }

  /* events */
  addColumnBtn.addEventListener("click", addColumn);
  addTaskBtn.addEventListener("click", addTaskToTodo);
  filterSelect.addEventListener("change", () => {
    render();
    saveState();
  });
  clearStorageBtn.addEventListener("click", () => {
    if (confirm("Видалити всі дані localStorage?")) {
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      render();
    }
  });
  startTimerBtn.addEventListener("click", startTimer);
  pauseTimerBtn.addEventListener("click", pauseTimer);
  resetTimerBtn.addEventListener("click", resetTimer);

  /* init */
  (function ensureColumns() {
    const hasTodo = state.columns.some((c) => c.id === "col-todo");
    const hasDone = state.columns.some((c) => c.id === "col-done");
    if (!hasTodo) state.columns.unshift({ id: "col-todo", name: "Todo" });
    if (!hasDone) state.columns.push({ id: "col-done", name: "Done" });
    state.columns = state.columns.filter(
      (c) => c.id !== "col-todo" && c.id !== "col-done"
    );
    state.columns.unshift({ id: "col-todo", name: "Todo" });
    state.columns.push({ id: "col-done", name: "Done" });
    saveState();
  })();

  if (state.timer.running && state.timer.endTime) {
    const rem = Math.round((state.timer.endTime - Date.now()) / 1000);
    state.timer.remainingSec = rem > 0 ? rem : 0;
    if (rem > 0) timerInterval = setInterval(tickTimer, 1000);
    else {
      state.timer.running = false;
      state.timer.endTime = null;
      saveState();
    }
  }

  render();
});
