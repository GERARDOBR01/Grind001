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

### Segunda corrida: el APK real

El APK correcto (`Hevy.apk`, 125 MB, extraído del teléfono y pasado por Drive):

| Campo | Valor |
|---|---|
| `package_name` | **`com.hevy`** |
| `version_name` / `version_code` | 3.1.16 / 3325935 |
| SDK | mín. 24, objetivo 36 |
| Clases Java/Kotlin | 28,701 (9 archivos `classes*.dex`) |
| Lógica de la app | `assets/index.android.bundle`, 22 MB: **React Native con bytecode Hermes v96** |

REA cubre la parte Android (manifiesto, clases), pero no decodifica bytecode Hermes. Para el bundle se
usó [`hermes-dec`](https://github.com/P1sec/hermes-dec) (soporta v96): 60,302 funciones y 139,363
cadenas; los nombres originales de las funciones se conservan, lo que hizo directo ubicar la lógica.
**En este repo no hay código de Hevy**: solo se documenta el comportamiento y se reimplementa.

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
| Calcular 1RM | Tabla porcentual por repeticiones (ver sección 4). |
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

## 4. Hallazgos del APK (comportamiento real) y qué se ajustó

| Tema | Lo que hace la app de referencia | Antes en *Serie* | Ahora |
|---|---|---|---|
| **1RM estimado** | `peso / porcentaje[reps]` con una tabla de 1 a 30 reps (1 = 100 %, 5 = 89 %, 10 = 75 %, 30 = 50 %); más de 30 reps = 50 % | Epley | Tabla porcentual; la tabla de repeticiones máximas usa los mismos porcentajes |
| **Volumen con peso corporal** | En ejercicios marcados como 100 % peso corporal suma tu peso: (lastre + peso) × reps; asistidos: (peso − asistencia) × reps; “solo reps” cuenta peso × reps | Solo lastre | Igual, con el peso corporal registrado más cercano antes de esa fecha |
| **Mancuernas** | Ajuste para contar el peso ×2 en ejercicios con mancuerna de peso y reps | — | Ajuste «Contar doble el peso en mancuernas» |
| **Calentamientos** | No suman volumen y no cuentan para récords | Sí contaban | Excluidos |
| **Récords por tipo** | Peso y reps: peso, 1RM, mejor serie. Peso corporal: peso, mejor serie. Asistido y solo reps: reps. Duración, distancia: los suyos | Similar | Alineado; se agregan tipos *asistido* y *peso y duración* |
| **Columna «Anterior»** | Ajuste: valores de cualquier entreno o de la misma rutina | Cualquiera | Ajuste con las dos opciones |
| **Calculadora de calentamiento** | 40 % × 5, 60 % × 5, 80 % × 3, redondeado a discos o mancuernas | 40 % × 10 | 40 % × 5 |
| **Duración estimada de rutina** | 45 s por serie (o la duración de la serie) + descanso del ejercicio (90 s por defecto), sin descanso tras un drop set | — | Se muestra en cada rutina |
| **Series por músculo** | Principal = 1, secundario = 0.5 | Igual | Sin cambio |
| **Nivel de fuerza** | Percentil ≥ 90 élite, ≥ 70 avanzado, ≥ 40 intermedio | — | No aplica: requiere datos de otros usuarios |
| **Calculadora de discos** | Los discos disponibles vienen del servidor | Lista fija | Sin cambio |
