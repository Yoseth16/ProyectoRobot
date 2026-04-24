# 🚀 Guía de Inicio Rápido: Rover XTART-01

¡Bienvenido a bordo! Si ya has ensamblado el hardware según las instrucciones en [INSTRUCCIONES_HARDWARE.md](INSTRUCCIONES_HARDWARE.md), sigue estos pasos para subir el código y comenzar a operar tu Rover XTART-01.

---

## 🛠️ 1. Preparación del Entorno

Necesitas preparar el IDE de Arduino para poder subir el código al Rover.

1. **Instala el IDE de Arduino** si no lo tienes (versión 1.8.x o la 2.x).
2. **Instala el soporte para placas ESP32:**
   * Ve a *Archivo > Preferencias*.
   * En "Gestor de URLs Adicionales de Tarjetas", pega: `https://dl.espressif.com/dl/package_esp32_index.json`
   * Ve a *Herramientas > Placa > Gestor de Tarjetas*, busca `esp32` (por Espressif Systems) e instálalo.
3. **Instala las Librerías Necesarias:** 
   Ve a *Programa > Incluir Librería > Administrar Bibliotecas...* y busca/instala:
   * `ESPAsyncWebServer` y `AsyncTCP` (Es posible que debas descargarlas en .zip desde GitHub, de me-no-dev).
   * `ArduinoJson`
   * `Adafruit Unified Sensor`
   * `DHT sensor library` (por Adafruit)
   * `Adafruit BMP085 Library`
   * `Adafruit TCS34725`
   * `Adafruit GFX Library`
   * `Adafruit SSD1306`

---

## 💾 2. Subir Archivos del Servidor Web (Memoria SPIFFS)

El Rover sirve su propia página web (los archivos de las carpetas `data/`, `css/`, `js/`). ¡No necesitas internet para controlarlo! Pero hay que subir estos archivos a la memoria de la placa.

**Si usas Arduino IDE 2.x (Recomendado):**
Actualmente existe soporte para subir archivos en la versión 2.x, pero requiere un pequeño paso extra.
1. Descarga el plugin [arduino-esp32fs-plugin](https://github.com/earlephilhower/arduino-esp8266littlefs-plugin/releases) (o las extensiones comunitarias compatibles para IDE 2.x, búscalo como *FS plugin for Arduino 2.x*). 
2. Coloca la carpeta del plugin en tu directorio de `plugins` de Arduino (por ejemplo, en `~/.arduinoIDE/plugins/`).
3. Reinicia tu Arduino IDE 2.x. 
4. Presiona `Ctrl+Shift+P` y busca el comando **"Upload SPIFFS"** o usa la opción correspondiente en el menú *Herramientas*.

> **💡 Consejo (Plan B):** Si el plugin para la versión 2.x te da problemas, lo más rápido y seguro es descargar la versión [Arduino IDE 1.8.19 (ZIP / Portable)](https://www.arduino.cc/en/software) **sólo para realizar este paso**. Puedes tener ambas versiones instaladas sin conflicto. En la 1.8.x funciona mediante la opción **Herramientas > ESP32 Sketch Data Upload**.

Asegúrate de:
* Tener los archivos correctamente organizados dentro de la carpeta `data/` del proyecto.
* Conectar el **ESP32 Principal** por USB y cerrar las ventanas del Monitor Serie antes de subir.

---

## 💻 3. Subir el Firmware al ESP32 Principal

1. Abre el archivo principal [rover_xtart_01.ino](rover_xtart_01.ino) en el IDE de Arduino.
2. Asegúrate de tener conectada la placa **ESP32 DEVKIT V1**.
3. Revisa la contraseña y el nombre de la red WiFi que el Rover va a crear:
   ```cpp
   const char* ssid     = "ROVER_XTART_01";
   const char* password = "misionapollo";
   ```
4. Presiona **Subir** (Upload).

---

## 📷 4. Subir el Código a la ESP32-CAM

El módulo de cámara funciona como un esclavo que se conecta a la red del robot para enviar la transmisión de vídeo. Se programa por separado.

1. Conecta la **ESP32-CAM** en su base programadora (o usa un módulo FTDI si no tienes la base) por USB.
2. Abre el archivo [esp32cam_stream.ino](esp32cam_stream.ino).
3. En *Herramientas > Placa*, selecciona **"AI Thinker ESP32-CAM"**.
4. Dale a **Subir**.

---

## 🚀 5. Encender y Jugar (Prueba de Vuelo)

Una vez que ambas placas están programadas y montadas en el chasis:

1. **Enciende el Robot** proporcionando energía adecuada (generalmente a través de baterías Li-Po o Li-Ion 18650 que alimenten el L298N y el circuito regulador).
2. **Espera unos segundos**; verás que la pantalla OLED del Rover se ilumina con la información inicial de telemetría y el logo de inicio.
3. Ve a un dispositivo con Wi-Fi (computadora, tablet o smartphone) y **busca nuevas redes Wi-Fi**.
4. Conéctate a la red del robot:
   * **Red (SSID):** `ROVER_XTART_01`
   * **Contraseña:** `misionapollo`
5. Abre el navegador web (Chrome/Safari recomendados) y entra a:
   👉 **http://192.168.4.1**
6. Se abrirá la **Landing Page**. ¡Podrás escribir mensajes para que aparezcan en la pantalla OLED del robot!
7. Para ir a la interfaz de control principal de movimiento, haz click en el acceso correspondiente que verás en esa página. Ahí encontrarás el Joystick, los datos de los sensores, y el Stream de Vídeo que entra directamente desde la IP `192.168.4.2/stream`.

**¡Felicidades piloto! El control es todo tuyo.**
