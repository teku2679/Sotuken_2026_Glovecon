const connectBtn = document.getElementById('connectBtn');
const connectionType = document.getElementById('connectionType');
const statusIndicator = document.getElementById('statusIndicator');
const robotControls = document.getElementById('robotControls');
const relayControls = document.getElementById('relayControls');
const connectGloveBtn = document.getElementById('connectGloveBtn');
const connectRelayRobotBtn = document.getElementById('connectRelayRobotBtn');
const relayGloveTransport = document.getElementById('relayGloveTransport');
const relayRobotTransport = document.getElementById('relayRobotTransport');
const startRelayBtn = document.getElementById('startRelayBtn');
const stopRelayBtn = document.getElementById('stopRelayBtn');
const disconnectRelayBtn = document.getElementById('disconnectRelayBtn');
const gloveRelayStatus = document.getElementById('gloveRelayStatus');
const robotRelayStatus = document.getElementById('robotRelayStatus');
const relayModeStatus = document.getElementById('relayModeStatus');
const relayPoseStatus = document.getElementById('relayPoseStatus');
const relaySensitivity = document.getElementById('relaySensitivity');
const robotSpeed = document.getElementById('robotSpeed');
const robotMinSpeed = document.getElementById('robotMinSpeed');
const robotSpeedValue = document.getElementById('robotSpeedValue');
const robotJoystick = document.getElementById('robotJoystick');
const joystickThumb = document.getElementById('joystickThumb');
const joystickState = document.getElementById('joystickState');
const sensorDashboard = document.getElementById('sensorDashboard');

const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_SENSOR_PACKET_BYTES = 26;
const ROBOT_DEVICE_NAME = "PicoW_Robot_BLE";

let isConnected = false;
let isConnecting = false;

let serialPort = null;
let serialReader = null;
let bleDevice = null;
let bleServer = null;
let bleNotifyCharacteristic = null;
let bleWriteCharacteristic = null;
let webSocket = null;
let activeMode = null;
let robotWifiConnected = false;
let activeRobotAction = null;
let activeRobotSpeed = 0;
let activeRobotLeft = 0;
let activeRobotRight = 0;
let robotCommandTimer = null;
let joystickPointerId = null;
let joystickX = 0;
let joystickY = 0;
let pendingRobotCommand = null;
let pendingRobotCommandImmediate = false;
let pendingRobotCommandWaiters = [];
let robotWriteInProgress = false;
let robotWriteTimer = null;
let lastRobotWriteAt = 0;
const ROBOT_WRITE_INTERVAL_MS = 25;
let relayGloveDevice = null;
let relayGloveServer = null;
let relayGloveNotifyCharacteristic = null;
let relayGloveWriteCharacteristic = null;
let relayGlovePort = null;
let relayGloveReader = null;
let relayGloveWifiRequested = false;
let relayRobotDevice = null;
let relayRobotServer = null;
let relayRobotWriteCharacteristic = null;
let relayRobotWifiRequested = false;
let relayRobotWifiConnected = false;
let relayWifiSocket = null;
let relayWifiSocketPromise = null;
let relayRobotWifiPollTimer = null;
let relayGloveConnecting = false;
let relayRobotConnecting = false;
let relayArmed = false;
let relayNeutralQuaternion = null;
let latestGloveQuaternion = null;
let chartRedrawPending = false;
let bleConnectStage = 'idle';
let bleConnectStartedAt = 0;
let bleRateWindowStartedAt = 0;
let bleNotificationCount = 0;
let bleDataRecordCount = 0;

let keepReading = false;
let receiveBuffer = "";

// 📊 13個のデータを4つのグラフに割り当て
const chartConfigs = [
    {
        id: 'chart0',
        label: 'Quaternion',
        indices: [0, 1, 2, 3],
        series: ['QW', 'QX', 'QY', 'QZ'],
        colors: ['#00ffcc', '#ff5555', '#ffff55', '#55aaff'],
        precision: 3
    },
    {
        id: 'chart1',
        label: 'Acceleration',
        indices: [4, 5, 6],
        series: ['AccX', 'AccY', 'AccZ'],
        colors: ['#00ffcc', '#ff5555', '#55ff55'],
        precision: 0
    },
    {
        id: 'chart2',
        label: 'Flex_Group1',
        indices: [7, 8, 9],
        series: ['Flex1', 'Flex2', 'Flex3'],
        colors: ['#ff5555', '#55ff55', '#5599ff'],
        precision: 0
    },
    {
        id: 'chart3',
        label: 'Flex_Group2',
        indices: [10, 11, 12],
        series: ['Flex4', 'Flex5', 'Flex6'],
        colors: ['#ff55ff', '#ffaa00', '#00aaff'],
        precision: 0
    }
];

const maxPoints = 120;
const channelData = Array.from({ length: 13 }, () => []);
const chartContexts = [];

function initCharts() {
    chartConfigs.forEach((config, idx) => {
        const canvas = document.getElementById(config.id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        chartContexts[idx] = ctx;
        resizeCanvas(canvas, ctx);
    });
}

function resizeCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function redrawAllCharts() {
    chartConfigs.forEach((_, idx) => drawChart(idx));
}

function scheduleChartRedraw() {
    if (chartRedrawPending) return;
    chartRedrawPending = true;
    window.requestAnimationFrame(() => {
        chartRedrawPending = false;
        redrawAllCharts();
    });
}

function valueRange(config) {
    if (config.label === 'Quaternion') return { min: -1.0, max: 1.0 };
    if (config.label === 'Acceleration') return { min: -2048, max: 2048 };
    return { min: 0, max: 4096 };
}

function drawChart(index) {
    const config = chartConfigs[index];
    const ctx = chartContexts[index];
    if (!ctx || !config) return;
    const canvas = ctx.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const { min, max } = valueRange(config);
    const xStep = w / Math.max(maxPoints - 1, 1);

    ctx.clearRect(0, 0, w, h);

    // 背景グリッド
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) {
        const yPos = (h - 20) * (y / 4) + 10;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(w, yPos);
        ctx.stroke();
    }

    let valHtml = "";

    config.indices.forEach((channelIndex, seriesIndex) => {
        const data = channelData[channelIndex];
        const color = config.colors[seriesIndex] || '#00ffcc';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;

        data.forEach((val, i) => {
            if (!Number.isFinite(val)) return;
            const normalized = (val - min) / (max - min);
            const y = h - 20 - Math.min(Math.max(normalized, 0), 1) * (h - 30) + 10;
            const x = Math.min(i * xStep, w);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        if (started) ctx.stroke();

        const latestVal = data.length > 0 ? data[data.length - 1] : null;
        const formattedVal = Number.isFinite(latestVal) 
            ? latestVal.toFixed(config.precision) 
            : "---";

        valHtml += `<div class="value-item" style="color:${color};">${config.series[seriesIndex]}: ${formattedVal}</div>`;
    });

    const valContainer = document.getElementById(`values-${config.id}`);
    if (valContainer) {
        valContainer.innerHTML = valHtml;
    }

    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('t', w - 6, h - 4);
}

window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    redrawAllCharts();
});

window.addEventListener('resize', () => {
    chartConfigs.forEach((config, idx) => {
        const canvas = document.getElementById(config.id);
        if (canvas && chartContexts[idx]) {
            resizeCanvas(canvas, chartContexts[idx]);
        }
    });
    redrawAllCharts();
});

function setConnectedState(text, isActive = true) {
    isConnected = isActive;
    connectionType.disabled = isActive;
    const joystickEnabled = isActive && (activeMode === 'robot_ble' || (activeMode === 'robot_wifi' && robotWifiConnected));
    robotJoystick.setAttribute('aria-disabled', String(!joystickEnabled));
    robotSpeed.disabled = !joystickEnabled;
    if (isActive) {
        connectBtn.textContent = "切断";
        connectBtn.classList.add('disconnect');
        statusIndicator.textContent = text;
        statusIndicator.classList.add('active');
    } else {
        if (robotCommandTimer !== null) {
            clearInterval(robotCommandTimer);
            robotCommandTimer = null;
        }
        if (robotWriteTimer !== null) {
            clearTimeout(robotWriteTimer);
            robotWriteTimer = null;
        }
        pendingRobotCommand = null;
        pendingRobotCommandImmediate = false;
        pendingRobotCommandWaiters.splice(0).forEach(resolve => resolve());
        connectBtn.textContent = "接続開始";
        connectBtn.classList.remove('disconnect');
        statusIndicator.textContent = "未接続";
        statusIndicator.classList.remove('active');
        activeMode = null;
        robotWifiConnected = false;
        activeRobotAction = null;
        activeRobotSpeed = 0;
        activeRobotLeft = 0;
        activeRobotRight = 0;
        joystickPointerId = null;
        joystickX = 0;
        joystickY = 0;
        updateJoystickThumb(0, 0);
        joystickState.textContent = 'STOP';
    }
}

function updateConnectionModeView() {
    const isRobotMode = connectionType.value === 'robot_ble' || connectionType.value === 'robot_wifi';
    const isRelayMode = connectionType.value === 'glove_robot_relay';
    robotControls.classList.toggle('hidden', !isRobotMode);
    relayControls.classList.toggle('hidden', !isRelayMode);
    sensorDashboard.classList.toggle('hidden', isRobotMode);
    connectBtn.classList.toggle('hidden', isRelayMode);
    if (isRelayMode) {
        activeMode = 'glove_robot_relay';
    } else if (activeMode === 'glove_robot_relay' && !isRelayConnected()) {
        activeMode = null;
    }
    connectionType.disabled = isConnected || isRelayConnected();
    updateRelayControls();
}

function isRelayGloveConnected() {
    if (relayGloveTransport.value === 'usb_serial') return Boolean(relayGlovePort);
    if (relayGloveTransport.value === 'wifi') return Boolean(relayGloveWifiRequested && relayWifiSocket?.readyState === WebSocket.OPEN);
    return Boolean(relayGloveDevice?.gatt?.connected && relayGloveNotifyCharacteristic);
}

function isRelayRobotConnected() {
    if (relayRobotTransport.value === 'wifi') return relayRobotWifiConnected && relayWifiSocket?.readyState === WebSocket.OPEN;
    return Boolean(relayRobotDevice?.gatt?.connected && relayRobotWriteCharacteristic);
}

function isRelayConnected() {
    return isRelayGloveConnected() || isRelayRobotConnected() || relayGloveWifiRequested || relayRobotWifiRequested || relayGloveConnecting || relayRobotConnecting;
}

function updateRelayControls() {
    const gloveConnected = isRelayGloveConnected();
    const robotConnected = isRelayRobotConnected();
    gloveRelayStatus.textContent = `グローブ: ${gloveConnected ? '接続済み' : '未接続'}`;
    robotRelayStatus.textContent = `Pico W: ${robotConnected ? '接続済み' : '未接続'}`;
    relayModeStatus.textContent = relayArmed
        ? '中継中'
        : (gloveConnected && robotConnected ? '中立姿勢を記録して開始できます' : '中継停止中');
    connectGloveBtn.disabled = relayGloveConnecting || gloveConnected;
    connectGloveBtn.textContent = relayGloveConnecting ? '接続中...' : (gloveConnected ? 'グローブ接続済み' : 'グローブ接続');
    connectRelayRobotBtn.disabled = relayRobotConnecting || robotConnected || relayRobotWifiRequested;
    connectRelayRobotBtn.textContent = relayRobotConnecting ? '接続中...' : (robotConnected ? 'ロボット接続済み' : (relayRobotWifiRequested ? 'Wi-Fi接続待ち...' : 'ロボット接続'));
    relayGloveTransport.disabled = relayGloveConnecting || gloveConnected || relayGloveWifiRequested;
    relayRobotTransport.disabled = relayRobotConnecting || robotConnected || relayRobotWifiRequested;
    relaySensitivity.disabled = !gloveConnected || relayArmed;
    startRelayBtn.disabled = !gloveConnected || !robotConnected || !latestGloveQuaternion || relayArmed;
    stopRelayBtn.disabled = !relayArmed;
    disconnectRelayBtn.disabled = !isRelayConnected();
    connectionType.disabled = isConnected || isRelayConnected();
}

function logBleStage(stage, details = {}) {
    bleConnectStage = stage;
    const elapsedMs = Math.round(performance.now() - bleConnectStartedAt);
    console.info(`[BLE] ${stage} (+${elapsedMs} ms)`, details);
}

function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function findNusService(server) {
    try {
        return await server.getPrimaryService(NUS_SERVICE_UUID);
    } catch (primaryError) {
        logBleStage('getPrimaryService: failed', {
            connected: server.connected,
            error: primaryError.message
        });

        if (!server.connected) throw primaryError;

        logBleStage('getPrimaryServices: fallback starting');
        const services = await server.getPrimaryServices();
        logBleStage('getPrimaryServices: fallback complete', {
            count: services.length,
            uuids: services.map(service => service.uuid)
        });
        const nusService = services.find(service =>
            service.uuid.toLowerCase() === NUS_SERVICE_UUID
        );
        if (!nusService) {
            throw new Error(`NUS service not found. Primary lookup error: ${primaryError.message}`);
        }
        return nusService;
    }
}

function handleRelayWifiMessage(message) {
    if (message === 'ROBOT:CONNECTED') {
        relayRobotWifiConnected = true;
        if (relayRobotWifiRequested && relayRobotTransport.value === 'wifi') {
            void sendRobotCommand('S');
        }
        updateRelayControls();
        return;
    }
    if (message === 'ROBOT:DISCONNECTED') {
        relayRobotWifiConnected = false;
        if (relayRobotTransport.value === 'wifi') {
            relayArmed = false;
            stopRobotAction();
        }
        updateRelayControls();
        return;
    }
    if (!relayGloveWifiRequested) return;
    receiveBuffer += `${message}\n`;
    processBuffer();
}

function ensureRelayWifiSocket() {
    if (relayWifiSocket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (relayWifiSocketPromise) return relayWifiSocketPromise;

    relayWifiSocket = new WebSocket('ws://localhost:8081');
    relayWifiSocketPromise = new Promise((resolve, reject) => {
        const socket = relayWifiSocket;
        socket.onopen = () => {
            socket.send('RELAY:HELLO');
            relayWifiSocketPromise = null;
            resolve();
            updateRelayControls();
        };
        socket.onmessage = event => handleRelayWifiMessage(event.data);
        socket.onerror = () => {
            relayWifiSocketPromise = null;
            reject(new Error('中継サーバー(serverapp.py)に接続できません。'));
        };
        socket.onclose = () => {
            relayWifiSocketPromise = null;
            relayGloveWifiRequested = false;
            relayRobotWifiRequested = false;
            relayRobotWifiConnected = false;
            relayArmed = false;
            stopRobotAction();
            if (relayWifiSocket === socket) relayWifiSocket = null;
            updateRelayControls();
        };
    });
    return relayWifiSocketPromise;
}

async function readRelayGloveSerial(port) {
    const decoder = new TextDecoder();
    while (relayGlovePort === port && port.readable) {
        const reader = port.readable.getReader();
        relayGloveReader = reader;
        try {
            while (relayGlovePort === port) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    receiveBuffer += decoder.decode(value, { stream: true });
                    processBuffer();
                }
            }
        } catch (err) {
            if (relayGlovePort === port) console.error('[RELAY] USB read failed:', err);
            break;
        } finally {
            if (relayGloveReader === reader) relayGloveReader = null;
            reader.releaseLock();
        }
    }
    if (relayGlovePort === port) {
        relayGlovePort = null;
        relayArmed = false;
        stopRobotAction();
        try {
            await port.close();
        } catch (err) {
            console.warn('[RELAY] USB port close warning:', err);
        }
    }
    updateRelayControls();
}

async function connectRelayGlove() {
    if (relayGloveConnecting || isRelayGloveConnected()) return;
    relayGloveConnecting = true;
    updateRelayControls();

    try {
        const transport = relayGloveTransport.value;
        if (transport === 'usb_serial') {
            if (!navigator.serial) throw new Error('Web Serialに対応したブラウザーが必要です。');
            relayGlovePort = await navigator.serial.requestPort();
            await relayGlovePort.open({ baudRate: 115200 });
            const writer = relayGlovePort.writable.getWriter();
            await writer.write(new TextEncoder().encode('U\n'));
            writer.releaseLock();
            void readRelayGloveSerial(relayGlovePort);
        } else if (transport === 'wifi') {
            await ensureRelayWifiSocket();
            relayGloveWifiRequested = true;
            relayWifiSocket.send('W\n');
        } else {
            if (!window.isSecureContext) throw new Error('BLE接続にはHTTPSまたはlocalhostが必要です。');
            relayGloveDevice = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'Glove_Sensor_ESP32_BLE' }],
                optionalServices: [NUS_SERVICE_UUID]
            });
            relayGloveDevice.addEventListener('gattserverdisconnected', onRelayGloveDisconnected);
            relayGloveServer = await relayGloveDevice.gatt.connect();
            const service = await relayGloveServer.getPrimaryService(NUS_SERVICE_UUID);
            relayGloveWriteCharacteristic = await service.getCharacteristic(NUS_RX_UUID);
            relayGloveNotifyCharacteristic = await service.getCharacteristic(NUS_TX_UUID);
            await relayGloveNotifyCharacteristic.startNotifications();
            relayGloveNotifyCharacteristic.addEventListener('characteristicvaluechanged', handleBleNotification);

            const modeCommand = new TextEncoder().encode('B\n');
            if (relayGloveWriteCharacteristic.properties.write && relayGloveWriteCharacteristic.writeValueWithResponse) {
                await relayGloveWriteCharacteristic.writeValueWithResponse(modeCommand);
            } else if (relayGloveWriteCharacteristic.writeValue) {
                await relayGloveWriteCharacteristic.writeValue(modeCommand);
            }
        }
        console.info(`[RELAY] Glove connected using ${transport}`);
    } catch (err) {
        console.error('[RELAY] Glove connection failed:', err);
        relayGloveDevice?.gatt?.disconnect();
        relayGloveDevice = null;
        relayGloveServer = null;
        relayGloveNotifyCharacteristic = null;
        relayGloveWriteCharacteristic = null;
        if (relayGlovePort) {
            try {
                await relayGlovePort.close();
            } catch (closeError) {
                console.warn('[RELAY] USB close warning:', closeError);
            }
            relayGlovePort = null;
        }
        relayGloveWifiRequested = false;
    } finally {
        relayGloveConnecting = false;
        updateRelayControls();
    }
}

async function connectRelayRobot() {
    if (relayRobotConnecting || isRelayRobotConnected()) return;
    relayRobotConnecting = true;
    updateRelayControls();

    try {
        const transport = relayRobotTransport.value;
        if (transport === 'wifi') {
            await ensureRelayWifiSocket();
            relayRobotWifiRequested = true;
        } else {
            if (!window.isSecureContext) throw new Error('BLE接続にはHTTPSまたはlocalhostが必要です。');
            relayRobotDevice = await navigator.bluetooth.requestDevice({
                filters: [{ name: ROBOT_DEVICE_NAME }],
                optionalServices: [NUS_SERVICE_UUID]
            });
            relayRobotDevice.addEventListener('gattserverdisconnected', onRelayRobotDisconnected);
            relayRobotServer = await relayRobotDevice.gatt.connect();
            const service = await relayRobotServer.getPrimaryService(NUS_SERVICE_UUID);
            relayRobotWriteCharacteristic = await service.getCharacteristic(NUS_RX_UUID);
            await sendRobotCommand('S');
        }
        console.info(`[RELAY] Pico W connected using ${transport}`);
    } catch (err) {
        console.error('[RELAY] Pico W connection failed:', err);
        relayRobotDevice?.gatt?.disconnect();
        relayRobotDevice = null;
        relayRobotServer = null;
        relayRobotWriteCharacteristic = null;
        relayRobotWifiRequested = false;
        relayRobotWifiConnected = false;
    } finally {
        relayRobotConnecting = false;
        updateRelayControls();
    }
}

function onRelayGloveDisconnected() {
    relayArmed = false;
    stopRobotAction();
    relayGloveServer = null;
    relayGloveNotifyCharacteristic = null;
    relayGloveWriteCharacteristic = null;
    relayNeutralQuaternion = null;
    latestGloveQuaternion = null;
    updateRelayControls();
    console.warn('[RELAY] Glove disconnected; relay stopped');
}

function onRelayRobotDisconnected() {
    relayArmed = false;
    stopRobotAction();
    relayRobotServer = null;
    relayRobotWriteCharacteristic = null;
    updateRelayControls();
    console.warn('[RELAY] Pico W disconnected; relay stopped');
}

async function disconnectRelayDevices() {
    relayArmed = false;
    await sendRobotCommand('S');
    stopRobotAction();
    const glovePortToClose = relayGlovePort;
    relayGlovePort = null;

    if (relayGloveNotifyCharacteristic) {
        try {
            await relayGloveNotifyCharacteristic.stopNotifications();
        } catch (err) {
            console.warn('[RELAY] Notification stop warning:', err);
        }
        relayGloveNotifyCharacteristic.removeEventListener('characteristicvaluechanged', handleBleNotification);
    }
    if (relayGloveReader) {
        try {
            await relayGloveReader.cancel();
        } catch (err) {
            console.warn('[RELAY] USB reader stop warning:', err);
        }
    }
    if (glovePortToClose) {
        try {
            await glovePortToClose.close();
        } catch (err) {
            console.warn('[RELAY] USB port close warning:', err);
        }
    }
    relayGloveDevice?.gatt?.disconnect();
    relayRobotDevice?.gatt?.disconnect();

    relayGloveDevice = null;
    relayGloveServer = null;
    relayGloveNotifyCharacteristic = null;
    relayGloveWriteCharacteristic = null;
    relayRobotDevice = null;
    relayRobotServer = null;
    relayRobotWriteCharacteristic = null;
    relayGloveWifiRequested = false;
    relayRobotWifiRequested = false;
    relayRobotWifiConnected = false;
    relayNeutralQuaternion = null;
    latestGloveQuaternion = null;
    receiveBuffer = '';
    if (relayWifiSocket) {
        relayWifiSocket.close();
        relayWifiSocket = null;
    }
    relayWifiSocketPromise = null;
    updateRelayControls();
}

function startGloveRelay() {
    if (!isRelayGloveConnected() || !isRelayRobotConnected() || !latestGloveQuaternion) return;
    relayNeutralQuaternion = { ...latestGloveQuaternion };
    relayArmed = true;
    activeMode = 'glove_robot_relay';
    stopRobotAction();
    relayPoseStatus.textContent = '中立姿勢を記録しました';
    updateRelayControls();
}

function stopGloveRelay() {
    relayArmed = false;
    stopRobotAction();
    updateRelayControls();
}

connectGloveBtn.addEventListener('click', connectRelayGlove);
connectRelayRobotBtn.addEventListener('click', connectRelayRobot);
relayGloveTransport.addEventListener('change', updateRelayControls);
relayRobotTransport.addEventListener('change', updateRelayControls);
startRelayBtn.addEventListener('click', startGloveRelay);
stopRelayBtn.addEventListener('click', stopGloveRelay);
disconnectRelayBtn.addEventListener('click', disconnectRelayDevices);

function sendRobotCommand(action, speedOverride = null, immediate = action === 'S') {
    const relayMode = activeMode === 'glove_robot_relay';
    const commandAvailable = relayMode
        ? (relayRobotTransport.value === 'wifi'
            ? Boolean(relayRobotWifiRequested && relayWifiSocket?.readyState === WebSocket.OPEN)
            : Boolean(relayRobotDevice?.gatt?.connected && relayRobotWriteCharacteristic))
        : activeMode === 'robot_wifi'
            ? Boolean(isConnected && robotWifiConnected && webSocket?.readyState === WebSocket.OPEN)
            : Boolean(isConnected && activeMode === 'robot_ble' && bleWriteCharacteristic);
    if (!commandAvailable) return Promise.resolve();

    if (action === 'S') {
        pendingRobotCommand = 'S\n';
    } else if (action === 'M') {
        pendingRobotCommand = `M,${Math.round(speedOverride.left)},${Math.round(speedOverride.right)}\n`;
    } else {
        const speed = speedOverride === null ? Number(robotSpeed.value) : speedOverride;
        pendingRobotCommand = `${action},${Math.round(speed)}\n`;
    }
    pendingRobotCommandImmediate = pendingRobotCommandImmediate || immediate;
    const completion = new Promise(resolve => pendingRobotCommandWaiters.push(resolve));

    if (robotWriteTimer !== null) {
        clearTimeout(robotWriteTimer);
        robotWriteTimer = null;
    }

    const waitMs = immediate
        ? 0
        : Math.max(0, ROBOT_WRITE_INTERVAL_MS - (performance.now() - lastRobotWriteAt));
    if (waitMs === 0) {
        flushRobotCommand();
    } else {
        robotWriteTimer = window.setTimeout(() => {
            robotWriteTimer = null;
            flushRobotCommand();
        }, waitMs);
    }
    return completion;
}

async function flushRobotCommand() {
    if (robotWriteInProgress || pendingRobotCommand === null) return;

    const command = pendingRobotCommand;
    const waiters = pendingRobotCommandWaiters.splice(0);
    const relayMode = activeMode === 'glove_robot_relay';
    const wifiSocket = relayMode && relayRobotTransport.value === 'wifi'
        ? relayWifiSocket
        : (!relayMode && activeMode === 'robot_wifi' ? webSocket : null);
    const characteristic = relayMode ? relayRobotWriteCharacteristic : bleWriteCharacteristic;
    const device = relayMode ? relayRobotDevice : bleDevice;
    pendingRobotCommand = null;
    pendingRobotCommandImmediate = false;
    robotWriteInProgress = true;
    lastRobotWriteAt = performance.now();

    try {
        if (wifiSocket?.readyState === WebSocket.OPEN) {
            wifiSocket.send(`ROBOT|${command}`);
        } else if (device?.gatt?.connected && characteristic) {
            const data = new TextEncoder().encode(command);
            if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
                await characteristic.writeValueWithoutResponse(data);
            } else if (characteristic.properties.write && characteristic.writeValueWithResponse) {
                await characteristic.writeValueWithResponse(data);
            } else {
                await characteristic.writeValue(data);
            }
        }
    } catch (err) {
        console.error('ロボットへのBLEコマンド送信エラー:', err);
    } finally {
        robotWriteInProgress = false;
        waiters.forEach(resolve => resolve());
        if (pendingRobotCommand !== null && robotWriteTimer === null) {
            const waitMs = pendingRobotCommandImmediate
                ? 0
                : Math.max(0, ROBOT_WRITE_INTERVAL_MS - (performance.now() - lastRobotWriteAt));
            robotWriteTimer = window.setTimeout(() => {
                robotWriteTimer = null;
                flushRobotCommand();
            }, waitMs);
        }
    }
}

function setRobotDrive(leftPower, rightPower) {
    const directControl = isConnected && (activeMode === 'robot_ble' || (activeMode === 'robot_wifi' && robotWifiConnected));
    const relayControl = relayArmed && activeMode === 'glove_robot_relay';
    if (!directControl && !relayControl) return;
    if (Math.abs(leftPower) < 0.001 && Math.abs(rightPower) < 0.001) {
        stopRobotAction();
        return;
    }

    const maxSpeed = Number(robotSpeed.value);
    const minSpeed = Math.min(maxSpeed, Number(robotMinSpeed.value));
    const mapPower = power => {
        const magnitude = Math.abs(power);
        if (magnitude < 0.025) return 0;
        const scaled = (magnitude - 0.025) / 0.975;
        const pwm = minSpeed + (maxSpeed - minSpeed) * scaled;
        return Math.sign(power) * Math.round(pwm);
    };

    const left = mapPower(leftPower);
    const right = mapPower(rightPower);
    if (left === 0 && right === 0) {
        stopRobotAction();
        return;
    }

    const directionChanged = activeRobotAction !== 'M' ||
        Math.sign(activeRobotLeft) !== Math.sign(left) ||
        Math.sign(activeRobotRight) !== Math.sign(right);
    const speedChanged = Math.max(
        Math.abs(activeRobotLeft - left),
        Math.abs(activeRobotRight - right)
    ) >= 100;
    activeRobotAction = 'M';
    activeRobotLeft = left;
    activeRobotRight = right;
    joystickState.textContent = `L ${left} / R ${right}`;

    if (directionChanged || speedChanged) {
        sendRobotCommand('M', { left, right }, false);
    }
    if (robotCommandTimer === null) {
        robotCommandTimer = window.setInterval(() => {
            if (activeRobotAction === 'M') {
                sendRobotCommand('M', { left: activeRobotLeft, right: activeRobotRight });
            }
        }, 500);
    }
}

function stopRobotAction() {
    const wasMoving = Boolean(activeRobotAction);
    activeRobotAction = null;
    activeRobotSpeed = 0;
    activeRobotLeft = 0;
    activeRobotRight = 0;
    if (robotCommandTimer !== null) {
        clearInterval(robotCommandTimer);
        robotCommandTimer = null;
    }
    if (wasMoving) sendRobotCommand('S');
    joystickState.textContent = 'STOP';
}

function resetJoystickControl() {
    joystickPointerId = null;
    joystickX = 0;
    joystickY = 0;
    updateJoystickThumb(0, 0);
    stopRobotAction();
}

function updateJoystickThumb(x, y) {
    joystickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function applyJoystickVector(x, y) {
    const magnitude = Math.hypot(x, y);
    const deadZone = 0.16;
    if (magnitude <= deadZone) {
        stopRobotAction();
        joystickState.textContent = 'STOP';
        return;
    }

    const intensity = Math.min(1, (magnitude - deadZone) / (1 - deadZone));
    const throttle = (-y / magnitude) * intensity;
    const steering = (x / magnitude) * intensity;
    applyDriveAxes(throttle, steering);
}

function applyDriveAxes(throttle, steering) {
    let leftPower = throttle + steering;
    let rightPower = throttle - steering;
    const normalization = Math.max(1, Math.abs(leftPower), Math.abs(rightPower));
    leftPower /= normalization;
    rightPower /= normalization;
    setRobotDrive(leftPower, rightPower);
}

function normalizeQuaternion(quaternion) {
    const magnitude = Math.hypot(quaternion.w, quaternion.x, quaternion.y, quaternion.z);
    if (!Number.isFinite(magnitude) || magnitude < 1e-6) return null;
    return {
        w: quaternion.w / magnitude,
        x: quaternion.x / magnitude,
        y: quaternion.y / magnitude,
        z: quaternion.z / magnitude
    };
}

function getRelativePose(neutral, current) {
    const relative = normalizeQuaternion({
        w: neutral.w * current.w + neutral.x * current.x + neutral.y * current.y + neutral.z * current.z,
        x: neutral.w * current.x - neutral.x * current.w - neutral.y * current.z + neutral.z * current.y,
        y: neutral.w * current.y + neutral.x * current.z - neutral.y * current.w - neutral.z * current.x,
        z: neutral.w * current.z - neutral.x * current.y + neutral.y * current.x - neutral.z * current.w
    });
    if (!relative) return null;

    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (relative.w * relative.y - relative.z * relative.x))));
    const roll = Math.atan2(
        2 * (relative.w * relative.x + relative.y * relative.z),
        1 - 2 * (relative.x * relative.x + relative.y * relative.y)
    );
    return { pitch, roll };
}

function relayGlovePose(quaternion) {
    const wasMissing = !latestGloveQuaternion;
    latestGloveQuaternion = normalizeQuaternion(quaternion);
    if (wasMissing && latestGloveQuaternion) updateRelayControls();
    if (!relayArmed || !relayNeutralQuaternion || !latestGloveQuaternion) return;

    const pose = getRelativePose(relayNeutralQuaternion, latestGloveQuaternion);
    if (!pose) return;

    const sensitivity = Math.max(10, Math.min(80, Number(relaySensitivity.value) || 35));
    const scale = sensitivity * Math.PI / 180;
    const throttle = Math.max(-1, Math.min(1, pose.pitch / scale));
    const steering = Math.max(-1, Math.min(1, pose.roll / scale));
    relayPoseStatus.textContent = `Pitch ${(pose.pitch * 180 / Math.PI).toFixed(1)}° / Roll ${(pose.roll * 180 / Math.PI).toFixed(1)}°`;

    const magnitude = Math.hypot(throttle, steering);
    const deadZone = 0.12;
    if (magnitude <= deadZone) {
        stopRobotAction();
        return;
    }
    const intensity = Math.min(1, (magnitude - deadZone) / (1 - deadZone));
    applyDriveAxes(
        (throttle / magnitude) * intensity,
        (steering / magnitude) * intensity
    );
}

function moveJoystick(clientX, clientY) {
    const rect = robotJoystick.getBoundingClientRect();
    const thumbRadius = joystickThumb.getBoundingClientRect().width / 2;
    const maxRadius = rect.width / 2 - thumbRadius - 12;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxRadius ? maxRadius / distance : 1;
    const offsetX = dx * scale;
    const offsetY = dy * scale;

    joystickX = offsetX / maxRadius;
    joystickY = offsetY / maxRadius;
    updateJoystickThumb(offsetX, offsetY);
    applyJoystickVector(joystickX, joystickY);
}

connectionType.addEventListener('change', updateConnectionModeView);
robotMinSpeed.addEventListener('input', () => {
    const minimum = Math.max(0, Math.min(65535, Number(robotMinSpeed.value) || 0));
    if (minimum > Number(robotSpeed.value)) robotSpeed.value = String(minimum);
    robotMinSpeed.max = robotSpeed.value;
    robotSpeedValue.value = robotSpeed.value;
    if (joystickPointerId !== null) applyJoystickVector(joystickX, joystickY);
});
robotSpeed.addEventListener('input', () => {
    if (Number(robotSpeed.value) < Number(robotMinSpeed.value)) {
        robotMinSpeed.value = robotSpeed.value;
    }
    robotMinSpeed.max = robotSpeed.value;
    robotSpeedValue.value = robotSpeed.value;
    if (joystickPointerId !== null) {
        applyJoystickVector(joystickX, joystickY);
    }
});

robotJoystick.addEventListener('pointerdown', event => {
    if (robotJoystick.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    joystickPointerId = event.pointerId;
    robotJoystick.setPointerCapture(event.pointerId);
    moveJoystick(event.clientX, event.clientY);
});
robotJoystick.addEventListener('pointermove', event => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault();
    moveJoystick(event.clientX, event.clientY);
});
const releaseJoystick = event => {
    if (event.pointerId !== joystickPointerId) return;
    joystickPointerId = null;
    joystickX = 0;
    joystickY = 0;
    updateJoystickThumb(0, 0);
    stopRobotAction();
};
robotJoystick.addEventListener('pointerup', releaseJoystick);
robotJoystick.addEventListener('pointercancel', releaseJoystick);
robotJoystick.addEventListener('keydown', event => {
    const vectors = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
    };
    const vector = vectors[event.key];
    if (!vector || robotJoystick.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    applyJoystickVector(vector[0], vector[1]);
});
robotJoystick.addEventListener('keyup', event => {
    if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        stopRobotAction();
    }
});

window.addEventListener('blur', resetJoystickControl);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetJoystickControl();
});

async function cleanupBleConnection() {
    if (bleNotifyCharacteristic) {
        try {
            await bleNotifyCharacteristic.stopNotifications();
        } catch (err) {
            console.warn('BLE notification stop warning:', err);
        }
        bleNotifyCharacteristic.removeEventListener('characteristicvaluechanged', handleBleNotification);
        bleNotifyCharacteristic = null;
    }

    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
        try {
            bleDevice.gatt.disconnect();
        } catch (err) {
            console.warn('BLE disconnect warning:', err);
        }
    }

    bleDevice = null;
    bleServer = null;
    bleWriteCharacteristic = null;
}

function handleDirectRobotWifiMessage(message) {
    if (message === 'ROBOT:CONNECTED') {
        robotWifiConnected = true;
        setConnectedState('ロボットWi-Fi接続済み');
        void sendRobotCommand('S');
    } else if (message === 'ROBOT:DISCONNECTED') {
        robotWifiConnected = false;
        setConnectedState('サーバー接続済み・ロボット未検出');
    }
}

connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        if (activeMode === 'robot_ble' || activeMode === 'robot_wifi') await sendRobotCommand('S');
        await disconnectAll();
        return;
    }

    if (isConnecting) return;

    const mode = connectionType.value;

    if (mode === 'usb_serial') {
        try {
            serialPort = await navigator.serial.requestPort();
            await serialPort.open({ baudRate: 115200 });

            keepReading = true;
            setConnectedState("USB有線 接続中");

            const encoder = new TextEncoder();
            const writer = serialPort.writable.getWriter();
            await writer.write(encoder.encode("U\n"));
            writer.releaseLock();

            readSerialLoop();
        } catch (err) {
            console.error("USB接続エラー:", err);
            alert("USB接続に失敗しました。");
        }
    }
    else if (mode === 'ble_wireless' || mode === 'robot_ble') {
        isConnecting = true;
        bleConnectStartedAt = performance.now();
        try {
            if (!window.isSecureContext) {
                throw new Error('BLE接続には HTTPS または localhost が必要です。');
            }

            logBleStage('preparing');
            await disconnectAll();
            await cleanupBleConnection();

            statusIndicator.textContent = "BLEデバイス選択中...";
            logBleStage('requestDevice: waiting for selection', { mode });
            bleDevice = await navigator.bluetooth.requestDevice({
                filters: mode === 'robot_ble'
                    ? [{ name: ROBOT_DEVICE_NAME }]
                    : [{ name: 'Glove_Sensor_ESP32_BLE' }, { namePrefix: 'Glove' }],
                optionalServices: [NUS_SERVICE_UUID]
            });
            logBleStage('requestDevice: selected', { name: bleDevice.name, id: bleDevice.id });

            bleDevice.addEventListener('gattserverdisconnected', onBleDisconnected);
            statusIndicator.textContent = "GATT接続中...";
            logBleStage('gatt.connect: starting');
            const server = await bleDevice.gatt.connect();
            bleServer = server;
            logBleStage('gatt.connect: complete', { connected: server.connected });

            await delay(500);
            if (!server.connected) {
                logBleStage('gatt.connect: reconnecting after initial disconnect');
                bleServer = await bleDevice.gatt.connect();
                await delay(500);
            }
            if (!bleServer.connected) {
                throw new Error('GATT接続がサービス探索前に切断されました。');
            }

            statusIndicator.textContent = "GATTサービス探索中...";
            logBleStage('getPrimaryService: starting', { uuid: NUS_SERVICE_UUID });
            const service = await findNusService(bleServer);
            logBleStage('getPrimaryService: complete');

            bleWriteCharacteristic = await service.getCharacteristic(NUS_RX_UUID);
            logBleStage('getCharacteristic RX: complete');

            if (mode === 'ble_wireless') {
                const txChar = await service.getCharacteristic(NUS_TX_UUID);
                await txChar.startNotifications();
                txChar.addEventListener('characteristicvaluechanged', handleBleNotification);
                bleNotifyCharacteristic = txChar;
                logBleStage('TX notifications: started');
            }

            activeMode = mode;
            if (mode === 'ble_wireless') {
                bleRateWindowStartedAt = performance.now();
                bleNotificationCount = 0;
                bleDataRecordCount = 0;
            }
            setConnectedState(mode === 'robot_ble' ? "ロボットBLE接続中" : "BLE無線 接続中");
            logBleStage('connected');

            if (mode === 'robot_ble') {
                await sendRobotCommand('S');
            } else {
                const encoder = new TextEncoder();
                await bleWriteCharacteristic.writeValue(encoder.encode("B\n"));
            }
        } catch (err) {
            const elapsedMs = Math.round(performance.now() - bleConnectStartedAt);
            console.error("BLE接続エラー:", {
                stage: bleConnectStage,
                elapsedMs,
                device: bleDevice?.name,
                gattConnected: bleDevice?.gatt?.connected
            }, err);
            alert(err.message || "BLE接続に失敗しました。\nHTTPS または localhost で開いているか確認してください。");
            setConnectedState("", false);
            statusIndicator.textContent = `BLE失敗: ${bleConnectStage}`;
            await cleanupBleConnection();
        } finally {
            isConnecting = false;
        }
    }
    else if (mode === 'robot_wifi') {
        isConnecting = true;
        statusIndicator.textContent = 'ロボットWi-Fiサーバー接続中...';
        try {
            const socket = new WebSocket('ws://localhost:8081');
            webSocket = socket;
            socket.onopen = () => {
                activeMode = 'robot_wifi';
                robotWifiConnected = false;
                setConnectedState('ロボットWi-Fi接続確認中...');
                socket.send('ROBOT:MONITOR');
                isConnecting = false;
            };
            socket.onmessage = event => handleDirectRobotWifiMessage(event.data);
            socket.onclose = () => {
                if (webSocket === socket) webSocket = null;
                robotWifiConnected = false;
                if (isConnected) setConnectedState('', false);
                isConnecting = false;
            };
            socket.onerror = err => {
                console.error('ロボットWi-Fi WebSocketエラー:', err);
                if (isConnecting) alert('中継サーバー(serverapp.py)に接続できません。');
                isConnecting = false;
                if (isConnected) setConnectedState('', false);
            };
        } catch (err) {
            console.error('ロボットWi-Fi接続初期化エラー:', err);
            isConnecting = false;
            statusIndicator.textContent = '未接続';
        }
    }
    else if (mode === 'wifi_udp') {
        try {
            statusIndicator.textContent = "サーバー接続中...";
            webSocket = new WebSocket("ws://localhost:8081");

            webSocket.onopen = () => {
                setConnectedState("Wi-Fi(UDP) 接続中");
                webSocket.send("W\n");
            };

            webSocket.onmessage = (event) => {
                receiveBuffer += event.data + "\n";
                processBuffer();
            };

            webSocket.onclose = () => {
                console.log("中継サーバーから切断されました。");
                if (isConnected) setConnectedState("", false);
            };

            webSocket.onerror = (err) => {
                console.error("WebSocketエラー:", err);
                alert("中継サーバー(serverapp.py)が起動していない可能性があります。");
                setConnectedState("", false);
            };
        } catch (err) {
            console.error("Wi-Fi接続初期化エラー:", err);
        }
    }
});

async function readSerialLoop() {
    const decoder = new TextDecoder();

    while (serialPort && serialPort.readable && keepReading) {
        try {
            serialReader = serialPort.readable.getReader();
            while (keepReading) {
                const { value, done } = await serialReader.read();
                if (done) break;
                if (value) {
                    receiveBuffer += decoder.decode(value);
                    processBuffer();
                }
            }
        } catch (err) {
            console.error("シリアル読み込み中のエラー:", err);
            break;
        } finally {
            if (serialReader) {
                serialReader.releaseLock();
                serialReader = null;
            }
        }
    }
}

function handleBleNotification(event) {
    if (activeMode === 'ble_wireless') {
        bleNotificationCount++;
    }

    const value = event.target.value;
    if (value instanceof DataView && value.byteLength === BLE_SENSOR_PACKET_BYTES) {
        const values = [];
        for (let i = 0; i < 4; i++) {
            values.push(value.getInt16(i * 2, true) / 32767);
        }
        for (let i = 0; i < 3; i++) {
            values.push(value.getInt16(8 + i * 2, true));
        }
        for (let i = 0; i < 6; i++) {
            values.push(value.getUint16(14 + i * 2, true));
        }
        updateChartsFromValues(values);
        reportBleReceiveRate();
        return;
    }

    const decoder = new TextDecoder();
    let payload = "";
    if (value instanceof DataView) {
        payload = decoder.decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    } else if (value instanceof ArrayBuffer) {
        payload = decoder.decode(value);
    } else if (typeof value === 'string') {
        payload = value;
    } else {
        payload = decoder.decode(value);
    }
    receiveBuffer += payload;
    processBuffer();

    reportBleReceiveRate();
}

function reportBleReceiveRate() {
    if (activeMode !== 'ble_wireless') return;

    const now = performance.now();
    const elapsedMs = now - bleRateWindowStartedAt;
    if (elapsedMs >= 1000) {
        console.info('[BLE] 受信レート', {
            notificationsPerSecond: Math.round(bleNotificationCount * 1000 / elapsedMs),
            sensorRecordsPerSecond: Math.round(bleDataRecordCount * 1000 / elapsedMs)
        });
        bleRateWindowStartedAt = now;
        bleNotificationCount = 0;
        bleDataRecordCount = 0;
    }
}

function processBuffer() {
    let newlineIndex;
    while ((newlineIndex = receiveBuffer.indexOf('\n')) !== -1) {
        const line = receiveBuffer.substring(0, newlineIndex).trim();
        receiveBuffer = receiveBuffer.substring(newlineIndex + 1);
        if (line !== '') {
            updateCharts(line);
        }
    }
}

function updateCharts(line) {
    line = line.trim();
    if (line === "") return;

    updateChartsFromValues(line.split(',').map(value => Number.parseFloat(value)));
}

function updateChartsFromValues(values) {
    if (values.length >= 13) {
        if (activeMode === 'ble_wireless') bleDataRecordCount++;

        const quaternion = {
            w: values[0],
            x: values[1],
            y: values[2],
            z: values[3]
        };
        for (let i = 0; i < 13; i++) {
            const val = values[i];
            channelData[i].push(Number.isFinite(val) ? val : null);
            if (channelData[i].length > maxPoints) channelData[i].shift();
        }
        
        relayGlovePose(quaternion);
        scheduleChartRedraw();
    } else {
        console.warn('受信データの要素数が不足しています:', values.length, values);
    }
}

function onBleDisconnected() {
    const elapsedMs = Math.round(performance.now() - bleConnectStartedAt);
    console.warn('[BLE] Peripheral disconnected', {
        stage: bleConnectStage,
        elapsedMs,
        device: bleDevice?.name
    });
    setConnectedState("", false);
}

async function disconnectAll() {
    if (activeMode === 'robot_ble' || activeMode === 'robot_wifi') await sendRobotCommand('S');
    setConnectedState("", false);

    keepReading = false;

    if (serialReader) {
        try {
            await serialReader.cancel();
        } catch (err) {
            console.log("Reader cancel error (無視可):", err);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (serialPort) {
        try {
            await serialPort.close();
            console.log("USBシリアルポートを安全に閉じました。");
        } catch (err) {
            console.error("ポートを閉じる際のエラー:", err);
        }
        serialPort = null;
    }

    await cleanupBleConnection();

    if (webSocket) {
        webSocket.close();
        webSocket = null;
        console.log("WebSocket中継サーバーを切断しました。");
    }

    receiveBuffer = "";
}

updateConnectionModeView();
