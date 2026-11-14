\set ON_ERROR_STOP on
\getenv app_password APP_DB_PASSWORD

BEGIN;

CREATE ROLE finanzas_app LOGIN PASSWORD :'app_password';
REVOKE CONNECT, TEMPORARY ON DATABASE finanzas FROM PUBLIC;
GRANT CONNECT ON DATABASE finanzas TO finanzas_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO finanzas_app;

CREATE TABLE public.categorias (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
    UNIQUE (nombre, tipo),
    UNIQUE (id, tipo)
);

CREATE TABLE public.movimientos (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo text NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
    categoria_id integer NOT NULL,
    fecha date NOT NULL CHECK (fecha BETWEEN DATE '1900-01-01' AND DATE '2099-12-31'),
    monto numeric(12, 2) NOT NULL CHECK (monto > 0 AND monto <= 9999999999.99),
    descripcion text NOT NULL CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 120),
    FOREIGN KEY (categoria_id, tipo) REFERENCES public.categorias (id, tipo)
);

CREATE INDEX movimientos_fecha_id_idx ON public.movimientos (fecha DESC, id DESC);

INSERT INTO public.categorias (nombre, tipo) VALUES
    ('Sueldo', 'ingreso'), ('Trabajo independiente', 'ingreso'),
    ('Reintegros', 'ingreso'), ('Otros ingresos', 'ingreso'),
    ('Alimentación', 'gasto'), ('Vivienda', 'gasto'), ('Servicios', 'gasto'),
    ('Transporte', 'gasto'), ('Salud', 'gasto'), ('Educación', 'gasto'),
    ('Ocio', 'gasto'), ('Otros gastos', 'gasto');

GRANT SELECT ON public.categorias TO finanzas_app;
GRANT SELECT, INSERT ON public.movimientos TO finanzas_app;
GRANT USAGE ON SEQUENCE public.movimientos_id_seq TO finanzas_app;

COMMIT;
