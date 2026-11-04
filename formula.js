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
  activa: true,
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
    sumaPagina: 50,          // página = día + 50
    multFila: 2,             // fila = mes × 2
    sumaColumna: 2,          // cifra de la fila donde empieza = mes + 2
    segundos: 4,             // lo que tarda la animación de «buscando»
  },
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

if (typeof module !== "undefined") {
  module.exports = { AJUSTES_POR_DEFECTO, secuenciaDePagina, inicioDePagina, sumaCifras, paginaCompleta, cifrasReto, leerFecha, posicionFecha };
}
