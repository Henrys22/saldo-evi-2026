# Evidencia de despliegue · Saldo

Pruebas ejecutadas por Codex el 14 de noviembre de 2026 en Windows con Ubuntu 20.04 sobre WSL 2. Docker Engine 28.5.2 y Docker Compose v2.40.3. Los contenedores ejecutaron Node.js 24.21.0 y PostgreSQL 17.11. Se usaron movimientos ficticios.

## Docker Compose

El [registro de terminal](evidencia/compose.txt) corresponde a `bash scripts/verificar-compose.sh`. La prueba se ejecutó con dos proyectos Compose y dos volúmenes separados en el mismo equipo.

| Comprobación | Esperado | Observado | Conclusión |
| --- | --- | --- | --- |
| Construcción y arranque | Los dos servicios quedan saludables y responden el frontend y la API. | Ambos saludables. La API consultó PostgreSQL. Solo el puerto web quedó publicado en loopback. | El despliegue arranca con la configuración de ejemplo. |
| Alta y reportes | Una base nueva está vacía. Siete altas válidas producen los tres reportes esperados. | Se rechazaron fecha imposible, monto negativo o con tres decimales, categoría incompatible y rango invertido. Las siete altas válidas coincidieron con los resultados esperados. | El backend valida la carga y calcula con precisión de centavos. |
| Persistencia | Cambian los IDs de los contenedores y se conservan datos y totales. | Tras `down` y `up`, cambiaron los IDs y coincidieron las siete filas y los tres reportes. | El volumen conserva el estado al recrear los contenedores. |
| Recuperación | El destino vacío recupera las filas, categorías y secuencia desde el respaldo. | Se comprobó que el destino tenía cero movimientos. Después de restaurar, coincidieron las siete filas y los reportes. La siguiente alta obtuvo el ID 8. | El respaldo permite continuar el trabajo en un volumen independiente. |

Para septiembre a noviembre de 2026, el saldo observado fue **ARS 722.479,30** sobre ingresos de ARS 1.030.000,30 y gastos de ARS 307.521,00. La prueba también comparó el desglose por categoría, el mes vacío de septiembre y el saldo negativo de noviembre.

El respaldo comprimido pesó 7.439 bytes. La restauración y verificación tardaron 2 segundos, medidos con resolución de un segundo, con el entorno destino ya arrancado. El registro incluye el SHA-256 del archivo de esa ejecución. Una copia lógica cubre el estado de la base al respaldarla. Una copia programada con una verificación periódica de restauración reduciría el intervalo de datos expuestos a una pérdida.

## Navegador

En Edge se cargó un gasto de ARS 1.250,25 y un ingreso de ARS 1.300,00. El saldo esperado para ese mes era ARS 49,75. Se observó el mismo saldo y las dos filas siguieron visibles después de recargar y seleccionar el período. También se comprobó el selector de categoría, la tabla de evolución mensual y la vista móvil de 390 px con los importes visibles.

- [Panel con tres reportes y siete movimientos](evidencia/panel.png)
- [Formulario de alta](evidencia/alta.png)
- [Vista móvil](evidencia/panel-movil.png)

## Transferencia

Una segunda persona puede clonar el repositorio en el equipo de laboratorio, seguir el [arranque del README](../README.md#arranque) y ejecutar `bash scripts/verificar-compose.sh`. Para demostrar la transferencia de datos entre equipos, copiá un respaldo de prueba desde el origen y restauralo siguiendo el [procedimiento documentado](../README.md#respaldo-y-recuperación). Registrá quién hizo la prueba, qué equipo y versiones usó, el resultado esperado, el resultado observado, los ajustes y el enlace a la evidencia.

La ejecución en otro equipo y la prueba propia de cada integrante quedan pendientes de registrar.
