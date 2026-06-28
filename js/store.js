// ====== capa de datos (localStorage) ======
import { uid, todayStr, addDays, parseDate } from "./util.js?v=16";

const KEY = "pr_state_v4";

const SERVICE = "servicio";
const PRODUCT = "producto";

// Empezamos de cero: sin clientes, productos ni citas. El negocio configura todo.
function seed() {
  return { clients: [], products: [], appointments: [], vacations: [], settings: { theme: "light", closedWeekdays: [0, 1] } };
}

let state = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.clients && raw.products && raw.appointments) return raw;
  } catch {}
  const s = seed();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function persist() { localStorage.setItem(KEY, JSON.stringify(state)); }

// ---- settings ----
export const getSettings = () => state.settings || (state.settings = { theme: "light" });
export function setSetting(k, v) { getSettings()[k] = v; persist(); }

// ---- facturación ----
export const IVA = 0.21; // peluquería en España
export function nextTicketNo() { const s = getSettings(); s.lastTicketNo = (s.lastTicketNo || 0) + 1; persist(); return s.lastTicketNo; }
// asigna nº correlativo a ventas completadas que aún no lo tengan (orden cronológico de cobro)
export function ensureTicketNumbers() {
  const s = getSettings();
  const done = state.appointments.filter((a) => a.status === "completada" && a.sale)
    .sort((a, b) => ((a.sale.completedAt || a.date) + a.time).localeCompare((b.sale.completedAt || b.date) + b.time));
  let changed = false;
  for (const a of done) if (a.sale.ticketNo == null) { s.lastTicketNo = (s.lastTicketNo || 0) + 1; a.sale.ticketNo = s.lastTicketNo; changed = true; }
  if (changed) persist();
}

// ---- vacaciones / días cerrados ----
export const listVacations = () => [...(state.vacations || [])].sort((a, b) => a.from.localeCompare(b.from));
export function addVacation(from, to, note) { state.vacations ||= []; const v = { id: uid(), from, to: to || from, note: note || "" }; state.vacations.push(v); persist(); return v; }
export function deleteVacation(id) { state.vacations = (state.vacations || []).filter((v) => v.id !== id); persist(); }
export function vacationOn(date) { return (state.vacations || []).find((v) => date >= v.from && date <= v.to) || null; }

// ---- días de cierre semanal (configurable). 0=domingo ... 6=sábado ----
const WD_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const getClosedWeekdays = () => getSettings().closedWeekdays || [];
export function setClosedWeekdays(arr) { getSettings().closedWeekdays = (arr || []).map(Number); persist(); }
// devuelve el motivo de cierre de un día (vacaciones o cierre semanal) o null
export function closedInfo(date) {
  const v = vacationOn(date);
  if (v) return { type: "vac", label: v.note || "Vacaciones" };
  const wd = parseDate(date).getDay();
  if ((getSettings().closedWeekdays || []).includes(wd)) return { type: "weekly", label: `Cerrado (${WD_NAMES[wd]})` };
  return null;
}

// ---- clientes ----
export const listClients = () => [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
export const getClient = (id) => state.clients.find((c) => c.id === id);
export function upsertClient(c) {
  if (c.id) { Object.assign(getClient(c.id), c); }
  else { c.id = uid(); c.createdAt = todayStr(); state.clients.push(c); }
  persist(); return c;
}
export function deleteClient(id) { state.clients = state.clients.filter((c) => c.id !== id); persist(); }

// ---- productos ----
export const listProducts = (onlyActive = false) =>
  [...state.products].filter((p) => !onlyActive || p.active).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
export const getProduct = (id) => state.products.find((p) => p.id === id);
export function upsertProduct(p) {
  p.price = Number(p.price) || 0; p.cost = Number(p.cost) || 0;
  if (p.stock != null) p.stock = Number(p.stock) || 0;
  if (p.minStock != null) p.minStock = Number(p.minStock) || 0;
  if (p.id) { Object.assign(getProduct(p.id), p); }
  else { p.id = uid(); state.products.push(p); }
  persist(); return p;
}
export function deleteProduct(id) { state.products = state.products.filter((p) => p.id !== id); persist(); }

// ---- stock / inventario (solo productos de venta) ----
export const listStock = () => state.products.filter((p) => p.category === "producto")
  .sort((a, b) => (isLow(b) - isLow(a)) || ((Number(a.stock) || 0) - (Number(b.stock) || 0)) || a.name.localeCompare(b.name));
export const isLow = (p) => (Number(p.stock) || 0) <= (p.minStock != null ? p.minStock : 0);
export function adjustStock(id, delta) { const p = getProduct(id); if (!p) return; p.stock = (Number(p.stock) || 0) + delta; persist(); }
export function setStockValues(id, stock, minStock) { const p = getProduct(id); if (!p) return; if (stock != null) p.stock = Number(stock) || 0; if (minStock != null) p.minStock = Number(minStock) || 0; persist(); }
function decLines(lines) { let ch = false; for (const l of (lines || [])) { if (!l.productId) continue; const p = getProduct(l.productId); if (p && p.category === "producto") { p.stock = (Number(p.stock) || 0) - (l.qty || 1); ch = true; } } return ch; }
export function consumeStock(lines) { if (decLines(lines)) persist(); }
export function restoreStock(lines) { let ch = false; for (const l of (lines || [])) { if (!l.productId) continue; const p = getProduct(l.productId); if (p && p.category === "producto") { p.stock = (Number(p.stock) || 0) + (l.qty || 1); ch = true; } } if (ch) persist(); }

// ---- citas ----
export const listAppointments = () => state.appointments;
export const apptsByDate = (date) => state.appointments.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
export const apptsBetween = (from, to) => state.appointments.filter((a) => a.date >= from && a.date <= to);
export const getAppt = (id) => state.appointments.find((a) => a.id === id);
export function upsertAppt(a) {
  if (a.id) { Object.assign(getAppt(a.id), a); }
  else { a.id = uid(); state.appointments.push(a); }
  persist(); return a;
}
export function deleteAppt(id) { state.appointments = state.appointments.filter((a) => a.id !== id); persist(); }

// venta directa de productos (sin cita). Se guarda como registro completado para que entre en estadísticas y facturación.
export function createSale({ lines, method, clientName, clientId }) {
  const total = lines.reduce((s, l) => s + l.price * (l.qty || 1), 0);
  const cost = lines.reduce((s, l) => s + (l.cost || 0) * (l.qty || 1), 0);
  const t = todayStr();
  const now = new Date();
  const s = getSettings(); s.lastTicketNo = (s.lastTicketNo || 0) + 1;
  const a = {
    id: uid(), kind: "venta", date: t, time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    clientId: clientId || null, clientName: clientName || "Venta directa", phone: "", items: [], durationMin: 0, status: "completada", note: "",
    sale: { completedAt: t, method, ticketNo: s.lastTicketNo, lines, total, cost, profit: total - cost },
  };
  decLines(lines);
  state.appointments.push(a); persist(); return a;
}
export const listSales = () => state.appointments.filter((a) => a.kind === "venta").sort((a, b) => (b.sale.ticketNo || 0) - (a.sale.ticketNo || 0));

// ---- estadísticas ----
export function statsBetween(from, to) {
  const done = apptsBetween(from, to).filter((a) => a.status === "completada" && a.sale);
  const noShow = apptsBetween(from, to).filter((a) => a.status === "no_show").length;
  let revenue = 0, cost = 0;
  const perItem = {};   // nombre -> {qty, revenue, cost}
  const perDay = {};    // fecha -> {revenue, cost, count, efectivo, tarjeta}
  const byMethod = { efectivo: { total: 0, count: 0 }, tarjeta: { total: 0, count: 0 }, otro: { total: 0, count: 0 } };
  for (const a of done) {
    const s = a.sale;
    revenue += s.total; cost += s.cost;
    const m = s.method === "tarjeta" ? "tarjeta" : s.method === "efectivo" ? "efectivo" : "otro";
    byMethod[m].total += s.total; byMethod[m].count++;
    const d = (perDay[a.date] ||= { revenue: 0, cost: 0, count: 0, efectivo: 0, tarjeta: 0 });
    d.revenue += s.total; d.cost += s.cost; d.count++;
    if (m === "tarjeta") d.tarjeta += s.total; else if (m === "efectivo") d.efectivo += s.total;
    for (const ln of s.lines) {
      const it = (perItem[ln.name] ||= { qty: 0, revenue: 0, cost: 0 });
      it.qty += ln.qty || 1; it.revenue += (ln.price || 0) * (ln.qty || 1); it.cost += (ln.cost || 0) * (ln.qty || 1);
    }
  }
  return {
    count: done.length, noShow, revenue, cost, profit: revenue - cost,
    avgTicket: done.length ? revenue / done.length : 0,
    perItem, perDay, byMethod, done,
  };
}

export const exportAll = () => state;
