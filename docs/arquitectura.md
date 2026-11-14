# Arquitectura de Saldo

~~~mermaid
flowchart LR
    B["Navegador del equipo anfitrión"]
    subgraph C["Proyecto Docker Compose"]
        subgraph N["Red bridge saldo_finanzas"]
            A["Servicio app · Node.js y Express<br/>Frontend estático y API · puerto 3000"]
            D["Servicio db · PostgreSQL 17<br/>Puerto interno 5432"]
            A -->|"SQL por TCP · db:5432 · finanzas_app"| D
        end
        V[("Volumen nombrado<br/>saldo_pgdatos")]
        S["db/01-inicio.sql<br/>Montaje de solo lectura"]
        D -->|"PGDATA"| V
        S -->|"Primer arranque con volumen vacío"| D
    end
    B -->|"HTTP · 127.0.0.1:8080 por defecto"| A
~~~

Los nombres con prefijo `saldo` corresponden al proyecto por defecto. Compose asigna otros prefijos cuando se usa `-p`.

## Construcción y arranque

El `Dockerfile` parte de Node 24.21.0 Alpine y copia primero los manifiestos. `npm ci` instala las versiones del archivo de bloqueo y reutiliza esa capa si solo cambia el código. Express sirve el HTML, CSS y JavaScript junto con `/api` en el mismo origen, por lo que el navegador usa un único puerto. PostgreSQL usa la imagen oficial 17.11 Alpine.

Compose inicia la aplicación cuando PostgreSQL responde por TCP. La inicialización de la imagen se hace antes de habilitar ese listener. La comprobación HTTP de la aplicación usa su propio rol para consultar el catálogo real. [Orden de arranque en Compose](https://docs.docker.com/compose/how-tos/startup-order/)

## Red, exposición y permisos

- La red bridge del proyecto permite resolver `db` por nombre y usar TCP 5432 entre los contenedores. PostgreSQL carece de mapeo de puertos hacia el anfitrión.
- La app escucha en 3000 dentro del contenedor. Compose publica el acceso en la interfaz de loopback del anfitrión. En otro equipo se usa el navegador de ese equipo con su propio `127.0.0.1`. Desde una estación con acceso SSH autorizado al anfitrión remoto, un túnel como `ssh -L 8080:127.0.0.1:8080 usuario@equipo` permite abrir la interfaz sin publicar la base ni cambiar el enlace de loopback.
- La app corre como el usuario Linux `node` y recibe solo la contraseña de `finanzas_app`. Ese rol puede consultar categorías, consultar e insertar movimientos y usar la secuencia de movimientos. El administrador de PostgreSQL inicializa el esquema y ejecuta el respaldo y la recuperación.
- El volumen se monta en `/var/lib/postgresql/data` para PostgreSQL 17. Al mover el proyecto a otro motor, se importa un respaldo lógico. [Imagen oficial de PostgreSQL y PGDATA](https://github.com/docker-library/docs/blob/master/postgres/content.md#pgdata)
- `.env` y los respaldos quedan excluidos del repositorio. El archivo de configuración de ejemplo usa contraseñas ficticias. El alcance es de un usuario local. Otros procesos de ese mismo equipo pueden acceder al puerto web. Un uso compartido requeriría autenticación y TLS. Quien administra el motor Docker puede inspeccionar sus contenedores.

## Modelo de datos

| Tabla | Columnas principales | Integridad |
| --- | --- | --- |
| `categorias` | ID, nombre, tipo | Nombre único por tipo |
| `movimientos` | ID, tipo, categoría, fecha, monto, descripción | Clave foránea compuesta por categoría y tipo, monto positivo, fecha entre 1900 y 2099 |

PostgreSQL almacena dinero en `numeric(12,2)` y suma los importes con precisión decimal. Los importes salen de la API como cadenas decimales. El frontend convierte a un número de punto flotante únicamente para calcular proporciones gráficas. Las fechas son días calendario y los extremos del filtro están incluidos. El balance resta los gastos a los ingresos. El reporte mensual toma solo los movimientos incluidos y presenta los meses vacíos con totales cero.

## API

| Método y ruta | Resultado |
| --- | --- |
| `GET /api/salud` | Estado de la lectura de PostgreSQL |
| `GET /api/categorias` | Categorías y su tipo |
| `GET /api/movimientos?desde=…&hasta=…&pagina=1` | Hasta 20 movimientos por página, ordenados de más reciente a más antiguo |
| `POST /api/movimientos` | Alta validada, estado 201 |
| `GET /api/reportes?desde=…&hasta=…` | Objetos `balance` y arreglos `categorias` y `mensual` |

En las rutas de consulta, `desde` y `hasta` van en formato `AAAA-MM-DD`. En el alta, el JSON lleva `tipo`, `categoriaId`, `fecha`, `monto` y `descripcion`. El monto debe ser una cadena positiva con hasta dos decimales y la descripción admite hasta 120 caracteres. Las entradas inválidas devuelven un objeto con `error`. Las consultas parametrizan los valores recibidos. [Consultas parametrizadas en node-postgres](https://node-postgres.com/features/queries)
