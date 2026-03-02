import { CONFIG } from "./config.js";
import { gvizQuery } from "./sheets_gviz.js";

function fmtDate(v) {
  if (!v) return "";
  // v may be a Date string or a number (Sheets serial). gviz usually returns Date objects as strings.
  if (typeof v === "number") return String(v);
  const s = String(v);
  // Try ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function badgeForDays(daysLeft) {
  if (daysLeft === "" || daysLeft === null || daysLeft === undefined) return "bg-slate-200 text-slate-700";
  const n = Number(daysLeft);
  if (Number.isNaN(n)) return "bg-slate-200 text-slate-700";
  if (n <= 1) return "bg-red-100 text-red-700";
  if (n <= 3) return "bg-orange-100 text-orange-700";
  if (n <= 7) return "bg-yellow-100 text-yellow-800";
  if (n <= 10) return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function money(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function buildActionNeeded(unpaidRows) {
  // unpaidRows columns:
  // card,bank,due_raw,due_actual,days_left,statement_day,statement_date,amount_due,amount_reported_on,paid,paid_confirmed_on,reminder_phase,next_reminder_date,last_reminded_on
  const action = [];

  for (const r of unpaidRows) {
    const card = r[0];
    const daysLeft = r[4];
    const amt = r[7];
    const phase = r[11] || "";

    const n = Number(daysLeft);
    if (!Number.isNaN(n) && n >= 1 && n <= 10) {
      action.push({
        kind: n <= 3 ? "urgent" : "soon",
        card,
        daysLeft: n,
        amount: amt,
        phase,
        due: r[3],
      });
    }

    // statement ready / amount missing
    if ((amt === "" || amt === null) && (String(phase).includes("記金額") || String(phase).includes("已記金額") || String(phase).includes("Statement"))) {
      action.push({ kind: "amount", card, daysLeft: n, amount: amt, phase, due: r[3] });
    }
  }

  // de-dupe by card+kind
  const seen = new Set();
  return action.filter((a) => {
    const key = `${a.kind}:${a.card}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function render(unpaidRows) {
  setText("subTitle", `${unpaidRows.length} 未繳卡`);

  const todayCount = unpaidRows.filter((r) => {
    const n = Number(r[4]);
    return !Number.isNaN(n) && n >= 1 && n <= 10;
  }).length;
  const urgentCount = unpaidRows.filter((r) => {
    const n = Number(r[4]);
    return !Number.isNaN(n) && n >= 1 && n <= 3;
  }).length;

  setText("kpiToday", String(todayCount));
  setText("kpiUrgent", String(urgentCount));

  // Action Needed cards
  const actionList = document.getElementById("actionList");
  const actions = buildActionNeeded(unpaidRows);

  if (!actions.length) {
    actionList.innerHTML = `<div class="text-sm text-slate-500 dark:text-slate-400">暫時冇需要即刻處理。</div>`;
  } else {
    actionList.innerHTML = actions
      .map((a) => {
        const pill = a.kind === "urgent" ? "bg-red-100 text-red-700" : a.kind === "soon" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-800";
        const pillText = a.kind === "urgent" ? `最急：${a.daysLeft}日` : a.kind === "soon" ? `即將到期：${a.daysLeft}日` : "請填金額";
        return `
        <div class="bg-white dark:bg-base-200 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col gap-3">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-bold text-slate-900 dark:text-white">${a.card}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">Due: ${fmtDate(a.due)} | Phase: ${a.phase || "—"}</div>
            </div>
            <span class="px-2.5 py-1 rounded-full ${pill} text-[10px] font-bold uppercase tracking-wider">${pillText}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold">${a.amount ? "$" + money(a.amount) : "(未填金額)"}</div>
            <a class="text-primary text-sm font-semibold" target="_blank" rel="noreferrer" href="${CONFIG.sheetUrl}">開 Sheet</a>
          </div>
        </div>`;
      })
      .join("");
  }

  // table
  const tbody = document.querySelector("#unpaidTable tbody");
  tbody.innerHTML = unpaidRows
    .slice()
    .sort((a, b) => Number(a[4]) - Number(b[4]))
    .map((r) => {
      const card = r[0];
      const due = fmtDate(r[3]);
      const days = r[4];
      const amt = r[7];
      const phase = r[11] || "";
      return `
      <tr class="border-t border-slate-100 dark:border-slate-700/40">
        <td class="py-2 pr-3 font-semibold">${card}</td>
        <td class="py-2 pr-3">${due}</td>
        <td class="py-2 pr-3"><span class="px-2 py-0.5 rounded-full text-xs ${badgeForDays(days)}">${days}</span></td>
        <td class="py-2 pr-3">${amt ? "$" + money(amt) : ""}</td>
        <td class="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">${phase}</td>
      </tr>`;
    })
    .join("");
}

async function load() {
  document.getElementById("sheetLink").href = CONFIG.sheetUrl;

  // We query the unpaid block we created in the Dashboard tab: columns P:AC (14 columns)
  // gviz query: select P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC
  const query = "select P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC where P is not null";

  try {
    const { rows } = await gvizQuery({ sheetId: CONFIG.sheetId, tabName: CONFIG.tabName, query });
    // rows include header row because we included P10 header via normal cells. Remove if first row looks like header.
    const unpaid = rows.filter((r) => r && r.length && r[0] && r[0] !== "card");
    render(unpaid);
  } catch (e) {
    console.error(e);
    setText("subTitle", "未連到資料（可能未 Publish to web）");
    const actionList = document.getElementById("actionList");
    actionList.innerHTML = `
      <div class="bg-white dark:bg-base-200 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
        <div class="font-bold mb-1">未能讀取 Google Sheet</div>
        <div class="text-sm text-slate-600 dark:text-slate-300 mb-3">
          GitHub Pages 版需要你先將 Sheet（或 Dashboard tab）Publish to web。
        </div>
        <a class="text-primary font-semibold" target="_blank" rel="noreferrer" href="${CONFIG.sheetUrl}">打開 Sheet</a>
      </div>`;
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => load());
load();
