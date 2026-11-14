# Saldo · Finanzas personales

Saldo registra ingresos y gastos en pesos argentinos, agrupa los movimientos por categoría y muestra tres reportes para el período elegido. Es el proyecto integrador de Entornos Virtualizados (TUTI, UTN Santa Fe, 2026).

## Requisitos

- Git y Docker Engine con Docker Compose v2 y Buildx, o Docker Desktop con contenedores Linux.
- Acceso a Docker Hub y npm en la primera construcción.
- Navegador actual y puerto local 8080 disponible. Node.js y PostgreSQL se ejecutan en contenedores.

## Arranque

Cloná el repositorio de la entrega y entrá en su carpeta. Desde un directorio que ya contiene el proyecto, empezá por copiar la configuración.

~~~bash
git clone https://github.com/Henrys22/saldo-evi-2026.git saldo
cd saldo
cp .env.example .env
~~~

En PowerShell, usá `Copy-Item .env.example .env` para el último paso.

El ejemplo contiene valores ficticios para un laboratorio con datos sintéticos. Para datos propios, elegí dos contraseñas distintas en `.env` antes del primer arranque. Si 8080 está ocupado, cambiá `WEB_PORT` en ese mismo archivo.

~~~bash
docker compose up --build --wait --wait-timeout 120
docker compose ps
~~~

Abrí [Saldo en el puerto 8080](http://127.0.0.1:8080). Ambos servicios deben estar `healthy`. La aplicación inicia con el catálogo de categorías y sin movimientos. Consultá [el endpoint de salud](http://127.0.0.1:8080/api/salud) si querés comprobar la conexión del backend con PostgreSQL.

## Uso

1. Seleccioná **Nuevo movimiento**, elegí **Ingreso** o **Gasto** y completá categoría, fecha, monto y descripción. Podés ingresar los decimales con punto o coma, sin separador de miles.
2. Aplicá el período inclusivo que querés consultar. La vista inicial abarca el mes actual y los cinco anteriores.
3. Consultá **Saldo del período** para ver ingresos menos gastos, **Por categoría** para comparar importes de cada tipo y **Evolución mensual** para ver ingresos, gastos y saldo por mes. **Ver totales por mes** abre la tabla de valores exactos.

## Persistencia

Recreá ambos servicios y volvé a cargar la página con el mismo período.

~~~bash
docker compose down
docker compose up --wait --wait-timeout 120
~~~

El volumen nombrado `pgdatos` conserva los datos en ese motor Docker. `docker compose down -v` elimina ese volumen y los movimientos. Usá el procedimiento de respaldo si necesitás copiar los datos a otro equipo.

## Respaldo y recuperación

En el origen, creá la carpeta `backups` con `mkdir backups` y generá un respaldo lógico de la base. `docker compose cp` copia el archivo binario sin depender de la redirección de la terminal.

~~~bash
docker compose exec -T db pg_dump -U finanzas_admin -d finanzas -Fc -f /tmp/saldo.dump
docker compose cp db:/tmp/saldo.dump ./backups/saldo.dump
docker compose exec -T db rm /tmp/saldo.dump
~~~

En el equipo destino, cloná el mismo proyecto y copiá el archivo a `backups/saldo.dump`. Creá un `.env` propio y seguí **Arranque** para inicializar una base vacía. Si probás origen y destino en el mismo equipo, usá otro proyecto y un puerto libre. Desde PowerShell o Bash, podés copiar `.env.example` a `.env.restaurada`, configurar `WEB_PORT=8081` en ese archivo y usar `docker compose --env-file .env.restaurada -p saldo-restaurado` como prefijo en los comandos de arranque y restauración.

~~~bash
docker compose cp ./backups/saldo.dump db:/tmp/saldo.dump
docker compose exec -T db pg_restore -U finanzas_admin -d finanzas --clean --if-exists --single-transaction --exit-on-error /tmp/saldo.dump
docker compose exec -T db rm /tmp/saldo.dump
docker compose exec -T db psql -U finanzas_admin -d finanzas -c "SELECT count(*) FROM public.movimientos;"
~~~

`--clean` reemplaza las tablas respaldadas en el destino. Compará el recuento, los movimientos y los reportes del mismo período con los del origen. Probá una nueva alta para comprobar la secuencia y los permisos del backend. Conservá el respaldo fuera del repositorio. Cubre la base `finanzas` en el momento de la copia, con sus objetos y permisos. Compose recrea los roles y la configuración viene del `.env` del destino. Los cambios posteriores al respaldo requieren una copia más reciente.

## Verificación repetible

Desde Bash en Linux, macOS o WSL con Docker habilitado, ejecutá el flujo de prueba con datos sintéticos. Usa proyectos temporales y los puertos 18080 y 18081. Podés cambiarlos con `SALDO_TEST_PORT` y `SALDO_RESTORE_PORT`.

~~~bash
bash scripts/verificar-compose.sh
~~~

El flujo arranca desde cero, comprueba la API y los tres reportes, recrea contenedores, copia un respaldo a otro proyecto con volumen vacío y comprueba que una nueva alta funciona después de restaurar. En GitHub, el workflow **Verificar Docker Compose** ejecuta el mismo procedimiento en un runner de Ubuntu.

## Documentación de la entrega

- [Arquitectura, decisiones y contrato de la API](docs/arquitectura.md)
- [Evidencia de ejecución y protocolo de transferencia](docs/evidencias.md)
- [Bitácora de dos decisiones](docs/bitacora.md)
- [Autoevaluación y preparación de la defensa](docs/autoevaluacion.md)
