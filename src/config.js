export const CONFIG = {
  // Google Sheet (OpenClaw - Credit Cards)
  sheetId: "1unqcw12V48VJaKA83QKu0E2ZLbuvh1wrfKmBzLtG7fM",

  // If your sheet is *published to web*, you can fetch via gviz.
  // This should be the tab that contains the computed dashboard data.
  // We default to the Sheet tab we created (Dashboard), and read the "未繳/最急" block (P10:AC).
  tabName: "Dashboard",

  // Range-like filter for gviz query (we'll use select columns from the sheet grid instead).
  // For simplicity, we read a rectangle starting at P10.
  unpaidBlockTopLeft: "P10",

  // Direct sheet URL for user.
  sheetUrl:
    "https://docs.google.com/spreadsheets/d/1unqcw12V48VJaKA83QKu0E2ZLbuvh1wrfKmBzLtG7fM/edit?usp=drivesdk",

  // UI
  currency: "HKD",
};
