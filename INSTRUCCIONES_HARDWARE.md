# Instructivo de Integración Completa — Rover XTART-01 🚀

¡Hola equipo de Hardware!

Este documento describe **cómo montar, cablear y programar** los dos microcontroladores del Rover (ESP32 DEVKIT + ESP32-CAM) junto con todos los sensores y periféricos del kit.

---

## 📦 Inventario de Componentes Utilizados

| # | Componente | Función en el Rover |
|---|-----------|-------------------|
| 1 | ESP32 DEVKIT | Controlador principal (motores, sensores, web) |
| 2 | ESP32-CAM OV3660 | Módulo de vídeo independiente (streaming MJPEG) |
| 3 | Programador ESP32-CAM | Base para programar el módulo de cámara |
| 4 | L298N (motores DC) | Conducción diferencial (tanque) |
| 5 | DHT11 | Sensor de temperatura y humedad |
| 6 | BMP180 GY-68 | Presión barométrica y altitud (I2C) |
| 7 | TEMT6000 | Sensor de luz ambiental (analógico) |
| 8 | TCS34725 | Detección de color RGB (I2C) |
| 9 | HC-SR04 | Distancia ultrasónica (anticolisión) |
| 10 | KY-033 (TCRT5000) | Sensor infrarrojo sigue-líneas |
| 11 | OLED SSD1306 0.96" | Pantalla de telemetría a bordo (I2C) |
| 12 | TMB12A03 | Zumbador activo (alarma de proximidad) |
| 13 | LED RGB 10mm | Indicador visual de estado |
| 14 | Protoboard MB-400 | Placa de conexiones |
| 15 | Cables Dupont | Conexionado general |
| 16 | LEDs, pulsadores, interruptor | Elementos auxiliares |

---

## 🔌 Mapa de Pines — ESP32 DEVKIT (Principal)

### Bus I2C (compartido — 3 dispositivos)
| Pin ESP32 | Señal | Dispositivos |
|-----------|-------|-------------|
| GPIO 21 | SDA | OLED (0x3C) + BMP180 (0x77) + TCS34725 (0x29) |
| GPIO 22 | SCL | OLED (0x3C) + BMP180 (0x77) + TCS34725 (0x29) |

### Motores (L298N)
| Pin ESP32 | Pin L298N | Motor |
|-----------|-----------|-------|
| GPIO 14 | IN1 | Izquierdo — señal A |
| GPIO 12 | IN2 | Izquierdo — señal B |
| GPIO 27 | IN3 | Derecho — señal A |
| GPIO 26 | IN4 | Derecho — señal B |

### Sensores (Entradas)
| Pin ESP32 | Componente | Tipo de señal |
|-----------|-----------|--------------|
| GPIO 32 | DHT11 (DATA) | Digital |
| GPIO 33 | TEMT6000 (OUT) | Analógico (ADC) |
| GPIO 25 | HC-SR04 (TRIG) | Digital — Salida |
| GPIO 34 | HC-SR04 (ECHO) | Digital — Entrada (input-only) |
| GPIO 35 | KY-033 (DO) | Digital — Entrada (input-only) |

### HMI — Salidas
| Pin ESP32 | Componente | Tipo de señal |
|-----------|-----------|--------------|
| GPIO 2 | TMB12A03 Buzzer | Digital (HIGH = suena) |
| GPIO 16 | LED RGB — Rojo | PWM (LEDC) |
| GPIO 17 | LED RGB — Verde | PWM (LEDC) |
| GPIO 4 | LED RGB — Azul | PWM (LEDC) |

---

## 📡 Arquitectura de Red — Dos ESP32 cooperando

```
┌────────────────────┐        ┌───────────────────────┐
│   ESP32 DEVKIT     │  WiFi  │    ESP32-CAM OV3660    │
│   (Controlador)    │  AP ◄──│    (Cámara)            │
│                    │        │                        │
│   IP: 192.168.4.1  │        │   IP: 192.168.4.2      │
│   Sirve: Web + API │        │   Sirve: /stream MJPEG │
└────────────────────┘        └───────────────────────┘
         ▲                              ▲
         │           WiFi               │
         └──────── Móvil/PC ────────────┘
                  (Navegador)
```

- El **ESP32 DEVKIT** crea la red WiFi `ROVER_XTART_01` (modo AP).
- El **ESP32-CAM** se conecta a esa red como cliente.
- El navegador del piloto se conecta a la misma red y accede a `192.168.4.1` para la interfaz y a `192.168.4.2/stream` para el vídeo.

---

## 🛠 Paso a Paso — Programación

### Paso 1: Descargar Chart.js

1. Descarguen desde: https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js
2. Renómbrenlo a **`chart.min.js`**.
3. Ya debe estar en la carpeta `data/` junto al resto de archivos web.

### Paso 2: Subir archivos web al ESP32 DEVKIT

La carpeta `data/` debe contener **exactamente 4 archivos**:

```
data/
├── index.html
├── style.css
├── main.js
└── chart.min.js
```

Usad la herramienta **"ESP32 Sketch Data Upload"** en el Arduino IDE para subir estos archivos a la memoria SPIFFS del ESP32 DEVKIT.

### Paso 3: Programar el ESP32 DEVKIT

1. Abrid el archivo `rover_xtart_01.ino` en el Arduino IDE.
2. Seleccionad la placa **"ESP32 Dev Module"**.
3. Compilar y subir.

### Paso 4: Programar el ESP32-CAM

1. Conectad el ESP32-CAM a la base programadora.
2. Abrid el archivo `esp32cam_stream.ino` en el Arduino IDE.
3. Seleccionad la placa **"AI Thinker ESP32-CAM"**.
4. Compilar y subir.
5. Desconectad de la base y alimentad el módulo.

---

## 🌐 Endpoints del Servidor Web

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/` | GET | Página principal (index.html) |
| `/style.css` | GET | Hoja de estilos |
| `/main.js` | GET | Lógica del frontend |
| `/chart.min.js` | GET | Librería de gráficas |
| `/move?dir=FORWARD` | GET | Motores: FORWARD, BACKWARD, LEFT, RIGHT, STOP |
| `/telemetry` | GET | JSON: temp, hum, pres, alt, light, dist, bat, cr, cg, cb, clux, line |
| `/oled?msg=texto` | GET | Envía mensaje a la pantalla OLED |
| `/pantilt?dir=UP` | GET | Servo cámara: UP, DOWN, LEFT, RIGHT, CENTER |
| `/qrlog` | GET | Códigos QR detectados (placeholder) |
| `/buzzer?mode=rapid` | GET | Zumbador: off, slow, rapid, on |
| `/led?r=255&g=0&b=0` | GET | LED RGB: valores 0-255 por canal |
| `/led?mode=auto` | GET | LED RGB: vuelve a modo automático por proximidad |

---

## ⚠️ AVISO CRÍTICO: MOCK MODE

Antes de probar en el robot real, **abrid `data/main.js`** y cambiad:

```javascript
const MOCK_MODE = true;   // ← Modo simulador (para desarrollo sin robot)
```

**a:**

```javascript
const MOCK_MODE = false;  // ← Modo producción (envía comandos reales al ESP32)
```

---

## 📚 Librerías Arduino Necesarias

### Para el ESP32 DEVKIT (rover_xtart_01.ino):
- **ESPAsyncWebServer** (me-no-dev)
- **AsyncTCP** (me-no-dev)
- **DHT sensor library** (Adafruit)
- **Adafruit Unified Sensor**
- **ArduinoJson** (Benoît Blanchon)
- **Adafruit BMP085 Library** (compatible con BMP180)
- **Adafruit TCS34725**
- **Adafruit SSD1306**
- **Adafruit GFX Library**

### Para el ESP32-CAM (esp32cam_stream.ino):
- Incluida con el board package "ESP32 by Espressif" (no se necesitan librerías extra).

---

## 🎮 Funcionalidades Automáticas del Firmware

### Sistema de Alerta por Proximidad (HC-SR04)
- **> 30 cm**: LED azul tenue, buzzer silencioso.
- **15–30 cm**: LED naranja, buzzer rápido (beep-beep).
- **< 15 cm**: LED rojo fijo, buzzer continuo, **frenado automático** en la web.

> El piloto puede tomar control manual del buzzer y LED desde la sección "SYSTEMS" de la interfaz. Pulsar "⚙️ AUTO" devuelve el control al sistema automático.

### Analizador de Superficie (TCS34725)
Clasifica el color del suelo bajo el sensor en categorías temáticas de exploración:
- 🔴 **Rojo dominante** → Suelo Volcánico
- 🟢 **Verde dominante** → Radiación Detectada
- 🔵 **Azul dominante** → Depósito de Agua
- ⚪ **Neutro** → Terreno Seguro
- ⚫ **Oscuro** → Sin datos

### Pantalla OLED SSD1306
Muestra en tiempo real:
- Temperatura + humedad (línea 2)
- Distancia + alerta si < 15 cm (línea 3)
- Presión + luz (línea 4)
- Último mensaje recibido desde la bitácora web (línea 5)

### Sensores Desconectados
Si un sensor I2C no se detecta al arrancar, el firmware lo marca como "NO DETECTADO" en el monitor serie y continúa sin él. **El rover funciona siempre**, aunque tenga menos datos disponibles.

---

¡Cualquier duda nos avisan! Éxito con el ensamblaje. 🤖
