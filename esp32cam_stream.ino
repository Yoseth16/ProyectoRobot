/*
 * ═══════════════════════════════════════════════════════
 *  Proyecto: ROVER XTART-01  |  Módulo de Cámara
 *  Placa:    ESP32-CAM con OV3660 (AI-Thinker)
 * ═══════════════════════════════════════════════════════
 *  Este módulo se programa por SEPARADO del ESP32 principal.
 *  Se conecta como CLIENTE WiFi a la red creada por el Rover
 *  ("ROVER_XTART_01") y transmite video MJPEG en tiempo real.
 *
 *  Tras conectarse, la IP típica será:
 *    http://192.168.4.2/stream
 *
 *  El frontend (main.js) apunta a esta URL para mostrar
 *  la imagen en vivo dentro de la interfaz de control.
 *
 *  Para programar este módulo, usar la base programadora
 *  ESP32-CAM incluida en el kit.
 * ═══════════════════════════════════════════════════════
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// Credenciales de la red WiFi creada por el ESP32 principal
const char* ssid     = "ROVER_XTART_01";
const char* password = "misionapollo";

// ─── PINOUT ESP32-CAM (Modelo AI-Thinker) ───────────
// Estos pines son FIJOS y específicos de la placa.
// NO modificar a menos que se use un modelo de placa diferente.
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// LED Flash integrado en la placa ESP32-CAM
#define FLASH_LED_PIN      4

httpd_handle_t stream_httpd = NULL;

// ═══════════════════════════════════════════════════════
//  STREAMING MJPEG
// ═══════════════════════════════════════════════════════
// El navegador recibe un flujo continuo de frames JPEG
// embebidos en un multipart HTTP. Esto permite ver video
// en el tag <img> de HTML sin necesidad de WebSockets.

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* STREAM_CONTENT_TYPE =
    "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* STREAM_BOUNDARY =
    "\r\n--" PART_BOUNDARY "\r\n";
static const char* STREAM_PART =
    "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  // Permitir acceso desde cualquier origen (CORS)
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  // Bucle infinito de captura y envío de frames
  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Error capturando frame");
      res = ESP_FAIL;
      break;
    }

    // Enviar separador del boundary
    res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (res != ESP_OK) { esp_camera_fb_return(fb); break; }

    // Enviar cabecera con tamaño del frame
    size_t hlen = snprintf(part_buf, 64, STREAM_PART, fb->len);
    res = httpd_resp_send_chunk(req, part_buf, hlen);
    if (res != ESP_OK) { esp_camera_fb_return(fb); break; }

    // Enviar datos JPEG del frame
    res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (res != ESP_OK) break;
    
    // Pequeño retardo para no saturar la CPU y permitir otras tareas
    delay(20);
  }

  return res;
}

void startStreamServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    Serial.println("Servidor de streaming OK en /stream");
  }
}

// ═══════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n=========================================");
  Serial.println("  ESP32-CAM XTART-01 - Modulo de Camara  ");
  Serial.println("=========================================");

  // Flash LED apagado por defecto
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // ── Configuración de la cámara ─────────────────────
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Ajustar calidad según la memoria PSRAM disponible
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;    // 640×480
    config.jpeg_quality = 12;               // Calidad (0-63, menor = mejor)
    config.fb_count     = 2;                // Doble buffer
    Serial.println("PSRAM detectada: VGA @ calidad 12");
  } else {
    config.frame_size   = FRAMESIZE_QVGA;   // 320×240
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    Serial.println("Sin PSRAM: QVGA @ calidad 15");
  }

  // Inicializar cámara
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("ERROR: Camara no inicializada (0x%x)\n", err);
    Serial.println("Verifica las conexiones del modulo.");
    return;
  }
  Serial.println("Camara inicializada correctamente.");

  // ── Conectar a la red del Rover (modo CLIENTE) ─────
  Serial.print("Conectando a: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConectado a la red del Rover!");
    Serial.print("IP de la camara: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/stream");
  } else {
    Serial.println("\nERROR: No se pudo conectar.");
    Serial.println("Asegurate de que el ESP32 principal esta encendido.");
    return;
  }

  // ── Iniciar servidor de streaming ──────────────────
  startStreamServer();
}

// ═══════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════
void loop() {
  // El streaming se gestiona por esp_http_server en segundo plano.
  // Aquí solo gestionamos la reconexión WiFi si se pierde.
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdido. Reconectando...");
    WiFi.begin(ssid, password);
    delay(5000);
  }
  delay(100);
}
