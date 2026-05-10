'use strict';

let gl, surface, shProgram, spaceball, stereoCam;
let webcamStream, webcamTexture, webcamVideo, showWebcamFlag = false;
let webcamQuadVertexBuffer;
let webcamQuadTexcoordBuffer;
let webcamQuadIndexBuffer;
let surfaceCenter = [0, 0, 0];
let animationFrameId = 0;
let sensorSocket = null;
let sensorOrientationMatrix = m4.identity();
let lastSensorAnglesDeg = null;
const $ = (id) => document.getElementById(id);
const MODEL_SCALE = 2.4;
const MODEL_DISTANCE_FACTOR = 0.5;
const DEFAULT_WEBGL_ASPECT = 4 / 3;
const MIRRORED_WEBCAM_TEXCOORDS = new Float32Array([
    1, 1,
    0, 1,
    0, 0,
    1, 0
]);
const STEREO_DEFAULTS = {
    convergence: 14.0,
    eyeSeparation: 0.7,
    aspectRatio: 1.3333,
    fov: 45.0,
    nearClip: 3.0,
    farClip: 50.0
};
const STEREO_FIELDS = [
    ['convergence', 1],
    ['eyeSeparation', 2],
    ['aspectRatio', 3],
    ['fov', 0],
    ['nearClip', 1],
    ['farClip', 0]
];


function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.iAttribVertex = -1;
    this.iColor = -1;
    this.Use = function() { gl.useProgram(this.prog); };
}


function draw() { 
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderWebcamAtZeroParallax();
    drawStereoModel();
}

function tick() {
    draw();
    animationFrameId = requestAnimationFrame(tick);
}

function drawStereoModel() {
    const modelView = spaceball.getViewMatrix();
    const centerShift = m4.translation(-surfaceCenter[0], -surfaceCenter[1], -surfaceCenter[2]);
    const rotateToPointZero = m4.axisRotation([0.0, 1.0, 0.0], 0.35);
    const sensorRotation = sensorOrientationMatrix;
    const modelDistance = Math.max(stereoCam.mNearClippingDistance + 0.5, stereoCam.mConvergence * MODEL_DISTANCE_FACTOR);
    gl.uniform1i(shProgram.iUseTexture, 0);
    const baseModel = m4.multiply(
        m4.translation(0, 0, -modelDistance),
        m4.multiply(
            m4.scaling(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE),
            m4.multiply(m4.multiply(m4.multiply(sensorRotation, rotateToPointZero), modelView), centerShift)
        )
    );
    const showFilled = $('showFilled').checked;
    const showWireframe = $('showWireframe').checked;
    const drawEye = (eye, mask) => {
        gl.colorMask(mask[0], mask[1], mask[2], false);
        gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, eye.projectionMatrix);
        gl.uniformMatrix4fv(
            shProgram.iModelViewMatrix,
            false,
            m4.multiply(m4.translation(eye.eyeShift, 0, 0), baseModel)
        );
        if (showFilled) {
            gl.uniform4fv(shProgram.iColor, [1, 1, 1, 1]);
            surface.Draw();
        }
        if (showWireframe) {
            gl.uniform4fv(shProgram.iColor, [0.3, 0.3, 0.3, 1]);
            surface.DrawWireframe();
        }
    };
    drawEye(stereoCam.ApplyLeftFrustum(), [true, false, false]);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    drawEye(stereoCam.ApplyRightFrustum(), [false, true, true]);

    gl.colorMask(true, true, true, true);
}



function initGL() {
    const prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexcoord = gl.getAttribLocation(prog, "texcoord");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iTextureSampler = gl.getUniformLocation(prog, "textureSampler");
    shProgram.iUseTexture = gl.getUniformLocation(prog, "useTexture");

    const data = {};
    CreateSurfaceData(data);
    surfaceCenter = computeSurfaceCenter(data.verticesF32);

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16);

    stereoCam = new StereoCamera(
        STEREO_DEFAULTS.convergence,
        STEREO_DEFAULTS.eyeSeparation,
        gl.canvas.width  / gl.canvas.height,
        STEREO_DEFAULTS.fov,
        STEREO_DEFAULTS.nearClip,
        STEREO_DEFAULTS.farClip
    );

    gl.enable(gl.DEPTH_TEST);
    webcamTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    initWebcamQuadBuffers();
}

function computeSurfaceCenter(vertices) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }
    return [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
}


function createProgram(gl, vShader, fShader) {
    const vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    const fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    const prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function updateStereoParameters() {
    const get = (id) => parseFloat($(id).value);
    stereoCam = new StereoCamera(
        get('convergence'),
        get('eyeSeparation'),
        get('aspectRatio'),
        get('fov'),
        get('nearClip'),
        get('farClip')
    );
}

function updateWebcamTexture() {
    if (webcamVideo && webcamVideo.readyState === webcamVideo.HAVE_ENOUGH_DATA) {
        gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, webcamVideo);
    }
}

function renderWebcamAtZeroParallax() {
    if (!showWebcamFlag || !webcamStream) return;
    updateWebcamTexture();

    gl.uniform1i(shProgram.iUseTexture, 1);
    gl.uniform1i(shProgram.iTextureSampler, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);

    const fovRadians = stereoCam.mFOV;
    const canvasAspect = gl.canvas.width / gl.canvas.height;
    const projection = m4.perspective(
        fovRadians,
        canvasAspect,
        stereoCam.mNearClippingDistance,
        stereoCam.mFarClippingDistance
    );
    const z = -stereoCam.mConvergence;
    const fullHalfHeight = Math.tan(fovRadians * 0.5) * stereoCam.mConvergence;
    const fullHalfWidth = fullHalfHeight * canvasAspect;
    let halfHeight = fullHalfHeight;
    let halfWidth = fullHalfWidth;

    // Keep camera texture aspect ratio to avoid face stretching/squeezing.
    if (webcamVideo && webcamVideo.videoWidth > 0 && webcamVideo.videoHeight > 0) {
        const videoAspect = webcamVideo.videoWidth / webcamVideo.videoHeight;
        if (videoAspect > canvasAspect) {
            halfHeight = fullHalfWidth / videoAspect;
        } else {
            halfWidth = fullHalfHeight * videoAspect;
        }
    }
    const model = m4.multiply(
        m4.translation(0, 0, z),
        m4.scaling(halfWidth, halfHeight, 1.0)
    );

    gl.disable(gl.DEPTH_TEST);
    gl.colorMask(true, true, true, true);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, model);

    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadTexcoordBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTexcoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTexcoord);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webcamQuadIndexBuffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.uniform1i(shProgram.iUseTexture, 0);
    gl.enable(gl.DEPTH_TEST);
}

function initWebcamQuadBuffers() {
    const quadVertices = new Float32Array([
        -1, -1, 0,
         1, -1, 0,
         1,  1, 0,
        -1,  1, 0
    ]);

    const quadTexcoords = new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0
    ]);

    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    webcamQuadVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    webcamQuadTexcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadTexcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadTexcoords, gl.STATIC_DRAW);

    webcamQuadIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, webcamQuadIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);
}

function updateWebcamMirror() {
    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadTexcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, MIRRORED_WEBCAM_TEXCOORDS, gl.STATIC_DRAW);
}

function updateValueDisplays() {
    STEREO_FIELDS.forEach(([id, fixed]) => {
        $(`${id}Value`).textContent = parseFloat($(id).value).toFixed(fixed);
    });
}

function resetParameters() {
    Object.entries(STEREO_DEFAULTS).forEach(([id, value]) => {
        $(id).value = value;
    });
    updateValueDisplays();
    updateStereoParameters();
    draw();
}

function enableWebcam() {
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
        } 
    })
    .then(function(stream) {
        webcamStream = stream;
        webcamVideo = $('webcam');
        webcamVideo.muted = true;
        webcamVideo.playsInline = true;
        webcamVideo.srcObject = stream;
        webcamVideo.play().catch(() => {});
        draw();
        console.log('Webcam enabled successfully');
    })
    .catch(function(error) {
        alert('Could not access webcam: ' + error.message);
        console.error('Error accessing webcam:', error);
    });
}

function disableWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (webcamVideo) {
        webcamVideo.pause();
        webcamVideo.srcObject = null;
    }
    showWebcamFlag = false;
    $('showWebcam').checked = false;
    draw();
    console.log('Webcam disabled');
}

function degToRad(v) {
    return v * Math.PI / 180;
}

function normalizeAngleDelta(deg) {
    let delta = deg;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
}

function updateSensorStatus(text) {
    const status = $('sensorStatus');
    if (status) {
        status.textContent = text;
    }
}

function updateSensorAnglesDisplay(anglesDeg) {
    const out = $('sensorAngles');
    if (!out) return;
    out.textContent = `Z(alpha): ${anglesDeg.alpha.toFixed(1)} deg, X(beta): ${anglesDeg.beta.toFixed(1)} deg, Y(gamma): ${anglesDeg.gamma.toFixed(1)} deg`;
}

function extractAnglesFromPacket(packet) {
    if (!packet || typeof packet !== 'object') return null;
    const pickNumber = (obj, keys) => {
        for (let i = 0; i < keys.length; i += 1) {
            const val = obj[keys[i]];
            if (typeof val === 'number' && Number.isFinite(val)) return val;
        }
        return null;
    };
    const alpha = pickNumber(packet, ['alpha', 'yaw', 'z', 'azimuth']);
    const beta = pickNumber(packet, ['beta', 'pitch', 'x']);
    const gamma = pickNumber(packet, ['gamma', 'roll', 'y']);
    if (alpha === null || beta === null || gamma === null) return null;
    return { alpha, beta, gamma };
}

function accumulateZXYRotation(deltaAnglesDeg) {
    // Sensor frames often use opposite sign for pitch/roll versus WebGL scene axes.
    const mapped = {
        alpha: deltaAnglesDeg.alpha,
        beta: deltaAnglesDeg.beta,
        gamma: -deltaAnglesDeg.gamma
    };
    const rz = m4.zRotation(degToRad(mapped.alpha));
    const rx = m4.xRotation(degToRad(mapped.beta));
    const ry = m4.yRotation(degToRad(mapped.gamma));
    const deltaMatrix = m4.multiply(rz, m4.multiply(rx, ry));
    sensorOrientationMatrix = m4.multiply(sensorOrientationMatrix, deltaMatrix);
}

function processSensorPacket(packet) {
    const anglesDeg = extractAnglesFromPacket(packet);
    if (!anglesDeg) return;

    if (lastSensorAnglesDeg === null) {
        lastSensorAnglesDeg = anglesDeg;
        updateSensorAnglesDisplay(anglesDeg);
        return;
    }

    const deltaAnglesDeg = {
        alpha: normalizeAngleDelta(anglesDeg.alpha - lastSensorAnglesDeg.alpha),
        beta: normalizeAngleDelta(anglesDeg.beta - lastSensorAnglesDeg.beta),
        gamma: normalizeAngleDelta(anglesDeg.gamma - lastSensorAnglesDeg.gamma)
    };
    lastSensorAnglesDeg = anglesDeg;
    accumulateZXYRotation(deltaAnglesDeg);
    updateSensorAnglesDisplay(anglesDeg);
}

function connectSensorStream() {
    const input = $('sensorWsUrl');
    if (!input) return;
    const wsUrl = input.value.trim();
    if (!wsUrl) {
        updateSensorStatus('Enter WebSocket URL first');
        return;
    }

    if (sensorSocket) {
        sensorSocket.close();
        sensorSocket = null;
    }

    updateSensorStatus('Connecting...');
    sensorSocket = new WebSocket(wsUrl);
    sensorSocket.onopen = function() {
        updateSensorStatus('Connected');
    };
    sensorSocket.onmessage = function(event) {
        try {
            const payload = JSON.parse(event.data);
            processSensorPacket(payload);
        } catch (error) {
            updateSensorStatus('Invalid sensor JSON');
        }
    };
    sensorSocket.onerror = function() {
        updateSensorStatus('WebSocket error');
    };
    sensorSocket.onclose = function() {
        updateSensorStatus('Disconnected');
    };
}

function disconnectSensorStream() {
    if (sensorSocket) {
        sensorSocket.close();
        sensorSocket = null;
    }
    updateSensorStatus('Disconnected');
}

function resetSensorOrientation() {
    sensorOrientationMatrix = m4.identity();
    lastSensorAnglesDeg = null;
    updateSensorAnglesDisplay({ alpha: 0, beta: 0, gamma: 0 });
    updateSensorStatus('Orientation reset');
}

function init() {
    let canvas;
    try {
        canvas = $("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
        canvas.style.aspectRatio = `${DEFAULT_WEBGL_ASPECT}`;
    }
    catch (e) {
        $("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    }
    catch (e) {
        $("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 8);
    spaceball.setRotationCenter(surfaceCenter);

    const onStereoInput = () => {
        updateValueDisplays();
        updateStereoParameters();
        draw();
    };
    STEREO_FIELDS.forEach(([id]) => {
        $(id).addEventListener('input', onStereoInput);
    });

    ['showWireframe', 'showFilled'].forEach((id) => $(id).addEventListener('change', draw));
    $('showWebcam').addEventListener('change', function() {
        showWebcamFlag = this.checked;
        if (showWebcamFlag && !webcamStream) {
            enableWebcam();
            return;
        }
        if (!showWebcamFlag) {
            disableWebcam();
            return;
        }
        draw();
    });
    $('resetParams').addEventListener('click', resetParameters);
    const connectBtn = $('sensorConnect');
    const disconnectBtn = $('sensorDisconnect');
    const resetSensorBtn = $('sensorResetOrientation');
    if (connectBtn) connectBtn.addEventListener('click', connectSensorStream);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectSensorStream);
    if (resetSensorBtn) resetSensorBtn.addEventListener('click', resetSensorOrientation);
    updateSensorStatus('Disconnected');

    updateValueDisplays();
    updateStereoParameters();
    updateWebcamMirror();
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(tick);
    }
}