console.log('Master client started.');

var ws = new WebSocket('ws://localhost:8081/ws');

let step = 'UNKNOWN';
const clientsIDs = new Map();

ws.onopen = function() {
    const messageBody = { type:'MASTER_CONNECTION' };
    ws.send(JSON.stringify(messageBody));

    ws.onmessage = function(webSocketMessage) {
        console.log('Received message from server.');
        const message = JSON.parse(webSocketMessage.data);
        console.log(message);

        if (message.type === 'CURRENT_STEP') {
            if (message.step !== step) {
                updateStep(message.step, message.level);
            }
        } else if (message.type === 'EXISTING_CLIENT') {
            const client = message.client;
            clientsIDs.set(client.id, client);
            addClient(client);
        } else if (message.type === 'CLIENT_CREATED') {
            const client = message.client;
            clientsIDs.set(client.id, client);
            addClient(client);
        } else if (message.type === 'CLIENT_DISCONNECTED') {
            const client = message.client;
            clientsIDs.set(client.id, client);
            updateClient(client);
        } else if (message.type === 'CLIENT_RECONNECTED') {
            const client = message.client;
            clientsIDs.set(client.id, client);
            updateClient(client);
        } 
    }
};

updateStep = (newStep, level) => {
    if (newStep === 'WAITING_CLIENTS') {
        displayWaitingClients();
    } else if (newStep === 'START_LEVEL') {
        displayLevel(level);
    }
    step = newStep;
};

addClient = (client) => {
    if (step === 'WAITING_CLIENTS') {
        addWaitingClient(client);
    } else if (step === 'START_LEVEL') {
        addPlayingClient(client);
    }
};

updateClient = (client) => {
    if (step === 'WAITING_CLIENTS') {
        const clientDiv = document.getElementById(client.id);
        if (client.connected) {
            clientDiv.classList.add('connected');
            clientDiv.classList.remove('disconnected');
        } else {
            clientDiv.classList.remove('connected');
            clientDiv.classList.add('disconnected');
        }
    }
};


// WAITING_CLIENTS

displayWaitingClients = () => {
    document.body.innerHTML=`
    <div id="waiting-clients">
        <div id="clients"></div>
        <button type="button" onclick="startGame();">Commencer</button>
    </div>
    `;
};

addWaitingClient = (client) => {
    const mainDiv = document.getElementById('clients');
    mainDiv.insertAdjacentHTML('beforeend', `
    <div class="client ${client.connected?'connected':'disconnected'}" id="${client.id}">
        <span>${client.name}<span>
        <input type="radio" name="${client.id}Team" ${client.teamName === 'RED' ? 'checked':''} value="RED" onclick="teamClick('${client.id}', this.value);">
        <input type="radio" name="${client.id}Team" ${client.teamName === undefined ? 'checked':''} value="undefined" disabled>
        <input type="radio" name="${client.id}Team" ${client.teamName === 'BLUE' ? 'checked':''} value="BLUE" onclick="teamClick('${client.id}', this.value);">
    </div>
    `);
};

teamClick = (clientId, teamName) => {
    const client = clientsIDs.get(clientId);
    client.teamName = teamName;

    const messageBody = { type:'MASTER_UPDATE_TEAM', clientId: clientId, teamName: teamName };
    ws.send(JSON.stringify(messageBody));
};

startGame = () => {
    const messageBody = { type:'MASTER_REQUEST_START_GAME'};
    ws.send(JSON.stringify(messageBody));
};

// LEVELS

addPlayingClient = (client) => {
    if (client.teamName !== undefined) {
        const teamDiv = document.getElementById(client.teamName);
        const clientsDiv = teamDiv.querySelector('.clients');
        clientsDiv.insertAdjacentHTML('beforeend', `
            <div class="client ${client.connected?'connected':'disconnected'}" id="${client.id}">
                <span>${client.name}<span>
            </div>
        `);
    }
};

displayLevel = (level) => {
    document.body.innerHTML=`
    <div id="game-container">
        <div class="team" id="RED">
            <span>Rouges</span>
            <div class="clients"></div>
        </div>
        <div id="model">
            <span>${level.id}</span>
            <div id="pictures"></div>
        </div>
        <div class="team" id="BLUE">
            <span>Bleus</span>
            <div class="clients"></div>
        </div>
    </div>
    `;

    clientsIDs.forEach((client)=>{
        addPlayingClient(client);
    });

    level.pictures.forEach((picture)=>{
        const picturesDiv = document.getElementById('pictures');
        picturesDiv.insertAdjacentHTML('beforeend', `
            <img src="assets/${picture}">
        `);
    });
}