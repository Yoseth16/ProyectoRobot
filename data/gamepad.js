
// ==========================================
// 8. CONFIGURACIÓN, PID Y CÁMARA (NUEVO)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const btnSettings = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-settings-close');

    // Toggle Modal
    btnSettings?.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
    btnCloseSettings?.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // ESP32-CAM Feed
    const btnCamConnect = document.getElementById('btn-cam-connect');
    const camIpInput = document.getElementById('cam-ip-input');
    const videoStream = document.getElementById('video-stream');
    const camOfflineTxt = document.getElementById('cam-offline');

    btnCamConnect?.addEventListener('click', () => {
        const ip = camIpInput.value.trim();
        if (ip) {
            // El ESP32-CAM suele emitir en el puerto 81 por defecto
            const streamUrl = `http://${ip}:81/stream`;
            videoStream.src = streamUrl;
            videoStream.style.display = 'block';
            camOfflineTxt.style.display = 'none';
            console.log(`[CAM] Conectando a stream: ${streamUrl}`);
            btnCamConnect.innerText = "CONECTADO";
            btnCamConnect.style.borderColor = "var(--accent-green)";
            btnCamConnect.style.color = "var(--accent-green)";
        }
    });

    // PID Sliders
    const sliderKp = document.getElementById('slider-kp');
    const sliderKi = document.getElementById('slider-ki');
    const sliderKd = document.getElementById('slider-kd');
    const valKp = document.getElementById('val-kp');
    const valKi = document.getElementById('val-ki');
    const valKd = document.getElementById('val-kd');

    const updatePIDLabels = () => {
        if(valKp) valKp.innerText = sliderKp.value;
        if(valKi) valKi.innerText = sliderKi.value;
        if(valKd) valKd.innerText = sliderKd.value;
    };

    sliderKp?.addEventListener('input', updatePIDLabels);
    sliderKi?.addEventListener('input', updatePIDLabels);
    sliderKd?.addEventListener('input', updatePIDLabels);

    document.getElementById('btn-send-pid')?.addEventListener('click', () => {
        const kp = sliderKp.value;
        const ki = sliderKi.value;
        const kd = sliderKd.value;
        fetchWithTimeout(`${API_BASE}/pid?kp=${kp}&ki=${ki}&kd=${kd}`)
            .then(res => {
                console.log(`[PID] Valores actualizados: Kp=${kp}, Ki=${ki}, Kd=${kd}`);
                const btn = document.getElementById('btn-send-pid');
                const oldText = btn.innerText;
                btn.innerText = "¡PID ENVIADO!";
                btn.style.borderColor = "var(--accent-green)";
                btn.style.color = "var(--accent-green)";
                setTimeout(() => {
                    btn.innerText = oldText;
                    btn.style.borderColor = "var(--accent-yellow)";
                    btn.style.color = "var(--accent-yellow)";
                }, 2000);
            })
            .catch(err => console.error('[PID] Error al enviar:', err));
    });
});

// ==========================================
// 9. GAMEPAD API (SOPORTE PARA MANDO)
// ==========================================
let gamepadIndex = null;
let lastGamepadState = { fw: false, bw: false, l: false, r: false };

window.addEventListener("gamepadconnected", (e) => {
    gamepadIndex = e.gamepad.index;
    const statusEl = document.getElementById('gamepad-status');
    if (statusEl) {
        statusEl.innerText = `🎮 MANDO CONECTADO`;
        statusEl.style.color = 'var(--accent-green)';
    }
    console.log(`[Gamepad] Conectado: ${e.gamepad.id}`);
    requestAnimationFrame(updateGamepad);
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === gamepadIndex) {
        gamepadIndex = null;
        const statusEl = document.getElementById('gamepad-status');
        if (statusEl) {
            statusEl.innerText = `🎮 NO GAMEPAD`;
            statusEl.style.color = '#555';
        }
        console.log(`[Gamepad] Desconectado`);
    }
});

function updateGamepad() {
    if (gamepadIndex === null) return;
    
    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];
    if (!gp) return;

    // Joysticks analógicos (Eje 1: Y-izq, Eje 0: X-izq)
    const deadzone = 0.2;
    let fw = false, bw = false, l = false, r = false;

    if (gp.axes[1] < -deadzone) fw = true;
    else if (gp.axes[1] > deadzone) bw = true;

    if (gp.axes[0] < -deadzone) l = true;
    else if (gp.axes[0] > deadzone) r = true;

    // DPAD (Botones 12=Up, 13=Down, 14=Left, 15=Right)
    if (gp.buttons[12]?.pressed) fw = true;
    if (gp.buttons[13]?.pressed) bw = true;
    if (gp.buttons[14]?.pressed) l = true;
    if (gp.buttons[15]?.pressed) r = true;

    // Determinar dirección a enviar
    let sendDir = null;
    if (fw && !l && !r) sendDir = 'FORWARD';
    else if (bw && !l && !r) sendDir = 'BACKWARD';
    else if (l && !fw && !bw) sendDir = 'LEFT';
    else if (r && !fw && !bw) sendDir = 'RIGHT';
    else if (fw && l) sendDir = 'FORWARD_LEFT';
    else if (fw && r) sendDir = 'FORWARD_RIGHT';
    else if (bw && l) sendDir = 'BACKWARD_LEFT';
    else if (bw && r) sendDir = 'BACKWARD_RIGHT';

    // Si no hay input y antes había, enviar STOP
    if (!fw && !bw && !l && !r && (lastGamepadState.fw || lastGamepadState.bw || lastGamepadState.l || lastGamepadState.r)) {
        sendDir = 'STOP';
    }

    if (sendDir) {
        // Evitamos spammear el mismo comando continuamente si no cambia la zona
        if (!window._lastGpCmd || window._lastGpCmd !== sendDir) {
            fetchWithTimeout(`${API_BASE}/move?dir=${sendDir}`).catch(e => console.log(e));
            if(typeof updateRover3D === 'function') updateRover3D(sendDir); // Actualizar mapa 3D
            window._lastGpCmd = sendDir;
        }
    }

    // Actualizar estado previo
    lastGamepadState = { fw, bw, l, r };

    // Continuar el bucle
    requestAnimationFrame(updateGamepad);
}

// ==========================================
// 10. PUBLIC MESSAGES INBOX (BANDEJA PÚBLICA)
// ==========================================
let msgReceptionOn = true;
let publicMessages = [];

document.addEventListener('DOMContentLoaded', () => {
    const msgLog = document.getElementById('public-messages-log');
    const btnMsgClear = document.getElementById('btn-msg-clear');
    const btnMsgToggle = document.getElementById('btn-msg-toggle');
    const msgStatusBadge = document.getElementById('msg-status-badge');

    function renderMessages() {
        if (!msgLog) return;
        if (publicMessages.length === 0) {
            msgLog.innerHTML = '<div style="color: #666; text-align: center; margin-top: 40px;">[ ESPERANDO MENSAJES ]</div>';
            return;
        }
        msgLog.innerHTML = publicMessages.map(m => 
            `<div style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 8px;">
                <span style="color: #888;">[${m.time}]</span> 
                <span style="color: var(--accent-cyan);">IP:${m.ip}</span><br>
                <strong style="color: #fff;">"${m.msg}"</strong>
                <button class="action-btn" style="padding: 2px 8px; font-size: 0.7rem; float: right; border-color: var(--accent-green); color: var(--accent-green);" onclick="document.getElementById('oled-input').value='${m.msg}'">CARGAR A OLED</button>
            </div>`
        ).join('');
    }

    // Exponemos la función para poder llamarla desde main.js si es necesario
    window.addPublicMessage = function(msg, fromIP = "192.168.4.15") {
        if (!msgReceptionOn) return;
        const time = new Date().toLocaleTimeString();
        publicMessages.unshift({ time, msg, ip: fromIP });
        if (publicMessages.length > 50) publicMessages.pop(); // Limitar historial a 50
        renderMessages();
    };

    btnMsgClear?.addEventListener('click', () => {
        publicMessages = [];
        renderMessages();
    });

    btnMsgToggle?.addEventListener('click', () => {
        msgReceptionOn = !msgReceptionOn;
        btnMsgToggle.innerText = msgReceptionOn ? "⏸️ PAUSAR" : "▶️ REANUDAR";
        btnMsgToggle.style.borderColor = msgReceptionOn ? "var(--accent-yellow)" : "var(--accent-green)";
        btnMsgToggle.style.color = msgReceptionOn ? "var(--accent-yellow)" : "var(--accent-green)";
        
        if (msgStatusBadge) {
            msgStatusBadge.innerText = msgReceptionOn ? "RECEPCIÓN: ON" : "RECEPCIÓN: OFF";
            msgStatusBadge.style.color = msgReceptionOn ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    // Simulador de recepción de mensajes (solo para ver cómo funciona sin múltiples clientes reales)
    setInterval(() => {
        // MOCK_MODE viene de main.js
        if (typeof MOCK_MODE !== 'undefined' && MOCK_MODE && msgReceptionOn && Math.random() > 0.90) {
            const randomMsgs = [
                "Hola robot!!", 
                "¿A dónde vas?", 
                "¡Cuidado con la pared!", 
                "Xtart-01 en línea", 
                "Saludos desde la Tierra",
                "¿Puedes ver esto?"
            ];
            const rMsg = randomMsgs[Math.floor(Math.random() * randomMsgs.length)];
            window.addPublicMessage(rMsg, `192.168.4.${Math.floor(Math.random() * 20 + 2)}`);
        }
    }, 5000);
});
