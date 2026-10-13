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
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb pull /sdcard/ui.xml "$OUT/ui.xml" >/dev/null
adb logcat -d > "$OUT/logcat.txt"
fail=0
if ! adb shell pidof $PKG >/dev/null; then echo "✗ la app no está corriendo (se cerró)"; fail=1; else echo "✓ la app sigue abierta"; fi
if grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG" "$OUT/logcat.txt"; then echo "✗ la app tronó"; fail=1; else echo "✓ sin cierres inesperados"; fi
if grep -E "Capacitor/Console.*(Uncaught|Error|error)|E Capacitor/Console" "$OUT/logcat.txt"; then echo "✗ errores de JavaScript"; fail=1; else echo "✓ sin errores de JavaScript"; fi
if grep -q "Comida" "$OUT/ui.xml" 2>/dev/null && grep -q "Movilidad" "$OUT/ui.xml"; then echo "✓ la interfaz se dibujó (pestañas Comida y Movilidad)"; else echo "✗ no se ve la interfaz"; fail=1; fi
exit $fail
