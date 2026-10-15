# PR: feat(editor): handles editables y primitivas paramétricas (línea/círculo)

Este PR añade edición de nodos (handles) para trazos SVG y detección/conversión básica de primitivas (línea y círculo). También incorpora un historial sencillo (undo snapshots), interfaz de edición y la sincronización entre entidades paramétricas y trazos.

## Cambios principales

- `src/components/HandlesEditor.tsx` — componente SVG para handles y arrastre de puntos.
- `src/hooks/useStrokeUtils.ts` — utilidades de procesado de trazos (simplificar, build path, create stroke).
- `src/geometry/detectPrimitives.ts` — detectores heurísticos (fitLine por PCA, fitCircle por Kasa).
- `src/models/primitives.ts` — modelo de entidades paramétricas (line/circle) y conversiones.
- `src/App.tsx` — integración: selección, overlay de handles, botón “Convertir a primitiva”, undo básico, snapshot, UI de edición de parámetros.
- `TODO.md` — backlog actualizado.

## Objetivo

- Permitir editar trazos directamente arrastrando nodos (handles).
- Detectar trazos aproximados a líneas o círculos y convertirlos en entidades paramétricas editables (centro/radio, endpoints).
- Sentar la base para añadir el feature‑tree paramétrico, snapping y la integración con el motor geométrico B‑Rep.

## Checklist (validar antes de merge)

- [ ] `npm install && npm run dev` compila sin errores
- [ ] Dibujar y seleccionar trazos — aparecen handles y se pueden arrastrar
- [ ] “Convertir a primitiva” detecta y reemplaza trazos aproximados a línea/círculo
- [ ] Edición numérica de parámetros (centro/radio/endpoints) actualiza el trazo
- [ ] Undo revierte la última modificación (historial básico)
- [ ] Export STL/glTF/SVG y extrusión funcionan tras la conversión
- [ ] Pruebas en dispositivos: Surface (Chrome/Edge), iPad (Safari) y Android (Chrome)

## Notas técnicas / Limitaciones

- Los detectores son heurísticos; los umbrales están en `src/geometry/detectPrimitives.ts` y pueden ajustarse según trazos reales.
- La conversión de círculos se visualiza como polígono de `N` segmentos para mantener compatibilidad SVG; la entidad paramétrica (centro/radio) es editable y sincroniza el trazo.
- El feature‑tree y la persistencia avanzada quedan para próximas tareas.

## Cómo crear el PR (si no lo haces desde la web)

```bash
# asegurarse en la rama feature/handles-primitives
git checkout feature/handles-primitives
git push origin feature/handles-primitives
# crear PR con GitHub CLI (ajusta reviewers/labels si quieres)
gh pr create --base main --head feature/handles-primitives --title "feat(editor): handles editables y primitivas paramétricas (línea/círculo)" --body-file PR_BODY.md --label enhancement,ui,sketch --reviewer marbat69
```

> También puedes abrir el PR desde el navegador: https://github.com/marbat69/sketch-cad/compare/main...feature/handles-primitives?expand=1

---

Si quieres que proceda a crear issues/milestones para las siguientes tareas (detección arco/rectángulo, feature tree, integración OCC), dime y creo el backlog y milestones en el repo.