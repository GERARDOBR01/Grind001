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

---

# Parte 2: nutrición (tipo MacroFactor) y movilidad (tipo Pliability)

Los dos APK llegaron en `Internal storage.zip` (Drive). Mismo criterio que con la app de gym:
**se documenta el comportamiento y se reimplementa; no se copia código, textos, imágenes, videos,
bases de datos ni marca.**

## 5. Herramientas

| Paso | Herramienta | Resultado |
|---|---|---|
| Manifiesto de cada APK | `rea inspect-android-package` (REA 6.4.0 + `jadx-headless-mcp` 0.7.1, SHA-256 `6e5eacf5…ff75` verificado contra el que REA audita) | OK en ambos |
| Inventario de clases | `rea search-android-classes` | Falla en Pliability: *“JADX class inventory is duplicated”* (clases repetidas entre `classes*.dex`). REA se niega a dar un inventario que no cuadra. |
| Decompilado | JADX 1.5.3 directo (el mismo motor) | 24,176 clases; la lógica de la app (`com.romwod.*`, `com.business.*`, `com.common.*`) es legible |

| Campo | MacroFactor | Pliability |
|---|---|---|
| `package_name` | `com.sbs.diet` | `com.romwodllc.android` |
| Versión | 5.8.9 (879) | 4.18.0 (357) |
| SDK mín. / objetivo | 32 / 36 | 25 / 36 |
| Tecnología | **Flutter** (Dart compilado AOT) | **Kotlin + Jetpack Compose**, MediaPipe Pose Landmarker |

## 6. MacroFactor: qué se pudo y qué no

El archivo es solo el **APK base** de un *split APK*: el manifiesto declara
`requiredSplitTypes="base__abi"` y no hay ningún `lib/*.so`. La lógica de Flutter vive en
`libapp.so`, que viene en el split `split_config.arm64_v8a.apk`, **que no estaba en el zip**. Sin ese
archivo no hay código Dart que leer. (Para la próxima: exportar la app con *SAI* o *APK Extractor*
como `.apks`/`.xapk`, que incluye todos los splits).

Lo que sí trae el APK base: los recursos de Flutter (`assets/flutter_assets`): ilustraciones de
alimentos, un catálogo de ejercicios propio, siluetas de % de grasa corporal, un minijuego. Nada de
eso se usa (es contenido de ellos).

Por eso el módulo **Comida** implementa el método que MacroFactor explica públicamente (artículos
de su equipo sobre cómo estiman el gasto), con fórmulas propias:

| Pieza | Implementación en esta app |
|---|---|
| **Peso de tendencia** | Media móvil exponencial diaria, α = 0.1; los días sin pesaje se interpolan linealmente. |
| **Gasto estimado (TDEE) inicial** | Mifflin-St Jeor × factor de actividad (1.2 a 1.9). |
| **Gasto adaptativo** | Ventana de hasta 28 días: `promedio de kcal registradas − pendiente del peso × 7700 kcal/kg`, con la pendiente (kg/día) por mínimos cuadrados sobre los pesajes de la ventana (no tiene el retraso de la media móvil). Solo cuenta días con comida registrada; exige ≥ 7 días registrados y ≥ 4 pesajes que abarquen ≥ 6 días. Se mezcla con el valor anterior según la cantidad de datos y el cambio se limita a ±150 kcal por día de cálculo, para que no salte por un día raro. |
| **Check-in semanal** | Meta de kcal = gasto − (ritmo objetivo en kg/semana × 7700 / 7). Ritmo de −1 % a +0.5 % del peso por semana. Piso de seguridad: 1200 kcal (mujer) / 1500 kcal (hombre). |
| **Macros** | Proteína 1.6–2.2 g/kg (según objetivo), grasa ≥ 25 % de kcal, carbohidratos el resto. Editable. |
| **Alimentos** | Base propia de alimentos comunes (valores por 100 g de tablas públicas), alimentos y recetas personalizados y escáner de código de barras contra Open Food Facts (la única conexión a internet, y solo cuando escaneas). |

## 7. Pliability: el test de movilidad sí se calcula en el teléfono

Las rutinas y sus videos vienen del servidor (no hay nada que reproducir sin su contenido). Lo
interesante es el **test de movilidad**: corre MediaPipe Pose (`assets/mobility_pose_landmarker.task`)
sobre la cámara y **calcula el puntaje localmente** (`com.business.mobility.assessment`).

**Protocolo** (`MobilityAssessmentEngine`): 2 movimientos × 3 vistas = 6 tomas.

| Movimiento | Vistas | Instrucción |
|---|---|---|
| Brazos arriba (*flexion*) | frente, lado izq., lado der. | De pie, brazos estirados sobre la cabeza |
| Sentadilla con brazos arriba (*squat*) | frente, lado izq., lado der. | Bajar lo más profundo cómodo y sostener |

Cada toma necesita sostener la postura ~5–9 s con el cuerpo completo en cuadro (largo del cuerpo
entre 40 % y 100 % del alto de la imagen). Las medidas se promedian sobre los cuadros válidos.

**Medidas** (`PoseMeasurements`): ángulos de 3 puntos (hombro, codo, cabeza, cadera, rodilla, tobillo
respecto a la vertical, escápula), anchos normalizados (rodillas/tobillos, tobillos/cadera) y
corrimientos de cadera y hombro, corregidos por la inclinación del teléfono.

**Compensaciones** (`MobilityAssessmentScorer`, revisión 1.3), cada una de 0 a 1:

| Compensación | Regla (resumen) |
|---|---|
| Cabeza inclinada | ángulo cabeza fuera de [140°, 172°] en sentadilla ([145°, 165°] brazos arriba), 10° = 1 |
| Hombros encogidos | ángulo escapular / 50° |
| Codos doblados | (170° − ángulo de codo) / 45° |
| Espalda arqueada | diferencia corrimiento cadera vs hombro / 4.5° |
| Brazos caen al frente | (180° − ángulo de hombro) / 55° |
| Arco colapsado | rodillas/tobillos < 0.95 |
| Rodillas hacia dentro (valgo) | (90° − ángulo rodilla-tobillo) / 18° |
| Rodillas hacia fuera (varo) | (75° − ángulo) / 30° |
| Peso cargado a un lado | centro corrido > 20 % del ancho de cadera |
| Inclinación al frente | tobillo + cadera − rodilla < 50° |
| Cadera sobre paralelo | profundidad de la sentadilla respecto a 90° |
| Talones levantados | ángulo de tobillo < 65° y relación tobillo/cadera > 1.35 |

**Puntaje por articulación** = `1 − (suma de compensaciones que le afectan / cuántas son)`,
para espalda, hombros, codos, caderas, rodillas y tobillos (izq./der.). Valgo y varo se excluyen
mutuamente. Puntaje general = promedio de *brazos arriba* y *sentadilla*. Las zonas a trabajar
(“tags”) salen de las compensaciones de la articulación con menor puntaje.

En esta app se reimplementó este flujo con **MediaPipe Tasks Vision para web** (el modelo oficial
de Google, licencia Apache 2.0, descargado de Google, no del APK), con código y umbrales propios
basados en esta descripción. Las rutinas de movilidad son propias: posturas con ilustración SVG,
instrucciones escritas y temporizador guiado.
