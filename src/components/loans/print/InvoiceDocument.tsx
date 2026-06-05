import React from "react";
import {
  COMPANY_NAME, COMPANY_ADDRESS, COMPANY_COUNTRY,
  PAGE_STYLE, SigBlock,
  loanNum, loanTypeLabel, num, fmtDate,
  type PrintDocumentProps,
} from "./shared";

export const InvoiceDocument = React.forwardRef<HTMLDivElement, PrintDocumentProps>(
  (p, ref) => {
    const id       = loanNum(p);
    const totalDue = p.principal + p.interest + p.sc;

    return (
      <div ref={ref} style={{ fontFamily: "Arial, sans-serif", fontSize: 11, padding: 40, color: "#111" }}>
        <style>{PAGE_STYLE}</style>

        {/* Title */}
        <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: "bold", color: "#1e40af", margin: "0 0 24px" }}>
          Invoice
        </h1>

        {/* Company ← → Invoice meta */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase", letterSpacing: ".3px" }}>
              {COMPANY_NAME}
            </div>
            <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.7, marginTop: 3 }}>
              {COMPANY_ADDRESS}<br />
              {COMPANY_COUNTRY}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#444", lineHeight: 1.8 }}>
            <div style={{ fontWeight: "bold", fontSize: 12 }}>Invoice #{id}</div>
            <div>{p.date}</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "2px solid #1e40af", margin: "10px 0 16px" }} />

        {/* Bill To */}
        <div style={{ fontWeight: "bold", fontSize: 11, marginBottom: 5 }}>Bill To:</div>
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.75, marginBottom: 20 }}>
          {p.client.name}<br />
          {p.client.address}<br />
          {COMPANY_COUNTRY}<br />
          {p.client.phone}
        </div>

        {/* Line items table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#1e40af", color: "#fff" }}>
              {["Description", "Quantity", "Rate", "Total"].map((h, i) => (
                <th key={h} style={{ padding: "8px 10px", fontSize: 11, fontWeight: "bold", textAlign: i === 0 ? "left" : "right" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Principal",       amount: p.principal },
              { label: "Interest",        amount: p.interest  },
              { label: "Processing fee",  amount: p.sc        },
            ].map((row) => (
              <tr key={row.label}>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb" }}>{row.label}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>1</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{num(row.amount)}</td>
                <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{num(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals block */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <table style={{ width: 270, borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 8px", color: "#555" }}>Total Due:</td>
                <td style={{ padding: "3px 8px", textAlign: "right" }}>{num(totalDue)}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 8px", color: "#555" }}>Paid:</td>
                <td style={{ padding: "3px 8px", textAlign: "right" }}>{num(p.sc)}</td>
              </tr>
              <tr>
                <td style={{ padding: "7px 8px 3px", fontWeight: "bold", fontSize: 13, color: "#1e40af", borderTop: "2px solid #1e40af" }}>
                  Balance Due:
                </td>
                <td style={{ padding: "7px 8px 3px", textAlign: "right", fontWeight: "bold", fontSize: 13, color: "#1e40af", borderTop: "2px solid #1e40af" }}>
                  PHP {num(p.totalReceivable)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "5px 8px 3px", color: "#555" }}>Net (Amount Released):</td>
                <td style={{ padding: "5px 8px 3px", textAlign: "right" }}>PHP {num(p.principal - p.sc)}</td>
              </tr>
              <tr>
                <td style={{ padding: "5px 8px 3px", color: "#555" }}>Daily Payment:</td>
                <td style={{ padding: "5px 8px 3px", textAlign: "right", fontWeight: "bold" }}>PHP {num(p.daily)}</td>
              </tr>
              <tr>
                <td style={{ padding: "5px 8px 3px", color: "#555" }}>Due Date:</td>
                <td style={{ padding: "5px 8px 3px", textAlign: "right" }}>{fmtDate(p.dueDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Loan type + remarks */}
        <div style={{ marginTop: 18, fontSize: 11, color: "#444" }}>{loanTypeLabel(p.loanType)}</div>
        {p.remarks && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#444" }}>Remarks: {p.remarks}</div>
        )}

        {/* Signatures */}
        <div style={{ display: "flex", gap: 40, marginTop: 56 }}>
          <SigBlock name="___________________________" role="Approved By" />
          <SigBlock name={p.client.name}               role="Client Signature" />
        </div>
      </div>
    );
  },
);

InvoiceDocument.displayName = "InvoiceDocument";
