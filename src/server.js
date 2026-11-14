import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const pool = new pg.Pool({ max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
pool.on('error', error => console.error('Conexión PostgreSQL inactiva:', error.message));

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  next();
});
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', express.json({ limit: '8kb' }));

const validDate = value => {
  if (typeof value !== 'string' || !/^(19|20)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function period(req, res, next) {
  const { desde, hasta } = req.query;
  if (!validDate(desde) || !validDate(hasta) || desde > hasta) {
    return res.status(400).json({ error: 'Indicá un rango válido entre 1900 y 2099.' });
  }
  res.locals.period = [desde, hasta];
  next();
}

app.get('/api/salud', async (req, res) => {
  try {
    await pool.query('SELECT true FROM public.categorias LIMIT 1');
    res.json({ estado: 'ok' });
  } catch {
    res.status(503).json({ error: 'La base de datos no está disponible.' });
  }
});

app.get('/api/categorias', async (req, res) => {
  const { rows } = await pool.query('SELECT id, nombre, tipo FROM public.categorias ORDER BY nombre');
  res.json(rows);
});

const pageSize = 20;
app.get('/api/movimientos', period, async (req, res) => {
  const pageParam = req.query.pagina ?? '1';
  if (typeof pageParam !== 'string' || !/^[1-9]\d{0,7}$/.test(pageParam)) {
    return res.status(400).json({ error: 'El número de página no es válido.' });
  }

  const pagina = Number(pageParam);
  const { rows } = await pool.query(
    'SELECT m.id, m.tipo, m.fecha::text, m.monto::text, m.descripcion, c.nombre AS categoria ' +
    'FROM public.movimientos m JOIN public.categorias c ON m.categoria_id = c.id ' +
    'WHERE m.fecha BETWEEN $1::date AND $2::date ORDER BY m.fecha DESC, m.id DESC LIMIT $3 OFFSET $4',
    [...res.locals.period, pageSize + 1, (pagina - 1) * pageSize]
  );

  res.json({ items: rows.slice(0, pageSize), pagina, haySiguiente: rows.length > pageSize });
});

app.post('/api/movimientos', async (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Enviá los datos en formato JSON.' });
  }

  const { tipo, categoriaId, fecha, monto, descripcion } = req.body ?? {};
  if (tipo !== 'ingreso' && tipo !== 'gasto') {
    return res.status(400).json({ error: 'Elegí ingreso o gasto.' });
  }
  if (!Number.isInteger(categoriaId) || categoriaId < 1 || categoriaId > 2147483647) {
    return res.status(400).json({ error: 'Elegí una categoría válida.' });
  }
  if (!validDate(fecha)) {
    return res.status(400).json({ error: 'Ingresá una fecha real entre 1900 y 2099.' });
  }
  if (typeof monto !== 'string' || !/^\d{1,10}(?:[.,]\d{1,2})?$/.test(monto) || Number(monto.replace(',', '.')) <= 0) {
    return res.status(400).json({ error: 'Ingresá un monto positivo con hasta 10 enteros y 2 decimales.' });
  }
  const detalle = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (!detalle || detalle.length > 120 || detalle.includes('\0')) {
    return res.status(400).json({ error: 'Ingresá una descripción válida de 1 a 120 caracteres.' });
  }

  const { rows } = await pool.query(
    'INSERT INTO public.movimientos (tipo, categoria_id, fecha, monto, descripcion) ' +
    'SELECT $1, id, $3::date, $4::numeric, $5 FROM public.categorias WHERE id = $2 AND tipo = $1 ' +
    'RETURNING id, tipo, categoria_id AS "categoriaId", fecha::text, monto::text, descripcion',
    [tipo, categoriaId, fecha, monto.replace(',', '.'), detalle]
  );
  if (!rows.length) {
    return res.status(400).json({ error: 'La categoría no corresponde al tipo de movimiento.' });
  }
  res.status(201).json(rows[0]);
});

const reportQuery = [
  'WITH datos AS (',
  "  SELECT m.tipo, m.monto, c.nombre AS categoria, date_trunc('month', m.fecha::timestamp)::date AS mes",
  '  FROM public.movimientos m JOIN public.categorias c ON m.categoria_id = c.id',
  '  WHERE m.fecha BETWEEN $1::date AND $2::date',
  '), balance AS (',
  "  SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0.00) AS ingresos,",
  "         COALESCE(SUM(monto) FILTER (WHERE tipo = 'gasto'), 0.00) AS gastos",
  '  FROM datos',
  '), categorias AS (',
  '  SELECT tipo, categoria, SUM(monto) AS total FROM datos GROUP BY tipo, categoria',
  '), mensuales AS (',
  "  SELECT mes, COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0.00) AS ingresos,",
  "              COALESCE(SUM(monto) FILTER (WHERE tipo = 'gasto'), 0.00) AS gastos",
  '  FROM datos GROUP BY mes',
  ')',
  'SELECT json_build_object(',
  "  'balance', json_build_object('ingresos', ingresos::text, 'gastos', gastos::text, 'saldo', (ingresos - gastos)::text),",
  "  'categorias', COALESCE((SELECT json_agg(json_build_object('tipo', tipo, 'categoria', categoria, 'total', total::text)",
  "     ORDER BY tipo, total DESC, categoria) FROM categorias), '[]'::json),",
  "  'mensual', COALESCE((SELECT json_agg(json_build_object('mes', to_char(cal.fecha, 'YYYY-MM'),",
  "     'ingresos', COALESCE(m.ingresos, 0.00)::text, 'gastos', COALESCE(m.gastos, 0.00)::text,",
  "     'saldo', (COALESCE(m.ingresos, 0.00) - COALESCE(m.gastos, 0.00))::text) ORDER BY cal.fecha)",
  "     FROM generate_series(date_trunc('month', $1::date::timestamp), date_trunc('month', $2::date::timestamp), '1 month') AS cal(fecha)",
  "     LEFT JOIN mensuales m ON m.mes = cal.fecha::date), '[]'::json)",
  ') AS reportes FROM balance'
].join('\n');

app.get('/api/reportes', period, async (req, res) => {
  const { rows } = await pool.query(reportQuery, res.locals.period);
  res.json(rows[0].reportes);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.status === 413) return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  if (err.status === 415) return res.status(415).json({ error: 'Formato de solicitud no admitido.' });
  console.error(err.message);
  res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
});

const server = app.listen(process.env.PORT || 3000, '0.0.0.0');
server.on('listening', () => console.log('Saldo escuchando en el puerto', server.address().port));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => pool.end()));
}
