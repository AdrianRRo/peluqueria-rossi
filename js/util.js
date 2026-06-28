// ====== utilidades compartidas ======
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const eurFmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const eur = (n) => eurFmt.format(Number(n) || 0);

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- fechas (todo en local, formato YYYY-MM-DD) ----
export const pad = (n) => String(n).padStart(2, "0");
export const dateToStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateToStr(new Date());
export const parseDate = (s) => new Date(s + "T00:00:00");
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateToStr(d); };
export const weekStart = (s) => { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return dateToStr(d); };
export const monthStart = (s) => { const d = parseDate(s); d.setDate(1); return dateToStr(d); };
export const yearStart = (s) => `${parseDate(s).getFullYear()}-01-01`;

const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const dowShort = (s) => DOW[(parseDate(s).getDay() + 6) % 7];
export const fmtLong = (s) => parseDate(s).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
export const fmtShort = (s) => parseDate(s).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
export const fmtMonthYear = (s) => parseDate(s).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

// ---- toast ----
export function toast(msg) {
  const root = $("#toast-root");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, 2200);
}

// ---- modal genérico ----
// opts: { title, body(HTML string), saveLabel, onSave(modalEl)->bool|void, extra:[{label,cls,onClick}] }
export function openModal(opts) {
  const root = $("#modal-root");
  root.innerHTML = "";
  const back = document.createElement("div");
  back.className = "modal";
  const extra = (opts.extra || []).map((b, i) => `<button type="button" class="btn ${b.cls || "btn-ghost"}" data-extra="${i}">${b.label}</button>`).join("");
  back.innerHTML = `
    <div class="modal-card">
      <h3>${esc(opts.title || "")}</h3>
      <div class="modal-body">${opts.body || ""}</div>
      <div class="modal-actions">
        ${opts.extra && opts.extra.length ? `<span class="spacer"></span>${extra}` : ""}
        <button type="button" class="btn btn-ghost" data-close>Cerrar</button>
        ${opts.onSave ? `<button type="button" class="btn btn-primary" data-save>${esc(opts.saveLabel || "Guardar")}</button>` : ""}
      </div>
    </div>`;
  const close = () => root.innerHTML = "";
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  $("[data-close]", back).addEventListener("click", close);
  const saveBtn = $("[data-save]", back);
  if (saveBtn) saveBtn.addEventListener("click", () => { const r = opts.onSave(back); if (r !== false) close(); });
  (opts.extra || []).forEach((b, i) => {
    $(`[data-extra="${i}"]`, back).addEventListener("click", () => { const r = b.onClick(back, close); if (r !== false && b.closeAfter !== false) close(); });
  });
  root.appendChild(back);
  if (opts.onShow) opts.onShow(back);
  return back;
}

export function confirmDialog(msg) { return window.confirm(msg); }

export function whatsapp(phone, text) {
  const p = (phone || "").replace(/[^0-9]/g, "");
  if (!p) { toast("Sin teléfono"); return; }
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`, "_blank");
}
