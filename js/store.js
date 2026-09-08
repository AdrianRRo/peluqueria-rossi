// ====== capa de datos (API-first) ======
// El estado NO se persiste en localStorage: el servidor es la única fuente de
// verdad. localStorage guarda SOLO el token (api.js) y el tema (aquí).
// El estado vive en memoria y se hidrata con loadRemote() (GET /api/state);
// las escrituras van por endpoints por-recurso desde las vistas (api.js).
import { parseDate } from "./util.js?v=23";
import { apiGetState } from "./api.js?v=23";

let state = { clients: [], products: [], appointments: [], vacations: [], settings: { theme: "light", closedWeekdays: [0, 1] } };
let _loading = null;

// Carga el estado completo del servidor (deduplica llamadas concurrentes).
// Es la ÚNICA forma de hidratar/refrescar el estado tras un arranque o escritura.
export function loadRemote() {
  if (!_loading) {
    _loading = apiGetState().then(
      (remote) => { state = remote || state; _loading = null; return state; },
      (err) => { _loading = null; throw err; },
    );
  }
  return _loading;
}

// Vuelve al estado vacío (al cerrar sesión: nada queda en memoria ni en disco).
export function resetState() {
  state = { clients: [], products: [], appointments: [], vacations: [], settings: { theme: "light", closedWeekdays: [0, 1] } };
}

// ---- tema (preferencia local del dispositivo; NO viaja al servidor) ----
const THEME_KEY = "pr_theme";
export const getTheme = () => localStorage.getItem(THEME_KEY) || "light";
export const setTheme = (t) => localStorage.setItem(THEME_KEY, t);

// ---- settings (solo lectura; escribir → PUT /api/settings) ----
export const getSettings = () => state.settings || (state.settings = { theme: "light" });

// ---- facturación ----
export const IVA = 0.21; // peluquería en España

// ---- vacaciones / días cerrados ----
export const listVacations = () => [...(state.vacations || [])].sort((a, b) => a.from.localeCompare(b.from));
export function vacationOn(date) { return (state.vacations || []).find((v) => date >= v.from && date <= v.to) || null; }

// ---- días de cierre semanal (configurable). 0=domingo ... 6=sábado ----
const WD_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const getClosedWeekdays = () => getSettings().closedWeekdays || [];
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

// ---- productos ----
export const listProducts = (onlyActive = false) =>
  [...state.products].filter((p) => !onlyActive || p.active).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
export const getProduct = (id) => state.products.find((p) => p.id === id);

// ---- stock / inventario (solo productos de venta) ----
export const listStock = () => state.products.filter((p) => p.category === "producto")
  .sort((a, b) => (isLow(b) - isLow(a)) || ((Number(a.stock) || 0) - (Number(b.stock) || 0)) || a.name.localeCompare(b.name));
export const isLow = (p) => (Number(p.stock) || 0) <= (p.minStock != null ? p.minStock : 0);

// ---- citas ----
export const listAppointments = () => state.appointments;
export const apptsByDate = (date) => state.appointments.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
export const apptsBetween = (from, to) => state.appointments.filter((a) => a.date >= from && a.date <= to);
export const getAppt = (id) => state.appointments.find((a) => a.id === id);
export const listSales = () => state.appointments.filter((a) => a.kind === "venta").sort((a, b) => ((b.sale && b.sale.ticketNo) || 0) - ((a.sale && a.sale.ticketNo) || 0));

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