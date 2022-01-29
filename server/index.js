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
const { setMaxListeners } = require('process');
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
const stopwatchs = new Map();

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
            startLevel(1);
        } else if (message.type === 'MASTER_REQUEST_ABANDON_GAME') {
            initialStep();
            notifyMasterStep(step);
            teams.forEach((team) => {
                team.score = 0;
                db.teams.update({name:team.name},{$set: { score: team.score }});
                notifyMasterTeam('EXISTING_TEAM', team);
            });
            // clear all timeout
            stopwatchs.forEach((stopwatch)=>{
                clearTimeout(stopwatch.timeout);
            });
            stopwatchs.clear();
        } else if (message.type === 'MASTER_REQUEST_RESET_GAME') {
            clientIDs.forEach((client) => {
                notifyMasterClient('REMOVE_CLIENT', client);
            });
            clientIDs.clear();
            clientWSs.clear();
            clientIDWSs.clear();
            db.clients.remove({}, { multi: true });
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

notifyMasterStopwatch = (stopwatchName, action, startTime) => {
    if (master !== undefined) {
        const message = JSON.stringify({
            type: 'STOPWATCH',
            name: stopwatchName,
            action: action,
            startTime: startTime
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

    if ((step.id === 'TEAM_WIN' || step.id === 'WAITING_READY') && client.teamName === step.teamName) {
        // Winners are frozen.
        return;
    }

    client.pictureRotated = getPictureRotated(client);

    if ((step.id === 'START_LEVEL' || step.id === 'TEAM_WIN') && step.level !== undefined && step.level.pictures !== undefined) {
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
            console.log('picture match ',client.teamName, step.id, modelAvailablePictures.length);
            if (modelAvailablePictures.length == 1 && step.id === 'START_LEVEL') {
                // Was the last picture to match

                let teamStopwatch = stopwatchs.get(client.teamName);
                console.log('teamStopwatch:',teamStopwatch);
                if (teamStopwatch === undefined) {
                    // No win timeout in progress

                    const timeout = setTimeout(()=>{
                        if (step.id !== 'TEAM_WIN') {
                            // First team to reach the win timeout
    
                            // clear all timeout
                            stopwatchs.forEach((stopwatch)=>{
                                clearTimeout(teamStopwatch.timeout);
                            });
                            stopwatchs.clear();

                            team = teams.get(client.teamName);
    
                            step.id='TEAM_WIN';
                            step.teamName=team.name;
                            db.step.update({},{$set: { id: step.id, teamName: step.teamName }});
                            notifyMasterStep(step);
                    
                            team.score++;
                            db.teams.update({name:team.name},{$set: { score: team.score }});
                            notifyMasterTeam('SCORE_TEAM', team);
                    
                            waitingReady(()=>{startLevel(step.level.id+1);});
                        }
                    },1000);
                    teamStopwatch = {
                        timeout: timeout
                    };
                    stopwatchs.set(client.teamName, teamStopwatch);
                    notifyMasterStopwatch('stopwatch'+client.teamName,'START', Date.now());
                }
            }
        } else {
            // Don't match any picture

            client.pictureMatch = false;
            if (step.id === 'START_LEVEL') {
                const teamStopwatch = stopwatchs.get(client.teamName);
                if (teamStopwatch !== undefined) {
                    // Cancel the win timeout of this team
                    clearTimeout(teamStopwatch.timeout);
                    notifyMasterStopwatch('stopwatch'+client.teamName,'CANCEL', Date.now());
                    stopwatchs.delete(client.teamName);
                }         
            }   
        }
    }

    notifyMasterClient('CLIENT_ORIENTATION', client);
};

getPictureRotated = (client) => {
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

    return pictureRotated;
};

// Wait for all clients to be in orientation "TOP_UP"
waitingReady = (callback) => {
    const intervalObj = setInterval(()=>{
        let allStandUp = true;
        clientIDs.forEach((client)=>{
            allStandUp &= client.orientation == 12 || client.orientation == 13 || client.orientation == 15;
        });
        let allStandUpStopwatch = stopwatchs.get('allStandUp');
        if (allStandUp && allStandUpStopwatch === undefined) {
            allStandUpStopwatch = {
                startTime : Date.now()
            };
            stopwatchs.set('allStandUp', allStandUpStopwatch);
            notifyMasterStopwatch('stopwatchWaitingReady','START',allStandUpStopwatch.startTime);
        }
        if (!allStandUp && allStandUpStopwatch !== undefined) {
            stopwatchs.delete('allStandUp');
            notifyMasterStopwatch('stopwatchWaitingReady','CANCEL');
        }
        if (allStandUp && Date.now()-allStandUpStopwatch.startTime > 2000) {
            clearInterval(intervalObj);
            stopwatchs.delete('allStandUp');

            if (callback !== undefined) {
                callback();
                if (step.id === 'FINISH') {
                    // No countdown required
                    return;
                }
            }

            step.id = 'WAITING_COUNTDOWN_3';
            step.teamName = undefined;
            notifyMasterStep(step);

            setTimeout(()=>{
                step.id = 'WAITING_COUNTDOWN_2';
                notifyMasterStep(step);

                setTimeout(()=>{
                    step.id = 'WAITING_COUNTDOWN_1';
                    notifyMasterStep(step);

                    setTimeout(()=>{
                        step.id = 'WAITING_COUNTDOWN_0';
                        notifyMasterStep(step);
    
                        setTimeout(()=>{
                            step.id = 'START_LEVEL';
                            notifyMasterStep(step);
                        }, 500);
                    }, 1000);
                }, 1000);
            }, 1000);
        }
    }, 500);
};

startLevel = (levelId) => {

    switch(levelId) {
        case 1:
            startLevel1();
            break;
        case 2:
            startLevel2();
            break;
        case 3:
            startLevel3();
            break;      
        case 4:
            startLevel4();
            break;     
        case 5:
            startLevel5();
            break;                              
        default:
            finish();
    }
};

startLevel1 = () => {
    step.id = 'WAITING_READY';

    const nbPictures = Math.ceil(clientIDs.size/2);
    const availablePictures = ['image01_RIGHT_DOWN.png','image01_RIGHT_UP.png','image01_TOP_DOWN.png'];
    const picture = availablePictures[Math.floor(Math.random() * availablePictures.length)];

    step.level = {
        id: 1,
        pictures: Array(nbPictures).fill(picture)
    };
    db.step.update({},{$set: { id: step.id, level: step.level }});

    clientIDs.forEach((client)=>{
        client.picture='image01.png';
        client.pictureRotated = getPictureRotated(client);
        client.pictureMatch=false;
        notifyClientPicture(client);
        notifyMasterClient('CLIENT_ORIENTATION', client);
    });

    notifyMasterStep(step);

    waitingReady();
};

startLevel2 = () => {
    const nbPictures = Math.ceil(clientIDs.size/2);
    const availablePictures01 = ['image01_RIGHT_DOWN.png','image01_RIGHT_UP.png','image01_TOP_DOWN.png'];
    const picture01 = availablePictures01[Math.floor(Math.random() * availablePictures01.length)];
    const availablePictures02 = ['image02_RIGHT_DOWN.png','image02_RIGHT_UP.png','image02_TOP_DOWN.png'];
    const picture02 = availablePictures02[Math.floor(Math.random() * availablePictures02.length)];
    const pictures = Array(nbPictures).fill(picture01);
    pictures[Math.floor(Math.random() * pictures.length)]=picture02;

    step.level = {
        id: 2,
        pictures: pictures
    };
    db.step.update({},{$set: { id: step.id, level: step.level }});

    teams.forEach((team)=>{
        let pictureIdx = 0;
        clientIDs.forEach((client)=>{
            if (client.teamName === team.name) {
                const picture = pictures[pictureIdx];
                client.picture = picture.substring(0,7)+picture.substring(picture.indexOf('.'));
                client.pictureRotated = getPictureRotated(client);
                client.pictureMatch=false;
                notifyClientPicture(client);
                notifyMasterClient('CLIENT_ORIENTATION', client);

                if (pictureIdx<pictures.length) pictureIdx++;
            }
        });
    });
};

startLevel3 = () => {
    const nbPictures = Math.ceil(clientIDs.size/2);
    const availablePictures = [];
    for (let i=1; i<=nbPictures; i++) {
        availablePictures.push('image'+(i).toLocaleString(undefined, {minimumIntegerDigits: 2}));
    }

    // Shuffle pictures
    // https://stackoverflow.com/a/2450976
    let currentIndex = availablePictures.length,  randomIndex;
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [availablePictures[currentIndex], availablePictures[randomIndex]] = [
            availablePictures[randomIndex], availablePictures[currentIndex]];
    }

    const orientations = ['_RIGHT_DOWN.png','_RIGHT_UP.png','_TOP_DOWN.png'];
    const pictures = [];
    availablePictures.forEach((picture)=>{
        const orientation = orientations[Math.floor(Math.random() * orientations.length)];
        pictures.push(picture+orientation);
    });

    step.level = {
        id: 3,
        pictures: pictures
    };
    db.step.update({},{$set: { id: step.id, level: step.level }});

    teams.forEach((team)=>{
        let pictureIdx = 0;
        clientIDs.forEach((client)=>{
            if (client.teamName === team.name) {
                const picture = pictures[pictureIdx];
                client.picture = picture.substring(0,7)+picture.substring(picture.indexOf('.'));
                client.pictureRotated = getPictureRotated(client);
                client.pictureMatch=false;
                notifyClientPicture(client);
                notifyMasterClient('CLIENT_ORIENTATION', client);

                if (pictureIdx<pictures.length) pictureIdx++;
            }
        });
    });
};

startLevel4 = () => {
    const nbPictures = Math.ceil(clientIDs.size/2);

    const availableOrientations = ['_RIGHT_DOWN.png','_RIGHT_UP.png','_TOP_DOWN.png'];
    const orientation1 = availableOrientations[Math.floor(Math.random() * availableOrientations.length)];
    availableOrientations.splice(availableOrientations.indexOf(orientation1), 1);

    const pictures = [];
    for (let i=0; i<nbPictures; i++) {
        pictures.push('image01'+orientation1);
    }

    const orientation2 = availableOrientations[Math.floor(Math.random() * availableOrientations.length)];
    pictures[Math.floor(Math.random() * pictures.length)] = 'image01'+orientation2;

    step.level = {
        id: 4,
        pictures: pictures
    };
    db.step.update({},{$set: { id: step.id, level: step.level }});

    teams.forEach((team)=>{
        let pictureIdx = 0;
        clientIDs.forEach((client)=>{
            if (client.teamName === team.name) {
                const picture = pictures[pictureIdx];
                client.picture = picture.substring(0,7)+picture.substring(picture.indexOf('.'));
                client.pictureRotated = getPictureRotated(client);
                client.pictureMatch=false;
                notifyClientPicture(client);
                notifyMasterClient('CLIENT_ORIENTATION', client);

                if (pictureIdx<pictures.length) pictureIdx++;
            }
        });
    });
};

startLevel5 = () => {
    const nbPictures = Math.ceil(clientIDs.size/2);

    let availableOrientations = []; 
    const pictures = [];
    for (let i=0; i<nbPictures; i++) {
        if (availableOrientations.length === 0) {
            availableOrientations = ['_RIGHT_DOWN.png','_RIGHT_UP.png','_TOP_DOWN.png'];
        }
        const orientation = availableOrientations[Math.floor(Math.random() * availableOrientations.length)];
        availableOrientations.splice(availableOrientations.indexOf(orientation), 1);
        pictures.push('image01'+orientation);
    }

    step.level = {
        id: 5,
        pictures: pictures
    };
    db.step.update({},{$set: { id: step.id, level: step.level }});

    teams.forEach((team)=>{
        let pictureIdx = 0;
        clientIDs.forEach((client)=>{
            if (client.teamName === team.name) {
                const picture = pictures[pictureIdx];
                client.picture = picture.substring(0,7)+picture.substring(picture.indexOf('.'));
                client.pictureRotated = getPictureRotated(client);
                client.pictureMatch=false;
                notifyClientPicture(client);
                notifyMasterClient('CLIENT_ORIENTATION', client);

                if (pictureIdx<pictures.length) pictureIdx++;
            }
        });
    });
};

finish = () => {
    step.id = 'FINISH';
    let winScore = 0;
    teams.forEach((team)=>{
        if (team.score > winScore) {
            winScore = team.score;
        }
    });
    let winTeamNames = [];
    teams.forEach((team)=>{
        if (team.score === winScore) {
            winTeamNames.push(team.name);
        }
    });

    step.winTeamNames = winTeamNames;
    step.teamName = undefined;
    step.level = undefined;
    db.step.update({},step);
    notifyMasterStep(step);
};