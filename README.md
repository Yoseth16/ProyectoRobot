# 🚀 ROVER XTART-01

**Rover XTART-01** es un avanzado sistema robótico basado en el ecosistema **ESP32** y **ESP32-CAM**, diseñado para exploración remota, telemetría en tiempo real y navegación autónoma. Cuenta con un sistema de doble interfaz web (Landing Page pública y Mission Control privado) servida de forma embebida desde la memoria SPIFFS del microcontrolador.

---

## ✨ Características Principales

*   🎮 **Telemetría y Control en Tiempo Real:** Dashboard interactivo con joystick virtual (UI) que controla motores de corriente continua usando señales PWM suavizadas.
*   🎥 **Live Video Feed:** Transmisión de video ininterrumpida MJPEG mediante un módulo ESP32-CAM integrado.
*   🤖 **Modo Patrulla Autónoma:** Sistema inteligente con seguidor de líneas infrarrojo (KY-033) y radar anticolisión (HC-SR04) para navegación sin intervención humana.
*   📊 **Centro Meteorológico / Ambiental:** Recopilación y visualización dinámica de datos de temperatura, humedad (DHT11), presión barométrica (BMP180), intensidad lumínica (TEMT6000) y color del terreno (TCS34725).
*   🔐 **Doble Capa de Interfaz (SPA):**
    *   **Pública:** Una *Landing Page* que permite a cualquier usuario enviar mensajes al display OLED (128x64) físico del robot.
    *   **Privada:** Panel de control de acceso restringido con credenciales para los administradores o "pilotos".
*   📼 **Caja Negra (Blackbox):** Registro continuo de eventos (obstáculos, cambios de estado, temperaturas críticas) en formato `.csv` guardado en la memoria flash (SPIFFS).
*   🚨 **Feedbacks HMI:** Respuestas visuales y auditivas a través de un zumbador activo (Buzzer) y un módulo LED RGB integrado.

---

## 🛠️ Arquitectura de Hardware

### Microcontroladores
*   **ESP32 DEVKIT V1** (Cerebro Principal / Servidor Web / Lógica de Motores)
*   **ESP32-CAM OV3660** (Servidor esclavo para Streaming de Video)

### HMI y Comunicación
*   **Pantalla OLED 0.96" Azul (SSD1306)** - Interfaz I2C
*   **Zumbador Activo TMB12A03** (3.3V)
*   **Módulo LED RGB 10mm Arduino**

### Sensores y Entorno
*   **BMP180 (GY-68)** - Presión Atmosférica y Altitud (I2C)
*   **DHT11** - Temperatura y Humedad Relativa
*   **TCS34725** - Sensor de Color RGB (I2C)
*   **TEMT6000** - Fototransistor de luz ambiental (Lux)
*   **HC-SR04** - Sensor Ultrasónico de distancia
*   **KY-033 (TCRT5000)** - Sigue-líneas Infrarrojo

### Motricidad
*   **L298N** (Driver de Motores) conectado a motores DC.

> **Nota de Compatibilidad:** Todos estos componentes están rigurosamente probados e integrados en el código mediante comunicación Analógica, Digital o bus compartido I2C.

---

## 💻 Interfaz Web

El panel de control está construido íntegramente con:
*   **HTML5 & CSS3** puros, empleando un diseño moderno *Glassmorphism* oscuro, aeroespacial y altamente responsivo.
*   **JavaScript (Vanilla):** Maneja la API Fetch hacia los endpoints REST del ESP32 (`/telemetry`, `/move`, `/oled`, `/auto`).
*   Todo el *frontend* se almacena y se sirve directamente desde la partición **SPIFFS** (Sistema de archivos Flash) del ESP32.

---

## ⚙️ Instalación y Uso

### 1. Preparar el entorno Arduino IDE
Asegúrate de tener instalado el soporte para placas ESP32 y las siguientes librerías:
*   `ESPAsyncWebServer` y `AsyncTCP`
*   `Adafruit GFX Library` y `Adafruit SSD1306`
*   `DHT sensor library`
*   `Adafruit BMP085 Library`
*   `Adafruit TCS34725`
*   `ArduinoJson`

### 2. Cargar Interfaz Web (SPIFFS)
Utiliza la herramienta **ESP32 Sketch Data Upload** en Arduino IDE para subir el contenido de la carpeta `/data` (donde están `index.html`, `style.css` y `main.js`) a la memoria flash del ESP32.

### 3. Flashear el Firmware
*   Sube `rover_xtart_01.ino` al ESP32 principal.
*   Sube `esp32cam_stream.ino` a la placa ESP32-CAM (asegúrate de puentear IO0 a GND para flashear).

### 4. Conexión y Control
1.  Enciende el robot.
2.  Desde tu PC o teléfono, conéctate a la red Wi-Fi que emite el robot:
    *   **SSID:** `ROVER_XTART_01`
    *   **Contraseña:** `misionapollo`
3.  Abre el navegador e ingresa a `http://192.168.4.1`.
4.  Te encontrarás con la *Landing Page*. Para acceder al mando central, presiona el icono del candado arriba a la derecha.
    *   **Usuario:** `piloto`
    *   **Contraseña:** `xtart`

---

## 📡 Mapa de Endpoints (API ESP32)

*   `GET /` - Sirve el Dashboard HTML.
*   `GET /telemetry` - Retorna un JSON consolidado con los datos de **todos** los sensores.
*   `GET /move?dir=FORWARD|BACKWARD|LEFT|RIGHT|STOP` - Aplica PWM a los pines IN1-IN4.
*   `GET /auto?mode=on|off` - Activa/Desactiva el modo de patrulla autónoma (sigue-líneas + evasión).
*   `GET /oled?msg=...` - Imprime un mensaje directo en la pantalla física del Rover.
*   `GET /blackbox` - Descarga el archivo CSV con los registros históricos.

---

## 📄 Licencia

Este proyecto es Open Source y su distribución es libre con fines educativos o recreativos. Construido con la mentalidad de inspirar vocaciones en el mundo de la electrónica, IoT y la robótica exploratoria.
