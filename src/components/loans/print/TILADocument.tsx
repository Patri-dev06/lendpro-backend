import React from "react";
import {
  COMPANY_NAME,
  PAGE_STYLE, SectionTitle, DataRow, Divider, SigBlock,
  loanNum, loanTypeLabel, php, fmtDate,
  type PrintDocumentProps,
} from "./shared";

export const TILADocument = React.forwardRef<HTMLDivElement, PrintDocumentProps>(
  (p, ref) => {
    const id         = loanNum(p);
    const amtRelease = p.principal - p.sc;

    return (
      <div ref={ref} style={{ fontFamily: "Arial, sans-serif", fontSize: 11, padding: 40, color: "#111" }}>
        <style>{PAGE_STYLE}</style>

        {/* Header */}
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>
          {COMPANY_NAME}
        </div>
        <h1 style={{ fontSize: 16, textAlign: "center", margin: "0 0 2px", fontWeight: "bold" }}>
          TRUTH IN LENDING DISCLOSURE STATEMENT
        </h1>
        <div style={{ textAlign: "center", fontSize: 10, color: "#666", marginBottom: 16 }}>
          Pursuant to Republic Act No. 3765 (Truth in Lending Act)
        </div>

        <Divider />

        {/* Parties */}
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Parties</SectionTitle>
          <DataRow label="Creditor"        value={COMPANY_NAME} />
          <DataRow label="Borrower"        value={p.client.name} />
          <DataRow label="Business / Store" value={p.client.store_name} />
          <DataRow label="Loan Reference"  value={id} />
          <DataRow label="Loan Type"       value={loanTypeLabel(p.loanType)} />
          <DataRow label="Release Date"    value={p.date} />
        </div>

        {/* Finance Details */}
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Finance Details</SectionTitle>
          <DataRow label="Principal Amount"                      value={php(p.principal)} />
          <DataRow label="Processing Fee (deducted from release)" value={`− ${php(p.sc)}`} />
          <DataRow label="Net"                                   value={php(amtRelease)} />
          <DataRow label="Interest"                              value={php(p.interest)} />
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontWeight: "bold", fontSize: 13,
            padding: "6px 0", borderTop: "2px solid #333", marginTop: 4,
          }}>
            <span>Net (Total Amount to be Paid)</span>
            <span>{php(p.totalReceivable)}</span>
          </div>
        </div>

        {/* Repayment Schedule */}
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Repayment Schedule</SectionTitle>
          <DataRow label="Daily Payment" value={php(p.daily)} />
          <DataRow label="Term of Loan"  value={`${p.termDays} days`} />
          <DataRow label="Due Date"      value={fmtDate(p.dueDate)} />
        </div>

        {/* Declaration */}
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>Declaration</SectionTitle>
          <p style={{ lineHeight: 1.6, margin: 0, fontSize: 11 }}>
            I/We have read, understood, and agree to the terms and conditions of this loan as
            stated above. I/We acknowledge receipt of this Truth in Lending Disclosure Statement
            prior to the consummation of this credit transaction, in accordance with the
            provisions of Republic Act No. 3765.
          </p>
        </div>

        {/* Signatures */}
        <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
          <SigBlock name={p.client.name}               role="Signature of Borrower" />
          <SigBlock name="___________________________" role="Manager / Authorized Representative" />
        </div>

        {/* Footer */}
        <div style={{
          fontSize: 9, color: "#888", marginTop: 20,
          textAlign: "center", borderTop: "1px solid #ddd", paddingTop: 8,
        }}>
          This disclosure is issued in compliance with Republic Act No. 3765 (Truth in Lending Act)
          and its implementing rules and regulations.
        </div>
      </div>
    );
  },
);

TILADocument.displayName = "TILADocument";
