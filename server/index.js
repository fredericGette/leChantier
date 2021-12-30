// HTTP Server

const express = require('express');
const app = express();
const port = 80;
app.use(express.static('client'));
 
app.listen(port, () => {
    console.log(`WebServer listening at http://localhost:${port}`);
});

// Websocket Server

const WebSocket = require('ws');
const wsPort = 8080;
const wss = new WebSocket.Server({ port: wsPort });

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


console.log(`WebSocketServer listening at ws://localhost:${wsPort}`);
