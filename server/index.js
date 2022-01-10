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

const clientWSs = new Map();
const clientIDs = new Map();
let masterClient = undefined;

wsServer1.on('connection', (ws, req)=>{
    wsConnection(ws, req);
});
wsServer2.on('connection', (ws, req)=>{
    wsConnection(ws, req);
});

wsConnection = (ws, req) => {
    console.log('Client connected (IP, user agent):', req.socket.remoteAddress, req.headers['user-agent']);

    ws.on('message', (messageAsString) => {
        const message = JSON.parse(messageAsString);
        console.log('Received message from client:', message);

        if (message.type === 'MASTER_CONNECTION') {
            masterClient = createMasterClient(ws);

        } else if (message.type === 'CONNECTION') {
            if (message.clientId==='UNKNOWN') {
                const client = createClient(uuidv4(), ws);

                const response = JSON.stringify({
                    type: 'SET_CLIENT_ID',
                    clientId: client.id
                });
                ws.send(response);

             } else if (!clientIDs.has(message.clientId) && message.clientId!=='UNKNOWN') {
                if (clientIDs.has(message.clientId)) {
                    // reconnect client.
                } else {
                    createClient(message.clientId, ws);
                }

                const response = JSON.stringify({
                    type: 'GET_ORIENTATION'
                });
                ws.send(response);
            } else {
                const response = JSON.stringify({
                    type: 'GET_ORIENTATION'
                });
                ws.send(response);
            }
        }
    });

    ws.on("close", () => {
        if(clientWSs.has(ws)) {
            disconnectClient(ws);
        } else if (masterClient !== undefined && masterClient.ws === ws) {
            console.log(`Master client disconnected.`);
            masterClient = undefined;
        }
    });
}

console.log(`WebSocketServer1 listening at wss://game.home:${portWss}`);
console.log(`WebSocketServer2 listening at ws://game.home:${portWs}`);

createMasterClient = (ws) => {
    const masterClient = {
        ws: ws
    };
    return masterClient;
}

createClient = (id, ws) => {
    console.log(`Create client ${id}.`);

    const client= {
        id: id,
        team: 1
    };
    clientIDs.set(client.id, client);
    clientWSs.set(ws, client);

    if (masterClient !== undefined) {
        const message = JSON.stringify({
            type: 'CLIENT_CREATED',
            client: client
        });
        masterClient.ws.send(message);
    }

    return client;
};

disconnectClient = (ws) => {
    let client = clientWSs.get(ws);
    console.log(`Client ${client.id} disconnected.`);
    clientWSs.delete(ws);

    if (masterClient !== undefined) {
        const message = JSON.stringify({
            type: 'CLIENT_DISCONNECTED',
            client: client
        });
        masterClient.ws.send(message);
    }
}