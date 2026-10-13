# Análisis de referencia: apps tipo *gym log*

Objetivo: entender cómo funciona una app de registro de entrenamiento de referencia
(Hevy, Android, `com.hevy`) y construir **nuestra propia versión** con el estilo de este repo.

## 1. Herramienta: REA

[REA — Reverse Engineer Anything](https://github.com/morluto/rea) es un servidor MCP + CLI que
le da a un agente herramientas para inspeccionar binarios, APKs, apps JavaScript/Electron,
sitios web y capturas de red, y devuelve hallazgos *con evidencia*. Para una app Android, sus
rutas relevantes son:

| Ruta de REA | Requiere | Estado en esta sesión |
|---|---|---|
| Android APK (manifest, clases, métodos descompilados) | el `.apk` + JADX + JDK | **No disponible**: los espejos de APK (APKPure, APKMirror) están bloqueados por la red del entorno y no hay acceso al teléfono. |
| Android devices (adb) | `adb` con el teléfono conectado | **No disponible**: el entorno corre en la nube, no ve el celular. |
| Websites (estructura, scripts, red) | navegador Chrome | Posible, pero la app web de referencia requiere cuenta. |
| Capturas de red (HAR / mitmproxy) | una captura hecha por ti | Pendiente: requiere capturar desde tu dispositivo. |

Además, el entorno no autorizó ejecutar el paquete `rea-agents` descargado de npm. Por eso el
análisis se hizo con **fuentes públicas**, que para el objetivo (reproducir comportamiento, no
copiar código) resultaron suficientes:

1. La **API pública** de la app (`api.hevyapp.com/docs`, especificación OpenAPI): expone el modelo
   de datos completo de entrenos, rutinas, ejercicios y medidas.
2. La **lista de funciones** publicada en su sitio y la ficha de Google Play.

### Corrida de REA sobre el APK subido

Se instaló `rea-agents` 6.4.0 con el motor `jadx-headless-mcp` 0.7.1; su SHA-256
(`6e5eacf5…ff75`) coincide con el que REA audita. Resultado de `rea inspect-android-package`:

| Campo | Valor |
|---|---|
| `package_name` | `com.uptodown` (no `com.hevy`) |
| `version_name` | 7.40 |
| Clases | 13,958; `search-android-classes hevy` → **0 coincidencias** |
| Actividad principal | `com.uptodown.activities.MainActivity` |

El archivo `uptodown-com.hevy.apk` es el **instalador de la tienda Uptodown**, no Hevy. Para
analizar Hevy hace falta extraer el APK del teléfono (p. ej. con ML Manager) o bajarlo de APKMirror
verificando que el desarrollador sea Hevy Studios S.L.

### Cómo correr REA tú mismo (opcional)

Si quieres profundizar en implementación nativa, desde tu computadora con el teléfono por USB:

```bash
npx rea-agents setup            # registra REA en tu agente
adb shell pm path com.hevy      # ubica el APK instalado
adb pull <ruta>/base.apk hevy.apk
```

Y pídele al agente: *“Con REA, analiza hevy.apk: ¿cómo calcula el 1RM y cómo decide qué serie
muestra en ‘anterior’?”*. Úsalo para entender, no para copiar: el código, textos e imágenes de una
app comercial tienen derechos de autor.

## 2. Modelo de datos (de la API pública)

| Entidad de referencia | Campos clave | En *Serie* |
|---|---|---|
| `Set.type` | `warmup`, `normal`, `failure`, `dropset` | `t`: `w`, `n`, `f`, `d` |
| `Set` | `weight_kg`, `reps`, `distance_meters`, `duration_seconds`, `rpe` (6–10) | `kg`, `reps`, `km`, `secs`, `rpe` (mismos valores) |
| `Exercise` | `exercise_template_id`, `superset_id`, `notes`, `sets[]` | `id`, `ss`, `notes`, `sets[]`, más `rest` |
| `Routine` exercise | `rest_seconds`, `sets[]` con `rep_range` | `rest`, `sets[]` como objetivo (`ph`); `rr: [min, max]` al escribir «8-12» |
| `ExerciseTemplate.type` | `weight_reps`, `bodyweight_reps`, `reps_only`, `duration`, `distance_duration`, … | `wr`, `bw`, `r`, `d`, `cd` |
| `primary_muscle_group` / `secondary_muscle_groups` | 20 grupos | `m` / `sec`, mismas claves en inglés, etiquetas en español |
| `equipment` | `barbell`, `dumbbell`, `machine`, … | `eq` (agregamos `cable` = polea) |
| `Workout` | `title`, `description`, `start_time`, `end_time`, `routine_id` | `title`, `desc`, `start`, `end`, `routineId` |
| `BodyMeasurement` | `date`, `weight_kg`, medidas en cm | `body[]` con peso (medidas: pendiente) |
| Usuario | `weight_unit: kg | lbs` | `units`; internamente todo en kg |

Mantener las mismas claves de músculo y la misma semántica permite, a futuro, importar o
sincronizar con esa API sin cambiar el modelo.

## 3. Comportamiento reproducido

Lista de funciones de referencia → decisión en *Serie*:

| Función | Implementación |
|---|---|
| Registro intuitivo, empezar vacío o desde rutina | Vistas `workout` y `train`. |
| Valores de la vez anterior | `prevFor()`: empata calentamientos con calentamientos y efectivas con efectivas, por orden. Tocar la columna copia los valores. |
| Marcar serie con campos vacíos | Toma el objetivo de la rutina o lo anterior (lo que se ve en gris). |
| Tipos de serie | Hoja al tocar el número de serie. |
| Temporizador de descanso automático | Por ejercicio; sonido (WebAudio) y vibración. |
| Notificación de récord en vivo | Compara contra el historial y contra las series previas del mismo entreno. |
| Calcular 1RM | Epley `peso × (1 + reps/30)`, con las reps acotadas a 12. |
| Gráficas por ejercicio, récords, historial | Vista `ex`. |
| Calentamiento y calculadora de discos | Menú `⋯` del ejercicio. |
| Superseries | Menú `⋯` → “Superserie con el siguiente”. |
| Ejercicios personalizados | Botón “Crear” en la biblioteca. |
| Series por músculo, constancia, racha | Vista `me`. |
| Medidas corporales | Peso corporal con tendencia. |

**Fuera de alcance** (requieren cuenta, servidor o un dispositivo): feed social, seguidores,
comentarios, reloj inteligente, videos de ejercicios, Strava, coach. **Pendientes razonables** para
una siguiente iteración: carpetas de rutinas, fotos de
progreso, medidas en cm, reordenar arrastrando. (RPE, rangos de reps y reemplazar ejercicio ya están.)
