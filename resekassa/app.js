/* Resekassan - delad reseutläggs-app
   Frontend talar med en Cloudflare Worker som lagrar en enda delad "state"-blob.
   State: { people: [{id,name}], expenses: [...], settled: {key:true}, rev }
*/

// ---- Konfiguration ----
// Sätt WORKER_URL till din deployade Worker. Lämnas den tom körs appen i
// lokalt läge (localStorage) så den funkar även innan Workern är uppsatt.
const WORKER_URL = "https://resekassa.mtgtt.workers.dev";
const TRIP_ID = "resa"; // byt om ni vill ha flera separata resor

const POLL_MS = 5000;
const LOCAL_KEY = "resekassa:" + TRIP_ID;

// ---- State ----
let state = { people: [], expenses: [], settled: {}, rev: 0 };
let selectedParticipants = new Set();
let saveTimer = null;
let pollTimer = null;
let suppressNextPoll = false;

// ---- Hjälpfunktioner ----
const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const kr = (n) => {
  const r = Math.round(n);
  return r.toLocaleString("sv-SE") + " kr";
};
const kr2 = (n) =>
  (Math.round(n * 100) / 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 }) + " kr";
const nameOf = (id) => (state.people.find((p) => p.id === id) || {}).name || "?";

// ---- Synk ----
function setSyncStatus(kind) {
  const el = $("#sync-status");
  el.className = "sync-status" + (kind ? " " + kind : "");
  el.textContent = kind === "saving" ? "⟳" : kind === "error" ? "⚠" : "●";
  el.title =
    kind === "saving" ? "Sparar…" : kind === "error" ? "Offline – sparat lokalt" : "Synkat";
}

async function loadRemote() {
  if (!WORKER_URL) {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try { state = JSON.parse(raw); } catch (_) {}
    }
    return;
  }
  try {
    const res = await fetch(`${WORKER_URL}/trip/${TRIP_ID}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") state = normalize(data);
      setSyncStatus("");
    }
  } catch (_) {
    setSyncStatus("error");
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) { try { state = JSON.parse(raw); } catch (_) {} }
  }
}

function normalize(data) {
  return {
    people: Array.isArray(data.people) ? data.people : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    settled: data.settled && typeof data.settled === "object" ? data.settled : {},
    rev: data.rev || 0,
  };
}

function scheduleSave() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  if (!WORKER_URL) return;
  setSyncStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRemote, 400);
}

async function saveRemote() {
  if (!WORKER_URL) return;
  state.rev = (state.rev || 0) + 1;
  suppressNextPoll = true;
  try {
    const res = await fetch(`${WORKER_URL}/trip/${TRIP_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rev != null) state.rev = data.rev;
      setSyncStatus("");
    } else {
      setSyncStatus("error");
    }
  } catch (_) {
    setSyncStatus("error");
  }
}

async function poll() {
  if (!WORKER_URL) return;
  if (suppressNextPoll) { suppressNextPoll = false; return; }
  try {
    const res = await fetch(`${WORKER_URL}/trip/${TRIP_ID}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = normalize(await res.json());
    if ((data.rev || 0) > (state.rev || 0)) {
      state = data;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      renderAll();
    }
    setSyncStatus("");
  } catch (_) {
    setSyncStatus("error");
  }
}

// ---- Beräkningar ----
// Varje person: betalat - sin andel av utläggen där de deltog.
function computeBalances() {
  const bal = {};
  state.people.forEach((p) => (bal[p.id] = 0));
  state.expenses.forEach((e) => {
    const parts = e.participants.filter((id) => bal[id] != null);
    if (parts.length === 0) return;
    if (bal[e.payer] != null) bal[e.payer] += e.amount;
    const share = e.amount / parts.length;
    parts.forEach((id) => (bal[id] -= share));
  });
  return bal; // { personId: netto }
}

// Greedy skuldavveckling -> minsta antal överföringar.
function computeTransfers(bal) {
  const EPS = 0.01;
  const debtors = [];
  const creditors = [];
  Object.keys(bal).forEach((id) => {
    const v = bal[id];
    if (v < -EPS) debtors.push({ id, amt: -v });
    else if (v > EPS) creditors.push({ id, amt: v });
  });
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < EPS) i++;
    if (creditors[j].amt < EPS) j++;
  }
  return transfers;
}

const transferKey = (t) => `${t.from}>${t.to}>${Math.round(t.amount)}`;

// ---- Rendering ----
function renderAll() {
  renderPayerSelect();
  renderParticipantChips();
  renderExpenseList();
  renderBalances();
  renderSettle();
  renderPeople();
}

function renderPayerSelect() {
  const sel = $("#exp-payer");
  const prev = sel.value;
  sel.innerHTML = "";
  if (state.people.length === 0) {
    const o = document.createElement("option");
    o.textContent = "Lägg till deltagare först";
    o.value = "";
    sel.appendChild(o);
    return;
  }
  state.people.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  });
  if (state.people.some((p) => p.id === prev)) sel.value = prev;
}

function renderParticipantChips() {
  const wrap = $("#exp-participants");
  wrap.innerHTML = "";
  // Behåll bara valda som fortf. finns
  selectedParticipants = new Set(
    [...selectedParticipants].filter((id) => state.people.some((p) => p.id === id))
  );
  // Default: alla valda om inget valt
  if (selectedParticipants.size === 0) {
    state.people.forEach((p) => selectedParticipants.add(p.id));
  }
  if (state.people.length === 0) {
    wrap.innerHTML = '<p class="empty">Inga deltagare än.</p>';
    return;
  }
  state.people.forEach((p) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (selectedParticipants.has(p.id) ? " on" : "");
    chip.textContent = p.name;
    chip.onclick = () => {
      if (selectedParticipants.has(p.id)) selectedParticipants.delete(p.id);
      else selectedParticipants.add(p.id);
      renderParticipantChips();
    };
    wrap.appendChild(chip);
  });
}

function renderExpenseList() {
  const list = $("#expense-list");
  list.innerHTML = "";
  if (state.expenses.length === 0) {
    list.innerHTML = '<p class="empty">Inga utlägg loggade än.</p>';
    $("#grand-total").textContent = "0 kr";
    return;
  }
  const sorted = [...state.expenses].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") || b.id.localeCompare(a.id)
  );
  let total = 0;
  sorted.forEach((e) => {
    total += e.amount;
    const item = document.createElement("div");
    item.className = "expense-item";
    const partNames = e.participants.map(nameOf).join(", ");
    item.innerHTML = `
      <div class="ei-top">
        <span class="ei-desc"></span>
        <span class="ei-amount"></span>
      </div>
      <div class="ei-meta"></div>
      <button class="ei-del">Ta bort</button>`;
    item.querySelector(".ei-desc").textContent = e.desc || "Utlägg";
    item.querySelector(".ei-amount").textContent = kr(e.amount);
    item.querySelector(".ei-meta").textContent =
      `${nameOf(e.payer)} betalade · ${e.date || ""} · delas på ${e.participants.length} (${partNames})`;
    item.querySelector(".ei-del").onclick = () => removeExpense(e.id);
    list.appendChild(item);
  });
  $("#grand-total").textContent = kr(total);
}

function renderBalances() {
  const list = $("#balance-list");
  list.innerHTML = "";
  if (state.people.length === 0) {
    list.innerHTML = '<p class="empty">Lägg till deltagare för att se saldo.</p>';
    return;
  }
  const bal = computeBalances();
  state.people.forEach((p) => {
    const v = bal[p.id] || 0;
    const cls = v > 0.5 ? "pos" : v < -0.5 ? "neg" : "zero";
    const sign = v > 0.5 ? "+" : "";
    const item = document.createElement("div");
    item.className = "balance-item";
    item.innerHTML = `<span class="bi-name"></span><span class="bi-amount ${cls}"></span>`;
    item.querySelector(".bi-name").textContent = p.name;
    item.querySelector(".bi-amount").textContent = sign + kr2(v);
    list.appendChild(item);
  });
}

function renderSettle() {
  const list = $("#settle-list");
  list.innerHTML = "";
  if (state.people.length < 2) {
    list.innerHTML = '<p class="empty">Behöver minst två deltagare.</p>';
    return;
  }
  const bal = computeBalances();
  const transfers = computeTransfers(bal);
  if (transfers.length === 0) {
    list.innerHTML = '<p class="empty">Allt är kvitt – inga swishar behövs. 🎉</p>';
    return;
  }
  transfers.forEach((t) => {
    const key = transferKey(t);
    const done = !!state.settled[key];
    const item = document.createElement("div");
    item.className = "settle-item" + (done ? " done" : "");
    item.innerHTML = `
      <div class="settle-check">${done ? "✓" : ""}</div>
      <div class="si-text"><strong class="t-from"></strong> swishar <strong class="t-to"></strong></div>
      <div class="si-amount"></div>`;
    item.querySelector(".t-from").textContent = nameOf(t.from);
    item.querySelector(".t-to").textContent = nameOf(t.to);
    item.querySelector(".si-amount").textContent = kr(t.amount);
    item.onclick = () => {
      if (state.settled[key]) delete state.settled[key];
      else state.settled[key] = true;
      scheduleSave();
      renderSettle();
    };
    list.appendChild(item);
  });
}

function renderPeople() {
  const list = $("#people-list");
  list.innerHTML = "";
  if (state.people.length === 0) {
    list.innerHTML = '<p class="empty">Inga deltagare än.</p>';
    return;
  }
  state.people.forEach((p) => {
    const item = document.createElement("div");
    item.className = "person-item";
    item.innerHTML = `<span class="pi-name"></span><button class="pi-del">Ta bort</button>`;
    item.querySelector(".pi-name").textContent = p.name;
    item.querySelector(".pi-del").onclick = () => removePerson(p.id);
    list.appendChild(item);
  });
}

// ---- Åtgärder ----
function addPerson() {
  const input = $("#person-name");
  const name = input.value.trim();
  if (!name) return;
  state.people.push({ id: uid(), name });
  input.value = "";
  scheduleSave();
  renderAll();
}

function removePerson(id) {
  const used = state.expenses.some(
    (e) => e.payer === id || e.participants.includes(id)
  );
  const msg = used
    ? `${nameOf(id)} finns i loggade utlägg. Ta bort ändå? Utläggen behålls men saldot kan bli skevt.`
    : `Ta bort ${nameOf(id)}?`;
  if (!confirm(msg)) return;
  state.people = state.people.filter((p) => p.id !== id);
  selectedParticipants.delete(id);
  scheduleSave();
  renderAll();
}

function addExpense() {
  const desc = $("#exp-desc").value.trim();
  const amount = parseFloat($("#exp-amount").value);
  const date = $("#exp-date").value;
  const payer = $("#exp-payer").value;
  const hint = $("#exp-hint");
  hint.className = "hint";

  if (state.people.length === 0) {
    hint.textContent = "Lägg till deltagare först (fliken Deltagare).";
    hint.className = "hint error";
    return;
  }
  if (!amount || amount <= 0) {
    hint.textContent = "Ange ett belopp större än 0.";
    hint.className = "hint error";
    return;
  }
  if (!payer) {
    hint.textContent = "Välj vem som betalade.";
    hint.className = "hint error";
    return;
  }
  const participants = [...selectedParticipants];
  if (participants.length === 0) {
    hint.textContent = "Välj minst en som var med.";
    hint.className = "hint error";
    return;
  }

  state.expenses.push({
    id: uid(),
    desc,
    amount,
    date: date || new Date().toISOString().slice(0, 10),
    payer,
    participants,
  });

  $("#exp-desc").value = "";
  $("#exp-amount").value = "";
  hint.textContent = "Utlägg tillagt ✓";
  scheduleSave();
  renderAll();
  setTimeout(() => { if (hint.textContent === "Utlägg tillagt ✓") hint.textContent = ""; }, 2000);
}

function removeExpense(id) {
  if (!confirm("Ta bort det här utlägget?")) return;
  state.expenses = state.expenses.filter((e) => e.id !== id);
  scheduleSave();
  renderAll();
}

function resetTrip() {
  if (!confirm("Nollställ hela resan? Alla utlägg, deltagare och avräkningar raderas.")) return;
  state = { people: [], expenses: [], settled: {}, rev: state.rev || 0 };
  selectedParticipants = new Set();
  scheduleSave();
  renderAll();
}

// ---- Flikar ----
function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $("#tab-" + tab.dataset.tab).classList.add("active");
    };
  });
}

// ---- Init ----
async function init() {
  initTabs();
  $("#exp-date").value = new Date().toISOString().slice(0, 10);
  $("#person-add").onclick = addPerson;
  $("#person-name").addEventListener("keydown", (e) => { if (e.key === "Enter") addPerson(); });
  $("#exp-add").onclick = addExpense;
  $("#reset-trip").onclick = resetTrip;
  $("#exp-toggle-all").onclick = () => {
    if (selectedParticipants.size === state.people.length) selectedParticipants.clear();
    else state.people.forEach((p) => selectedParticipants.add(p.id));
    renderParticipantChips();
  };

  if (!WORKER_URL) setSyncStatus("error");
  await loadRemote();
  renderAll();

  if (WORKER_URL) pollTimer = setInterval(poll, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll();
  });
}

init();
