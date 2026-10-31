/*
 * File:     app.js
 * Purpose:  Task Manager logic. Loads the public Supabase configuration from
 *           config.json and runs CRUD on the "tasks" table through the
 *           Supabase (PostgREST) REST API with fetch().
 * Author:   Vistula student 73196
 * Created:  2026-10-31
 * Modified: 2026-10-31
 */

'use strict';

const REQUIRED_CONFIG_FIELDS = ['supabaseUrl', 'supabasePublishableKey', 'tableName'];

const state = {
  config: null,     // { supabaseUrl, supabasePublishableKey, tableName }
  tasks: [],        // last list loaded from the database
  editingId: null,  // id of the task in the form; null means "create" mode
  loadSeq: 0,       // ignores list responses that arrive out of order
};

const ui = {
  form: document.getElementById('task-form'),
  title: document.getElementById('task-title'),
  description: document.getElementById('task-description'),
  submit: document.getElementById('task-submit'),
  cancel: document.getElementById('task-cancel'),
  list: document.getElementById('task-list'),
  status: document.getElementById('status-message'),
};

/* ---------- status message ---------- */

function showStatus(text, kind = 'info') {
  ui.status.textContent = text;
  ui.status.className = kind; // info | success | error
}

/* ---------- configuration ---------- */

async function loadConfig() {
  let response;
  try {
    response = await fetch('config.json', { cache: 'no-store' });
  } catch {
    throw new Error('config.json could not be downloaded');
  }
  if (!response.ok) {
    throw new Error(`config.json could not be loaded (HTTP ${response.status})`);
  }

  let config;
  try {
    config = await response.json();
  } catch {
    throw new Error('config.json is not valid JSON');
  }

  for (const field of REQUIRED_CONFIG_FIELDS) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') {
      throw new Error(`config.json has no "${field}" value`);
    }
  }
  if (/PROJECT_ID|REPLACE_ME/.test(config.supabaseUrl + config.supabasePublishableKey)) {
    throw new Error('config.json still contains placeholder values');
  }

  return { ...config, supabaseUrl: config.supabaseUrl.trim().replace(/\/+$/, '') };
}

/* ---------- REST API ---------- */

// The publishable key goes only into the "apikey" header, which is all the
// Data API needs. It is not a JWT, so no "Authorization: Bearer" is sent.
async function request(method, query, body) {
  const { supabaseUrl, supabasePublishableKey, tableName } = state.config;
  const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}${query}`;
  const headers = { apikey: supabasePublishableKey };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers.Prefer = 'return=representation';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('the database could not be reached (network error)');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const reason = data && typeof data === 'object'
      ? data.message || data.error || JSON.stringify(data)
      : data || response.statusText;
    throw new Error(`HTTP ${response.status}: ${reason}`);
  }
  return data;
}

const api = {
  // GET /tasks?select=*
  list: () => request('GET', '?select=*&order=id.asc'),

  // GET /tasks?id=eq.{id}&select=*
  async get(id) {
    const rows = await request('GET', `?id=eq.${id}&select=*`);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`task #${id} was not found (it may have been deleted)`);
    }
    return rows[0];
  },

  // POST /tasks
  create: (task) => request('POST', '', task),

  // PUT /tasks?id=eq.{id} replaces the whole record, so the body carries
  // every column and the same primary key as the URL filter.
  async put(task) {
    const rows = await request('PUT', `?id=eq.${task.id}`, task);
    if (Array.isArray(rows) && rows.length === 0) {
      throw new Error(`task #${task.id} was not saved`);
    }
    return rows;
  },

  // DELETE /tasks?id=eq.{id}. An empty result means nothing was deleted:
  // the row is gone already or a database policy blocked the delete.
  async remove(id) {
    const rows = await request('DELETE', `?id=eq.${id}`);
    if (Array.isArray(rows) && rows.length === 0) {
      throw new Error(`task #${id} was not deleted (it may not exist, or the database policy does not allow deleting)`);
    }
    return rows;
  },
};

// Reads the current record first, so PUT always gets the complete,
// up-to-date row with only the intended fields changed.
async function updateTask(id, changes) {
  const current = await api.get(id);
  return api.put({ ...current, ...changes, id: current.id });
}

/* ---------- rendering ---------- */

function makeButton(className, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

// Task text goes in through textContent only: the table is publicly
// writable, so its content must never be interpreted as HTML.
function renderTask(task) {
  const item = document.createElement('li');
  item.className = 'task-item';
  item.dataset.id = String(task.id);
  item.dataset.completed = String(Boolean(task.completed));

  const title = document.createElement('h3');
  title.className = 'task-title';
  title.textContent = task.title;

  const description = document.createElement('p');
  description.className = 'task-description';
  description.textContent = task.description ?? '';

  const status = document.createElement('span');
  status.className = 'task-status';
  status.textContent = task.completed ? 'Completed' : 'Incomplete';

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  actions.append(
    makeButton('toggle-task', task.completed ? 'Mark as incomplete' : 'Mark as completed'),
    makeButton('edit-task', 'Edit'),
    makeButton('delete-task', 'Delete'),
  );

  item.append(title, description, status, actions);
  return item;
}

function renderTasks() {
  ui.list.replaceChildren(...state.tasks.map(renderTask));
}

async function loadTasks() {
  const seq = ++state.loadSeq;
  try {
    const tasks = await api.list();
    if (seq !== state.loadSeq) return true; // a newer reload is on its way
    state.tasks = Array.isArray(tasks) ? tasks : [];
    renderTasks();
    return true;
  } catch (error) {
    if (seq === state.loadSeq) showStatus(`Could not load tasks: ${error.message}`, 'error');
    return false;
  }
}

/* ---------- actions ---------- */

// Runs one database operation, reloads the list and reports the outcome.
async function perform(action, operation, successMessage) {
  try {
    await operation();
  } catch (error) {
    showStatus(`Could not ${action}: ${error.message}`, 'error');
    return false;
  }
  if (await loadTasks()) showStatus(successMessage, 'success');
  return true;
}

// task = null switches the form to "create" mode, a task switches it to "edit".
function setFormMode(task) {
  state.editingId = task ? task.id : null;
  ui.title.value = task ? task.title : '';
  ui.description.value = task ? (task.description ?? '') : '';
  ui.submit.textContent = task ? 'Save changes' : 'Add task';
  ui.cancel.hidden = !task;
  ui.form.classList.toggle('editing', Boolean(task));
}

function startEdit(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) {
    showStatus(`Task #${id} is no longer in the list. Reload the page.`, 'error');
    return;
  }
  // Filled synchronously from the loaded list, so typing right after the
  // click is never overwritten by a late network response.
  setFormMode(task);
  ui.title.focus();
  showStatus(`Editing task #${id}.`, 'info');
}

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return Promise.resolve(false);
  const completed = !task.completed;
  return perform(
    'update the task status',
    () => updateTask(id, { completed }),
    `Task #${id} marked as ${completed ? 'completed' : 'incomplete'}.`,
  );
}

function deleteTask(id) {
  return perform('delete the task', async () => {
    await api.remove(id);
    if (state.editingId === id) setFormMode(null);
  }, `Task #${id} deleted.`);
}

// Disables the buttons of one task while its request is running, so a
// double click does not send the same request twice.
async function runOnItem(item, action) {
  const buttons = [...item.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await action();
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

/* ---------- events ---------- */

ui.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.config) {
    showStatus('The app is not connected to the database. Check config.json.', 'error');
    return;
  }

  const title = ui.title.value.trim();
  const description = ui.description.value.trim();
  if (!title) {
    showStatus('Title is required.', 'error');
    ui.title.focus();
    return;
  }

  const editingId = state.editingId;
  const fields = { title, description: description || null };
  ui.submit.disabled = true;
  try {
    if (editingId === null) {
      await perform('add the task', async () => {
        await api.create(fields);
        setFormMode(null);
      }, `Task "${title}" added.`);
    } else {
      await perform('save the task', async () => {
        await updateTask(editingId, fields);
        setFormMode(null);
      }, `Task #${editingId} saved.`);
    }
  } finally {
    ui.submit.disabled = false;
  }
});

ui.cancel.addEventListener('click', () => {
  setFormMode(null);
  showStatus('Editing cancelled.', 'info');
});

ui.list.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  const item = button && button.closest('.task-item');
  if (!item || !state.config) return;

  const id = Number(item.dataset.id);
  if (button.classList.contains('edit-task')) startEdit(id);
  else if (button.classList.contains('toggle-task')) runOnItem(item, () => toggleTask(id));
  else if (button.classList.contains('delete-task')) runOnItem(item, () => deleteTask(id));
});

/* ---------- start ---------- */

async function init() {
  showStatus('Loading tasks...', 'info');
  try {
    state.config = await loadConfig();
  } catch (error) {
    showStatus(`Configuration error: ${error.message}`, 'error');
    ui.submit.disabled = true;
    return;
  }

  if (await loadTasks()) {
    const count = state.tasks.length;
    showStatus(
      count === 0 ? 'No tasks in the database yet.' : `Loaded ${count} task${count === 1 ? '' : 's'} from the database.`,
      'success',
    );
  }
}

init();
