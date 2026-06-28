// ====== capa de datos (localStorage) ======
import { uid, todayStr, addDays } from "./util.js?v=8";

const KEY = "pr_state_v3";

const SERVICE = "servicio";
const PRODUCT = "producto";

function seed() {
  const t = todayStr();
  const products = [
    { id: uid(), name: "Corte mujer", category: SERVICE, price: 20, cost: 2, active: true },
    { id: uid(), name: "Corte hombre", category: SERVICE, price: 13, cost: 1.5, active: true },
    { id: uid(), name: "Peinado", category: SERVICE, price: 25, cost: 3, active: true },
    { id: uid(), name: "Tinte", category: SERVICE, price: 45, cost: 12, active: true },
    { id: uid(), name: "Mechas", category: SERVICE, price: 60, cost: 18, active: true },
    { id: uid(), name: "Barba", category: SERVICE, price: 10, cost: 1, active: true },
    { id: uid(), name: "Tratamiento hidratación", category: SERVICE, price: 30, cost: 8, active: true },
    { id: uid(), name: "Champú profesional", category: PRODUCT, price: 14, cost: 6, active: true },
    { id: uid(), name: "Mascarilla capilar", category: PRODUCT, price: 16, cost: 7, active: true },
  ];
  const byName = (n) => products.find((p) => p.name === n);
  const clients = [
    { id: uid(), name: "María López", phone: "+34611223344", email: "maria@example.com", hairType: "Largo / liso", notes: "Prefiere tinte sin amoníaco.", createdAt: t },
    { id: uid(), name: "Carlos Ruiz", phone: "+34622334455", email: "", hairType: "Corto", notes: "", createdAt: t },
    { id: uid(), name: "Lucía Fernández", phone: "+34633445566", email: "lucia@example.com", hairType: "Media melena / rizado", notes: "Alergia a un tinte concreto.", createdAt: t },
  ];
  const mkItem = (p) => ({ productId: p.id, name: p.name, price: p.price });
  const appointments = [
    { id: uid(), date: t, time: "10:00", clientId: clients[0].id, clientName: clients[0].name, phone: clients[0].phone, items: [mkItem(byName("Corte mujer"))], durationMin: 45, status: "confirmada", note: "" },
    { id: uid(), date: t, time: "11:30", clientId: clients[1].id, clientName: clients[1].name, phone: clients[1].phone, items: [mkItem(byName("Corte hombre")), mkItem(byName("Barba"))], durationMin: 30, status: "pendiente", note: "" },
    { id: uid(), date: addDays(t, 1), time: "17:00", clientId: clients[2].id, clientName: clients[2].name, phone: clients[2].phone, items: [mkItem(byName("Tinte"))], durationMin: 90, status: "confirmada", note: "" },
  ];
  // un par de citas completadas en días pasados para que las estadísticas tengan datos
  const past = (s, p, method) => ({
    id: uid(), date: s, time: "12:00", clientId: clients[0].id, clientName: clients[0].name, phone: clients[0].phone,
    items: [], durationMin: 45, status: "completada", note: "",
    sale: { completedAt: s, method, lines: [{ name: p.name, qty: 1, price: p.price, cost: p.cost }], total: p.price, cost: p.cost, profit: p.price - p.cost },
  });
  appointments.push(past(addDays(t, -1), byName("Mechas"), "tarjeta"));
  appointments.push(past(addDays(t, -2), byName("Tinte"), "efectivo"));
  appointments.push(past(addDays(t, -2), byName("Corte mujer"), "tarjeta"));
  return { clients, products, appointments, settings: { theme: "light" } };
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
  if (p.id) { Object.assign(getProduct(p.id), p); }
  else { p.id = uid(); state.products.push(p); }
  persist(); return p;
}
export function deleteProduct(id) { state.products = state.products.filter((p) => p.id !== id); persist(); }

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
