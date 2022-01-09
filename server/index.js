const { v4: uuidv4 } = require('uuid');

// HTTP Server

const express = require('express');
const app = express();
const portHttps = 443;
const portHttp = 80;
app.use(express.static('client'));

const fs = require('fs');
const key = fs.readFileSync('./game.home.key');
const cert = fs.readFileSync('./game.home.crt');

const https = require('https');
const serverHttps = https.createServer({key: key, cert: cert }, app);
 
serverHttps.listen(portHttps, () => {
    console.log(`WebServer listening at https://game.home:${portHttps}`);
});
app.listen(portHttp, () => {
    console.log(`WebServer listening at http://game.home:${portHttp}`)
});

// Websocket Server

const WebSocket = require('ws');
const portWss = 8080;
const portWs = 8081;
const serverWss = https.createServer({key: key, cert: cert }, app);
const wsServer1 = new WebSocket.Server({ server: serverWss });
serverWss.listen(portWss);

const wsServer2 = new WebSocket.Server({ port: portWs });

const clients = new Map();
const clientIds = new Map();

wsServer1.on('connection', (ws, req)=>{
    wsConnection(ws, req);
});
wsServer2.on('connection', (ws, req)=>{
    wsConnection(ws, req);
});

wsConnection = (ws, req) => {
    console.log('Client connected (IP, user agent):', req.socket.remoteAddress, req.headers['user-agent']);

    clients.set(ws, {id: 'UNKNOWN', ws: ws});

    ws.on('message', (messageAsString) => {
        const message = JSON.parse(messageAsString);
        console.log('Received message from client:', message);

        if (message.type === 'CONNECTION') {
            if (message.clientId==='UNKNOWN') {
                var clientId = uuidv4();
                var client = {
                    id: clientId,
                    ws: ws
                };
                clientIds.set(clientId, client);
                clients.set(ws, client);

                const response = JSON.stringify({
                    type: 'SET_CLIENT_ID',
                    clientId: clientId
                });
                ws.send(response);

             } else if (!clientIds.has(message.clientId) && message.clientId!=='UNKNOWN') {
                var client = {
                    id: message.clientId,
                    ws: ws
                };
                clientIds.set(message.clientId, client);
                clients.set(ws, client);

                const response = JSON.stringify({
                    type: 'GET_ORIENTATION',
                    clientId: clientId
                });
                ws.send(response);
            } else {
                const response = JSON.stringify({
                    type: 'GET_ORIENTATION',
                    clientId: clientId
                });
                ws.send(response);
            }
        }
    });

    ws.on("close", () => {
        var clientId = 'UNKNOWN';
        if(clients.has(ws)) {
            var client = clients.get(ws);
            clientId = client.id;
        }

        console.log(`Client ${clientId} disconnected.`);
        clients.delete(ws);
        clientIds.delete(clientId);
    });
}

console.log(`WebSocketServer1 listening at wss://game.home:${portWss}`);
console.log(`WebSocketServer2 listening at ws://game.home:${portWs}`);
