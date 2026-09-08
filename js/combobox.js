// ====== combobox compartido (input con búsqueda filtrante + dropdown) ======
// Extraído de js/views/agenda.js (commit 51baff4) para reutilizarlo en toda la app.
// Estructura HTML que espera el wrapper:
//   <div class="cb-wrap">
//     <input class="cb-inp" ... autocomplete="off" />
//     <input type="hidden" ... />          <- guarda el value elegido (para el submit)
//     <div class="cb-drop" hidden></div>
//   </div>
// items: [{ value, label, special? }]  ·  onSelect(value) se llama al elegir una opción.
// opts.freeText: si true, al desenfocar sin elegir se conserva el texto escrito
// (campos opcionales con texto libre, p. ej. el cliente en Ventas).
import { esc } from "./util.js?v=23";

export function makeCombobox(wrapper, items, initVal, onSelect, opts = {}) {
  const inp = wrapper.querySelector(".cb-inp");
  const hidden = wrapper.querySelector("input[type=hidden]");
  const drop = wrapper.querySelector(".cb-drop");
  let hiIdx = -1;

  function pos() {
    const r = inp.getBoundingClientRect();
    drop.style.left = r.left + "px";
    drop.style.top = (r.bottom + 2) + "px";
    drop.style.width = r.width + "px";
  }

  function render(filter) {
    const f = (filter || "").toLowerCase().trim();
    const list = f ? items.filter((it) => it.label.toLowerCase().includes(f)) : items;
    hiIdx = -1;
    drop.innerHTML = list.length
      ? list.map((it) => `<div class="cb-opt${it.special ? " cb-opt-special" : ""}" data-val="${esc(it.value)}">${esc(it.label)}</div>`).join("")
      : `<div class="cb-empty">Sin resultados</div>`;
    pos();
    drop.hidden = false;
  }

  function pick(val, label) {
    hidden.value = val;
    inp.value = label;
    drop.hidden = true;
    hiIdx = -1;
    onSelect && onSelect(val);
  }

  function hi() {
    [...drop.querySelectorAll(".cb-opt")].forEach((el, i) => el.classList.toggle("cb-hi", i === hiIdx));
    const a = drop.querySelector(".cb-opt.cb-hi");
    if (a) a.scrollIntoView({ block: "nearest" });
  }

  inp.addEventListener("focus", () => render(inp.value));
  inp.addEventListener("input", () => { hidden.value = ""; render(inp.value); });
  inp.addEventListener("blur", () => setTimeout(() => {
    drop.hidden = true;
    if (!hidden.value && !opts.freeText) inp.value = "";
  }, 160));
  inp.addEventListener("keydown", (e) => {
    const opts2 = [...drop.querySelectorAll(".cb-opt")];
    if (e.key === "ArrowDown") { e.preventDefault(); hiIdx = Math.min(hiIdx + 1, opts2.length - 1); hi(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); hiIdx = Math.max(hiIdx - 1, 0); hi(); }
    else if (e.key === "Enter" && hiIdx >= 0) {
      e.preventDefault();
      const it = items.find((x) => x.value === opts2[hiIdx].dataset.val);
      if (it) pick(it.value, it.label);
    } else if (e.key === "Escape") drop.hidden = true;
  });
  drop.addEventListener("mousedown", (e) => {
    const opt = e.target.closest(".cb-opt");
    if (!opt) return;
    e.preventDefault();
    const it = items.find((x) => x.value === opt.dataset.val);
    if (it) pick(it.value, it.label);
  });

  if (initVal) {
    const it = items.find((x) => x.value === initVal);
    if (it) { hidden.value = it.value; inp.value = it.label; }
  }
}