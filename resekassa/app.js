/* Resekassan - delad reseutläggs-app
   Frontend talar med en Cloudflare Worker som lagrar en enda delad "state"-blob.

   State: { people: [{id,name}], expenses: [...], rev }

   Utlägg (expense):
   {
     id, desc, amount, date (YYYY-MM-DD), time (HH:MM),
     payer,                       // personId som la ut pengarna
     splitMode: "even"|"custom",
     shares: { personId: belopp },// vad varje person är skyldig för utlägget
     paid:   { personId: true }   // vilka som swishat sin andel (per utlägg)
   }
   Betalaren behöver inte betala sig själv – deras egen andel räknas som betald.
*/

// ---- Konfiguration ----
const WORKER_URL = "https://resekassa.mtgtt.workers.dev";
const TRIP_ID = "resa"; // byt om ni vill ha flera separata resor

const POLL_MS = 5000;
const LOCAL_KEY = "resekassa:" + TRIP_ID;

// ---- State ----
let state = { people: [], expenses: [], rev: 0 };
let selectedParticipants = new Set();
let customAmounts = {};            // personId -> sträng (i anpassat läge)
let splitMode = "even";
let saveTimer = null;
let pollTimer = null;
let suppressNextPoll = false;

// ---- Hjälpfunktioner ----
const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const kr = (n) => Math.round(n).toLocaleString("sv-SE") + " kr";
const kr2 = (n) =>
  (Math.round(n * 100) / 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 }) + " kr";
const nameOf = (id) => (state.people.find((p) => p.id === id) || {}).name || "?";
const round2 = (n) => Math.round(n * 100) / 100;

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
    if (raw) { try { state = normalize(JSON.parse(raw)); } catch (_) {} }
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
    if (raw) { try { state = normalize(JSON.parse(raw)); } catch (_) {} }
  }
}

// Normaliserar + migrerar gamla utlägg till nya formatet.
function normalize(data) {
  const people = Array.isArray(data.people) ? data.people : [];
  const expenses = (Array.isArray(data.expenses) ? data.expenses : []).map((e) =>
    migrateExpense(e)
  );
  return { people, expenses, rev: data.rev || 0 };
}

function migrateExpense(e) {
  // Redan nytt format?
  if (e.shares && e.splitMode) {
    return {
      id: e.id,
      desc: e.desc || "",
      amount: Number(e.amount) || 0,
      date: e.date || "",
      time: e.time || "",
      payer: e.payer,
      splitMode: e.splitMode,
      shares: e.shares || {},
      paid: e.paid && typeof e.paid === "object" ? e.paid : {},
    };
  }
  // Gammalt format: { amount, payer, participants[] } -> dela lika
  const parts = Array.isArray(e.participants) ? e.participants : [];
  const amount = Number(e.amount) || 0;
  const shares = {};
  if (parts.length > 0) {
    const base = Math.floor((amount / parts.length) * 100) / 100;
    parts.forEach((id) => (shares[id] = base));
    // lägg restören på första deltagaren
    const diff = round2(amount - base * parts.length);
    if (parts.length) shares[parts[0]] = round2(shares[parts[0]] + diff);
  }
  return {
    id: e.id || uid(),
    desc: e.desc || "",
    amount,
    date: e.date || "",
    time: "",
    payer: e.payer,
    splitMode: "even",
    shares,
    paid: {},
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
    } else setSyncStatus("error");
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
// Vem i ett utlägg som faktiskt är skyldig något (alla med en andel > 0,
// utom betalaren själv – deras andel täcks av att de la ut pengarna).
function debtorShares(e) {
  const rows = [];
  Object.keys(e.shares || {}).forEach((id) => {
    const amt = e.shares[id] || 0;
    if (amt <= 0.004) return;
    if (id === e.payer) return; // egen andel = redan "betald"
    rows.push({ id, amount: round2(amt), paid: !!(e.paid && e.paid[id]) });
  });
  return rows;
}

// Total per person: summa av obetalda andelar de är skyldiga (över alla utlägg),
// samt summa de ska få tillbaka (obetalda andelar i utlägg de la ut).
function computeTotals() {
  const owes = {};     // personId -> obetalt de ska betala
  const receives = {}; // personId -> obetalt de ska få in
  state.people.forEach((p) => { owes[p.id] = 0; receives[p.id] = 0; });
  state.expenses.forEach((e) => {
    debtorShares(e).forEach((d) => {
      if (d.paid) return;
      if (owes[d.id] != null) owes[d.id] += d.amount;
      if (receives[e.payer] != null) receives[e.payer] += d.amount;
    });
  });
  return { owes, receives };
}

// ---- Rendering ----
function renderAll() {
  renderPayerSelect();
  renderSplitUI();
  renderExpenseList();
  renderTotals();
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

function renderSplitUI() {
  $("#even-block").hidden = splitMode !== "even";
  $("#custom-block").hidden = splitMode !== "custom";
  $("#split-even").classList.toggle("active", splitMode === "even");
  $("#split-custom").classList.toggle("active", splitMode === "custom");
  if (splitMode === "even") renderParticipantChips();
  else renderCustomRows();
}

function renderParticipantChips() {
  const wrap = $("#exp-participants");
  wrap.innerHTML = "";
  selectedParticipants = new Set(
    [...selectedParticipants].filter((id) => state.people.some((p) => p.id === id))
  );
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

function renderCustomRows() {
  const wrap = $("#exp-custom-rows");
  wrap.innerHTML = "";
  if (state.people.length === 0) {
    wrap.innerHTML = '<p class="empty">Inga deltagare än.</p>';
    $("#custom-sum").textContent = "";
    return;
  }
  state.people.forEach((p) => {
    const row = document.createElement("div");
    row.className = "custom-row";
    row.innerHTML = `<span class="cr-name"></span>`;
    row.querySelector(".cr-name").textContent = p.name;
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "0.01";
    input.placeholder = "0";
    input.value = customAmounts[p.id] || "";
    input.oninput = () => {
      customAmounts[p.id] = input.value;
      updateCustomSum();
    };
    row.appendChild(input);
    wrap.appendChild(row);
  });
  updateCustomSum();
}

function customSumValue() {
  return state.people.reduce(
    (sum, p) => sum + (parseFloat(customAmounts[p.id]) || 0),
    0
  );
}

function updateCustomSum() {
  const el = $("#custom-sum");
  const sum = customSumValue();
  const amount = parseFloat($("#exp-amount").value) || 0;
  const diff = round2(amount - sum);
  if (amount <= 0) {
    el.textContent = `Fördelat: ${kr2(sum)}`;
    el.className = "custom-sum";
  } else if (Math.abs(diff) < 0.005) {
    el.textContent = `Fördelat: ${kr2(sum)} ✓`;
    el.className = "custom-sum ok";
  } else {
    el.textContent = `Fördelat: ${kr2(sum)} av ${kr2(amount)} (${diff > 0 ? "kvar" : "för mycket"} ${kr2(Math.abs(diff))})`;
    el.className = "custom-sum off";
  }
}

function renderExpenseList() {
  const list = $("#expense-list");
  list.innerHTML = "";
  if (state.expenses.length === 0) {
    list.innerHTML = '<p class="empty">Inga utlägg loggade än.</p>';
    $("#grand-total").textContent = "0 kr";
    return;
  }
  const sorted = [...state.expenses].sort((a, b) => {
    const ka = (a.date || "") + "T" + (a.time || "00:00");
    const kb = (b.date || "") + "T" + (b.time || "00:00");
    return kb.localeCompare(ka) || b.id.localeCompare(a.id);
  });
  let total = 0;
  sorted.forEach((e) => {
    total += e.amount;
    list.appendChild(buildExpenseItem(e));
  });
  $("#grand-total").textContent = kr(total);
}

function buildExpenseItem(e) {
  const item = document.createElement("div");
  item.className = "expense-item";

  const debtors = debtorShares(e);
  const unpaid = debtors.filter((d) => !d.paid);
  const allPaid = debtors.length > 0 && unpaid.length === 0;
  const when = [e.date, e.time].filter(Boolean).join(" ");
  const splitLabel = e.splitMode === "custom" ? "anpassad delning" : "delat lika";

  item.innerHTML = `
    <div class="ei-top">
      <span class="ei-desc"></span>
      <span class="ei-amount"></span>
    </div>
    <div class="ei-meta"></div>
    <div class="ei-progress"></div>
    <div class="ei-shares"></div>
    <button class="ei-del">Ta bort utlägg</button>`;

  item.querySelector(".ei-desc").textContent = e.desc || "Utlägg";
  item.querySelector(".ei-amount").textContent = kr(e.amount);
  item.querySelector(".ei-meta").textContent =
    `${nameOf(e.payer)} la ut · ${when || "–"} · ${splitLabel}`;

  const prog = item.querySelector(".ei-progress");
  if (debtors.length === 0) {
    prog.textContent = "Ingen är skyldig något för det här utlägget.";
  } else if (allPaid) {
    prog.textContent = "Alla har swishat ✓";
    prog.classList.add("done");
  } else {
    const paidCount = debtors.length - unpaid.length;
    const unpaidSum = unpaid.reduce((s, d) => s + d.amount, 0);
    prog.textContent = `${paidCount}/${debtors.length} har swishat · kvar att få in: ${kr(unpaidSum)}`;
  }

  const sharesWrap = item.querySelector(".ei-shares");
  // Betalaren först (som referens), sen övriga
  const payerShare = (e.shares && e.shares[e.payer]) || 0;
  if (payerShare > 0.004) {
    const prow = document.createElement("div");
    prow.className = "share-row payer";
    prow.innerHTML = `<span class="sr-name"></span><span class="sr-tag">betalare</span><span class="sr-amount"></span>`;
    prow.querySelector(".sr-name").textContent = nameOf(e.payer);
    prow.querySelector(".sr-amount").textContent = kr2(payerShare);
    sharesWrap.appendChild(prow);
  }
  debtors.forEach((d) => {
    const row = document.createElement("div");
    row.className = "share-row" + (d.paid ? " paid" : "");
    row.innerHTML = `
      <div class="share-check">${d.paid ? "✓" : ""}</div>
      <span class="sr-name"></span>
      <span class="sr-amount"></span>`;
    row.querySelector(".sr-name").textContent = nameOf(d.id);
    row.querySelector(".sr-amount").textContent = kr2(d.amount);
    row.onclick = () => togglePaid(e.id, d.id);
    sharesWrap.appendChild(row);
  });

  item.querySelector(".ei-del").onclick = () => removeExpense(e.id);
  return item;
}

function renderTotals() {
  const list = $("#totals-list");
  list.innerHTML = "";
  if (state.people.length === 0) {
    list.innerHTML = '<p class="empty">Lägg till deltagare för att se totalen.</p>';
    return;
  }
  const { owes, receives } = computeTotals();
  state.people.forEach((p) => {
    const owe = round2(owes[p.id] || 0);
    const rec = round2(receives[p.id] || 0);
    const item = document.createElement("div");
    item.className = "total-person";
    item.innerHTML = `
      <div class="tp-top">
        <span class="tp-name"></span>
        <span class="tp-amount"></span>
      </div>
      <div class="tp-detail"></div>
      <div class="tp-receive"></div>`;
    item.querySelector(".tp-name").textContent = p.name;
    const amtEl = item.querySelector(".tp-amount");
    if (owe > 0.004) {
      amtEl.textContent = "ska betala " + kr2(owe);
      amtEl.className = "tp-amount owing";
    } else {
      amtEl.textContent = "inget att betala";
      amtEl.className = "tp-amount clear";
    }
    // Detalj: vem de är skyldiga, per utlägg
    const detail = perPersonOwedBreakdown(p.id);
    item.querySelector(".tp-detail").textContent = detail;
    const recEl = item.querySelector(".tp-receive");
    if (rec > 0.004) recEl.textContent = "Ska få in " + kr2(rec) + " från andra";
    else recEl.textContent = "";
    list.appendChild(item);
  });
}

// Textrad: "Skyldig Anna 120 kr (Middag), Bo 60 kr (Taxi)"
function perPersonOwedBreakdown(personId) {
  const byPayer = {};
  state.expenses.forEach((e) => {
    debtorShares(e).forEach((d) => {
      if (d.id !== personId || d.paid) return;
      byPayer[e.payer] = (byPayer[e.payer] || 0) + d.amount;
    });
  });
  const parts = Object.keys(byPayer).map(
    (payer) => `${nameOf(payer)} ${kr(byPayer[payer])}`
  );
  return parts.length ? "Skyldig: " + parts.join(", ") : "Kvitt – inga obetalda andelar.";
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
function togglePaid(expenseId, personId) {
  const e = state.expenses.find((x) => x.id === expenseId);
  if (!e) return;
  if (!e.paid) e.paid = {};
  if (e.paid[personId]) delete e.paid[personId];
  else e.paid[personId] = true;
  scheduleSave();
  renderExpenseList();
  renderTotals();
}

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
    (e) => e.payer === id || (e.shares && e.shares[id] != null)
  );
  const msg = used
    ? `${nameOf(id)} finns i loggade utlägg. Ta bort ändå? Utläggen behålls men totalen kan bli skev.`
    : `Ta bort ${nameOf(id)}?`;
  if (!confirm(msg)) return;
  state.people = state.people.filter((p) => p.id !== id);
  selectedParticipants.delete(id);
  delete customAmounts[id];
  scheduleSave();
  renderAll();
}

function buildShares(amount, payer) {
  if (splitMode === "even") {
    const parts = [...selectedParticipants];
    if (parts.length === 0) return { error: "Välj minst en som var med." };
    const base = Math.floor((amount / parts.length) * 100) / 100;
    const shares = {};
    parts.forEach((id) => (shares[id] = base));
    const diff = round2(amount - base * parts.length);
    shares[parts[0]] = round2(shares[parts[0]] + diff); // restören på första
    return { shares };
  }
  // custom
  const shares = {};
  let sum = 0;
  state.people.forEach((p) => {
    const v = parseFloat(customAmounts[p.id]);
    if (v && v > 0) { shares[p.id] = round2(v); sum += v; }
  });
  if (Object.keys(shares).length === 0) return { error: "Ange belopp för minst en person." };
  if (Math.abs(round2(sum) - amount) > 0.01)
    return { error: `Summan av andelarna (${kr2(sum)}) måste bli lika med beloppet (${kr2(amount)}).` };
  return { shares };
}

function addExpense() {
  const desc = $("#exp-desc").value.trim();
  const amount = round2(parseFloat($("#exp-amount").value));
  const date = $("#exp-date").value;
  const time = $("#exp-time").value;
  const payer = $("#exp-payer").value;
  const hint = $("#exp-hint");
  hint.className = "hint";
  const fail = (m) => { hint.textContent = m; hint.className = "hint error"; };

  if (state.people.length === 0) return fail("Lägg till deltagare först (fliken Deltagare).");
  if (!amount || amount <= 0) return fail("Ange ett belopp större än 0.");
  if (!payer) return fail("Välj vem som betalade.");

  const built = buildShares(amount, payer);
  if (built.error) return fail(built.error);

  state.expenses.push({
    id: uid(),
    desc,
    amount,
    date: date || new Date().toISOString().slice(0, 10),
    time: time || "",
    payer,
    splitMode,
    shares: built.shares,
    paid: {},
  });

  // Nollställ formuläret
  $("#exp-desc").value = "";
  $("#exp-amount").value = "";
  customAmounts = {};
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
  if (!confirm("Nollställ hela resan? Alla utlägg och deltagare raderas.")) return;
  state = { people: [], expenses: [], rev: state.rev || 0 };
  selectedParticipants = new Set();
  customAmounts = {};
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
  $("#exp-time").value = new Date().toTimeString().slice(0, 5);
  $("#person-add").onclick = addPerson;
  $("#person-name").addEventListener("keydown", (e) => { if (e.key === "Enter") addPerson(); });
  $("#exp-add").onclick = addExpense;
  $("#reset-trip").onclick = resetTrip;
  $("#exp-amount").addEventListener("input", () => {
    if (splitMode === "custom") updateCustomSum();
  });
  $("#exp-toggle-all").onclick = () => {
    if (selectedParticipants.size === state.people.length) selectedParticipants.clear();
    else state.people.forEach((p) => selectedParticipants.add(p.id));
    renderParticipantChips();
  };
  $("#split-even").onclick = () => { splitMode = "even"; renderSplitUI(); };
  $("#split-custom").onclick = () => { splitMode = "custom"; renderSplitUI(); };

  if (!WORKER_URL) setSyncStatus("error");
  await loadRemote();
  renderAll();

  if (WORKER_URL) pollTimer = setInterval(poll, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) poll();
  });
}

init();
