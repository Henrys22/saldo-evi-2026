# Bitácora · Saldo · EVI 2026

Codex elaboró las propuestas y ejecutó las pruebas técnicas registradas. Cada integrante debe identificar la decisión que revisó y registrar su propia comprobación antes de entregar esta bitácora.

## 1. Publicar solo la aplicación

**Autoría del integrante** ____ · **Herramienta** Codex

**Consulta y respuesta.** Cómo implementar un frontend, un backend y PostgreSQL con Docker Compose para el TP. Codex propuso servir el frontend y la API desde Express y conectar la aplicación con PostgreSQL por una red bridge.

**Decisión técnica.** Se adoptó un único puerto en loopback para simplificar la apertura desde el navegador. La app usa un rol de PostgreSQL con permisos de lectura y alta.

**Prueba técnica.** Se esperaba consultar salud, cargar movimientos en el navegador y ver solo el puerto HTTP publicado. Compose informó ambos servicios saludables, PostgreSQL figuró con 5432 interno y Edge guardó un ingreso y un gasto. La interfaz funciona con una sola entrada desde el anfitrión. [Evidencia](evidencias.md#navegador)

## 2. Recuperar datos con un respaldo lógico

**Autoría del integrante** ____ · **Herramienta** Codex

**Consulta y respuesta.** Cómo comprobar persistencia y recuperación al trasladar el proyecto. Codex propuso un volumen nombrado para recreaciones y `pg_dump`/`pg_restore` para copiar la base.

**Decisión técnica.** Se adoptaron ambos mecanismos. El volumen conserva el estado local y el respaldo lógico permite importar los mismos datos en otro entorno.

**Prueba técnica.** Se esperaban siete filas idénticas, el mismo saldo y una nueva alta después de restaurar. El destino empezó vacío, devolvió las siete filas y un saldo de ARS 722.479,30, y la nueva alta recibió el ID 8. La copia permite continuar la carga en el destino. [Evidencia](evidencias.md#docker-compose)
