const { v4: uuidv4 } = require('uuid');

const Datastore = require('nedb');
const db = {};
db.clients = new Datastore({ filename: 'db/clients.db', autoload: true });
db.teams = new Datastore({ filename: 'db/teams.db', autoload: true });
db.step = new Datastore({ filename: 'db/step.db', autoload: true });

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
let step = undefined;
const names = ['Anatole','Berthe','Célestine','Désiré','Eugène','Ferdinand','Gaston','Henri','Irma','John','Kléber','Ludwig','Marcel','Napoléon','Oscar','Peter','Quincy','Romeo','Suzanne','Thérèse','Ursule','Voldemort','Washington','Xena','Yvonne','Zacharias'];
const teams = new Map();

// Restore all persisted data
db.clients.find({}, (err, docs) => {
    docs.forEach((client)=>{
        client.connected = false;
        client.orientation = undefined;
        client.pictureRotated = undefined;
        client.pictureMatch = false;
        clientIDs.set(client.id, client);
    })
});
db.teams.find({}, (err, docs) => {
    docs.forEach((team)=>{
        teams.set(team.name, team);
    })
});
db.step.find({}, (err, docs) => {
    if (docs.length > 0) {
        step = docs[docs.length-1];
    }
});


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
            });
            teams.forEach((team) => {
                notifyMasterTeam('EXISTING_TEAM', team);
            });
        } else if (message.type === 'MASTER_UPDATE_TEAM') {
            const client = clientIDs.get(message.clientId);
            client.teamName = message.teamName;
            db.clients.update({ id: client.id }, { $set: { teamName: client.teamName } });
            notifyClientTeam(client);

        } else if (message.type === 'MASTER_REQUEST_START_GAME') {
            startLevel1();
        } else if (message.type === 'MASTER_REQUEST_ABANDON_GAME') {
            initialStep();
            notifyMasterStep(step);
            teams.forEach((team) => {
                team.score = 0;
                db.teams.update({name:team.name},{$set: { score: team.score }});
                notifyMasterTeam('EXISTING_TEAM', team);
            });
        } else if (message.type === 'MASTER_REQUEST_RESET_GAME') {
            clientIDs.forEach((client) => {
                notifyMasterClient('REMOVE_CLIENT', client);
            });
            clientIDs.clear();
            clientWSs.clear();
            clientIDWSs.clear();
            db.clients.remove({});
        } else if (message.type === 'CONNECTION') {
            if (message.clientId==='UNKNOWN') {
                // First connexion ever
                const client = createClient(ws);
             } else {
                if (clientIDs.has(message.clientId)) {
                    // Client already known.
                    reconnectClient(message.clientId, ws);
                } else {
                    // Create a new id
                    createClient(ws);
                }

                const response = JSON.stringify({
                    type: 'GET_ORIENTATION'
                });
                ws.send(response);
            }
        } else if (message.type === 'ORIENTATION') {
            const client = clientIDs.get(message.clientId);
            if (client !== undefined) {
                updateOrientation(client, message.orientation);
            } else {
                // We have missed the connection message
                // Request another one.
                const response = JSON.stringify({
                    type: 'GET_CONNECTION'
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

initialStep = () => {
    step = {
        id: 'WAITING_CLIENTS',
        level: undefined
    };
    db.step.update({},step,{upsert :true});
}
if (step === undefined) {
    initialStep();
}

createTeam = (teamName) => {
    const team = {
        name: teamName,
        score : 0
    }

    teams.set(teamName, team);
    db.teams.insert(team);
};
if (teams.size == 0) {
    createTeam('RED');
    createTeam('BLUE');
}

createMaster = (ws) => {
    const master = {
        ws: ws
    };
    return master;
};

createClient = (ws) => {
    let id = uuidv4();
    console.log(`Create client ${id}.`);

    const usedNames = Array.from(clientIDs.values()).map(client => client.name);
    const availableNames = names.filter(name => {
        return !usedNames.includes(name);
    });
    const name = availableNames[Math.floor(Math.random() * availableNames.length)];

    const client= {
        id: id,
        name: name,
        connected: true,
        teamName: undefined,
        picture: undefined,
        orientation: undefined,
        pictureRotated: undefined,
        pictureMatch: false
    };
    clientIDs.set(client.id, client);
    clientWSs.set(ws, client);
    clientIDWSs.set(client.id, ws);
    db.clients.insert(client);

    notifyMasterClient('CLIENT_CREATED', client);
    notifyClientId(client);
    notifyClientName(client);
    notifyClientTeam(client);
    notifyClientPicture(client);
    
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
    notifyClientPicture(client);
}

notifyMasterClient = (eventType, client) => {
    if (master !== undefined && client !== undefined) {
        const message = JSON.stringify({
            type: eventType,
            client: client
        });
        master.ws.send(message);
    }
};

notifyMasterTeam = (eventType, team) => {
    if (master !== undefined && team !== undefined) {
        const message = JSON.stringify({
            type: eventType,
            team: team
        });
        master.ws.send(message);
    }
};


notifyMasterStep = (step) => {
    if (master !== undefined) {
        const message = JSON.stringify({
            type: 'CURRENT_STEP',
            step: step
        });
        master.ws.send(message);
    }
};

notifyClientTeam = (client) => {
    if (client !== undefined) {
        const clientWs = clientIDWSs.get(client.id);
        if (clientWs != undefined) {
            const message = JSON.stringify({
                type: 'SET_CLIENT_TEAM',
                teamName: client.teamName
            });
            clientWs.send(message);
        }
    }
};

notifyClientId = (client) => {
    if (client !== undefined) {
        const clientWs = clientIDWSs.get(client.id);
        if (clientWs !== undefined) {
            const response = JSON.stringify({
                type: 'SET_CLIENT_ID',
                clientId: client.id
            });
            clientWs.send(response);
        }
    }
};

notifyClientName = (client) => {
    if (client !== undefined) {
        const clientWs = clientIDWSs.get(client.id);
        if (clientWs !== undefined) {
            const message = JSON.stringify({
                type: 'SET_CLIENT_NAME',
                clientName: client.name
            });
            clientWs.send(message);
        }
    }
};

notifyClientPicture = (client) => {
    if (client !== undefined) {
        const clientWs = clientIDWSs.get(client.id);
        if (clientWs !== undefined) {
            const message = JSON.stringify({
                type: 'SET_CLIENT_PICTURE',
                picture: client.picture
            });
            clientWs.send(message);
        }
    }
};

updateOrientation = (client, orientation) => {
    if (client === undefined) {
        return;
    }

    client.orientation = orientation;

    let pictureRotated = undefined;
    if (client.picture !== undefined) {
        let fileExtension = client.picture.substring(client.picture.indexOf('.'));
        let fileName = client.picture.substring(0, client.picture.length - fileExtension.length);
  
        let suffix = '';
        if ((client.orientation & 12) == 4) {
            suffix += 'TOP_DOWN ';
        }    
        if ((client.orientation & 12) == 12) {
            suffix += 'TOP_UP ';
        } 
        if ((client.orientation & 48) == 16) {
            suffix += 'RIGHT_DOWN ';
        }
        if ((client.orientation & 48) == 48) {
            suffix += 'RIGHT_UP ';
        } 
        suffix = suffix.trim();
        suffix = suffix.replaceAll(' ','_');

        if (suffix.length > 0) {
            pictureRotated = fileName+'_'+suffix+fileExtension;
        }
    }
    client.pictureRotated = pictureRotated;

    if (step.id === 'START_LEVEL' && step.level !== undefined && step.level.pictures !== undefined) {
        // Find model pictures of the level that aren't matched by a client of our team yet.
        const modelAvailablePictures = Array.from(step.level.pictures);
        clientIDs.forEach((otherClient) => {
            if (otherClient.id !== client.id
                && otherClient.teamName === client.teamName 
                && otherClient.pictureMatch) {
                const index = modelAvailablePictures.indexOf(otherClient.pictureRotated);
                if (index > -1) {
                    modelAvailablePictures.splice(index, 1);
                }
            }
        });
        // Test if the current client matches one of the available model picture of the level.
        if (modelAvailablePictures.indexOf(client.pictureRotated) > -1) {
            client.pictureMatch = true;
        } else {
            client.pictureMatch = false;
        }
    }

    notifyMasterClient('CLIENT_ORIENTATION', client);
};

startLevel1 = () => {
    step.id = 'WAITING_READY';

    const nbPictures = Math.ceil(clientIDs.size/2);
    const availablePictures = ['image01_RIGHT_DOWN.jpg','image01_RIGHT_UP.jpg','image01_TOP_DOWN.jpg'];
    const picture = availablePictures[Math.floor(Math.random() * availablePictures.length)];

    step.level = {
        id: 1,
        pictures: Array(nbPictures).fill(picture)
    };
    db.step.update({},{$set: { id: step.id, level: step.level }});

    clientIDs.forEach((client)=>{
        client.picture='image01.jpg';
        notifyClientPicture(client);
    });

    notifyMasterStep(step);

    // Wait for all clients to be in orientation "TOP_UP"
    const intervalObj = setInterval(()=>{
        let allStandUp = true;
        clientIDs.forEach((client)=>{
            allStandUp &= client.orientation == 12 || client.orientation == 13 || client.orientation == 15;
        });
        if (allStandUp) {
            clearInterval(intervalObj);
            step.id = 'WAITING_COUNTDOWN_3';
            notifyMasterStep(step);

            const timeoutObj = setTimeout(()=>{
                step.id = 'WAITING_COUNTDOWN_2';
                notifyMasterStep(step);

                const timeoutObj = setTimeout(()=>{
                    step.id = 'WAITING_COUNTDOWN_1';
                    notifyMasterStep(step);

                    const timeoutObj = setTimeout(()=>{
                        step.id = 'START_LEVEL';
                        notifyMasterStep(step);
                    }, 1000);
                }, 1000);
            }, 1000);
        }
    }, 1000);
};