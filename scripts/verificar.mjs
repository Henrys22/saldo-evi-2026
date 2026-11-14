import assert from 'node:assert/strict';

const [mode, origin = 'http://127.0.0.1:3000'] = process.argv.slice(2);
assert.ok(['cargar', 'verificar', 'alta-recuperada'].includes(mode));
const period = 'desde=2026-09-01&hasta=2026-11-30';
const data = [
  ['ingreso', 'Sueldo', '2026-10-01', '850000,10', 'Sueldo de octubre'],
  ['gasto', 'Alimentación', '2026-10-05', '42850.30', 'Compra de supermercado'],
  ['gasto', 'Transporte', '2026-10-16', '12750.25', 'Carga de transporte'],
  ['ingreso', 'Trabajo independiente', '2026-11-02', '180000.20', 'Trabajo de diseño'],
  ['gasto', 'Vivienda', '2026-11-04', '225000', 'Alquiler'],
  ['gasto', 'Alimentación', '2026-11-08', '18420.45', 'Compras de la semana'],
  ['gasto', 'Transporte', '2026-11-10', '8500', 'Viajes en colectivo']
];

async function request(path, status = 200, payload) {
  const options = payload === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
  const response = await fetch(new URL('/api/' + path, origin), { ...options, signal: AbortSignal.timeout(10000) });
  const body = await response.json();
  assert.equal(response.status, status, path + ' ' + JSON.stringify(body));
  return body;
}

assert.deepEqual(await request('salud'), { estado: 'ok' });
const categories = await request('categorias');
const categoryId = (tipo, nombre) => {
  const match = categories.find(category => category.tipo === tipo && category.nombre === nombre);
  assert.ok(match, nombre);
  return match.id;
};

const landing = await fetch(origin, { signal: AbortSignal.timeout(10000) });
assert.equal(landing.status, 200);
assert.match(await landing.text(), /Resumen financiero/);

if (mode === 'cargar') {
  const empty = await request('movimientos?' + period);
  assert.equal(empty.items.length, 0);
  assert.deepEqual((await request('reportes?' + period)).balance, { ingresos: '0.00', gastos: '0.00', saldo: '0.00' });

  const first = { tipo: 'ingreso', categoriaId: categoryId('ingreso', 'Sueldo'), fecha: '2026-10-01', monto: '1', descripcion: 'Registro inválido' };
  await request('movimientos', 400, { ...first, fecha: '2026-02-30' });
  await request('movimientos', 400, { ...first, monto: '1.005' });
  await request('movimientos', 400, { ...first, monto: '-1' });
  await request('movimientos', 400, { ...first, categoriaId: categoryId('gasto', 'Vivienda') });
  await request('reportes?desde=2026-11-30&hasta=2026-10-01', 400);

  for (const [tipo, categoria, fecha, monto, descripcion] of data) {
    await request('movimientos', 201, { tipo, categoriaId: categoryId(tipo, categoria), fecha, monto, descripcion });
  }
  console.log('Alta de siete movimientos sintéticos y rechazo de datos inválidos verificados.');
}

const movements = await request('movimientos?' + period);
assert.equal(movements.pagina, 1);
assert.equal(movements.haySiguiente, false);
const expectedRows = data.map(([tipo, categoria, fecha, monto, descripcion], index) => ({
  id: 1 + index, tipo, fecha, monto: Number(monto.replace(',', '.')).toFixed(2), descripcion, categoria
})).reverse();
assert.deepEqual(movements.items, expectedRows);
assert.equal((await request('movimientos?desde=2026-11-10&hasta=2026-11-10')).items.length, 1);

const reports = await request('reportes?' + period);
assert.deepEqual(reports.balance, { ingresos: '1030000.30', gastos: '307521.00', saldo: '722479.30' });
assert.deepEqual(reports.categorias, [
  { tipo: 'gasto', categoria: 'Vivienda', total: '225000.00' },
  { tipo: 'gasto', categoria: 'Alimentación', total: '61270.75' },
  { tipo: 'gasto', categoria: 'Transporte', total: '21250.25' },
  { tipo: 'ingreso', categoria: 'Sueldo', total: '850000.10' },
  { tipo: 'ingreso', categoria: 'Trabajo independiente', total: '180000.20' }
]);
assert.deepEqual(reports.mensual, [
  { mes: '2026-09', ingresos: '0.00', gastos: '0.00', saldo: '0.00' },
  { mes: '2026-10', ingresos: '850000.10', gastos: '55600.55', saldo: '794399.55' },
  { mes: '2026-11', ingresos: '180000.20', gastos: '251920.45', saldo: '-71920.25' }
]);
console.log('Salud, frontend, siete filas exactas y los tres reportes verificados.');
console.log(JSON.stringify(reports.balance));

if (mode === 'alta-recuperada') {
  const inserted = await request('movimientos', 201, {
    tipo: 'ingreso', categoriaId: categoryId('ingreso', 'Sueldo'),
    fecha: '2026-12-01', monto: '1', descripcion: 'Alta después de recuperar'
  });
  assert.equal(inserted.id, 8);
  console.log('La base restaurada admite altas y la secuencia continuó en 8.');
}
