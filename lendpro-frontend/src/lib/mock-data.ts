export type LoanStatus = "new" | "renew" | "overdue" | "past-due" | "paid";
export type ScheduleStatus = "paid" | "partial" | "missed" | "pending" | "catch-up";

export interface Collector {
  id: string;
  name: string;
  code: string;
  area: string;
  assigned: number;
  expected: number;
  actual: number;
  missed: number;
  overdue: number;
  pastDue: number;
}

export interface Client {
  id: string;
  number: string;
  name: string;
  storeName: string;
  address: string;
  phone: string;
  email?: string;
  type: "new" | "renew";
  collectorId: string;
  status: LoanStatus;
}

export type LoanType = "new-loan" | "reloan" | "reconstruct";

export interface Loan {
  id: string;
  number: string;
  clientId: string;
  loanType: LoanType;
  principal: number;
  interest: number;
  serviceCharge: number;
  totalReceivable: number;
  dailyPayment: number;
  termDays: number;
  currentBalance: number;
  releaseDate: string;
  dueDate: string;
  expectedEndDate: string;
  status: LoanStatus;
  collectorId: string;
}

export interface Payment {
  id: string;
  loanId: string;
  clientId: string;
  date: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  collectorId: string;
  remarks?: string;
}

export interface ScheduleRow {
  date: string;
  expected: number;
  actual: number;
  previousBalance: number;
  balanceAfter: number;
  status: ScheduleStatus;
  remarks?: string;
}

export const collectors: Collector[] = [
  { id: "c1", name: "Mark Rivera", code: "Collector A", area: "Quezon City", assigned: 42, expected: 38500, actual: 35200, missed: 4, overdue: 6, pastDue: 2 },
  { id: "c2", name: "Sheila Cruz", code: "Collector B", area: "Manila", assigned: 38, expected: 34200, actual: 33100, missed: 2, overdue: 3, pastDue: 1 },
  { id: "c3", name: "John Ramos", code: "Collector C", area: "Pasig", assigned: 35, expected: 31000, actual: 26800, missed: 6, overdue: 8, pastDue: 4 },
  { id: "c4", name: "Liza Mendoza", code: "Collector D", area: "Makati", assigned: 31, expected: 28500, actual: 27900, missed: 1, overdue: 2, pastDue: 0 },
];

export const clients: Client[] = [
  { id: "cl1", number: "CL-2025-001", name: "Juan Dela Cruz", storeName: "Juan Sari-Sari Store", address: "12 Mabini St., Quezon City", phone: "+63 917 123 4567", type: "new", collectorId: "c1", status: "new" },
  { id: "cl2", number: "CL-2025-002", name: "Maria Santos", storeName: "Maria Mini Mart", address: "45 Rizal Ave., Manila", phone: "+63 918 555 1212", email: "maria.santos@gmail.com", type: "renew", collectorId: "c2", status: "renew" },
  { id: "cl3", number: "CL-2025-003", name: "Roberto Reyes", storeName: "RJR General Merchandise", address: "78 Ortigas Ave., Pasig", phone: "+63 920 444 7788", type: "renew", collectorId: "c3", status: "overdue" },
  { id: "cl4", number: "CL-2025-004", name: "Ana Villanueva", storeName: "AV Store", address: "10 Ayala Blvd., Makati", phone: "+63 915 222 9090", email: "ana.villanueva@gmail.com", type: "new", collectorId: "c4", status: "paid" },
  { id: "cl5", number: "CL-2025-005", name: "Pedro Gonzales", storeName: "Pedro's Bakery", address: "5 Katipunan, QC", phone: "+63 917 998 1122", type: "renew", collectorId: "c1", status: "past-due" },
  { id: "cl6", number: "CL-2025-006", name: "Liza Bautista", storeName: "LB Carenderia", address: "23 Taft Ave., Manila", phone: "+63 919 333 6677", email: "liza.bautista@gmail.com", type: "new", collectorId: "c2", status: "new" },
  { id: "cl7", number: "CL-2025-007", name: "Carlos Mercado", storeName: "Mercado Hardware", address: "88 C. Raymundo, Pasig", phone: "+63 916 700 1234", type: "renew", collectorId: "c3", status: "overdue" },
  { id: "cl8", number: "CL-2025-008", name: "Grace Lim", storeName: "Grace Beauty Shop", address: "9 Buendia, Makati", phone: "+63 918 121 3434", type: "new", collectorId: "c4", status: "new" },
  { id: "cl9", number: "CL-2025-009", name: "Miguel Tan", storeName: "Tan Auto Parts", address: "34 EDSA, QC", phone: "+63 917 565 7878", email: "miguel.tan@email.com", type: "renew", collectorId: "c1", status: "renew" },
  { id: "cl10", number: "CL-2025-010", name: "Rosa Aquino", storeName: "Aquino Grocery", address: "16 Aurora Blvd., QC", phone: "+63 920 111 2233", type: "new", collectorId: "c2", status: "paid" },
];

export const loans: Loan[] = [
  { id: "ln1", number: "LN-2025-0001", clientId: "cl1", loanType: "new-loan", principal: 10000, interest: 1500, serviceCharge: 500, totalReceivable: 12000, dailyPayment: 267, termDays: 45, currentBalance: 8750, releaseDate: "2025-04-15", dueDate: "2025-06-14", expectedEndDate: "2025-06-22", status: "new", collectorId: "c1" },
  { id: "ln2", number: "LN-2025-0002", clientId: "cl2", loanType: "reloan", principal: 20000, interest: 3000, serviceCharge: 1000, totalReceivable: 24000, dailyPayment: 533, termDays: 45, currentBalance: 12500, releaseDate: "2025-03-10", dueDate: "2025-05-08", expectedEndDate: "2025-05-26", status: "renew", collectorId: "c2" },
  { id: "ln3", number: "LN-2025-0003", clientId: "cl3", loanType: "new-loan", principal: 15000, interest: 2250, serviceCharge: 750, totalReceivable: 18000, dailyPayment: 300, termDays: 60, currentBalance: 14700, releaseDate: "2025-04-01", dueDate: "2025-06-27", expectedEndDate: "2025-06-15", status: "overdue", collectorId: "c3" },
  { id: "ln4", number: "LN-2025-0004", clientId: "cl4", loanType: "new-loan", principal: 8000, interest: 1200, serviceCharge: 400, totalReceivable: 9600, dailyPayment: 320, termDays: 30, currentBalance: 0, releaseDate: "2025-01-05", dueDate: "2025-02-14", expectedEndDate: "2025-03-25", status: "paid", collectorId: "c4" },
  { id: "ln5", number: "LN-2025-0005", clientId: "cl5", loanType: "reloan", principal: 25000, interest: 3750, serviceCharge: 1250, totalReceivable: 30000, dailyPayment: 500, termDays: 60, currentBalance: 9000, releaseDate: "2024-12-01", dueDate: "2025-02-26", expectedEndDate: "2025-03-15", status: "past-due", collectorId: "c1" },
  { id: "ln6", number: "LN-2025-0006", clientId: "cl6", loanType: "new-loan", principal: 12000, interest: 1800, serviceCharge: 600, totalReceivable: 14400, dailyPayment: 320, termDays: 45, currentBalance: 11400, releaseDate: "2025-04-20", dueDate: "2025-06-19", expectedEndDate: "2025-06-30", status: "new", collectorId: "c2" },
  { id: "ln7", number: "LN-2025-0007", clientId: "cl7", loanType: "reconstruct", principal: 18000, interest: 2700, serviceCharge: 900, totalReceivable: 21600, dailyPayment: 360, termDays: 60, currentBalance: 16200, releaseDate: "2025-04-05", dueDate: "2025-07-02", expectedEndDate: "2025-06-22", status: "overdue", collectorId: "c3" },
  { id: "ln8", number: "LN-2025-0008", clientId: "cl8", loanType: "new-loan", principal: 10000, interest: 1500, serviceCharge: 500, totalReceivable: 12000, dailyPayment: 267, termDays: 45, currentBalance: 10750, releaseDate: "2025-04-25", dueDate: "2025-06-24", expectedEndDate: "2025-07-02", status: "new", collectorId: "c4" },
  { id: "ln9", number: "LN-2025-0009", clientId: "cl9", loanType: "reloan", principal: 30000, interest: 4500, serviceCharge: 1500, totalReceivable: 36000, dailyPayment: 600, termDays: 60, currentBalance: 18900, releaseDate: "2025-03-15", dueDate: "2025-06-11", expectedEndDate: "2025-06-15", status: "renew", collectorId: "c1" },
  { id: "ln10", number: "LN-2025-0010", clientId: "cl10", loanType: "new-loan", principal: 9000, interest: 1350, serviceCharge: 450, totalReceivable: 10800, dailyPayment: 240, termDays: 45, currentBalance: 0, releaseDate: "2025-01-20", dueDate: "2025-03-19", expectedEndDate: "2025-04-10", status: "paid", collectorId: "c2" },
];

export const payments: Payment[] = [
  { id: "p1", loanId: "ln1", clientId: "cl1", date: "2025-05-14", amount: 250, previousBalance: 9000, newBalance: 8750, collectorId: "c1" },
  { id: "p2", loanId: "ln2", clientId: "cl2", date: "2025-05-14", amount: 500, previousBalance: 13000, newBalance: 12500, collectorId: "c2" },
  { id: "p3", loanId: "ln3", clientId: "cl3", date: "2025-05-13", amount: 200, previousBalance: 14900, newBalance: 14700, collectorId: "c3", remarks: "Partial payment" },
  { id: "p4", loanId: "ln6", clientId: "cl6", date: "2025-05-14", amount: 300, previousBalance: 11700, newBalance: 11400, collectorId: "c2" },
  { id: "p5", loanId: "ln9", clientId: "cl9", date: "2025-05-14", amount: 700, previousBalance: 19600, newBalance: 18900, collectorId: "c1" },
  { id: "p6", loanId: "ln1", clientId: "cl1", date: "2025-05-13", amount: 250, previousBalance: 9250, newBalance: 9000, collectorId: "c1" },
  { id: "p7", loanId: "ln7", clientId: "cl7", date: "2025-05-12", amount: 450, previousBalance: 16650, newBalance: 16200, collectorId: "c3" },
];

export function generateSchedule(loan: Loan, paid = 0): ScheduleRow[] {
  const days = Math.ceil(loan.totalReceivable / loan.dailyPayment);
  const rows: ScheduleRow[] = [];
  let balance = loan.totalReceivable;
  const start = new Date(loan.releaseDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i + 1);
    const previous = balance;
    let actual = 0;
    let status: ScheduleStatus = "pending";
    if (i < paid) {
      actual = loan.dailyPayment;
      status = "paid";
      balance -= actual;
    } else if (i === paid && loan.status === "overdue") {
      actual = 0;
      status = "missed";
    } else if (i === paid + 1 && loan.status === "overdue") {
      actual = loan.dailyPayment * 2;
      status = "catch-up";
      balance -= actual;
    }
    rows.push({
      date: d.toISOString().slice(0, 10),
      expected: loan.dailyPayment,
      actual,
      previousBalance: previous,
      balanceAfter: balance < 0 ? 0 : balance,
      status,
    });
  }
  return rows;
}

export const auditLogs = [
  { id: "a1", ts: "2025-05-14 09:12", user: "Alex Dela Cruz", role: "Administrator", action: "CREATE_LOAN", record: "LN-2025-0010", description: "Created loan for Rosa Aquino" },
  { id: "a2", ts: "2025-05-14 09:45", user: "Mark Rivera", role: "Collector", action: "RECORD_PAYMENT", record: "LN-2025-0001", description: "Recorded ₱250.00 payment" },
  { id: "a3", ts: "2025-05-14 10:02", user: "Sheila Cruz", role: "Collector", action: "RECORD_PAYMENT", record: "LN-2025-0002", description: "Recorded ₱500.00 payment" },
  { id: "a4", ts: "2025-05-14 10:35", user: "Grace Sy", role: "Manager", action: "EXPORT_REPORT", record: "Daily Collection Report", description: "Exported to Excel" },
  { id: "a5", ts: "2025-05-14 11:00", user: "Alex Dela Cruz", role: "Administrator", action: "UPDATE_CLIENT", record: "CL-2025-003", description: "Updated contact number" },
  { id: "a6", ts: "2025-05-14 11:22", user: "John Ramos", role: "Collector", action: "FLAG_OVERDUE", record: "CL-2025-007", description: "Marked client overdue +3 days" },
  { id: "a7", ts: "2025-05-14 13:48", user: "Sysadmin", role: "System Administrator", action: "CREATE_USER", record: "USR-014", description: "Added new collector account" },
];

export const systemUsers = [
  { id: "u1", name: "Alex Dela Cruz", email: "alex@lendpro.ph", role: "Administrator / Encoder", status: "Active", lastLogin: "2025-05-14 09:00" },
  { id: "u2", name: "Mark Rivera", email: "mark.rivera@lendpro.ph", role: "Collector", status: "Active", lastLogin: "2025-05-14 08:30" },
  { id: "u3", name: "Sheila Cruz", email: "sheila.cruz@lendpro.ph", role: "Collector", status: "Active", lastLogin: "2025-05-14 08:45" },
  { id: "u4", name: "John Ramos", email: "john.ramos@lendpro.ph", role: "Collector", status: "Active", lastLogin: "2025-05-13 17:50" },
  { id: "u5", name: "Grace Sy", email: "grace.sy@lendpro.ph", role: "Manager", status: "Active", lastLogin: "2025-05-14 07:55" },
  { id: "u6", name: "IT Admin", email: "it@lendpro.ph", role: "System Administrator", status: "Active", lastLogin: "2025-05-14 06:30" },
  { id: "u7", name: "Liza Mendoza", email: "liza.mendoza@lendpro.ph", role: "Collector", status: "Inactive", lastLogin: "2025-05-10 16:10" },
];

export const monthlyReleases = [
  { month: "Dec", releases: 285000 },
  { month: "Jan", releases: 320000 },
  { month: "Feb", releases: 360000 },
  { month: "Mar", releases: 412000 },
  { month: "Apr", releases: 478000 },
  { month: "May", releases: 521000 },
];

export const outstandingTrend = [
  { month: "Dec", outstanding: 1240000 },
  { month: "Jan", outstanding: 1380000 },
  { month: "Feb", outstanding: 1455000 },
  { month: "Mar", outstanding: 1520000 },
  { month: "Apr", outstanding: 1612000 },
  { month: "May", outstanding: 1748000 },
];

export const expectedVsActual = [
  { day: "Mon", expected: 42000, actual: 39800 },
  { day: "Tue", expected: 41500, actual: 38200 },
  { day: "Wed", expected: 43200, actual: 42100 },
  { day: "Thu", expected: 42800, actual: 40500 },
  { day: "Fri", expected: 44000, actual: 41200 },
  { day: "Sat", expected: 38500, actual: 35900 },
];

export const monthlyCollection = [
  { month: "Dec", collected: 720000 },
  { month: "Jan", collected: 815000 },
  { month: "Feb", collected: 902000 },
  { month: "Mar", collected: 968000 },
  { month: "Apr", collected: 1042000 },
  { month: "May", collected: 1180000 },
];

export const collectorById = (id: string) => collectors.find((c) => c.id === id)!;
export const clientById = (id: string) => clients.find((c) => c.id === id)!;
export const loanByClientId = (id: string) => loans.find((l) => l.clientId === id);
