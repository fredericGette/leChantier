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

wsServer1.on('connection', (ws, req)=>{
    wsConnection(ws, req);
});
wsServer2.on('connection', (ws, req)=>{
    wsConnection(ws, req);
});

const clientWSs = new Map();
const clientIDs = new Map();
const clientIDWSs = new Map();
let master = undefined;
let step = 'WAITING_CLIENTS';
let level = undefined;
const names = ['Anatole','Berthe','Célestine','Désiré','Eugène','Ferdinand','Gaston','Henri','Irma','John','Kléber','Ludwig','Marcel','Napoléon','Oscar','Peter','Quincy','Romeo','Suzanne','Thérèse','Ursule','Voldemort','Washington','Xena','Yvonne','Zacharias'];

wsConnection = (ws, req) => {
    console.log('Client connected (IP, user agent):', req.socket.remoteAddress, req.headers['user-agent']);

    ws.on('message', (messageAsString) => {
        const message = JSON.parse(messageAsString);
        console.log('Received message from client:', message);

        if (message.type === 'MASTER_CONNECTION') {
            master = createMaster(ws);
            notifyMasterStep(step);
            clientIDs.forEach((client) => {
                notifyMasterClient('EXISTING_CLIENT', client);
            })
        } else if (message.type === 'MASTER_UPDATE_TEAM') {
            const client = clientIDs.get(message.clientId);
            client.teamName = message.teamName;
            notifyClientTeam(client);

        } else if (message.type === 'MASTER_REQUEST_START_GAME') {
            step = 'START_LEVEL';
            level = {
                id: 1,
                
            };
            notifyMasterStep(step, level);
        } else if (message.type === 'CONNECTION') {
            if (message.clientId==='UNKNOWN') {
                const client = createClient(uuidv4(), ws);

                const response = JSON.stringify({
                    type: 'SET_CLIENT_ID',
                    clientId: client.id
                });
                ws.send(response);

             } else {
                if (clientIDs.has(message.clientId)) {
                    reconnectClient(message.clientId, ws);
                } else {
                    createClient(message.clientId, ws);
                }

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
        } else if (master !== undefined && master.ws === ws) {
            console.log(`Master client disconnected.`);
            master = undefined;
        }
    });
}

console.log(`WebSocketServer1 listening at wss://game.home:${portWss}`);
console.log(`WebSocketServer2 listening at ws://game.home:${portWs}`);

// --------------------------------

createMaster = (ws) => {
    const master = {
        ws: ws
    };
    return master;
};

createClient = (id, ws) => {
    console.log(`Create client ${id}.`);

    const usedNames = Array.from(clientIDs.values()).map(client => client.name);
    const availableNames = names.filter(name => {
        return !usedNames.includes(name);
    });
    const name = availableNames[Math.floor(Math.random() * availableNames.length)];

    const client= {
        id: id,
        name: name,
        connected: true
    };
    clientIDs.set(client.id, client);
    clientWSs.set(ws, client);
    clientIDWSs.set(client.id, ws);

    notifyMasterClient('CLIENT_CREATED', client);
    notifyClientName(client);

    return client;
};

disconnectClient = (ws) => {
    const client = clientWSs.get(ws);
    client.connected = false;
    console.log(`Client ${client.id} disconnected.`);
    clientWSs.delete(ws);
    clientIDWSs.delete(client.id);

    notifyMasterClient('CLIENT_DISCONNECTED', client);
};

reconnectClient = (id, ws) => {
    const client = clientIDs.get(id);
    client.connected = true;
    clientWSs.set(ws, client);
    clientIDWSs.set(client.id, ws);

    notifyMasterClient('CLIENT_RECONNECTED', client);
    notifyClientName(client);
    notifyClientTeam(client);
}

notifyMasterClient = (eventType, client) => {
    if (master !== undefined) {
        const message = JSON.stringify({
            type: eventType,
            client: client
        });
        master.ws.send(message);
    }
};

notifyMasterStep = (step) => {
    if (master !== undefined) {
        const message = JSON.stringify({
            type: 'CURRENT_STEP',
            step: step,
            level : level
        });
        master.ws.send(message);
    }
};

notifyClientTeam = (client) => {
    const clientWs = clientIDWSs.get(client.id);
    const message = JSON.stringify({
        type: 'SET_CLIENT_TEAM',
        teamName: client.teamName
    });
    clientWs.send(message);
};

notifyClientName = (client) => {
    const clientWs = clientIDWSs.get(client.id);
    const message = JSON.stringify({
        type: 'SET_CLIENT_NAME',
        clientName: client.name
    });
    clientWs.send(message);
};