# AGENTS.md — INGEGAR Platform

Este proyecto usa `CLAUDE.md` (raíz del repo) como archivo canónico de instrucciones para agentes de
IA. Leer ese archivo primero — cubre stack, comandos, arquitectura, estructura y reglas críticas
(`.claude/rules/`).

Este archivo se dejó deliberadamente como puntero, no como copia — un `AGENTS.md` con su propio
contenido duplicado queda desactualizado apenas `CLAUDE.md` cambia (pasó: llegó a describir v1.10
mientras el proyecto ya iba en v1.13). Si alguna herramienta necesita contenido inline acá en vez de
un puntero, actualizar ambos archivos en el mismo commit — nunca dejar que diverjan de nuevo.
