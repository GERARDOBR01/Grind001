#!/usr/bin/env bash
# Prueba de humo del APK en un emulador Android: instala, abre y revisa que
# la app siga viva, que la interfaz se haya dibujado y que no haya errores de JavaScript.
set -u
APK=${1:-Serie.apk}; OUT=${2:-emulador}; PKG=mx.serie.app
mkdir -p "$OUT"
adb wait-for-device
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity
sleep 30                                   # primer arranque: WebView + datos de ejemplo
adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png "$OUT/inicio.png"
adb logcat -d > "$OUT/logcat.txt"
fail=0
if ! adb shell pidof $PKG >/dev/null; then echo "✗ la app no está corriendo (se cerró)"; fail=1; else echo "✓ la app sigue abierta"; fi
if grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG" "$OUT/logcat.txt"; then echo "✗ la app tronó"; fail=1; else echo "✓ sin cierres inesperados"; fi
if grep -E "Capacitor/Console.*(Uncaught|Error|error)|E Capacitor/Console" "$OUT/logcat.txt"; then echo "✗ errores de JavaScript"; fail=1; else echo "✓ sin errores de JavaScript"; fi
# la app escribe «serie:listo <pestañas>» en la consola al terminar de dibujar (js/boot.js);
# capacitor.config.json usa loggingBehavior=production para que la consola llegue al logcat también en release
if grep -E "serie:listo .*Comida.*Movilidad" "$OUT/logcat.txt"; then echo "✓ la interfaz se dibujó con sus pestañas"; else echo "✗ la interfaz no terminó de dibujarse"; fail=1; fi
exit $fail
