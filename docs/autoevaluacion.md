# Autoevaluación · EVI 2026

Revisión técnica preliminar para V1 con la rúbrica 3.1 del TP integrador. Cada integrante debe validar el nivel con su propia evidencia al preparar la entrega. En V2 hay que registrar la devolución de V1 y enlazar la nueva comprobación.

| Criterio | Nivel preliminar V1 | Evidencia y condición de cierre |
| --- | --- | --- |
| Despliegue reproducible | En proceso | [Arranque documentado](../README.md#arranque) y [arranque observado](evidencias.md#docker-compose). Falta que otra persona lo reproduzca en otro equipo con el repositorio y el README. |
| Persistencia y recuperación | Logrado | [Prueba con dos proyectos y volúmenes independientes](evidencias.md#docker-compose), comparación de filas e importes y nueva alta tras restaurar. |
| Red y exposición | Logrado | [Diagrama y justificación](arquitectura.md#red-exposición-y-permisos) y tabla de puertos de los dos servicios en [el registro de Compose](evidencia/compose.txt). |
| Seguridad básica | Logrado | [Configuración ficticia](../.env.example), [archivos excluidos](../.gitignore) y [permisos de aplicación](../db/01-inicio.sql). |
| Evidencias y bitácora | En proceso | [Resultados esperados y observados](evidencias.md) y [dos decisiones](bitacora.md). Falta incorporar autoría y prueba propia de cada integrante. |
| Uso documentado de la IA | En proceso | [Consultas, decisiones y comprobaciones de Codex](bitacora.md). Falta registrar qué aceptó o descartó y cómo lo comprobó cada integrante. |
| Transferencia y defensa | En proceso | [Guía de verificación en otro equipo](evidencias.md#transferencia). Falta el registro de la prueba externa y la demostración de cada integrante. |

## Seguimiento de V2

Para cada criterio, anotá la devolución recibida en V1, el cambio aplicado, el resultado de la prueba y el nivel que justifica la evidencia nueva.

| Criterio | Devolución de V1 | Cambio en V2 | Nivel y evidencia de V2 |
| --- | --- | --- | --- |
| Despliegue reproducible | Pendiente | | |
| Persistencia y recuperación | Pendiente | | |
| Red y exposición | Pendiente | | |
| Seguridad básica | Pendiente | | |
| Evidencias y bitácora | Pendiente | | |
| Uso documentado de la IA | Pendiente | | |
| Transferencia y defensa | Pendiente | | |

## Defensa de 5 a 10 minutos

1. Presentá qué datos registra Saldo y calculá el saldo de dos movimientos desde la interfaz.
2. Usá el diagrama para explicar cómo resuelve Compose el nombre `db`, qué puerto publica y por qué la app usa un rol de permisos limitados.
3. Mostrá el efecto de `down` y `up` sobre los datos. Explicá cómo verificaste un respaldo en un destino con un volumen nuevo y el límite temporal de la copia.
4. Mostrá la prueba en otro equipo y los ajustes hechos. Cada integrante explica una decisión y demuestra su comprobación.
