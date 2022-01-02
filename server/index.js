// HTTP Server

const express = require('express');
const app = express();
const port = 443;
app.use(express.static('client'));

const fs = require('fs');
const key = fs.readFileSync('./game.home.key');
const cert = fs.readFileSync('./game.home.crt');

const https = require('https');
const serverHttps = https.createServer({key: key, cert: cert }, app);
 
serverHttps.listen(port, () => {
    console.log(`WebServer listening at https://game.home:${port}`);
});

// Websocket Server

const WebSocket = require('ws');
const wsPort = 8080;
const serverWss = https.createServer({key: key, cert: cert }, app);
const wss = new WebSocket.Server({ server: serverWss });
serverWss.listen(wsPort);

const clients = new Map();

wss.on('connection', (ws) => {
    console.log('Client connected.');

    const id = "test";
    const color = Math.floor(Math.random() * 360);
    const metadata = { id, color };

    clients.set(ws, metadata);

    ws.on('message', (messageAsString) => {
        console.log('Received message from client.');

        const message = JSON.parse(messageAsString);

        console.log(message);

        const metadata = clients.get(ws);

        message.sender = metadata.id;
        message.color = metadata.color;

        const outbound = JSON.stringify(message);

        [...clients.keys()].forEach((client) => {
            client.send(outbound);
        });
    });

    ws.on("close", () => {
        console.log('Client disconnected.');
        clients.delete(ws);
    });
});


console.log(`WebSocketServer listening at wss://game.home:${wsPort}`);
