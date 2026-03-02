// Fetch data from Google Sheets using the Visualization API.
// Works only if the sheet/tab is published to web or accessible without auth.

export function gvizUrl({ sheetId, tabName, query }) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const params = new URLSearchParams();
  params.set("tqx", "out:json");
  if (tabName) params.set("sheet", tabName);
  if (query) params.set("tq", query);
  return `${base}?${params.toString()}`;
}

export async function gvizQuery({ sheetId, tabName, query }) {
  const url = gvizUrl({ sheetId, tabName, query });
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  // Google wraps JSON in a function call. Extract the JSON object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Unexpected gviz response");
  const json = JSON.parse(text.slice(start, end + 1));

  const cols = json.table.cols.map((c) => c.label || c.id);
  const rows = json.table.rows.map((r) => r.c.map((cell) => (cell ? cell.v : "")));
  return { cols, rows };
}
