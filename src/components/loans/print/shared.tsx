import React from "react";
import { LOAN_TYPE_LABELS } from "@/lib/loan-constants";

export const COMPANY_NAME    = "BuenaMano Lending Corporation";
export const COMPANY_ADDRESS = "Bonaguit Street, Purok 4, Poblacion 2, Buenavista, Agusan del Norte";
export const COMPANY_COUNTRY = "Philippines";

export interface PrintClient {
  name: string;
  store_name: string;
  address: string;
  phone: string;
}

export interface PrintDocumentProps {
  client: PrintClient;
  loanType: string;
  date: string;
  principal: number;
  interest: number;
  sc: number;
  totalLoanAmount: number;
  totalReceivable: number;
  daily: number;
  termDays: number;
  dueDate: Date | null;
  remarks: string;
  loanNumber?: string;
}

export function loanNum(p: Pick<PrintDocumentProps, "loanNumber">): string {
  return p.loanNumber ?? `LN-${new Date().getFullYear()}-DRAFT`;
}

export function loanTypeLabel(type: string): string {
  return LOAN_TYPE_LABELS[type as keyof typeof LOAN_TYPE_LABELS] ?? type;
}

export function num(n: number): string {
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function php(n: number): string {
  return `₱${num(n)}`;
}

export function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

/* ── Shared sub-components ─────────────────────────────────────────────── */

export const PAGE_STYLE = `
  @page { size: A4 portrait; margin: 14mm; }
  @media print { body { margin: 0; } }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
`;

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontWeight: "bold", fontSize: 10, textTransform: "uppercase",
      letterSpacing: ".5px", background: "#f0f0f0",
      padding: "4px 8px", margin: "10px 0 7px",
    }}>
      {children}
    </div>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "3px 0", borderBottom: "1px dotted #ddd",
    }}>
      <span style={{ color: "#555" }}>{label}</span>
      <span style={{ fontWeight: "bold" }}>{value}</span>
    </div>
  );
}

export function Field({ label, value, flex = 1 }: { label: string; value: string; flex?: number }) {
  return (
    <div style={{ flex }}>
      <div style={{ fontSize: 9, color: "#777", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ borderBottom: "1px solid #333", paddingBottom: 2, minHeight: 16, fontWeight: "bold" }}>
        {value}
      </div>
    </div>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export function Divider({ color = "#000" }: { color?: string }) {
  return <div style={{ borderTop: `2px solid ${color}`, margin: "10px 0" }} />;
}

export function SigBlock({ name, role }: { name: string; role: string }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, textAlign: "center", fontSize: 9 }}>
      <div style={{ height: 48 }} />
      <div style={{ borderTop: "1px solid #000", marginBottom: 4 }} />
      <div style={{ fontWeight: "bold", fontSize: 10 }}>{name}</div>
      <div style={{ color: "#555" }}>{role}</div>
      <div style={{ marginTop: 6 }}>Date: _______________</div>
    </div>
  );
}
