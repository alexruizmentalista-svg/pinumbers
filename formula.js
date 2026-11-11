// Motor de la fórmula de páginas — Pi Numbers
// Reglas:
//  · Inicio = suma de las cifras del número de página.
//      - inicio "suma": si da dos cifras, se siguen sumando hasta que quede una (66 → 12 → 3)
//      - inicio "ultima": si da dos cifras, se queda la última (66 → 12 → 2)
//  · Después, la secuencia de operaciones (por defecto +4, +2, −3) se repite en bucle.
//  · Cada resultado se reduce a su última cifra; los negativos dan la vuelta (−1 = 9, −2 = 8).
//  · Modo "pares": todo funciona con números de dos cifras (00–99) y se dicen de dos en dos.
//      La suma de la página se usa tal cual (66 → 12, 32 → 05).

const AJUSTES_POR_DEFECTO = {
  activa: false,            // de fábrica la web enseña pi real; la fórmula se enciende desde la app
  digitos: 10,               // cuántos dígitos del principio de la página salen de la fórmula
  modo: "una",               // "una" | "pares"
  inicio: "suma",            // "suma" | "ultima"  (solo en modo "una")
  operaciones: [
    { op: "+", n: 4 },
    { op: "+", n: 2 },       // ×2 hacía bucles visibles (página 32 → 5985985985); +2 no repite en 20 dígitos
    { op: "−", n: 3 },
  ],
  pagina1Real: true,         // la página 1 siempre empieza por 3,14159… real
  segundosReto: 30,          // duración del cronómetro del reto de memoria
  cifrasReto: 60,            // 30 = una secuencia; 60 = cambia a la otra secuencia en la cifra 30
  // Regla de las páginas pares: el inicio se multiplica (última cifra) y usan su propia secuencia.
  // Así dos páginas seguidas no empiezan por números consecutivos ni se parecen entre sí.
  reglaPares: {
    activa: true,
    multiplicador: 3,
    operaciones: [
      { op: "+", n: 3 },
      { op: "−", n: 1 },
      { op: "+", n: 5 },
    ],
  },
  // Efecto «tu cumpleaños en π»: dónde aparece la fecha que escribe el espectador
  fecha: {
    formato: "dma",          // "dm" | "md" | "dma" | "mda"  (el año siempre con 2 cifras)
    ambos: true,             // europea y americana a la vez: DDMM en la fila mes×2 y MMDD en la siguiente
    sumaPagina: 50,          // página = día + 50
    multFila: 2,             // fila = mes × 2
    sumaColumna: 2,          // cifra de la fila donde empieza = mes + 2
    segundos: 4,             // lo que tarda la animación de «buscando»
  },
  // Buscador de secuencias: «regla» (siempre aparece), «real» (busca de verdad) o
  // «seguir» (no dice dónde: su número va al principio de la próxima página que abra y detrás sigue tu secuencia)
  secuencia: {
    modo: "regla",
    continuacion: "formula",  // «formula» (desde su última cifra con la secuencia de las impares) | «fija»
    fija: "",                 // tu bloque memorizado para «fija»
    cifras: 20,               // cuántas cifras van detrás de su número
    sumaPagina: 100,         // página = dos primeras cifras + 100
    sumaFila: 1,             // fila = tercera cifra + 1
    sumaCifra: 1,            // cifra de la fila donde empieza = cuarta cifra + 1
  },
  // Idioma de la web del espectador: «auto» (el de su móvil), «es» o «en»
  idioma: "auto",
  // Lo que se ve en la web (para encadenar rutinas)
  rutinas: {
    buscador: false,
    reto: true,
    notas: true,
  },
};

const FORMATOS_FECHA = {
  dm: { orden: ["d", "m"], texto: "DD/MM" },
  md: { orden: ["m", "d"], texto: "MM/DD" },
  dma: { orden: ["d", "m", "a"], texto: "DD/MM/AA" },
  mda: { orden: ["m", "d", "a"], texto: "MM/DD/AA" },
};

// "14/03/95" → {dia:14, mes:3, anio:95, cifras:"140395"} según el formato; null si no es una fecha
function leerFecha(texto, formato) {
  const fm = FORMATOS_FECHA[formato] || FORMATOS_FECHA.dma;
  const trozos = String(texto).trim().split(/[^0-9]+/).filter(Boolean);
  let partes;
  if (trozos.length === fm.orden.length) partes = trozos;
  else {
    const s = trozos.join("");
    if (s.length !== fm.orden.length * 2) return null;
    partes = fm.orden.map((_, i) => s.slice(i * 2, i * 2 + 2));
  }
  const v = {};
  fm.orden.forEach((k, i) => { v[k] = parseInt(partes[i], 10); });
  if (!(v.d >= 1 && v.d <= 31 && v.m >= 1 && v.m <= 12)) return null;
  if (fm.orden.includes("a") && !(v.a >= 0 && v.a <= 99)) return null;
  const dos = (n) => String(n).padStart(2, "0");
  return { dia: v.d, mes: v.m, anio: fm.orden.includes("a") ? v.a : null,
           cifras: fm.orden.map((k) => dos(v[k])).join("") };
}

// Dónde va la fecha: página = día + sumaPagina, fila = mes × multFila, cifra = mes + sumaColumna
function posicionFecha(dia, mes, f) {
  const pag = ((dia + f.sumaPagina - 1) % 1000 + 1000) % 1000 + 1;
  const fila = ((mes * f.multFila - 1) % 25 + 25) % 25 + 1;
  const col = ((mes + f.sumaColumna - 1) % 20 + 20) % 20 + 1;
  return { pagina: pag, fila, columna: col, decimal: (pag - 1) * 500 + (fila - 1) * 20 + col };
}

// ¿Escribe la fecha al estilo americano (mes primero)?
function esAmericana(formato) { return String(formato || "").startsWith("m"); }
// Con «ambos», el buscador lee la fecha como la escribe el país del móvil (EE. UU.: mes primero)
function formatoDelMovil(f, idioma) {
  if (!f.ambos) return f.formato;
  const lg = String(idioma || "").toLowerCase();
  const usa = /^en-(us|ph|fm|mh|pw|as|gu|mp|pr|vi|um)/.test(lg) || lg === "en";
  const conAnio = String(f.formato || "dma").endsWith("a");
  return (usa ? "md" : "dm") + (conAnio ? "a" : "");
}
// Posición con las dos fechas: la americana va una fila más abajo
function posicionFechaFormato(dia, mes, f, formato) {
  const pos = posicionFecha(dia, mes, f);
  if (f.ambos && esAmericana(formato)) {
    pos.fila = pos.fila % 25 + 1;
    pos.decimal = (pos.pagina - 1) * 500 + (pos.fila - 1) * 20 + pos.columna;
  }
  return pos;
}

function sumaCifras(n) {
  return String(Math.abs(n)).split("").reduce((a, c) => a + Number(c), 0);
}

function modulo(n, m) {
  return ((n % m) + m) % m;
}

function aplicar(valor, { op, n }, m) {
  let r;
  if (op === "+") r = valor + n;
  else if (op === "−" || op === "-") r = valor - n;
  else if (op === "×" || op === "x" || op === "*") r = valor * n;
  else r = valor;
  return modulo(r, m);
}

function inicioDePagina(pagina, a) {
  let s = sumaCifras(pagina);
  if (a.modo === "pares") return modulo(s, 100);
  if (a.inicio === "ultima") return s % 10;
  while (s > 9) s = sumaCifras(s);
  return s;
}

// Devuelve los valores de la secuencia (cifras sueltas o pares) y la cadena de dígitos.
function secuenciaDePagina(pagina, ajustes = {}) {
  const a = { ...AJUSTES_POR_DEFECTO, ...ajustes };
  const m = a.modo === "pares" ? 100 : 10;
  const rp = a.reglaPares;
  const esParConRegla = !!(rp && rp.activa && pagina % 2 === 0);
  const lista = esParConRegla ? rp.operaciones : a.operaciones;
  const ops = lista && lista.length ? lista : [{ op: "+", n: 0 }];
  const valores = [];
  const pasos = [];
  let v = inicioDePagina(pagina, a);
  if (esParConRegla) {
    const base = v;
    v = modulo(v * (rp.multiplicador || 1), m);
    pasos.push({ op: "suma", resultado: base });
    pasos.push({ op: "×" + (rp.multiplicador || 1) + " (par)", resultado: v });
  } else {
    pasos.push({ op: "inicio", resultado: v });
  }
  valores.push(v);
  let digitos = a.modo === "pares" ? String(v).padStart(2, "0") : String(v);
  let i = 0;
  while (digitos.length < a.digitos) {
    const o = ops[i % ops.length];
    v = aplicar(v, o, m);
    valores.push(v);
    pasos.push({ op: o.op + o.n, resultado: v });
    digitos += a.modo === "pares" ? String(v).padStart(2, "0") : String(v);
    i++;
  }
  return { valores, pasos, digitos: digitos.slice(0, a.digitos), par: esParConRegla };
}

// Página completa (efecto del reto): arranca con las 4 primeras cifras de la fórmula de la página
// (con su regla de par/impar) y cada cifra siguiente = la anterior + la de cuatro posiciones atrás,
// quedándose con la última cifra. El ciclo dura 1.560 cifras: en 500 no se repite ningún bloque de 4.
function paginaCompleta(pagina, ajustes = {}, total = 500) {
  const a = { ...AJUSTES_POR_DEFECTO, ...ajustes, modo: "una", digitos: 4 };
  const d = secuenciaDePagina(pagina, a).digitos.split("").map(Number);
  if (d.every((x) => x === 0)) d[3] = 1; // 0000 se quedaría en ceros
  while (d.length < total) d.push((d[d.length - 1] + d[d.length - 4]) % 10);
  return d.join("");
}

// Reto de memoria (versión fácil): las primeras 30 cifras son la fórmula de la página
// (impares +4 +2 −3, pares ×3 y +3 −1 +5). Con 60, al llegar a la cifra 30 se sigue
// desde la última cifra con la secuencia de la otra paridad otras 30. El resto, pi real.
function cifrasReto(pagina, ajustes = {}, cuantas = 60) {
  const a = { ...AJUSTES_POR_DEFECTO, ...ajustes, modo: "una" };
  const primera = secuenciaDePagina(pagina, { ...a, digitos: Math.min(30, cuantas) });
  let d = primera.digitos;
  if (cuantas > 30) {
    const rp = a.reglaPares;
    const otra = primera.par ? a.operaciones : (rp && rp.activa ? rp.operaciones : a.operaciones);
    let v = Number(d[d.length - 1]);
    let i = 0;
    while (d.length < cuantas) {
      v = aplicar(v, otra[i % otra.length], 10);
      d += String(v);
      i++;
    }
  }
  return d;
}

// Modo seguir: lo que va detrás de su número
function continuacionSeguir(num, a) {
  const q = a.secuencia, n = Math.max(1, Math.min(60, q.cifras || 20));
  if (q.continuacion === "fija" && q.fija) {
    let s = String(q.fija).replace(/[^0-9]/g, "");
    if (s.length >= n) return s.slice(0, n);
    num = num + s;  // si el bloque es corto, se completa con la fórmula desde su última cifra
    const resto = continuacionFormula(num, n - s.length, a);
    return s + resto;
  }
  return continuacionFormula(num, n, a);
}
function continuacionFormula(num, n, a) {
  const ops = a.operaciones && a.operaciones.length ? a.operaciones : [{ op: "+", n: 0 }];
  let v = Number(String(num).slice(-1)) || 0, d = "", i = 0;
  while (d.length < n) { v = aplicar(v, ops[i % ops.length], 10); d += String(v); i++; }
  return d;
}

// Buscador con regla: dónde va una secuencia de 4 a 9 cifras
function posicionSecuencia(s, q) {
  const ab = parseInt(s.slice(0, 2), 10), c = +s[2], d = +s[3];
  const pag = ((ab + q.sumaPagina - 1) % 1000 + 1000) % 1000 + 1;
  const fila = ((c + q.sumaFila - 1) % 25 + 25) % 25 + 1;
  const col = ((d + q.sumaCifra - 1) % 20 + 20) % 20 + 1;
  return { pagina: pag, fila, columna: col, decimal: (pag - 1) * 500 + (fila - 1) * 20 + col };
}

// Modo filas: las 6 primeras cifras de cada fila esconden la página y la fila.
//  · Fila = suma de las 3 primeras cifras.
//  · Página: cada una de las 3 siguientes menos la que tiene 3 posiciones antes
//    (centenas = 4ª − 1ª, decenas = 5ª − 2ª, unidades = 6ª − 3ª; si sale negativo, +10).
//  Ejemplo: 4 9 1 8 1 2 → fila 4+9+1 = 14; página 8−4=4, 1−9=2 (−8+10), 2−1=1 → 421.
//  El reparto de las 3 primeras es pseudoaleatorio pero fijo para cada página y fila.
function codigoFila(p, r) {
  let s = (p * 7919 + r * 104729) >>> 0;
  const azar = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 16) % n; };
  const lo1 = Math.max(0, r - 18), hi1 = Math.min(9, r);
  const d1 = lo1 + azar(hi1 - lo1 + 1);
  const lo2 = Math.max(0, r - d1 - 9), hi2 = Math.min(9, r - d1);
  const d2 = lo2 + azar(hi2 - lo2 + 1);
  const d3 = r - d1 - d2;
  const pp = String(p % 1000).padStart(3, "0");
  return "" + d1 + d2 + d3 + ((+pp[0] + d1) % 10) + ((+pp[1] + d2) % 10) + ((+pp[2] + d3) % 10);
}
function leerCodigoFila(c) {
  const d = String(c).replace(/[^0-9]/g, "").split("").map(Number);
  if (d.length < 6) return null;
  const fila = d[0] + d[1] + d[2];
  const p = ((d[3] - d[0] + 10) % 10) * 100 + ((d[4] - d[1] + 10) % 10) * 10 + ((d[5] - d[2] + 10) % 10);
  return { fila, pagina: p === 0 ? 1000 : p };
}

if (typeof module !== "undefined") {
  module.exports = { AJUSTES_POR_DEFECTO, secuenciaDePagina, inicioDePagina, sumaCifras, paginaCompleta, cifrasReto, leerFecha, posicionFecha, esAmericana, formatoDelMovil, posicionFechaFormato, posicionSecuencia, codigoFila, leerCodigoFila, continuacionSeguir };
}
