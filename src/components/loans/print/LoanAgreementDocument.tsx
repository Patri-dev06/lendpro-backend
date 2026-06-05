import React from "react";
import {
  COMPANY_NAME,
  PAGE_STYLE, SectionTitle, FieldRow, Field, Divider, SigBlock,
  loanNum, loanTypeLabel, php, fmtDate,
  type PrintDocumentProps,
} from "./shared";

export const LoanAgreementDocument = React.forwardRef<HTMLDivElement, PrintDocumentProps>(
  (p, ref) => {
    const id         = loanNum(p);
    const amtRelease = p.principal - p.sc;

    return (
      <div ref={ref} style={{ fontFamily: "Arial, sans-serif", fontSize: 11, padding: 40, color: "#111" }}>
        <style>{PAGE_STYLE}</style>

        {/* Header */}
        <h1 style={{ fontSize: 16, textAlign: "center", margin: "0 0 2px", fontWeight: "bold" }}>
          LOAN AGREEMENT &amp; PROMISSORY NOTE
        </h1>
        <div style={{ textAlign: "center", fontSize: 10, color: "#666", marginBottom: 14 }}>
          {COMPANY_NAME}
        </div>

        <Divider />

        {/* Loan Information */}
        <SectionTitle>Loan Information</SectionTitle>
        <FieldRow>
          <Field label="Loan Number"  value={id} />
          <Field label="Loan Type"    value={loanTypeLabel(p.loanType)} />
          <Field label="Release Date" value={p.date} />
          <Field label="Due Date"     value={fmtDate(p.dueDate)} />
        </FieldRow>

        {/* Maker Information */}
        <SectionTitle>Maker Information</SectionTitle>
        <FieldRow>
          <Field label="Full Name"           value={p.client.name} />
          <Field label="Business / Store Name" value={p.client.store_name} />
        </FieldRow>
        <FieldRow>
          <Field label="Address" value={p.client.address} />
          <Field label="Phone"   value={p.client.phone} />
        </FieldRow>

        {/* Loan Amount Summary */}
        <SectionTitle>Loan Amount Summary</SectionTitle>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              { label: "Principal",                              value: php(p.principal),       sub: false, total: false },
              { label: "Processing Fee (deducted from release)", value: `− ${php(p.sc)}`,       sub: false, total: false },
              { label: "Net",                                    value: php(amtRelease),         sub: true,  total: false },
              { label: "Interest",                               value: php(p.interest),         sub: false, total: false },
              { label: "Total Payable",                          value: php(p.totalReceivable),  sub: false, total: true  },
            ].map((row) => (
              <tr key={row.label} style={{ background: row.total ? "#f8f8f8" : row.sub ? "#fafafa" : "transparent" }}>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", color: row.total ? "#111" : "#555", fontStyle: row.sub ? "italic" : "normal", fontWeight: row.total ? "bold" : "normal" }}>
                  {row.label}
                </td>
                <td style={{ padding: "5px 8px", border: "1px solid #ddd", textAlign: "right", fontWeight: row.total ? "bold" : "normal", fontSize: row.total ? 12 : 11 }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Payment Terms */}
        <SectionTitle>Payment Terms</SectionTitle>
        <FieldRow>
          <Field label="Daily Payment" value={php(p.daily)} />
          <Field label="Term of Loan"  value={{ 30: "1 Month", 45: "1.5 Months", 60: "2 Months" }[p.termDays] ?? `${p.termDays} days`} />
        </FieldRow>
        {p.remarks && (
          <FieldRow>
            <Field label="Remarks" value={p.remarks} />
          </FieldRow>
        )}

        {/* Terms & Conditions */}
        <div style={{
          fontSize: 9, lineHeight: 1.6, color: "#555",
          border: "1px solid #ddd", padding: 8, borderRadius: 4, marginTop: 8,
        }}>
          <strong>Terms &amp; Conditions:</strong> The maker agrees to pay the daily payment
          amount every day until the full balance is settled. Late payments beyond 6 days are
          subject to a monthly compound penalty of 8% (5% interest + 3% penalty fee) on the
          outstanding balance. The maker acknowledges receipt of the amount to release stated
          above. This document constitutes a promissory note and is legally binding upon signing.
        </div>

        {/* Signatures */}
        <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
          <SigBlock name={p.client.name}               role="Maker" />
          <SigBlock name="___________________________" role="Spouse of Maker" />
          <SigBlock name="___________________________" role="Manager / Authorized Representative" />
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 40 }}>
          <SigBlock name="___________________________" role="Co-Maker" />
          <SigBlock name="___________________________" role="Spouse of Co-Maker" />
          <SigBlock name="___________________________" role="" />
        </div>
      </div>
    );
  },
);

LoanAgreementDocument.displayName = "LoanAgreementDocument";
