const byId = id => document.getElementById(id);
const amount = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const fullDate = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' });
const shortMonth = new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fullMonth = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const form = byId('form-movimiento');
const dialog = byId('alta');
const today = new Date();
let period = {
  desde: isoDate(new Date(today.getFullYear(), today.getMonth() - 5, 1)),
  hasta: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0))
};
let categories;
let page = 1;
let reportCategories = [];
let requestNumber = 0;
let saving = false;

function isoDate(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
}

function setPeriodInputs() {
  byId('desde').value = period.desde;
  byId('hasta').value = period.hasta;
}

function message(id, value) {
  const node = byId(id);
  node.textContent = value;
  node.hidden = !value;
}

async function api(path, options) {
  const response = await fetch('/api/' + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function cell(row, value, className) {
  row.append(element('td', value, className));
}

function reportByCategory() {
  const type = byId('tipo-categorias').value;
  const categoriesOfType = reportCategories.filter(item => item.tipo === type);
  const target = byId('categorias');
  if (!categoriesOfType.length) {
    target.replaceChildren(element('p', 'No hay ' + (type === 'ingreso' ? 'ingresos' : 'gastos') + ' en este período.', 'empty'));
    return;
  }

  const list = element('ul', undefined, 'category-list');
  const largest = Number(categoriesOfType[0].total);
  for (const item of categoriesOfType) {
    const li = element('li');
    const label = element('div', undefined, 'category-label');
    label.append(element('span', item.categoria), element('strong', amount.format(item.total)));
    const track = element('div', undefined, 'track');
    track.setAttribute('aria-hidden', 'true');
    const fill = element('div', undefined, type === 'ingreso' ? 'income' : 'expense');
    fill.style.inlineSize = Number(item.total) / largest * 100 + '%';
    track.append(fill);
    li.append(label, track);
    list.append(li);
  }
  target.replaceChildren(list);
}

function monthlyReport(months) {
  const largest = months.reduce((max, month) => Math.max(max, Number(month.ingresos), Number(month.gastos)), 0);
  byId('grafico').hidden = largest === 0;
  byId('detalle-mensual').hidden = largest === 0;
  message('mensual-vacio', largest === 0 ? 'No hay movimientos en este período.' : '');
  if (!largest) return;

  const chart = element('div', undefined, 'chart');
  const rows = document.createDocumentFragment();
  for (const month of months) {
    const date = new Date(month.mes + '-01T00:00:00Z');
    const slot = element('div', undefined, 'chart-slot');
    const columns = element('div', undefined, 'chart-columns');
    for (const [key, style] of [['ingresos', 'income'], ['gastos', 'expense']]) {
      const bar = element('div', undefined, style);
      const ratio = Number(month[key]) / largest;
      bar.style.blockSize = ratio ? 'max(2px, ' + ratio * 100 + '%)' : '0';
      columns.append(bar);
    }
    slot.title = fullMonth.format(date) + ' · Ingresos ' + amount.format(month.ingresos) + ' · Gastos ' + amount.format(month.gastos);
    slot.append(columns, element('span', shortMonth.format(date), 'month-label'));
    chart.append(slot);

    const row = element('tr');
    cell(row, fullMonth.format(date));
    cell(row, amount.format(month.ingresos), 'number');
    cell(row, amount.format(month.gastos), 'number');
    cell(row, amount.format(month.saldo), 'number');
    rows.append(row);
  }
  byId('grafico').replaceChildren(chart);
  byId('grafico').scrollLeft = byId('grafico').scrollWidth;
  byId('tabla-mensual').replaceChildren(rows);
}

function renderMovements(result) {
  const rows = document.createDocumentFragment();
  for (const movement of result.items) {
    const row = element('tr');
    const income = movement.tipo === 'ingreso';
    const type = income ? 'Ingreso' : 'Gasto';
    const date = fullDate.format(new Date(movement.fecha + 'T00:00:00Z'));
    const description = element('td', movement.descripcion, 'description');
    description.append(element('span', [movement.categoria, date, type].join(' · '), 'movement-meta'));
    row.append(description);
    cell(row, movement.categoria, 'movement-column');
    cell(row, date, 'movement-column');
    const typeCell = element('td', undefined, 'movement-column');
    typeCell.append(element('span', type, income ? 'type income-type' : 'type expense-type'));
    row.append(typeCell);
    cell(row, amount.format((income ? '' : '-') + movement.monto), 'number movement-amount');
    rows.append(row);
  }
  byId('tabla-movimientos').replaceChildren(rows);
  message('sin-movimientos', result.items.length ? '' : 'No hay movimientos para mostrar.');
  byId('detalle-movimientos').hidden = !result.items.length;
  byId('paginacion').hidden = page === 1 && !result.haySiguiente;
  byId('pagina').textContent = 'Página ' + page;
  byId('anterior').disabled = page === 1;
  byId('siguiente').disabled = !result.haySiguiente;
}

function clearData() {
  for (const id of ['saldo', 'ingresos', 'gastos']) byId(id).textContent = '—';
  for (const id of ['grafico', 'detalle-mensual', 'detalle-movimientos', 'paginacion']) byId(id).hidden = true;
  byId('tipo-categorias').disabled = true;
  byId('categorias').replaceChildren();
  message('sin-movimientos', '');
  message('mensual-vacio', '');
}

async function load({ keepReports = false, confirmation = '' } = {}) {
  const request = ++requestNumber;
  const params = new URLSearchParams(period);
  const list = new URLSearchParams({ ...period, pagina: String(page) });
  const previousButtons = [byId('anterior').disabled, byId('siguiente').disabled];
  if (!keepReports) clearData();
  byId('anterior').disabled = true;
  byId('siguiente').disabled = true;
  message('error-datos', '');
  message('estado', 'Cargando datos…');

  try {
    const [movements, reports] = await Promise.all([
      api('movimientos?' + list),
      keepReports ? null : api('reportes?' + params)
    ]);
    if (request !== requestNumber) return;
    if (reports) {
      for (const id of ['saldo', 'ingresos', 'gastos']) byId(id).textContent = amount.format(reports.balance[id]);
      reportCategories = reports.categorias;
      byId('tipo-categorias').disabled = false;
      reportByCategory();
      monthlyReport(reports.mensual);
    }
    renderMovements(movements);
    message('estado', confirmation);
  } catch {
    if (request !== requestNumber) return;
    if (keepReports) {
      page = Number(byId('pagina').textContent.replace('Página ', ''));
      [byId('anterior').disabled, byId('siguiente').disabled] = previousButtons;
    }
    message('estado', confirmation);
    message('error-datos', 'No se pudieron cargar los datos. Volvé a aplicar el período para reintentar.');
  }
}

function fillCategories() {
  const available = (categories ?? []).filter(category => category.tipo === byId('tipo').value);
  byId('categoria').replaceChildren(...available.map(category => new Option(category.nombre, category.id)));
  byId('guardar').disabled = saving || !available.length;
}

async function openForm() {
  form.reset();
  const now = isoDate(new Date());
  byId('fecha').value = now >= period.desde && now <= period.hasta ? now : period.hasta;
  message('error-alta', '');
  fillCategories();
  dialog.showModal();
  if (categories) return;
  try {
    categories = await api('categorias');
    fillCategories();
  } catch {
    message('error-alta', 'No se pudieron cargar las categorías. Cerrá el formulario y volvé a abrirlo.');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  message('error-alta', '');
  const data = Object.fromEntries(new FormData(form));
  data.categoriaId = Number(data.categoriaId);
  saving = true;
  for (const id of ['guardar', 'cerrar', 'cancelar']) byId(id).disabled = true;
  try {
    await api('movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (data.fecha < period.desde || data.fecha > period.hasta) {
      const [year, month] = data.fecha.split('-').map(Number);
      period = { desde: data.fecha.slice(0, 7) + '-01', hasta: isoDate(new Date(year, month, 0)) };
      setPeriodInputs();
      message('error-filtros', '');
    }
    page = 1;
    dialog.close();
    load({ confirmation: 'Movimiento guardado.' });
  } catch (error) {
    message('error-alta', error.message || 'No se pudo guardar el movimiento.');
  } finally {
    saving = false;
    for (const id of ['guardar', 'cerrar', 'cancelar']) byId(id).disabled = false;
  }
});

byId('filtros').addEventListener('submit', event => {
  event.preventDefault();
  const desde = byId('desde').value;
  const hasta = byId('hasta').value;
  if (desde > hasta) {
    message('error-filtros', 'La fecha «Desde» tiene que ser anterior o igual a «Hasta».');
    return;
  }
  message('error-filtros', '');
  period = { desde, hasta };
  page = 1;
  load();
});

byId('anterior').onclick = () => { page--; load({ keepReports: true }); };
byId('siguiente').onclick = () => { page++; load({ keepReports: true }); };
byId('tipo-categorias').onchange = reportByCategory;
byId('nuevo').onclick = openForm;
byId('tipo').onchange = fillCategories;
byId('cerrar').onclick = () => dialog.close();
byId('cancelar').onclick = () => dialog.close();
dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });

setPeriodInputs();
load();
