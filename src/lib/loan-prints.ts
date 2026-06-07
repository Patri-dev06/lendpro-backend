import { formatPHP, formatDate } from "@/lib/format";
import { LOAN_TYPE_LABELS } from "@/lib/loan-constants";

export interface PrintClient {
  name: string;
  store_name: string;
  address: string;
  phone: string;
}

export interface PrintLoan {
  number: string;
  loan_type: string;
  principal: number;
  interest: number;
  service_charge: number;
  total_receivable: number;
  daily_payment: number;
  term_days: number;
  current_balance: number;
  release_date: string;
  due_date: string;
  client: PrintClient;
}

const COMMON_STYLES = `
  body{font-family:Arial,sans-serif;font-size:11px;margin:0;padding:32px;color:#111}
  .div{border-top:2px solid #000;margin:10px 0}
  .sigs{display:flex;gap:40px;margin-top:48px}
  .sig{flex:1;text-align:center;font-size:9px}
  .sig-line{border-top:1px solid #000;margin-bottom:4px}
  .sig-name{font-weight:bold;font-size:10px}
  .sig-role{color:#555}
  @media print{body{padding:20px}}
`;

/* ── Client Ledger ───────────────────────────────────────────────────── */

export function printLedger(loan: PrintLoan) {
  const win = window.open("", "_blank");
  if (!win) return;
  const { client } = loan;
  win.document.write(`<!DOCTYPE html><html><head><title>Client Ledger</title>
<style>
  ${COMMON_STYLES}
  h2{font-size:16px;margin:0 0 2px}.co{font-size:13px;font-weight:bold;margin-bottom:4px}
  .div2{border-top:2px solid #000;margin:10px 0}.div1{border-top:1px solid #ccc;margin:8px 0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px}
  .info-row{display:flex;gap:8px}.info-lbl{color:#555;min-width:120px}.info-val{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#f0f0f0;font-size:10px;text-transform:uppercase;padding:6px 8px;border:1px solid #ccc;text-align:left}
  td{padding:5px 8px;border:1px solid #e0e0e0}
  .right{text-align:right}.paid{color:#16a34a}.missed{color:#dc2626}
  .total-row td{font-weight:bold;background:#f8f8f8;border-top:2px solid #aaa}
</style></head><body>
<div class="co">BuenaMano Lending Corporation</div>
<h2>Client Ledger</h2>
<div class="div2"></div>
<div class="info-grid">
  <div class="info-row"><span class="info-lbl">Client Name</span><span class="info-val">${client.name}</span></div>
  <div class="info-row"><span class="info-lbl">Loan Number</span><span class="info-val">${loan.number}</span></div>
  <div class="info-row"><span class="info-lbl">Store / Business</span><span class="info-val">${client.store_name}</span></div>
  <div class="info-row"><span class="info-lbl">Loan Type</span><span class="info-val">${LOAN_TYPE_LABELS[loan.loan_type as keyof typeof LOAN_TYPE_LABELS] ?? loan.loan_type}</span></div>
  <div class="info-row"><span class="info-lbl">Address</span><span class="info-val">${client.address}</span></div>
  <div class="info-row"><span class="info-lbl">Release Date</span><span class="info-val">${loan.release_date}</span></div>
  <div class="info-row"><span class="info-lbl">Phone</span><span class="info-val">${client.phone}</span></div>
  <div class="info-row"><span class="info-lbl">Due Date</span><span class="info-val">${loan.due_date}</span></div>
  <div class="info-row"><span class="info-lbl">Principal</span><span class="info-val">${formatPHP(loan.principal)}</span></div>
  <div class="info-row"><span class="info-lbl">Processing Fee (−)</span><span class="info-val">${formatPHP(loan.service_charge)}</span></div>
  <div class="info-row"><span class="info-lbl">Net</span><span class="info-val">${formatPHP(loan.principal - loan.service_charge)}</span></div>
  <div class="info-row"><span class="info-lbl">Interest</span><span class="info-val">${formatPHP(loan.interest)}</span></div>
  <div class="info-row"><span class="info-lbl">Total Payable</span><span class="info-val">${formatPHP(loan.total_receivable)}</span></div>
  <div class="info-row"><span class="info-lbl">Daily Payment</span><span class="info-val">${formatPHP(loan.daily_payment)}</span></div>
  <div class="info-row"><span class="info-lbl">Term of Loan</span><span class="info-val">${loan.term_days} days</span></div>
</div>
<div class="div1"></div>
<table>
  <thead>
    <tr><th>#</th><th>Date</th><th class="right">Daily Due</th><th class="right">Amount Paid</th><th class="right">Running Balance</th><th>Status</th></tr>
  </thead>
  <tbody>
    ${Array.from({ length: loan.term_days }, (_, i) => {
      const paidDays = Math.round((loan.total_receivable - loan.current_balance) / loan.daily_payment);
      const isPaid   = i < paidDays;
      const bal      = Math.max(0, loan.total_receivable - (Math.min(i + 1, paidDays) * loan.daily_payment));
      return `<tr>
        <td>${i + 1}</td><td></td>
        <td class="right">${formatPHP(loan.daily_payment)}</td>
        <td class="right ${isPaid ? "paid" : ""}">${isPaid ? formatPHP(loan.daily_payment) : "—"}</td>
        <td class="right">${formatPHP(bal)}</td>
        <td class="${isPaid ? "paid" : "missed"}">${isPaid ? "Paid" : "Pending"}</td>
      </tr>`;
    }).join("")}
    <tr class="total-row">
      <td colspan="3">Total Paid</td>
      <td class="right">${formatPHP(loan.total_receivable - loan.current_balance)}</td>
      <td class="right">${formatPHP(loan.current_balance)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div style="margin-top:20px;font-size:9px;color:#888">Printed: ${new Date().toLocaleDateString("en-PH")} — BuenaMano Lending Corporation</div>
</body></html>`);
  win.document.close(); win.focus(); win.print();
}

/* ── Daily Collection Sheet ──────────────────────────────────────────── */

export interface CollectionLoan {
  number: string;
  loan_type: string;
  client: { name: string; store_name: string };
  daily_payment: number;
  current_balance: number;
  status: string;
  collector?: { id: number; name: string; area: string } | null;
}

interface CollectorGroup {
  id: number;
  name: string;
  area: string;
  active: CollectionLoan[];      // new-loan + reloan, not overdue/past-due
  reconstruct: CollectionLoan[]; // reconstruct, not overdue/past-due
  pastDue: CollectionLoan[];     // overdue + past-due (any loan type)
}

function buildGroups(loans: CollectionLoan[]): CollectorGroup[] {
  const groupMap = new Map<number, CollectorGroup>();
  const noCollector: CollectorGroup = { id: 0, name: "Unassigned", area: "—", active: [], reconstruct: [], pastDue: [] };

  for (const loan of loans) {
    const isPastDue = ["overdue", "past-due"].includes(loan.status);
    const bucket    = (g: CollectorGroup) => {
      if (isPastDue)                        g.pastDue.push(loan);
      else if (loan.loan_type === "reconstruct") g.reconstruct.push(loan);
      else                                  g.active.push(loan);
    };

    if (!loan.collector) { bucket(noCollector); continue; }

    const cid = loan.collector.id;
    if (!groupMap.has(cid)) {
      groupMap.set(cid, { id: cid, name: loan.collector.name, area: loan.collector.area, active: [], reconstruct: [], pastDue: [] });
    }
    bucket(groupMap.get(cid)!);
  }

  const groups = [...groupMap.values()];
  if (noCollector.active.length || noCollector.reconstruct.length || noCollector.pastDue.length) groups.push(noCollector);
  return groups;
}

export function printCollectionSheet(
  loans: CollectionLoan[],
  companyName: string,
  companyAddress: string,
) {
  const win = window.open("", "_blank");
  if (!win) return;

  const today = new Date().toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });

  const groups = buildGroups(loans);

  function tableRows(list: CollectionLoan[], minFill = 20): string {
    const minRows = Math.max(list.length, minFill);
    return Array.from({ length: minRows }, (_, i) => {
      const loan = list[i];
      return `<tr>
        <td class="c num" style="width:26px">${i + 1}</td>
        <td>${loan ? `<span class="client-name">${loan.client.name}</span><br/><span class="store">${loan.client.store_name}</span>` : ""}</td>
        <td class="c num" style="width:70px">${loan ? formatPHP(loan.daily_payment) : ""}</td>
        <td class="c" style="width:54px"></td>
        <td style="width:80px"></td>
      </tr>`;
    }).join("");
  }

  function sectionTable(title: string, list: CollectionLoan[], minFill = 20): string {
    return `
  <div class="section-title" style="margin-top:8px">${title} (${list.length})</div>
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th style="text-align:left">Client / Business</th>
        <th>Daily Collection</th>
        <th>Amount Paid</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>${tableRows(list, minFill)}</tbody>
  </table>`;
  }

  function collectorPage(g: CollectorGroup, isLast: boolean, isFirst: boolean): string {
    const breakBefore = isFirst ? "" : "page-break-before:always;break-before:page;";
    const breakAfter  = isLast  ? "" : "page-break-after:always;break-after:page";
    return `
<div style="${breakBefore}${breakAfter}">
  <div class="hdr">
    <div class="co">${companyName || "BuenaMano Lending Corporation"}</div>
    <div class="addr">${companyAddress || ""}</div>
  </div>

  <div class="meta">
    <div class="meta-field" style="flex:1"><span>AREA:</span><div class="line">${g.area}</div></div>
    <div class="meta-field" style="flex:1.5"><span>NAME OF COLLECTOR:</span><div class="line">${g.name}</div></div>
    <div class="meta-field"><span>DATE:</span><div class="line" style="min-width:100px">${today}</div></div>
  </div>

  <div class="summary">
    <div class="sum-col">
      <div class="sum-row"><span class="lbl">Daily Collection:</span><div class="val"></div></div>
      <div class="sum-row"><span class="lbl">Past Due Collection:</span><div class="val"></div></div>
      <div class="sum-row"><span class="lbl">Total Collection:</span><div class="val"></div></div>
    </div>
    <div class="sum-col">
      <div class="sum-row"><span class="lbl">Cash:</span><div class="val"></div></div>
      <div class="sum-row"><span class="lbl">Check:</span><div class="val"></div></div>
      <div class="sum-row"><span class="lbl">Total:</span><div class="val"></div></div>
    </div>
    <div class="sum-col">
      <div class="sum-row"><span class="lbl">Total Collection:</span><div class="val"></div></div>
      <div class="sum-row"><span class="lbl">Total Release:</span><div class="val"></div></div>
      <div class="sum-row"><span class="lbl">BB:</span><div class="val"></div></div>
    </div>
  </div>

  ${sectionTable("Active Clients — New Loan / Reloan", g.active, 20)}
  <div class="total-bar"><span>Total Active Collection: P ___________________</span></div>

  ${sectionTable("Reconstruct Clients", g.reconstruct, 10)}
  <div class="total-bar"><span>Total Reconstruct Collection: P ___________________</span></div>

  ${sectionTable("Past Due / Overdue Clients", g.pastDue, 10)}
  <div class="total-bar"><span>Total Past Due Collection: P ___________________</span></div>

  <div class="total-bar" style="margin-top:4px;font-size:10px">
    <span>TOTAL DAILY COLLECTION: P ___________________</span>
  </div>
  <div class="cert">I hereby certify that the above data are true and correct.</div>

  <div class="sig-row">
    <div class="sig">
      <div style="height:32px"></div>
      <div class="sig-line"></div>
      <div>Signature of Collector</div>
      <div style="margin-top:4px">Date: _______________</div>
    </div>
    <div class="sig">
      <div style="height:32px"></div>
      <div class="sig-line"></div>
      <div>Verified by (Manager / Authorized)</div>
      <div style="margin-top:4px">Date: _______________</div>
    </div>
  </div>

  <div class="breakdown">
    <div class="breakdown-title">BREAKDOWN</div>
    <table class="breakdown-table">
      <thead><tr><th colspan="3">Check</th></tr></thead>
      <tbody><tr><td colspan="3" style="height:18px"></td></tr></tbody>
      <thead><tr><th colspan="3">Cash</th></tr></thead>
      <tbody>
        <tr><td class="r">1,000</td><td>×</td><td style="min-width:60px"></td></tr>
        <tr><td class="r">500</td><td>×</td><td></td></tr>
        <tr><td class="r">200</td><td>×</td><td></td></tr>
        <tr><td class="r">100</td><td>×</td><td></td></tr>
        <tr><td class="r">50</td><td>×</td><td></td></tr>
        <tr><td class="r">20</td><td>×</td><td></td></tr>
      </tbody>
      <thead><tr><th colspan="3">Coins</th></tr></thead>
      <tbody>
        <tr><td class="r">20</td><td>×</td><td></td></tr>
        <tr><td class="r">10</td><td>×</td><td></td></tr>
        <tr><td class="r">5</td><td>×</td><td></td></tr>
        <tr><td class="r">.10</td><td>×</td><td></td></tr>
        <tr><td class="r">.25</td><td>×</td><td></td></tr>
        <tr class="section-hdr"><td colspan="3">Others</td></tr>
        <tr><td colspan="3" style="height:16px"></td></tr>
        <tr class="total-hdr"><td colspan="2" style="text-align:right">Total:</td><td></td></tr>
      </tbody>
    </table>
  </div>
</div>`;
  }

  win.document.write(`<!DOCTYPE html><html><head>
<title>Daily Collection Sheet — ${today}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9px;margin:0;padding:16px 20px;color:#000}
  .hdr{text-align:center;margin-bottom:8px}
  .hdr .co{font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px}
  .hdr .addr{font-size:8px;color:#333;margin-top:2px}
  .meta{display:flex;gap:12px;margin-bottom:8px;font-size:9px}
  .meta-field{display:flex;align-items:center;gap:4px}
  .meta-field span{font-weight:bold;white-space:nowrap}
  .meta-field .line{border-bottom:1px solid #000;flex:1;min-width:80px;padding-bottom:1px}
  .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #000;margin-bottom:8px;font-size:8.5px}
  .sum-col{border-right:1px solid #000;padding:3px 5px}
  .sum-col:last-child{border-right:none}
  .sum-row{display:flex;justify-content:space-between;align-items:center;padding:1px 0}
  .sum-row .lbl{color:#444}
  .sum-row .val{border-bottom:1px solid #000;min-width:60px;height:12px}
  .section-title{font-size:9px;font-weight:bold;text-transform:uppercase;background:#e8e8e8;padding:3px 6px;border:1px solid #000;border-bottom:none;margin-top:8px;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;font-size:8.5px}
  th{background:#f0f0f0;border:1px solid #555;padding:3px 4px;text-align:center;font-size:8px;text-transform:uppercase;line-height:1.2}
  td{border:1px solid #999;padding:2px 4px;height:16px;vertical-align:middle}
  td.c{text-align:center}td.num{font-family:monospace}td.r{text-align:right;font-weight:bold}
  .client-name{font-weight:600;font-size:8.5px}
  .store{font-size:7.5px;color:#555}
  .total-bar{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;border-top:2px solid #000;padding:4px 8px;font-weight:bold;font-size:9px}
  .cert{font-size:7.5px;color:#444;margin-top:4px;font-style:italic}
  .sig-row{display:flex;gap:40px;margin-top:20px}
  .sig{flex:1;text-align:center;font-size:8px}
  .sig-line{border-top:1px solid #000;margin-bottom:3px}
  .breakdown{margin-top:20px}
  .breakdown-title{font-size:10px;font-weight:bold;text-align:center;text-transform:uppercase;border:1px solid #000;padding:4px;background:#f0f0f0}
  .breakdown-table{width:220px;border-collapse:collapse;margin:0 auto}
  .breakdown-table td,.breakdown-table th{border:1px solid #999;padding:2px 6px;font-size:8.5px}
  .breakdown-table th{background:#f0f0f0;text-align:center;font-size:8px;text-transform:uppercase}
  .breakdown-table .section-hdr td{background:#e8e8e8;font-weight:bold;text-align:center}
  .breakdown-table .total-hdr td{background:#d8d8d8;font-weight:bold}
  @media print{
    body{padding:10px 14px}
    @page{size:A4 portrait;margin:8mm}
  }
</style>
</head><body>
${groups.map((g, i) => collectorPage(g, i === groups.length - 1, i === 0)).join("")}
</body></html>`);

  win.document.close(); win.focus(); win.print();
}


/* ── Collection Sheet CSV Export ─────────────────────────────────────── */

export function exportCollectionSheetCsv(
  loans: CollectionLoan[],
  companyName: string,
  companyAddress: string,
  filenameHint = "all",
): void {
  const today    = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `Collection Sheet - ${filenameHint} - ${dateSlug}.csv`;

  const groups = buildGroups(loans);

  const lines: string[] = [];
  const esc = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row   = (...cells: (string | number)[]) => lines.push(cells.map(esc).join(","));
  const blank = () => lines.push("");

  const SECTION_HEADER = ["No.", "Client Name", "Business / Store", "Daily Collection", "Amount Paid", "Remarks"];

  row(companyName || "BuenaMano Lending Corporation");
  row(companyAddress || "");

  for (const g of groups) {
    blank();
    row("AREA:", g.area, "NAME OF COLLECTOR:", g.name, "DATE:", today);
    blank();
    row("SUMMARY");
    row("Daily Collection:", "", "Cash:", "", "Total Collection:", "");
    row("Past Due Collection:", "", "Check:", "", "Total Release:", "");
    row("Total Collection:", "", "Total:", "", "BB:", "");
    blank();

    // Active clients — new-loan + reloan
    row(`ACTIVE CLIENTS — NEW LOAN / RELOAN (${g.active.length})`);
    row(...SECTION_HEADER);
    const minActive = Math.max(g.active.length, 20);
    for (let i = 0; i < minActive; i++) {
      const loan = g.active[i];
      row(i + 1, loan?.client.name ?? "", loan?.client.store_name ?? "", loan?.daily_payment ?? "", "", "");
    }
    row("", "", "", "Total Active Collection:", "P");
    blank();

    // Reconstruct clients
    row(`RECONSTRUCT CLIENTS (${g.reconstruct.length})`);
    row(...SECTION_HEADER);
    const minRecon = Math.max(g.reconstruct.length, 10);
    for (let i = 0; i < minRecon; i++) {
      const loan = g.reconstruct[i];
      row(i + 1, loan?.client.name ?? "", loan?.client.store_name ?? "", loan?.daily_payment ?? "", "", "");
    }
    row("", "", "", "Total Reconstruct Collection:", "P");
    blank();

    // Past due / overdue
    row(`PAST DUE / OVERDUE CLIENTS (${g.pastDue.length})`);
    row(...SECTION_HEADER);
    const minPast = Math.max(g.pastDue.length, 10);
    for (let i = 0; i < minPast; i++) {
      const loan = g.pastDue[i];
      row(i + 1, loan?.client.name ?? "", loan?.client.store_name ?? "", loan?.daily_payment ?? "", "", "");
    }
    row("", "", "", "Total Past Due Collection:", "P");
    blank();
    row("", "", "", "TOTAL DAILY COLLECTION:", "P");
    blank();
    row("I hereby certify that the above data are true and correct.");
    blank();
    row("Signature of Collector:", "", "", "", "Verified by (Manager / Authorized):", "");
    row("Date:", "", "", "", "Date:", "");
    blank();
    blank();
  }

  const csv  = lines.join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
