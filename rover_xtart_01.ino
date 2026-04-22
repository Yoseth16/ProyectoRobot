/*
 * ═══════════════════════════════════════════════════════
 *  Proyecto: ROVER XTART-01  |  Firmware Principal v2
 *  Placa:    ESP32 DEVKIT V1
 * ═══════════════════════════════════════════════════════
 *  Componentes integrados:
 *  ► L298N ........... Control de motores DC (diferencial)
 *  ► DHT11 ........... Temperatura y humedad
 *  ► HC-SR04 ......... Distancia ultrasónica (anticolisión)
 *  ► BMP180 GY-68 .... Presión barométrica y altitud (I2C)
 *  ► TEMT6000 ........ Intensidad luminosa (analógico)
 *  ► TCS34725 ........ Detección de color RGB (I2C)
 *  ► KY-033 .......... Sensor infrarrojo sigue-líneas
 *  ► SSD1306 0.96" ... Pantalla OLED 128×64 (I2C)
 *  ► TMB12A03 ........ Zumbador activo 3.3V
 *  ► LED RGB 10mm .... Indicador visual multicolor
 *
 *  Funcionalidades v2:
 *  ✦ Modo Patrulla Autónoma (line-follower + anticolisión)
 *  ✦ Caja Negra (Black Box) — logging CSV a SPIFFS
 * ═══════════════════════════════════════════════════════
 */

// ─── LIBRERÍAS ────────────────────────────────────────
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <Wire.h>                  // Bus I2C compartido (OLED, BMP180, TCS34725)
#include <ArduinoJson.h>

// Sensores
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <Adafruit_BMP085.h>       // Compatible con BMP180 GY-68
#include "Adafruit_TCS34725.h"     // Sensor de color RGB

// Display OLED
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ─── CONFIGURACIÓN WiFi ──────────────────────────────
const char* ssid     = "ROVER_XTART_01";
const char* password = "misionapollo";

AsyncWebServer server(80);

// ═══════════════════════════════════════════════════════
//  PINOUT COMPLETO
// ═══════════════════════════════════════════════════════
// Motores L298N
const int IN1 = 14;    // Motor izquierdo - señal A
const int IN2 = 12;    // Motor izquierdo - señal B
const int IN3 = 27;    // Motor derecho   - señal A
const int IN4 = 26;    // Motor derecho   - señal B

// Sensores (Entradas)
#define DHTPIN       32              // DHT11 (digital)
#define DHTTYPE      DHT11
const int TEMT_PIN   = 33;          // TEMT6000 (analógico)
const int BAT_PIN    = 36;          // Batería (analógico, VP)
const int TRIG_PIN   = 25;          // HC-SR04 Trigger (salida)
const int ECHO_PIN   = 34;          // HC-SR04 Echo (entrada, input-only)
const int LINE_PIN   = 35;          // KY-033 (entrada digital, input-only)

// HMI - Salidas
const int BUZZER_PIN = 2;           // TMB12A03 zumbador activo
const int LED_R_PIN  = 16;          // LED RGB - canal Rojo
const int LED_G_PIN  = 17;          // LED RGB - canal Verde
const int LED_B_PIN  = 4;           // LED RGB - canal Azul

// I2C (GPIO 21=SDA, GPIO 22=SCL — por defecto en ESP32)
//   ► OLED SSD1306 .... dirección 0x3C
//   ► BMP180 .......... dirección 0x77
//   ► TCS34725 ........ dirección 0x29
#define SCREEN_W 128
#define SCREEN_H 64

// ═══════════════════════════════════════════════════════
//  INSTANCIAS DE SENSORES Y PERIFÉRICOS
// ═══════════════════════════════════════════════════════
DHT dht(DHTPIN, DHTTYPE);
Adafruit_BMP085 bmp;
Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

// Flags: ¿se detectó el sensor durante el arranque?
bool bmpOK  = false;
bool tcsOK  = false;
bool oledOK = false;

// ═══════════════════════════════════════════════════════
//  CACHÉ DE SENSORES (lectura periódica en loop)
// ═══════════════════════════════════════════════════════
float    cachedTemp  = 0.0;
float    cachedHum   = 0.0;
float    cachedPres  = 1013.25;
float    cachedAlt   = 0.0;
int      cachedLight = 0;
long     cachedDist  = 100;
int      cachedBat   = 100;
uint16_t cachedCR = 0, cachedCG = 0, cachedCB = 0;
uint16_t cachedCLux  = 0;
bool     cachedLine  = false;

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 2000;  // ms

unsigned long lastFastRead = 0;
const unsigned long FAST_INTERVAL = 50;  // 50 ms para sensores criticos

unsigned long lastMotorUpdate = 0;
const unsigned long MOTOR_INTERVAL = 10; // 10 ms para suavizado PWM
int target_in1 = 0, target_in2 = 0, target_in3 = 0, target_in4 = 0;
float curr_in1 = 0, curr_in2 = 0, curr_in3 = 0, curr_in4 = 0;

// ═══════════════════════════════════════════════════════
//  ESTADO DEL OLED
// ═══════════════════════════════════════════════════════
String lastOledMsg = "> SYSTEM READY";

// ═══════════════════════════════════════════════════════
//  BUZZER — Máquina de estados no-bloqueante
// ═══════════════════════════════════════════════════════
enum BzMode { BZ_OFF, BZ_SLOW, BZ_RAPID, BZ_ON };
BzMode buzzerMode    = BZ_OFF;
bool   buzzerManual  = false;   // true = controlado desde la web
unsigned long lastBzToggle = 0;
bool   bzState       = false;

void updateBuzzer() {
  unsigned long now = millis();
  switch (buzzerMode) {
    case BZ_OFF:
      digitalWrite(BUZZER_PIN, LOW);
      bzState = false;
      break;
    case BZ_SLOW:
      if (now - lastBzToggle >= 400) {
        bzState = !bzState;
        digitalWrite(BUZZER_PIN, bzState);
        lastBzToggle = now;
      }
      break;
    case BZ_RAPID:
      if (now - lastBzToggle >= 100) {
        bzState = !bzState;
        digitalWrite(BUZZER_PIN, bzState);
        lastBzToggle = now;
      }
      break;
    case BZ_ON:
      digitalWrite(BUZZER_PIN, HIGH);
      bzState = true;
      break;
  }
}

// ═══════════════════════════════════════════════════════
//  LED RGB — Control PWM con LEDC
// ═══════════════════════════════════════════════════════
bool ledManual = false;  // true = controlado desde la web

void setLED(uint8_t r, uint8_t g, uint8_t b) {
  ledcWrite(0, r);
  ledcWrite(1, g);
  ledcWrite(2, b);
}

// ═══════════════════════════════════════════════════════
//  MODO PATRULLA AUTÓNOMA
// ═══════════════════════════════════════════════════════
// Estados de la máquina de estados del autopiloto
enum AutoState {
  AUTO_IDLE,         // No activo
  AUTO_FOLLOW_LINE,  // Siguiendo la línea con KY-033
  AUTO_OBSTACLE,     // Obstáculo detectado — detener
  AUTO_REVERSE,      // Retrocediendo
  AUTO_TURN          // Girando para esquivar
};

AutoState autoState = AUTO_IDLE;
bool autoMode = false;
unsigned long autoStateTimer = 0;     // Timer para fases temporizadas
int autoTurnCount = 0;                // Contador de giros consecutivos
const long AUTO_REVERSE_MS = 600;     // ms retrocediendo
const long AUTO_TURN_MS    = 500;     // ms girando
const int  AUTO_OBSTACLE_CM = 20;     // Distancia de detección (cm)

// Actualización del autopiloto — llamar en cada iteración del loop()
void updateAutoPilot() {
  if (!autoMode) return;

  unsigned long now = millis();

  switch (autoState) {

    case AUTO_FOLLOW_LINE:
      // Prioridad 1: Obstáculo frontal
      if (cachedDist < AUTO_OBSTACLE_CM) {
        moveRover("STOP");
        autoState = AUTO_OBSTACLE;
        autoStateTimer = now;
        setLED(255, 0, 0);
        buzzerMode = BZ_RAPID;
        logBlackBox("OBSTACLE", String(cachedDist) + "cm");
        break;
      }
      // Prioridad 2: Seguir la línea
      if (cachedLine) {
        // La línea está bajo el sensor — avanzar
        moveRover("FORWARD");
        setLED(0, 80, 0);  // Verde = siguiendo
        autoTurnCount = 0;
      } else {
        // Perdió la línea — girar para buscarla
        // Alterna dirección cada 2 pérdidas para hacer zigzag
        if (autoTurnCount % 2 == 0) moveRover("LEFT");
        else                        moveRover("RIGHT");
        setLED(255, 80, 0);  // Naranja = buscando
        autoTurnCount++;
        // Seguridad: si pierde la línea 20 veces seguidas, frenar
        if (autoTurnCount > 20) {
          moveRover("STOP");
          setLED(255, 255, 0);
          logBlackBox("LINE_LOST", "Detenido por seguridad");
        }
      }
      break;

    case AUTO_OBSTACLE:
      // Breve pausa antes de retroceder (300ms)
      if (now - autoStateTimer >= 300) {
        moveRover("BACKWARD");
        autoState = AUTO_REVERSE;
        autoStateTimer = now;
      }
      break;

    case AUTO_REVERSE:
      // Retroceder durante AUTO_REVERSE_MS
      if (now - autoStateTimer >= AUTO_REVERSE_MS) {
        // Girar para esquivar (siempre a la derecha)
        moveRover("RIGHT");
        autoState = AUTO_TURN;
        autoStateTimer = now;
        setLED(0, 0, 255);
        logBlackBox("EVADE", "Girando para esquivar");
      }
      break;

    case AUTO_TURN:
      // Girar durante AUTO_TURN_MS
      if (now - autoStateTimer >= AUTO_TURN_MS) {
        autoState = AUTO_FOLLOW_LINE;
        buzzerMode = BZ_OFF;
      }
      break;

    default:
      break;
  }
}

// ═══════════════════════════════════════════════════════
//  CAJA NEGRA (BLACK BOX) — Logging a SPIFFS
// ═══════════════════════════════════════════════════════
const char* BLACKBOX_FILE = "/blackbox.csv";
unsigned long bootTime = 0;
unsigned long lastBlackBoxWrite = 0;
const unsigned long BLACKBOX_INTERVAL = 10000;  // Log automático cada 10s
int blackboxEntries = 0;
const int BLACKBOX_MAX_ENTRIES = 500;  // Límite para no saturar la flash

// Inicializar la caja negra (cabecera CSV)
void initBlackBox() {
  // Si el archivo ya existe, lo conservamos. Si no, creamos cabecera.
  if (!SPIFFS.exists(BLACKBOX_FILE)) {
    File f = SPIFFS.open(BLACKBOX_FILE, FILE_WRITE);
    if (f) {
      f.println("T+s,Event,Temp,Hum,Pres,Light,Dist,ColorR,ColorG,ColorB,Line,Detail");
      f.close();
      Serial.println("BlackBox: Archivo CSV creado.");
    }
  } else {
    Serial.println("BlackBox: Archivo CSV existente encontrado.");
    // Contar líneas existentes para no exceder el límite
    File f = SPIFFS.open(BLACKBOX_FILE, FILE_READ);
    if (f) {
      while (f.available()) {
        if (f.read() == '\n') blackboxEntries++;
      }
      f.close();
      blackboxEntries--;  // Descontar la cabecera
      Serial.printf("BlackBox: %d entradas previas.\n", blackboxEntries);
    }
  }
}

// Escribir un evento en la caja negra
void logBlackBox(String event, String detail) {
  if (blackboxEntries >= BLACKBOX_MAX_ENTRIES) return;  // Protección de flash

  File f = SPIFFS.open(BLACKBOX_FILE, FILE_APPEND);
  if (!f) return;

  unsigned long elapsed = (millis() - bootTime) / 1000;

  // Formato: T+s, Event, Temp, Hum, Pres, Light, Dist, CR, CG, CB, Line, Detail
  f.printf("%lu,%s,%.1f,%.0f,%.1f,%d,%ld,%u,%u,%u,%d,%s\n",
    elapsed,
    event.c_str(),
    cachedTemp,
    cachedHum,
    cachedPres,
    cachedLight,
    cachedDist,
    cachedCR, cachedCG, cachedCB,
    cachedLine ? 1 : 0,
    detail.c_str()
  );
  f.close();
  blackboxEntries++;
}

// Log periódico automático del estado de los sensores
void autoLogBlackBox() {
  unsigned long now = millis();
  if (now - lastBlackBoxWrite < BLACKBOX_INTERVAL) return;
  lastBlackBoxWrite = now;

  // Solo loguear si hay algo interesante (no llenar de datos "normales")
  // Logueamos siempre, pero con evento "TELEMETRY"
  logBlackBox("TELEMETRY", autoMode ? "AUTO" : "MANUAL");
}

// ═══════════════════════════════════════════════════════
//  FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════

// Medir distancia con HC-SR04 (resultado en cm)
long measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // Timeout ~5m
  if (duration == 0) return 999;  // Sin eco = sin obstáculo cercano
  return duration / 58;           // Fórmula estándar: cm = µs / 58
}

// Actualizar pantalla OLED con telemetría resumida
void updateOLED() {
  if (!oledOK) return;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  // ─ Línea 1: Título + modo ─
  display.setCursor(0, 0);
  if (autoMode) {
    display.print("ROVER [AUTOPILOTO]");
  } else {
    display.println("ROVER XTART-01");
  }
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  // ─ Línea 2: Temp + Humedad ─
  display.setCursor(0, 14);
  display.print("T:");
  display.print(cachedTemp, 1);
  display.print("C  H:");
  display.print((int)cachedHum);
  display.println("%");

  // ─ Línea 3: Distancia + Alerta ─
  display.setCursor(0, 24);
  display.print("DIST:");
  display.print(cachedDist);
  display.print("cm");
  if (cachedDist < 15) display.print(" !!ALERT");

  // ─ Línea 4: Presión + Luz ─
  display.setCursor(0, 34);
  display.print("P:");
  display.print(cachedPres, 0);
  display.print(" L:");
  display.print(cachedLight);

  // ─ Línea 5: Último mensaje de la bitácora ─
  display.drawLine(0, 44, 128, 44, SSD1306_WHITE);
  display.setCursor(0, 48);
  String msg = lastOledMsg;
  if (msg.length() > 21) msg = msg.substring(0, 21);
  display.println(msg);

  display.display();
}

void setMotorTargets(int t1, int t2, int t3, int t4) {
  target_in1 = t1; target_in2 = t2;
  target_in3 = t3; target_in4 = t4;
}

// Control de motores (conducción diferencial suave mediante PWM)
void moveRover(String direction) {
  Serial.println("MOV: " + direction);
  int speed = 255;

  if (direction == "FORWARD") {
    setMotorTargets(speed, 0, speed, 0);
  }
  else if (direction == "BACKWARD") {
    setMotorTargets(0, speed, 0, speed);
  }
  else if (direction == "LEFT") {
    setMotorTargets(0, speed, speed, 0);
  }
  else if (direction == "RIGHT") {
    setMotorTargets(speed, 0, 0, speed);
  }
  else { // STOP
    setMotorTargets(0, 0, 0, 0);
  }
}

// ═══════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n=========================================");
  Serial.println("    Iniciando ROVER XTART-01 v2...       ");
  Serial.println("=========================================");

  bootTime = millis();

  // ── Pines de motores (LEDC canales 3, 4, 5, 6) ─────
  ledcSetup(3, 5000, 8); ledcAttachPin(IN1, 3);
  ledcSetup(4, 5000, 8); ledcAttachPin(IN2, 4);
  ledcSetup(5, 5000, 8); ledcAttachPin(IN3, 5);
  ledcSetup(6, 5000, 8); ledcAttachPin(IN4, 6);
  moveRover("STOP");

  // ── HC-SR04 ────────────────────────────────────────
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // ── KY-033 ─────────────────────────────────────────
  pinMode(LINE_PIN, INPUT);

  // ── Buzzer ─────────────────────────────────────────
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // ── LED RGB (LEDC PWM: 3 canales a 5 kHz, 8 bits) ─
  ledcSetup(0, 5000, 8); ledcAttachPin(LED_R_PIN, 0);
  ledcSetup(1, 5000, 8); ledcAttachPin(LED_G_PIN, 1);
  ledcSetup(2, 5000, 8); ledcAttachPin(LED_B_PIN, 2);
  setLED(0, 0, 50);  // Azul tenue = arrancando

  // ── I2C + Sensores ─────────────────────────────────
  Wire.begin();  // SDA=21, SCL=22

  Serial.print("DHT11 ......... ");
  dht.begin();
  Serial.println("OK");

  Serial.print("BMP180 ........ ");
  if (bmp.begin()) { bmpOK = true; Serial.println("OK"); }
  else Serial.println("NO DETECTADO");

  Serial.print("TCS34725 ...... ");
  if (tcs.begin()) { tcsOK = true; Serial.println("OK"); }
  else Serial.println("NO DETECTADO");

  Serial.print("OLED SSD1306 .. ");
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    oledOK = true;
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(16, 8);
    display.println("ROVER");
    display.setCursor(4, 32);
    display.println("XTART-01");
    display.display();
    Serial.println("OK");
  } else {
    Serial.println("NO DETECTADO");
  }

  // ── Bip de encendido (2 tonos cortos) ──────────────
  digitalWrite(BUZZER_PIN, HIGH); delay(80);
  digitalWrite(BUZZER_PIN, LOW);  delay(60);
  digitalWrite(BUZZER_PIN, HIGH); delay(80);
  digitalWrite(BUZZER_PIN, LOW);

  // ── SPIFFS ─────────────────────────────────────────
  if (!SPIFFS.begin(true)) {
    Serial.println("ERROR CRITICO: SPIFFS no montado.");
    return;
  }
  Serial.println("SPIFFS ........ OK");

  // ── Inicializar Caja Negra ─────────────────────────
  initBlackBox();
  logBlackBox("BOOT", "Sistema iniciado");

  // ── WiFi en modo Access Point ──────────────────────
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP: "); Serial.println(ssid);
  Serial.print("IP: http://"); Serial.println(IP);

  // ═══════════════════════════════════════════════════
  //  RUTAS DEL SERVIDOR WEB
  // ═══════════════════════════════════════════════════

  // ── Archivos estáticos (SPIFFS) ────────────────────
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *r){
    r->send(SPIFFS, "/index.html", "text/html");
  });
  server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *r){
    r->send(SPIFFS, "/style.css", "text/css");
  });
  server.on("/main.js", HTTP_GET, [](AsyncWebServerRequest *r){
    r->send(SPIFFS, "/main.js", "application/javascript");
  });
  server.on("/chart.min.js", HTTP_GET, [](AsyncWebServerRequest *r){
    r->send(SPIFFS, "/chart.min.js", "application/javascript");
  });

  // ── /move — Control de motores ─────────────────────
  server.on("/move", HTTP_GET, [](AsyncWebServerRequest *r){
    // Deshabilitar autopiloto si el piloto toma control manual
    if (autoMode) {
      autoMode = false;
      autoState = AUTO_IDLE;
      logBlackBox("AUTO_OFF", "Piloto tomo control manual");
    }
    if (r->hasParam("dir")) {
      moveRover(r->getParam("dir")->value());
      r->send(200, "text/plain", "OK");
    } else r->send(400, "text/plain", "Falta: dir");
  });

  // ── /telemetry — JSON con TODOS los sensores ───────
  server.on("/telemetry", HTTP_GET, [](AsyncWebServerRequest *r){
    StaticJsonDocument<512> doc;
    doc["temp"]  = cachedTemp;
    doc["hum"]   = cachedHum;
    doc["pres"]  = cachedPres;
    doc["alt"]   = cachedAlt;
    doc["light"] = cachedLight;
    doc["dist"]  = cachedDist;
    doc["bat"]   = cachedBat;
    doc["cr"]    = cachedCR;
    doc["cg"]    = cachedCG;
    doc["cb"]    = cachedCB;
    doc["clux"]  = cachedCLux;
    doc["line"]  = cachedLine ? 1 : 0;
    doc["auto"]  = autoMode ? 1 : 0;
    doc["bbx"]   = blackboxEntries;
    String out;
    serializeJson(doc, out);
    r->send(200, "application/json", out);
  });

  // ── /oled — Mensaje para la pantalla OLED ──────────
  server.on("/oled", HTTP_GET, [](AsyncWebServerRequest *r){
    if (r->hasParam("msg")) {
      lastOledMsg = r->getParam("msg")->value();
      Serial.println("OLED: " + lastOledMsg);
      logBlackBox("MSG_RECV", lastOledMsg);
      r->send(200, "text/plain", "OK");
    } else r->send(400, "text/plain", "Falta: msg");
  });

  // ── /pantilt — Control servo cámara (placeholder) ──
  server.on("/pantilt", HTTP_GET, [](AsyncWebServerRequest *r){
    if (r->hasParam("dir")) {
      Serial.println("PT: " + r->getParam("dir")->value());
      // TODO: Integrar ESP32Servo para pan/tilt
      r->send(200, "text/plain", "OK");
    } else r->send(400, "text/plain", "Falta: dir");
  });

  // ── /qrlog — Códigos QR detectados (placeholder) ──
  server.on("/qrlog", HTTP_GET, [](AsyncWebServerRequest *r){
    r->send(200, "application/json", "[]");
  });

  // ── /buzzer — Control del zumbador activo ──────────
  server.on("/buzzer", HTTP_GET, [](AsyncWebServerRequest *r){
    if (r->hasParam("mode")) {
      String mode = r->getParam("mode")->value();
      if (mode == "off")        { buzzerMode = BZ_OFF;   buzzerManual = false; }
      else if (mode == "slow")  { buzzerMode = BZ_SLOW;  buzzerManual = true; }
      else if (mode == "rapid") { buzzerMode = BZ_RAPID; buzzerManual = true; }
      else if (mode == "on")    { buzzerMode = BZ_ON;    buzzerManual = true; }
      r->send(200, "text/plain", "OK");
    } else r->send(400, "text/plain", "Falta: mode");
  });

  // ── /led — Control del LED RGB ─────────────────────
  server.on("/led", HTTP_GET, [](AsyncWebServerRequest *r){
    if (r->hasParam("r") && r->hasParam("g") && r->hasParam("b")) {
      setLED(r->getParam("r")->value().toInt(),
             r->getParam("g")->value().toInt(),
             r->getParam("b")->value().toInt());
      ledManual = true;
      r->send(200, "text/plain", "OK");
    } else if (r->hasParam("mode") && r->getParam("mode")->value() == "auto") {
      ledManual = false;
      r->send(200, "text/plain", "OK");
    } else r->send(400, "text/plain", "Falta: r,g,b o mode=auto");
  });

  // ── /auto — Activar/desactivar Modo Patrulla ──────
  server.on("/auto", HTTP_GET, [](AsyncWebServerRequest *r){
    if (r->hasParam("mode")) {
      String mode = r->getParam("mode")->value();
      if (mode == "on") {
        autoMode = true;
        autoState = AUTO_FOLLOW_LINE;
        autoTurnCount = 0;
        buzzerManual = false;
        ledManual = false;
        logBlackBox("AUTO_ON", "Patrulla iniciada");
        Serial.println(">>> AUTOPILOTO ACTIVADO <<<");
        r->send(200, "text/plain", "AUTO_ON");
      } else {
        autoMode = false;
        autoState = AUTO_IDLE;
        moveRover("STOP");
        logBlackBox("AUTO_OFF", "Patrulla detenida");
        Serial.println(">>> AUTOPILOTO DESACTIVADO <<<");
        r->send(200, "text/plain", "AUTO_OFF");
      }
    } else r->send(400, "text/plain", "Falta: mode=on/off");
  });

  // ── /blackbox — Descargar CSV de la caja negra ─────
  server.on("/blackbox", HTTP_GET, [](AsyncWebServerRequest *r){
    if (SPIFFS.exists(BLACKBOX_FILE)) {
      r->send(SPIFFS, BLACKBOX_FILE, "text/csv");
    } else {
      r->send(404, "text/plain", "No hay datos de caja negra.");
    }
  });

  // ── /blackbox/clear — Borrar el CSV ────────────────
  server.on("/blackbox/clear", HTTP_GET, [](AsyncWebServerRequest *r){
    if (SPIFFS.exists(BLACKBOX_FILE)) {
      SPIFFS.remove(BLACKBOX_FILE);
    }
    blackboxEntries = 0;
    initBlackBox();
    logBlackBox("CLEAR", "Caja negra reiniciada");
    r->send(200, "text/plain", "BlackBox borrada y reiniciada.");
  });

  // ── Iniciar servidor ───────────────────────────────
  server.begin();
  Serial.println("Servidor web iniciado. Esperando clientes...");

  // LED verde = listo
  setLED(0, 50, 0);
  delay(500);
  setLED(0, 0, 40);
}

// ═══════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  // ── Actualización de motores PWM (Suavizado) ───────
  if (now - lastMotorUpdate >= MOTOR_INTERVAL) {
    lastMotorUpdate = now;
    curr_in1 += (target_in1 - curr_in1) * 0.1;
    curr_in2 += (target_in2 - curr_in2) * 0.1;
    curr_in3 += (target_in3 - curr_in3) * 0.1;
    curr_in4 += (target_in4 - curr_in4) * 0.1;

    ledcWrite(3, (uint8_t)curr_in1);
    ledcWrite(4, (uint8_t)curr_in2);
    ledcWrite(5, (uint8_t)curr_in3);
    ledcWrite(6, (uint8_t)curr_in4);
  }

  // ── Lectura rápida de sensores críticos (patrón millis) ──
  if (now - lastFastRead >= FAST_INTERVAL) {
    lastFastRead = now;
    // 4. HC-SR04 — Distancia
    cachedDist = measureDistance();
    // 6. KY-033 — Sigue-líneas (activo-bajo: LOW = línea detectada)
    cachedLine = (digitalRead(LINE_PIN) == LOW);
  }

  // ── Lectura periódica de sensores lentos (patrón millis) ──
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;

    // 1. DHT11 — Temperatura y Humedad
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) cachedTemp = t;
    if (!isnan(h)) cachedHum  = h;

    // 2. BMP180 — Presión barométrica y Altitud
    if (bmpOK) {
      cachedPres = bmp.readPressure() / 100.0;  // Pa → hPa
      cachedAlt  = bmp.readAltitude();
    }

    // 3. TEMT6000 — Luz ambiental (0–4095)
    cachedLight = analogRead(TEMT_PIN);

    // 5. TCS34725 — Detección de color
    if (tcsOK) {
      uint16_t r, g, b, c;
      tcs.getRawData(&r, &g, &b, &c);
      cachedCR   = r;
      cachedCG   = g;
      cachedCB   = b;
      cachedCLux = (uint16_t)tcs.calculateLux(r, g, b);
    }

    // 7. Batería (lectura real con divisor de voltaje)
    int batRaw = analogRead(BAT_PIN);
    // Asumiendo divisor donde 8.4V = ~3500 y 6.0V = ~2500
    cachedBat = map(batRaw, 2500, 3500, 0, 100);
    cachedBat = constrain(cachedBat, 0, 100);

    // ── Auto-alerta por proximidad (solo si no está en autopiloto) ─
    if (!autoMode) {
      if (!buzzerManual) {
        if      (cachedDist < 15) buzzerMode = BZ_ON;
        else if (cachedDist < 30) buzzerMode = BZ_RAPID;
        else                      buzzerMode = BZ_OFF;
      }

      if (!ledManual) {
        if      (cachedDist < 15) setLED(255, 0, 0);     // Rojo = peligro
        else if (cachedDist < 30) setLED(255, 80, 0);    // Naranja = precaución
        else                      setLED(0, 0, 40);      // Azul tenue = normal
      }
    }

    // ── Eventos automáticos para la caja negra ──────
    if (cachedDist < 15) {
      logBlackBox("ALERT_COLLISION", String(cachedDist) + "cm");
    }
    if (cachedTemp > 40) {
      logBlackBox("ALERT_TEMP", String(cachedTemp, 1) + "C");
    }

    // ── Actualizar pantalla OLED ─────────────────────
    updateOLED();
  }

  // ── Actualización continua del buzzer (no-bloqueante)
  updateBuzzer();

  // ── Actualización del autopiloto (no-bloqueante) ───
  updateAutoPilot();

  // ── Log periódico a la caja negra ──────────────────
  autoLogBlackBox();
}
