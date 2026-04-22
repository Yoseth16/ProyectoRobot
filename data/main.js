        /* ========================================= */
        /* CONFIGURACIÓN DEL ROBOT                   */
        /* ========================================= */
        // CONSTANTE MOCK MODE: Útil para simular y diseñar la web sin el ESP32 conectado
        const MOCK_MODE = true;

        // Cambiar por la IP real del ESP32 en la red Wi-Fi
        const IP_ROBOT = "192.168.4.1"; 
        // IP del módulo ESP32-CAM (se conecta como cliente a la red del rover)
        const IP_CAMERA = "192.168.4.2";
        
        // Base URLs para los fetch
        const BASE_URL = `http://${IP_ROBOT}`;
        const CAM_URL = `http://${IP_CAMERA}`;

        /* ========================================= */
        /* ESTADO DEL SISTEMA                        */
        /* ========================================= */
        let isConnected = false;
        let missionSeconds = 0;

        // Referencias al DOM
        const statusIndicator = document.getElementById('status-indicator');
        const ipDisplay = document.getElementById('ip-display');
        const videoStream = document.getElementById('video-stream');
        const camOfflineText = document.getElementById('cam-offline');
        const wifiStatus = document.getElementById('wifi-status');
        const batteryStatus = document.getElementById('battery-status');
        const missionTimeDisplay = document.getElementById('mission-time');

        // Inicialización visual básica
        ipDisplay.innerText = MOCK_MODE ? `IP: [MOCK MODE]` : `IP: ${IP_ROBOT}`;
        
        // Iniciar stream de la cámara (el ESP32-CAM transmite MJPEG en su propia IP)
        if (MOCK_MODE) {
            // Simulamos el stream de video apagado (Offline) mostrando texto parpadeante
            videoStream.style.display = 'none';
            camOfflineText.style.display = 'block';
        } else {
            // El ESP32-CAM sirve el video en /stream. Timestamp para evitar caché.
            videoStream.src = `${CAM_URL}/stream?cb=${Date.now()}`;
        }

        /* ========================================= */
        /* NAVEGACIÓN (LANDING <-> DASHBOARD)        */
        /* ========================================= */
        const viewPublic = document.getElementById('view-public');
        const viewPrivate = document.getElementById('view-private');
        const mainTopbar = document.getElementById('main-topbar');
        const loginModal = document.getElementById('login-modal');
        const loginError = document.getElementById('login-error');
        const publicOledInput = document.getElementById('public-oled-input');
        const publicOledStatus = document.getElementById('public-oled-status');

        // Función para enviar mensaje público
        document.getElementById('btn-public-oled-send')?.addEventListener('click', () => {
            const msg = publicOledInput.value.trim();
            if (msg) {
                fetchRobot(`/oled?msg=${encodeURIComponent(msg)}`);
                publicOledStatus.innerText = "¡Mensaje transmitido al Rover!";
                publicOledInput.value = "";
                setTimeout(() => publicOledStatus.innerText = "", 3000);
            }
        });

        // Abrir y cerrar modal de login
        document.getElementById('btn-open-login')?.addEventListener('click', () => {
            loginModal.classList.remove('hidden');
            loginError.innerText = "";
        });

        document.getElementById('btn-login-cancel')?.addEventListener('click', () => {
            loginModal.classList.add('hidden');
        });

        // Enviar login
        document.getElementById('btn-login-submit')?.addEventListener('click', () => {
            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;
            if (user === 'piloto' && pass === 'xtart') {
                loginModal.classList.add('hidden');
                viewPublic.classList.add('hidden');
                viewPrivate.classList.remove('hidden');
                mainTopbar.classList.remove('hidden');
                // Inicializar el mapa 3D una vez visible
                setTimeout(() => { if (typeof initRover3D === 'function') initRover3D(); }, 100);
            } else {
                loginError.innerText = "Credenciales incorrectas.";
            }
        });

        document.getElementById('btn-volver')?.addEventListener('click', () => {
            viewPrivate.classList.add('hidden');
            mainTopbar.classList.add('hidden');
            viewPublic.classList.remove('hidden');
            document.getElementById('login-user').value = '';
            document.getElementById('login-pass').value = '';
        });

        /* ========================================= */
        /* FUNCIONES DE COMUNICACIÓN (FETCH)         */
        /* ========================================= */
        
        /**
         * Realiza una petición GET al robot y maneja el estado de conexión visual
         * @param {string} endpoint - Ruta a llamar (ej: '/move?dir=FORWARD')
         * @param {boolean} updateStatus - Si debe afectar al punto verde/rojo superior
         */
        async function fetchRobot(endpoint, updateStatus = true) {
            // MODO SIMULACIÓN INTERCEPTA LAS PETICIONES REALES PARA EVITAR ERRORES EN LA CONSOLA
            if (MOCK_MODE) {
                return new Promise(resolve => {
                    setTimeout(() => {
                        if (updateStatus) setConnectionStatus(true);
                        
                        if (endpoint.startsWith('/telemetry')) {
                            // Generamos un JSON dummy fluctuante para simular sensores ambientales
                            const mockData = {
                                temp: (20 + Math.random() * 5).toFixed(1),
                                hum: Math.floor(40 + Math.random() * 10),
                                pres: (1013 - 2 + Math.random() * 4).toFixed(2),
                                alt: (45 + Math.random() * 10).toFixed(1),
                                light: Math.floor(Math.random() * 4095),
                                bat: Math.floor(80 + Math.random() * 20),
                                dist: Math.floor(5 + Math.random() * 95),
                                cr: Math.floor(Math.random() * 300),
                                cg: Math.floor(Math.random() * 300),
                                cb: Math.floor(Math.random() * 300),
                                clux: Math.floor(Math.random() * 2000),
                                line: Math.random() > 0.7 ? 1 : 0,
                                auto: 0,
                                bbx: Math.floor(Math.random() * 50)
                            };
                            resolve(JSON.stringify(mockData));
                        }
                        else if (endpoint.startsWith('/qrlog')) {
                            // Simulamos 10% de probabilidad de haber escaneado un QR en este ciclo de polling
                            if (Math.random() > 0.9) {
                                const mockTargets = ['TARGET_ALPHA', 'TARGET_BETA', 'TARGET_GAMMA', 'TARGET_DELTA'];
                                const randomTarget = mockTargets[Math.floor(Math.random() * mockTargets.length)];
                                const mockQR = [{
                                    id: Math.floor(Math.random() * 1000),
                                    value: randomTarget,
                                    time: new Date().toLocaleTimeString()
                                }];
                                resolve(JSON.stringify(mockQR));
                            } else {
                                resolve("[]");
                            }
                        }
                        else if (endpoint.startsWith('/move')) {
                            const urlParams = new URLSearchParams(endpoint.split('?')[1]);
                            console.log(`[MOCK] Comando enviado: ${urlParams.get('dir')}`);
                            resolve("OK");
                        }
                        else if (endpoint.startsWith('/pantilt')) {
                            const urlParams = new URLSearchParams(endpoint.split('?')[1]);
                            console.log(`[MOCK] PanTilt movido a: ${urlParams.get('dir')}`);
                            resolve("OK");
                        }
                        else if (endpoint.startsWith('/oled')) {
                            const urlParams = new URLSearchParams(endpoint.split('?')[1]);
                            console.log(`[MOCK] Texto OLED: ${urlParams.get('msg')}`);
                            resolve("OK");
                        }
                        else if (endpoint.startsWith('/buzzer')) {
                            const urlParams = new URLSearchParams(endpoint.split('?')[1]);
                            console.log(`[MOCK] Buzzer: ${urlParams.get('mode')}`);
                            resolve("OK");
                        }
                        else if (endpoint.startsWith('/led')) {
                            console.log(`[MOCK] LED: ${endpoint}`);
                            resolve("OK");
                        }
                        else if (endpoint.startsWith('/auto')) {
                            const urlParams = new URLSearchParams(endpoint.split('?')[1]);
                            console.log(`[MOCK] Autopiloto: ${urlParams.get('mode')}`);
                            resolve("OK");
                        }
                        else {
                            resolve("OK");
                        }
                    }, 200); // 200ms de retraso simulado en la red
                });
            }

            try {
                // Timeout manual para evitar que el fetch se quede colgado eternamente
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(`${BASE_URL}${endpoint}`, {
                    method: 'GET',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error('Status no OK');

                // Si responde bien, actualizamos UI
                if (updateStatus) setConnectionStatus(true);
                return await response.text(); // Retornamos texto, luego procesamos si es JSON

            } catch (error) {
                console.warn(`Error en fetch a ${endpoint}:`, error);
                if (updateStatus) setConnectionStatus(false);
                return null;
            }
        }

        // Actualiza indicadores visuales de si hay conexión
        function setConnectionStatus(connected) {
            isConnected = connected;
            if (connected) {
                statusIndicator.classList.add('connected');
                wifiStatus.innerText = "LINK ESTABLISHED";
                wifiStatus.style.color = "var(--accent-green)";
            } else {
                statusIndicator.classList.remove('connected');
                wifiStatus.innerText = "DISCONNECTED";
                wifiStatus.style.color = "var(--accent-red)";
            }
        }

        /* ========================================= */
        /* CONTROL DE MOVIMIENTO Y PANTILT           */
        /* ========================================= */
        
        // Mapeo de teclas para teclado
        const keyMap = {
            'ArrowUp': 'FORWARD',
            'ArrowDown': 'BACKWARD',
            'ArrowLeft': 'LEFT',
            'ArrowRight': 'RIGHT',
            ' ': 'STOP',       // Espacio
            'w': 'FORWARD',
            's': 'BACKWARD',
            'a': 'LEFT',
            'd': 'RIGHT'
        };

        // Variable para no repetir envíos si la tecla se mantiene pulsada
        let lastMoveCommand = '';
        let controlsBlocked = false; // Bloqueo por colisión

        // Enviar comando de movimiento
        function sendMove(direction) {
            // ANTI-COLISIÓN: Evitar avanzar o girar hacia adelante si estamos bloqueados
            if (controlsBlocked && direction !== 'BACKWARD' && direction !== 'STOP') {
                return; 
            }

            if (direction === lastMoveCommand) return; // Evita spam
            lastMoveCommand = direction;
            
            // Efecto visual en los botones en pantalla
            document.querySelectorAll('.d-btn[data-dir]').forEach(btn => btn.classList.remove('active'));
            if (direction !== 'STOP') {
                const btn = document.querySelector(`.d-btn[data-dir="${direction}"]`);
                if (btn) btn.classList.add('active');
            }

            // Petición real al ESP32
            fetchRobot(`/move?dir=${direction}`);

            // Actualizar modelo 3D del rover
            if (typeof updateRover3D === 'function') updateRover3D(direction);
        }

        // Soltar botón de movimiento = STOP
        function stopMove() {
            if (lastMoveCommand === 'STOP') return;
            sendMove('STOP');
        }

        // Enviar comando PanTilt
        let lastPanTiltCommand = '';
        function sendPanTilt(direction) {
            if (direction === lastPanTiltCommand) return;
            lastPanTiltCommand = direction;

            // Efecto visual
            document.querySelectorAll('.d-btn[data-pt-dir]').forEach(btn => btn.classList.remove('active'));
            if (direction !== 'STOP' && direction !== 'CENTER') {
                const btn = document.querySelector(`.d-btn[data-pt-dir="${direction}"]`);
                if (btn) btn.classList.add('active');
            }

            fetchRobot(`/pantilt?dir=${direction}`);
        }

        function stopPanTilt() {
            if (lastPanTiltCommand === 'STOP' || lastPanTiltCommand === 'CENTER') return;
            sendPanTilt('STOP');
        }

        // Listeners para botones HTML (Mouse y Touch para móviles) - MOVIMIENTO
        document.querySelectorAll('.d-btn[data-dir]').forEach(btn => {
            const dir = btn.dataset.dir;
            btn.addEventListener('mousedown', () => sendMove(dir));
            btn.addEventListener('mouseup', () => stopMove());
            btn.addEventListener('mouseleave', () => stopMove());
            
            // Soporte táctil
            btn.addEventListener('touchstart', (e) => { 
                e.preventDefault(); // Evita mouse events fantasma
                sendMove(dir); 
            });
            btn.addEventListener('touchend', (e) => { 
                e.preventDefault(); 
                stopMove(); 
            });
        });

        // Listeners para botones HTML (Mouse y Touch para móviles) - PANTILT
        document.querySelectorAll('.d-btn[data-pt-dir]').forEach(btn => {
            const dir = btn.dataset.ptDir;
            // Para PanTilt, si es CENTER se queda donde está, o podríamos asumirlo como action click-only, 
            // pero aplicaremos el Dead Man's Switch para las flechas direcionales.
            if (dir === 'CENTER') {
                btn.addEventListener('mousedown', () => sendPanTilt(dir));
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendPanTilt(dir); });
            } else {
                btn.addEventListener('mousedown', () => sendPanTilt(dir));
                btn.addEventListener('mouseup', () => stopPanTilt());
                btn.addEventListener('mouseleave', () => stopPanTilt());
                
                btn.addEventListener('touchstart', (e) => { 
                    e.preventDefault(); 
                    sendPanTilt(dir); 
                });
                btn.addEventListener('touchend', (e) => { 
                    e.preventDefault(); 
                    stopPanTilt(); 
                });
            }
        });

        // Listeners Globales para el Teclado
        window.addEventListener('keydown', (e) => {
            // Ignorar teclas si el usuario está escribiendo en el input del OLED
            if (document.activeElement.tagName === 'INPUT') return;
            
            // Evitar envíos repetidos por pulsar y mantener la tecla
            if (e.repeat) return;
            
            const dir = keyMap[e.key] || keyMap[e.key.toLowerCase()];
            if (dir) {
                e.preventDefault();
                sendMove(dir);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            
            const dir = keyMap[e.key] || keyMap[e.key.toLowerCase()];
            if (dir && dir !== 'STOP') {
                e.preventDefault();
                stopMove();
            }
        });

        /* ========================================= */
        /* BITÁCORA Y OLED                           */
        /* ========================================= */
        const oledScreen = document.getElementById('oled-screen');
        const oledInput = document.getElementById('oled-input');
        const crewIdInput = document.getElementById('crew-id');
        const targetSelect = document.getElementById('target-select');
        const missionIndicator = document.getElementById('mission-indicator');
        const missionTargetDisplay = document.getElementById('mission-target-display');
        const oledBtn = document.getElementById('btn-oled-send');
        const crewLogContainer = document.getElementById('crew-log-container');

        function sendOledMessage() {
            const msg = oledInput.value.trim();
            const crewId = crewIdInput.value.trim() || 'ANONIMO';
            const selectedTarget = targetSelect.value;
            
            if(!msg) return;

            // Registrar misión activa si se seleccionó un objetivo
            if (selectedTarget) {
                misionActiva = {
                    nombre: crewId,
                    mensaje: msg,
                    objetivo: selectedTarget,
                    completada: false
                };
                missionTargetDisplay.innerText = selectedTarget;
                missionIndicator.classList.remove('hidden');
            }

            // 1. Mostrar en pantalla simulada (OLED Override)
            oledScreen.innerText = `> ${msg}`;
            
            // 2. Registrar visualmente en la bitácora
            const time = new Date().toLocaleTimeString();
            const logEntry = `[${time}] [${crewId}]: ${msg}`;
            
            crewHistoryData.push(logEntry); // Se guarda en memoria para exportar después
            
            const li = document.createElement('li');
            li.className = 'crew-log-item';
            li.innerText = logEntry;
            crewLogContainer.prepend(li);
            
            // 3. Enviar al ESP32. Nota: encodeURIComponent es clave para caracteres especiales y espacios.
            fetchRobot(`/oled?msg=${encodeURIComponent(msg)}`);
            
            oledInput.value = '';
        }

        oledBtn.addEventListener('click', sendOledMessage);
        oledInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendOledMessage();
        });

        /* ========================================= */
        /* CHART.JS Y JOYSTICK VIRTUAL               */
        /* ========================================= */
        
        // --- 1. GRÁFICA DE TELEMETRÍA (Chart.js) ---
        let telemetryChart = null;
        const maxChartPoints = 15;

        function initChart() {
            const ctx = document.getElementById('telemetryChart').getContext('2d');
            telemetryChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [], // Tiempos
                    datasets: [
                        {
                            label: 'Temp (°C)',
                            data: [],
                            borderColor: '#378add', /* accent-blue */
                            backgroundColor: 'rgba(55, 138, 221, 0.2)',
                            borderWidth: 2,
                            pointRadius: 2,
                            fill: true,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Hum (%)',
                            data: [],
                            borderColor: '#3ddc84', /* accent-green */
                            backgroundColor: 'rgba(61, 220, 132, 0.2)',
                            borderWidth: 2,
                            pointRadius: 2,
                            fill: true,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    color: '#e0e6ed',
                    plugins: {
                        legend: { labels: { color: '#e0e6ed' } }
                    },
                    scales: {
                        x: { display: false }, /* Ocultar textos del eje X para que no se sature */
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#378add' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { color: '#3ddc84' }
                        }
                    }
                }
            });
        }
        
        // Inicializar la gráfica despues de que cargue el script
        window.addEventListener('load', initChart);

        // --- 2. JOYSTICK TÁCTIL ---
        const joystickBase = document.getElementById('joystick-base');
        const joystickStick = document.getElementById('joystick-stick');
        let stickActive = false;
        let lastJoystickDir = 'STOP';

        if (joystickBase && joystickStick) {
            const maxRadius = 45; // Radio máximo de arrastre

            function handleJoystickMove(e) {
                if (!stickActive) return;

                const baseRect = joystickBase.getBoundingClientRect();
                const centerX = baseRect.left + baseRect.width / 2;
                const centerY = baseRect.top + baseRect.height / 2;

                let clientX = e.clientX;
                let clientY = e.clientY;
                
                if (e.touches && e.touches.length > 0) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                }

                let dx = clientX - centerX;
                let dy = clientY - centerY;
                
                const distance = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);
                
                // Limitar dentro del radio (visual)
                if (distance > maxRadius) {
                    dx = Math.cos(angle) * maxRadius;
                    dy = Math.sin(angle) * maxRadius;
                }

                // Aplicar transformación visual usando CSS Translate relativo al padre
                // Notar que el CSS default tiene top: 50%, left: 50%, transform: translate(-50%, -50%)
                joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                // Determinar dirección base
                let newDir = 'STOP';
                
                // Zona muerta central de 15px
                if (distance > 15) {
                    const dirAngle = angle * (180 / Math.PI); // Convertir a grados (-180 a 180)
                    
                    if (dirAngle >= -45 && dirAngle <= 45) {
                        newDir = 'RIGHT';
                    } else if (dirAngle > 45 && dirAngle < 135) {
                        newDir = 'BACKWARD';
                    } else if (dirAngle >= 135 || dirAngle <= -135) {
                        newDir = 'LEFT';
                    } else if (dirAngle < -45 && dirAngle > -135) {
                        newDir = 'FORWARD';
                    }
                }

                // Solo enviar el fetch si cambió la dirección predominante
                if (newDir !== lastJoystickDir) {
                    lastJoystickDir = newDir;
                    if (newDir === 'STOP') {
                        stopMove();
                    } else {
                        sendMove(newDir);
                    }
                }
            }

            joystickBase.addEventListener('pointerdown', (e) => {
                stickActive = true;
                joystickStick.style.transition = 'none'; // Quitar transición suave
                handleJoystickMove(e);
                joystickBase.setPointerCapture(e.pointerId);
            });

            joystickBase.addEventListener('pointermove', handleJoystickMove);

            const resetJoystick = () => {
                stickActive = false;
                joystickStick.style.transition = 'transform 0.1s linear';
                joystickStick.style.transform = 'translate(-50%, -50%)'; // Devolver al centro
                
                if (lastJoystickDir !== 'STOP') {
                    lastJoystickDir = 'STOP';
                    stopMove();
                }
            };

            joystickBase.addEventListener('pointerup', resetJoystick);
            joystickBase.addEventListener('pointercancel', resetJoystick);
            joystickBase.addEventListener('pointerout', resetJoystick);
        }

        /* ========================================= */
        /* TELEMETRÍA (POLLING)                      */
        /* ========================================= */
        // Declaración anticipada para evitar TDZ (temporal dead zone)
        var isAutopilot = false;

        async function updateTelemetry() {
            const dataStr = await fetchRobot('/telemetry');
            if (!dataStr) return; // Fallo de conexión o parseo

            try {
                // Se asume que el ESP32 devuelve JSON: {"temp": 24.5, "hum": 60, "pres": 1013, "light": 850, "bat": 95}
                const data = JSON.parse(dataStr);

                // Actualizar textos
                if(data.temp !== undefined) document.getElementById('val-temp').innerText = data.temp;
                if(data.hum !== undefined) document.getElementById('val-hum').innerText = data.hum;

                // Presión barométrica (BMP180)
                if(data.pres !== undefined) {
                    document.getElementById('val-pres').innerText = data.pres;
                    document.getElementById('bar-pres').style.width = `${Math.min(((data.pres - 950) / 100) * 100, 100)}%`;
                }

                // Intensidad luminosa (TEMT6000)
                if(data.light !== undefined) {
                    document.getElementById('val-light').innerText = data.light;
                    document.getElementById('bar-light').style.width = `${Math.min((data.light / 4095) * 100, 100)}%`;
                }
                
                if(data.bat !== undefined) {
                    batteryStatus.innerText = `${data.bat}%`;
                    if(data.bat <= 20) batteryStatus.style.color = 'var(--accent-red)';
                    else batteryStatus.style.color = 'var(--accent-green)';
                }

                // Actualizar barras visuales
                if(data.temp !== undefined) document.getElementById('bar-temp').style.width = `${Math.min((data.temp/50)*100, 100)}%`;
                if(data.hum !== undefined) document.getElementById('bar-hum').style.width = `${data.hum}%`;
                
                // SISTEMA DE ALERTA ROJA (HC-SR04)
                if(data.dist !== undefined) {
                    document.getElementById('val-dist').innerText = data.dist;
                    document.getElementById('bar-dist').style.width = `${Math.min(data.dist, 100)}%`;

                    if(data.dist < 15) {
                        if(!controlsBlocked) {
                            controlsBlocked = true;
                            document.body.classList.add('red-alert');
                            document.getElementById('emergency-overlay').classList.remove('hidden');
                            stopMove();
                        }
                    } else {
                        if(controlsBlocked) {
                            controlsBlocked = false;
                            document.body.classList.remove('red-alert');
                            document.getElementById('emergency-overlay').classList.add('hidden');
                        }
                    }
                }

                // SENSOR DE LÍNEA (KY-033)
                if(data.line !== undefined) {
                    const lineVal = document.getElementById('val-line');
                    const lineInd = document.getElementById('line-indicator');
                    if(data.line === 1) {
                        lineVal.innerText = 'DETECTED';
                        lineVal.style.color = 'var(--accent-green)';
                        if(lineInd) lineInd.classList.add('active');
                    } else {
                        lineVal.innerText = 'CLEAR';
                        lineVal.style.color = '#888';
                        if(lineInd) lineInd.classList.remove('active');
                    }
                }


                // Sincronizar estado del autopiloto desde el ESP32
                if (data.auto !== undefined) {
                    syncAutopilotState(data.auto);
                }

                // Actualizar contador de caja negra
                if (data.bbx !== undefined) {
                    document.getElementById('bbx-count').innerText = data.bbx;
                }

                // Actualizar gráfica
                if (telemetryChart && data.temp !== undefined && data.hum !== undefined) {
                    const now = new Date().toLocaleTimeString();
                    
                    telemetryChart.data.labels.push(now);
                    telemetryChart.data.datasets[0].data.push(data.temp);
                    telemetryChart.data.datasets[1].data.push(data.hum);

                    // Mantener tamaño máximo
                    if (telemetryChart.data.labels.length > maxChartPoints) {
                        telemetryChart.data.labels.shift();
                        telemetryChart.data.datasets[0].data.shift();
                        telemetryChart.data.datasets[1].data.shift();
                    }

                    telemetryChart.update('none'); // Update sin animación pesada
                }

            } catch (e) {
                console.error("Error parseando telemetría JSON", e);
            }
        }

        // Ejecutar cada 2 segundos
        setInterval(updateTelemetry, 2000);

        /* ========================================= */
        /* QR LOG (POLLING)                          */
        /* ========================================= */
        const qrList = document.getElementById('qr-list-container');

        async function updateQRLog() {
            const dataStr = await fetchRobot('/qrlog', false); // No afectar status principal con esto
            if (!dataStr) return;

            try {
                // Se espera JSON Array: [{"id": 1, "value": "BASE_ALPHA", "time": "14:05:22"}]
                const qrArray = JSON.parse(dataStr);
                
                if (qrArray && qrArray.length > 0) {
                    // Limpiar "Waiting for target..." la primera vez
                    if(document.querySelector('.qr-item').innerText.includes('Waiting')) {
                        qrList.innerHTML = '';
                    }

                    qrArray.forEach(qr => {
                        // Usar un ID único compuesto para no repetir
                        const uniqueId = `${qr.id}_${qr.value}`;
                        if (!knownQRs.has(uniqueId)) {
                            knownQRs.add(uniqueId);
                            
                            const timeStr = qr.time || new Date().toLocaleTimeString();
                            qrHistoryData.push({ id: qr.id, value: qr.value, time: timeStr });

                            // Crear elemento de lista
                            const li = document.createElement('li');
                            li.className = 'qr-item';
                            li.innerHTML = `
                                <span class="qr-id">[ID:${qr.id}]</span>
                                <span class="qr-val">${qr.value}</span>
                                <span class="qr-time">${timeStr}</span>
                            `;
                            // Insertar al principio
                            qrList.prepend(li);
                            
                            // =====================================
                            // COMPROBACIÓN DE "CAZA DEL TESORO"
                            // =====================================
                            if (misionActiva && !misionActiva.completada && qr.value === misionActiva.objetivo) {
                                // Misión Cumplida!
                                misionActiva.completada = true;
                                triggerProjectionView();
                            }
                        }
                    });
                }
            } catch (e) {
                // console.error("Error parseando QR logs", e);
            }
        }
        
        // Función para mostrar la VISTA 3 (Pantalla Gigante)
        function triggerProjectionView() {
            document.getElementById('view-public').classList.add('hidden');
            document.getElementById('view-private').classList.add('hidden');
            
            document.getElementById('proj-target-name').innerText = misionActiva.objetivo;
            document.getElementById('proj-student-name').innerText = misionActiva.nombre;
            document.getElementById('proj-message-text').innerText = misionActiva.mensaje;
            
            document.getElementById('view-projection').classList.remove('hidden');
            
            // Ocultar el indicador de la vista 1
            missionIndicator.classList.add('hidden');
        }

        // Botón de regresar desde la proyección
        document.getElementById('btn-close-projection').addEventListener('click', () => {
            document.getElementById('view-projection').classList.add('hidden');
            // Retornamos a la vista donde estaba el usuario (probablemente la pública)
            document.getElementById('view-public').classList.remove('hidden');
            misionActiva = null; // Reset de la misión actual
            document.getElementById('target-select').value = '';
        });

        // Ejecutar cada 3 segundos
        setInterval(updateQRLog, 3000);

        /* ========================================= */
        /* EXPORTAR MISIÓN (LOGS)                    */
        /* ========================================= */
        document.getElementById('btn-export').addEventListener('click', () => {
            let content = "=== REPORTE DE MISIÓN XTART-01 ===\r\n";
            content += "FECHA: " + new Date().toLocaleDateString() + "\r\n";
            content += "TIEMPO DE MISIÓN: " + missionTimeDisplay.innerText + "\r\n\r\n";
            
            content += "--- BITÁCORA DE TRIPULACIÓN ---\r\n";
            if (crewHistoryData.length === 0) {
                content += "Sin mensajes registrados.\r\n";
            } else {
                crewHistoryData.slice().reverse().forEach(entry => content += entry + "\r\n");
            }
            
            content += "\r\n--- REGISTROS QR DETECTADOS ---\r\n";
            if (qrHistoryData.length === 0) {
                content += "Ningún objetivo detectado.\r\n";
            } else {
                qrHistoryData.slice().reverse().forEach(qr => {
                    content += `[${qr.time}] ID:${qr.id} - VALOR: ${qr.value}\r\n`;
                });
            }
            
            content += "\r\n=== FIN DEL REPORTE ===";
            
            // Generar Blob (archivo de texto) y desencadenar descarga automática
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_mision_xtart01_${Date.now()}.txt`;
            document.body.appendChild(a); // Necesario para que funcione en Firefox
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); // Liberar memoria
        });

        /* ========================================= */
        /* CONTADOR DE MISIÓN                        */
        /* ========================================= */
        setInterval(() => {
            if (isConnected) {
                missionSeconds++;
                const h = Math.floor(missionSeconds / 3600).toString().padStart(2, '0');
                const m = Math.floor((missionSeconds % 3600) / 60).toString().padStart(2, '0');
                const s = (missionSeconds % 60).toString().padStart(2, '0');
                missionTimeDisplay.innerText = `${h}:${m}:${s}`;
            }
        }, 1000);

        /* ========================================= */
        /* GAMEPAD API (SOPORTE DE MANDO)            */
        /* ========================================= */
        let lastGamepadMoveDir = 'STOP';
        let lastGamepadPanTiltDir = 'CENTER';

        function checkGamepad() {
            const gamepads = navigator.getGamepads();
            if (!gamepads) return;

            // Tomar el primer gamepad conectado
            const gp = gamepads[0];
            if (gp) {
                const deadzone = 0.2;

                // --- 1. Movimiento del Rover (Stick Izquierdo) ---
                const axisX_L = gp.axes[0]; // Izquierda-Derecha (L)
                const axisY_L = gp.axes[1]; // Arriba-Abajo (L)
                
                let newMoveDir = 'STOP';

                if (Math.abs(axisX_L) < deadzone && Math.abs(axisY_L) < deadzone) {
                    newMoveDir = 'STOP';
                } else if (Math.abs(axisY_L) > Math.abs(axisX_L)) {
                    // Predomina eje Y
                    newMoveDir = axisY_L < 0 ? 'FORWARD' : 'BACKWARD';
                } else {
                    // Predomina eje X
                    newMoveDir = axisX_L < 0 ? 'LEFT' : 'RIGHT';
                }

                if (newMoveDir !== lastGamepadMoveDir) {
                    // Evitamos conflictos con el joystick virtual si está en uso
                    if (!stickActive) {
                        lastGamepadMoveDir = newMoveDir;
                        if (newMoveDir === 'STOP') {
                            stopMove();
                        } else {
                            sendMove(newMoveDir);
                        }
                    }
                }

                // --- 2. Movimiento Cámara PanTilt (Stick Derecho) ---
                // Nota: Algunos mandos mapean diferentemente sus ejes derechos,
                // estandarizamos ejes 2 (X) y 3 (Y) para Xbox/Playstation
                const axisX_R = gp.axes[2];
                const axisY_R = gp.axes[3];
                
                let newPanTiltDir = 'CENTER';

                if (Math.abs(axisX_R) < deadzone && Math.abs(axisY_R) < deadzone) {
                    newPanTiltDir = 'CENTER';
                } else if (Math.abs(axisY_R) > Math.abs(axisX_R)) {
                    // Predomina eje Y
                    newPanTiltDir = axisY_R < 0 ? 'UP' : 'DOWN';
                } else {
                    // Predomina eje X
                    newPanTiltDir = axisX_R < 0 ? 'LEFT' : 'RIGHT';
                }

                if (newPanTiltDir !== lastGamepadPanTiltDir) {
                    lastGamepadPanTiltDir = newPanTiltDir;
                    // Solo evitamos enviar CENTER repetidamente ya que el endpoint /pantilt manual no tiene STOP general
                    // o podrías agregar lógica manual aquí. Por ahora, imita los botones.
                    if (newPanTiltDir !== 'CENTER') {
                        fetchRobot(`/pantilt?dir=${newPanTiltDir}`);
                        
                        // Efecto visual en la UI
                        document.querySelectorAll('#pantilt-dpad .d-btn').forEach(b => {
                            if(b.dataset.ptDir === newPanTiltDir) {
                                b.classList.add('active');
                                setTimeout(() => b.classList.remove('active'), 100);
                            }
                        });
                    }
                }
            }
            
            // Loop constante ligado al renderizado del navegador
            requestAnimationFrame(checkGamepad);
        }

        // Iniciar el loop de chequeo de Gamepads
        window.addEventListener('gamepadconnected', () => {
            console.log("Gamepad detectado! Activando GameLoop...");
            requestAnimationFrame(checkGamepad);
        });

        /* ========================================= */
        /* CONTROL POR VOZ (Web Speech API)          */
        /* ========================================= */
        const btnVoice = document.getElementById('btn-voice');
        const voiceLog = document.getElementById('voice-log');
        let speechRecognition;
        let isVoiceActive = false;

        // Verificar soporte del navegador
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
            speechRecognition = new SpeechRecognitionConstructor();
            
            speechRecognition.continuous = true;
            speechRecognition.interimResults = false;
            speechRecognition.lang = 'es-ES'; // Castellano

            // Diccionario expandido de comandos de voz
            const voiceCommands = {
                // Movimiento
                'adelante':   () => { sendMove('FORWARD');  voiceLog.innerText = '🔼 AVANZANDO'; },
                'avanza':     () => { sendMove('FORWARD');  voiceLog.innerText = '🔼 AVANZANDO'; },
                'atrás':      () => { sendMove('BACKWARD'); voiceLog.innerText = '🔽 RETROCEDIENDO'; },
                'atras':      () => { sendMove('BACKWARD'); voiceLog.innerText = '🔽 RETROCEDIENDO'; },
                'izquierda':  () => { sendMove('LEFT');     voiceLog.innerText = '◀ GIRANDO IZQUIERDA'; },
                'derecha':    () => { sendMove('RIGHT');    voiceLog.innerText = '▶ GIRANDO DERECHA'; },
                'alto':       () => { stopMove();           voiceLog.innerText = '⏹ DETENIDO'; },
                'parar':      () => { stopMove();           voiceLog.innerText = '⏹ DETENIDO'; },
                'stop':       () => { stopMove();           voiceLog.innerText = '⏹ DETENIDO'; },
                'frena':      () => { stopMove();           voiceLog.innerText = '⏹ FRENADO'; },
                // Sistemas
                'alarma':     () => { fetchRobot('/buzzer?mode=rapid'); voiceLog.innerText = '🔊 ALARMA ACTIVADA'; },
                'silencio':   () => { fetchRobot('/buzzer?mode=off');   voiceLog.innerText = '🔇 ALARMA DESACTIVADA'; },
                'rojo':       () => { fetchRobot('/led?r=255&g=0&b=0'); voiceLog.innerText = '🔴 LED ROJO'; },
                'verde':      () => { fetchRobot('/led?r=0&g=255&b=0'); voiceLog.innerText = '🟢 LED VERDE'; },
                'azul':       () => { fetchRobot('/led?r=0&g=0&b=255'); voiceLog.innerText = '🔵 LED AZUL'; },
                'automático': () => { fetchRobot('/led?mode=auto');     voiceLog.innerText = '⚙️ LED EN AUTO'; },
                // Autopiloto
                'autopiloto': () => { toggleAutopilot(); voiceLog.innerText = '🤖 AUTOPILOTO ALTERNADO'; },
                'patrulla':   () => { toggleAutopilot(); voiceLog.innerText = '🤖 PATRULLA ALTERNADA'; },
                // Cámara
                'arriba':     () => { fetchRobot('/pantilt?dir=UP');     voiceLog.innerText = '📷 CÁMARA ARRIBA'; },
                'abajo':      () => { fetchRobot('/pantilt?dir=DOWN');   voiceLog.innerText = '📷 CÁMARA ABAJO'; },
                'centro':     () => { fetchRobot('/pantilt?dir=CENTER'); voiceLog.innerText = '📷 CÁMARA CENTRADA'; },
            };

            speechRecognition.onstart = () => {
                isVoiceActive = true;
                btnVoice.classList.add('voice-active');
                btnVoice.innerText = "🎙️ Escuchando...";
                voiceLog.innerText = "[Di: Adelante, Stop, Alarma, Patrulla, Rojo...]";
            };

            speechRecognition.onresult = (event) => {
                const lastResultIndex = event.results.length - 1;
                const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
                
                console.log(`[VOZ] Reconocido: "${transcript}"`);
                
                // Buscar la primera palabra clave que coincida
                let matched = false;
                for (const [keyword, action] of Object.entries(voiceCommands)) {
                    if (transcript.includes(keyword)) {
                        action();
                        matched = true;
                        break;
                    }
                }
                
                if (!matched) {
                    voiceLog.innerText = `❓ No entendido: "${transcript}"`;
                }
            };

            speechRecognition.onerror = (event) => {
                console.warn('Error de reconocimiento de voz:', event.error);
                if (event.error === 'not-allowed') {
                    voiceLog.innerText = "Error: Permiso de micrófono denegado.";
                    btnVoice.classList.remove('voice-active');
                    btnVoice.innerText = "🎙️ Control por Voz [OFF]";
                    isVoiceActive = false;
                }
            };

            speechRecognition.onend = () => {
                // Reiniciar si el usuario no lo ha apagado explícitamente
                if(isVoiceActive) {
                    speechRecognition.start();
                } else {
                    btnVoice.classList.remove('voice-active');
                    btnVoice.innerText = "🎙️ Control por Voz [OFF]";
                    voiceLog.innerText = "Sistema de voz apagado.";
                }
            };

            btnVoice.addEventListener('click', () => {
                if (isVoiceActive) {
                    isVoiceActive = false;
                    speechRecognition.stop();
                } else {
                    try {
                        speechRecognition.start();
                    } catch (e) {
                        console.error('El reconocimiento ya ha iniciado', e);
                    }
                }
            });

        } else {
            console.warn('Web Speech API no disponible en este navegador.');
            btnVoice.disabled = true;
            btnVoice.style.opacity = '0.5';
            btnVoice.innerText = "🎙️ Voz No Soportada";
            voiceLog.innerText = "Utiliza Chrome o Edge para el control por voz.";
        }

        /* ========================================= */
        /* CONTROL DE SISTEMAS (BUZZER + LED RGB)    */
        /* ========================================= */
        
        // Buzzer
        document.getElementById('btn-buzzer-on').addEventListener('click', () => {
            fetchRobot('/buzzer?mode=rapid');
        });
        document.getElementById('btn-buzzer-off').addEventListener('click', () => {
            fetchRobot('/buzzer?mode=off');
        });

        // LED RGB
        document.getElementById('btn-led-r').addEventListener('click', () => {
            fetchRobot('/led?r=255&g=0&b=0');
        });
        document.getElementById('btn-led-g').addEventListener('click', () => {
            fetchRobot('/led?r=0&g=255&b=0');
        });
        document.getElementById('btn-led-b').addEventListener('click', () => {
            fetchRobot('/led?r=0&g=0&b=255');
        });
        document.getElementById('btn-led-auto').addEventListener('click', () => {
            fetchRobot('/led?mode=auto');
        });

        /* ========================================= */
        /* MODO AUTOPILOTO                           */
        /* ========================================= */
        // isAutopilot ya declarado arriba (antes de telemetría)
        const btnAutopilot = document.getElementById('btn-autopilot');
        const autoBadge = document.getElementById('auto-badge');

        function toggleAutopilot() {
            isAutopilot = !isAutopilot;
            if (isAutopilot) {
                fetchRobot('/auto?mode=on');
                btnAutopilot.classList.add('active');
                btnAutopilot.innerText = '🤖 AUTOPILOTO [ON]';
                autoBadge.classList.remove('hidden');
            } else {
                fetchRobot('/auto?mode=off');
                btnAutopilot.classList.remove('active');
                btnAutopilot.innerText = '🤖 AUTOPILOTO [OFF]';
                autoBadge.classList.add('hidden');
            }
        }

        btnAutopilot.addEventListener('click', toggleAutopilot);

        // Sincronizar UI con el estado real del ESP32 (desde telemetría)
        function syncAutopilotState(autoFromServer) {
            if (autoFromServer === 1 && !isAutopilot) {
                isAutopilot = true;
                btnAutopilot.classList.add('active');
                btnAutopilot.innerText = '🤖 AUTOPILOTO [ON]';
                autoBadge.classList.remove('hidden');
            } else if (autoFromServer === 0 && isAutopilot) {
                isAutopilot = false;
                btnAutopilot.classList.remove('active');
                btnAutopilot.innerText = '🤖 AUTOPILOTO [OFF]';
                autoBadge.classList.add('hidden');
            }
        }

        /* ========================================= */
        /* CAJA NEGRA (BLACK BOX)                    */
        /* ========================================= */
        document.getElementById('btn-bbx-download').addEventListener('click', () => {
            if (MOCK_MODE) {
                // Generar CSV mock para demostración
                let csv = "T+s,Event,Temp,Hum,Pres,Light,Dist,ColorR,ColorG,ColorB,Line,Detail\n";
                csv += "0,BOOT,22.3,45,1013.2,500,80,100,120,90,0,Sistema iniciado\n";
                csv += "10,TELEMETRY,22.5,44,1013.1,510,75,105,115,95,0,MANUAL\n";
                csv += "20,ALERT_COLLISION,23.0,46,1013.0,480,12,100,120,90,0,12cm\n";
                csv += "30,AUTO_ON,22.8,45,1013.3,520,45,110,130,85,1,Patrulla iniciada\n";
                csv += "40,OBSTACLE,23.1,44,1013.2,490,8,100,120,90,0,8cm\n";
                csv += "50,EVADE,23.0,45,1013.1,500,35,100,120,90,0,Girando para esquivar\n";
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `blackbox_xtart01_${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('[MOCK] BlackBox CSV descargado');
            } else {
                // Descargar directamente del ESP32
                window.open(`${BASE_URL}/blackbox`, '_blank');
            }
        });

        document.getElementById('btn-bbx-clear').addEventListener('click', () => {
            if (confirm('¿Borrar todos los datos de la caja negra?')) {
                if (MOCK_MODE) {
                    document.getElementById('bbx-count').innerText = '0';
                    console.log('[MOCK] BlackBox borrada');
                } else {
                    fetchRobot('/blackbox/clear');
                }
            }
        });

        /* ========================================= */
        /* TRANSMISOR OLED                           */
        /* ========================================= */
        document.getElementById('btn-oled-send')?.addEventListener('click', () => {
            const inputEl = document.getElementById('oled-input');
            const text = inputEl.value.trim();
            if (text.length > 0) {
                fetchRobot('/oled?msg=' + encodeURIComponent(text));
                inputEl.value = '';
                console.log(`[OLED] Enviado: ${text}`);
            }
        });

        /* ========================================= */
        /* MAPA 3D DE RASTREO (THREE.JS)             */
        /* ========================================= */
        var rover3DInitialized = false;
        function initRover3D() {
            if (rover3DInitialized) return;
            rover3DInitialized = true;
            const container = document.getElementById('rover-3d-container');
            if (!container || typeof THREE === 'undefined') return;

            // --- Escena, cámara, renderer ---
            const scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x030712, 0.015);

            const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 500);
            camera.position.set(0, 12, 15);
            camera.lookAt(0, 0, 0);

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x030712);
            container.appendChild(renderer.domElement);

            // --- Luces ---
            const ambientLight = new THREE.AmbientLight(0x8899bb, 1.0);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
            dirLight.position.set(10, 20, 10);
            scene.add(dirLight);

            const pointLight = new THREE.PointLight(0x10b981, 0.5, 40);
            pointLight.position.set(0, 5, 0);
            scene.add(pointLight);

            // --- Suelo con cuadrícula ---
            const gridHelper = new THREE.GridHelper(100, 50, 0x38bdf8, 0x1e3a5c);
            scene.add(gridHelper);

            // Suelo sólido semitransparente
            const floorGeo = new THREE.PlaneGeometry(100, 100);
            const floorMat = new THREE.MeshStandardMaterial({
                color: 0x050d1a,
                transparent: true,
                opacity: 0.4,
                roughness: 0.9
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.01;
            scene.add(floor);

            // --- Modelo del Rover (desde rover3d.js — referencia CAD) ---
            const roverData = buildRoverModel(THREE);
            const roverGroup = roverData.roverGroup;
            const wheels = roverData.wheels;
            const antBallMat = roverData.antBallMat;
            const ledMat = roverData.ledMat;
            const headlightMat = roverData.headlightMat;
            const lensMat = roverData.lensMat;

            scene.add(roverGroup);

            // --- Trail (rastro de desplazamiento) ---
            const maxTrailPoints = 500;
            const trailPositions = new Float32Array(maxTrailPoints * 3);
            const trailGeo = new THREE.BufferGeometry();
            trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            trailGeo.setDrawRange(0, 0);
            const trailMat = new THREE.LineBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.6
            });
            const trailLine = new THREE.Line(trailGeo, trailMat);
            scene.add(trailLine);

            // --- Estado del rover ---
            let roverX = 0, roverZ = 0;
            let roverHeading = 0; // en radianes, 0 = mirando hacia +Z
            let totalDistance = 0;
            let trailPointCount = 0;
            let showTrail = true;
            let currentDirection = 'STOP';

            const MOVE_SPEED = 0.12;
            const TURN_SPEED = 0.04;

            function addTrailPoint() {
                if (!showTrail || trailPointCount >= maxTrailPoints) return;
                const idx = trailPointCount * 3;
                trailPositions[idx]     = roverX;
                trailPositions[idx + 1] = 0.05;
                trailPositions[idx + 2] = roverZ;
                trailPointCount++;
                trailGeo.attributes.position.needsUpdate = true;
                trailGeo.setDrawRange(0, trailPointCount);
            }

            // --- Función pública para conectar con sendMove() ---
            window.updateRover3D = function(direction) {
                currentDirection = direction;
            };

            // --- Actualización de posición por frame ---
            let lastTrailDist = 0;

            function updateRoverPosition() {
                if (currentDirection === 'STOP') return;

                let moved = false;

                if (currentDirection === 'FORWARD') {
                    roverX += Math.sin(roverHeading) * MOVE_SPEED;
                    roverZ += Math.cos(roverHeading) * MOVE_SPEED;
                    totalDistance += MOVE_SPEED;
                    moved = true;
                    // Girar ruedas
                    wheels.forEach(w => w.rotation.x += 0.1);
                }
                else if (currentDirection === 'BACKWARD') {
                    roverX -= Math.sin(roverHeading) * MOVE_SPEED;
                    roverZ -= Math.cos(roverHeading) * MOVE_SPEED;
                    totalDistance += MOVE_SPEED;
                    moved = true;
                    wheels.forEach(w => w.rotation.x -= 0.1);
                }
                else if (currentDirection === 'LEFT') {
                    roverHeading += TURN_SPEED;
                }
                else if (currentDirection === 'RIGHT') {
                    roverHeading -= TURN_SPEED;
                }

                // Actualizar posición del grupo
                roverGroup.position.x = roverX;
                roverGroup.position.z = roverZ;
                roverGroup.rotation.y = roverHeading;

                // Trail: añadir punto cada cierta distancia
                if (moved && totalDistance - lastTrailDist > 0.3) {
                    addTrailPoint();
                    lastTrailDist = totalDistance;
                }

                // Mover la point light con el rover
                pointLight.position.set(roverX, 5, roverZ);

                // Actualizar UI
                document.getElementById('rover-pos-x').innerText = roverX.toFixed(1);
                document.getElementById('rover-pos-y').innerText = roverZ.toFixed(1);
                document.getElementById('rover-heading').innerText = ((roverHeading * 180 / Math.PI) % 360).toFixed(0) + '°';
                document.getElementById('rover-total-dist').innerText = totalDistance.toFixed(1) + 'm';
            }

            // --- Cámara sigue al rover suavemente ---
            function updateCamera() {
                const targetX = roverX - Math.sin(roverHeading) * 10;
                const targetZ = roverZ - Math.cos(roverHeading) * 10;

                camera.position.x += (targetX - camera.position.x) * 0.03;
                camera.position.z += (targetZ + 5 - camera.position.z) * 0.03;
                camera.position.y += (12 - camera.position.y) * 0.03;

                camera.lookAt(roverX, 0, roverZ);
            }

            // --- Pulso de la antena y luces ---
            let pulseTime = 0;
            function updatePulse() {
                pulseTime += 0.03;
                antBallMat.emissiveIntensity = 0.4 + Math.sin(pulseTime * 2) * 0.5;
                ledMat.emissiveIntensity = 0.6 + Math.sin(pulseTime * 3) * 0.4;
                headlightMat.emissiveIntensity = 1.0 + Math.sin(pulseTime * 1.5) * 0.5;
                lensMat.emissiveIntensity = 0.5 + Math.sin(pulseTime * 4) * 0.3;
            }

            // --- Bucle de renderizado ---
            function animate() {
                requestAnimationFrame(animate);
                updateRoverPosition();
                updateCamera();
                updatePulse();
                renderer.render(scene, camera);
            }
            animate();

            // --- Responsive ---
            window.addEventListener('resize', () => {
                if (!container.clientWidth) return;
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            });

            // --- Botones de control del mapa ---
            document.getElementById('btn-reset-track')?.addEventListener('click', () => {
                roverX = 0; roverZ = 0; roverHeading = 0;
                totalDistance = 0; lastTrailDist = 0;
                trailPointCount = 0;
                trailGeo.setDrawRange(0, 0);
                roverGroup.position.set(0, 0, 0);
                roverGroup.rotation.y = 0;
                camera.position.set(0, 12, 15);

                document.getElementById('rover-pos-x').innerText = '0.0';
                document.getElementById('rover-pos-y').innerText = '0.0';
                document.getElementById('rover-heading').innerText = '0°';
                document.getElementById('rover-total-dist').innerText = '0.0m';
            });

            document.getElementById('btn-toggle-trail')?.addEventListener('click', function() {
                showTrail = !showTrail;
                trailLine.visible = showTrail;
                this.innerText = showTrail ? '🛤️ TRAIL ON' : '🛤️ TRAIL OFF';
                this.style.borderColor = showTrail ? '' : 'var(--accent-red)';
                this.style.color = showTrail ? '' : 'var(--accent-red)';
            });

            console.log('[3D] Tracking Map inicializado correctamente.');
        }