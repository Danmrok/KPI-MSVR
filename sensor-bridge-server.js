#!/usr/bin/env node
'use strict';

const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');

const HTTP_PORT = Number(process.env.HTTP_PORT || 8090);
const WS_BROADCAST_MS = Number(process.env.WS_BROADCAST_MS || 20);

const latest = {
    alpha: 0,
    beta: 0,
    gamma: 0,
    timestamp: Date.now()
};

function sendJson(res, code, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(body);
}

function parseRequestJson(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk.toString('utf8');
            if (raw.length > 1_000_000) {
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch (err) {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function normalizePacket(body) {
    const toNumber = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const n = Number(value);
            if (Number.isFinite(n)) return n;
        }
        return null;
    };

    const pickDeep = (node, keys, visited = new Set()) => {
        if (node === null || typeof node !== 'object') return null;
        if (visited.has(node)) return null;
        visited.add(node);

        for (let i = 0; i < keys.length; i += 1) {
            if (Object.prototype.hasOwnProperty.call(node, keys[i])) {
                const n = toNumber(node[keys[i]]);
                if (n !== null) return n;
            }
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i += 1) {
                const n = pickDeep(node[i], keys, visited);
                if (n !== null) return n;
            }
            return null;
        }

        const values = Object.values(node);
        for (let i = 0; i < values.length; i += 1) {
            const n = pickDeep(values[i], keys, visited);
            if (n !== null) return n;
        }
        return null;
    };

    const alpha = pickDeep(body, ['alpha', 'yaw', 'z', 'azimuth', 'heading']);
    const beta = pickDeep(body, ['beta', 'pitch', 'x']);
    const gamma = pickDeep(body, ['gamma', 'roll', 'y']);
    if (alpha === null || beta === null || gamma === null) return null;

    return {
        alpha,
        beta,
        gamma,
        timestamp: pickDeep(body, ['timestamp', 'time', 'timeStamp', 'ts']) || Date.now()
    };
}

const server = http.createServer(async (req, res) => {
    if (!req.url) {
        sendJson(res, 400, { error: 'Missing URL' });
        return;
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, latest });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/sensor') {
        try {
            const body = await parseRequestJson(req);
            const normalized = normalizePacket(body);
            if (!normalized) {
                sendJson(res, 400, { error: 'Expected numeric alpha, beta, gamma (or yaw, pitch, roll)' });
                return;
            }
            latest.alpha = normalized.alpha;
            latest.beta = normalized.beta;
            latest.gamma = normalized.gamma;
            latest.timestamp = normalized.timestamp;
            console.log(
                `[sensor] alpha=${latest.alpha.toFixed(2)} beta=${latest.beta.toFixed(2)} gamma=${latest.gamma.toFixed(2)} ts=${latest.timestamp}`
            );
            sendJson(res, 200, { ok: true, latest });
        } catch (error) {
            sendJson(res, 400, { error: error.message });
        }
        return;
    }

    sendJson(res, 404, { error: 'Not found' });
});

const wss = new WebSocket.Server({ server, path: '/sensor-stream' });

setInterval(() => {
    const payload = JSON.stringify(latest);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}, WS_BROADCAST_MS);

server.listen(HTTP_PORT, () => {
    console.log(`Sensor bridge running on http://0.0.0.0:${HTTP_PORT}`);
    console.log(`POST sensor data to http://<host>:${HTTP_PORT}/sensor`);
    console.log(`WebSocket stream at ws://<host>:${HTTP_PORT}/sensor-stream`);
});
