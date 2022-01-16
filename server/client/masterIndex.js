console.log('Master client started.');

var ws = new WebSocket('ws://localhost:8081/ws');

let step = {
    id:'UNKNOWN'
};
const clientsIDs = new Map();
const teams = new Map();

ws.onopen = function() {
    const messageBody = { type:'MASTER_CONNECTION' };
    ws.send(JSON.stringify(messageBody));

    ws.onmessage = function(webSocketMessage) {
        console.log('Received message from server.');
        const message = JSON.parse(webSocketMessage.data);
        console.log(message);

        if (message.type === 'CURRENT_STEP') {
            if (message.step.id !== step.id) {
                updateStep(message.step);
            }
        } else if (message.type === 'EXISTING_CLIENT') {
            const client = message.client;
            clientsIDs.set(client.id, client);
            addClient(client);
        } else if (message.type === 'EXISTING_TEAM') {
            const team = message.team;
            teams.set(team.name, team);
            updateTeam(team);
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
        } else if (message.type === 'CLIENT_ORIENTATION') {
            const client = message.client;
            clientsIDs.set(client.id, client);
            updateClient(client);
        } else if (message.type === 'REMOVE_CLIENT') {
            const client = message.client;
            clientsIDs.delete(client.id);
            removeClient(client);
        } 
    }
};

updateStep = (newStep) => {
    if (newStep.id === 'WAITING_CLIENTS') {
        displayWaitingClients();
    } else if (newStep.id === 'START_LEVEL') {
        displayLevel(newStep.level);
    }
    step = newStep;
};

addClient = (client) => {
    if (step.id === 'WAITING_CLIENTS') {
        addWaitingClient(client);
    } else if (step.id === 'START_LEVEL') {
        addPlayingClient(client);
    }
};

updateClient = (client) => {
    if (step.id === 'WAITING_CLIENTS') {
        updateWaitingClient(client);
    } else if (step.id === 'START_LEVEL') {
        updatePlayingClient(client);
    }
};

removeClient = (client) => {
    if (step.id === 'WAITING_CLIENTS') {
        removeWaitingClient(client);
    }
};

updateTeam = (team) => {
    if (step.id === 'START_LEVEL') {
        updatePlayingTeam(team);
    }
};


// WAITING_CLIENTS

displayWaitingClients = () => {
    document.body.innerHTML=`
    <div id="waiting-clients">
        <div id="clients"></div>
        <div id="command">
            <button type="button" onclick="startGame();">Commencer</button>
            <button type="button" onclick="resetGame();">Reinitialiser</button>
        </div>
    </div>
    `;
};

addWaitingClient = (client) => {
    const mainDiv = document.getElementById('clients');
    mainDiv.insertAdjacentHTML('beforeend', `
    <div class="client ${client.connected?'connected':'disconnected'}" id="${client.id}">
        <span>${client.name}</span>
        <input type="radio" name="${client.id}Team" ${client.teamName === 'RED' ? 'checked':''} value="RED" onclick="teamClick('${client.id}', this.value);">
        <input type="radio" name="${client.id}Team" ${client.teamName === undefined ? 'checked':''} value="undefined" disabled>
        <input type="radio" name="${client.id}Team" ${client.teamName === 'BLUE' ? 'checked':''} value="BLUE" onclick="teamClick('${client.id}', this.value);">
    </div>
    `);
};

removeWaitingClient = (client) => {
    const clientDiv = document.getElementById(client.id);
    clientDiv.remove();
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

resetGame = () => {
    const messageBody = { type:'MASTER_REQUEST_RESET_GAME'};
    ws.send(JSON.stringify(messageBody));
};

updateWaitingClient = (client) => {
    const clientDiv = document.getElementById(client.id);
    if (client.connected) {
        clientDiv.classList.add('connected');
        clientDiv.classList.remove('disconnected');
    } else {
        clientDiv.classList.remove('connected');
        clientDiv.classList.add('disconnected');
    }
};

// LEVELS

addPlayingClient = (client) => {
    if (client.teamName !== undefined) {
        const teamDiv = document.getElementById(client.teamName);
        const clientsDiv = teamDiv.querySelector('.clients');
        clientsDiv.insertAdjacentHTML('beforeend', `
            <div class="client ${client.connected?'connected':'disconnected'}" id="${client.id}">
                <span>${client.name}</span>
                <img src="assets/unknown.png">
            </div>
        `);
    }
};

updatePlayingTeam = (team) => {
    const teamDiv = document.getElementById(team.name);
    const scoreSpan = teamDiv.querySelector('.score');
    scoreSpan.innerHTML = team.score;
};

updatePlayingClient = (client) => {
    const clientDiv = document.getElementById(client.id);
    if (client.connected) {
        clientDiv.classList.add('connected');
        clientDiv.classList.remove('disconnected');
    } else {
        clientDiv.classList.remove('connected');
        clientDiv.classList.add('disconnected');
    }

    let imgSrc = 'assets/unknown.png';
    if (client.pictureRotated !== undefined) {
        imgSrc = 'assets/'+client.pictureRotated;
    }

    const clientImg = clientDiv.querySelector('img');
    clientImg.src = imgSrc;

    if (client.pictureMatch) {
        clientImg.classList.add('match');
    } else {
        clientImg.classList.remove('match');
    }
};

displayLevel = (level) => {
    document.body.innerHTML=`
    <div id="game-container">
        <div id="teams-models">
            <div class="team" id="RED">
                <span>Rouges</span>
                <span class="score"></span>
                <div class="clients"></div>
            </div>
            <div id="models">
                <span>Niveau</span>
                <span id="level">${level.id}</span>
                <div id="pictures"></div>
            </div>
            <div class="team" id="BLUE">
                <span>Bleus</span>
                <span class="score"></span>
                <div class="clients"></div>
            </div>
        </div>
        <div id="command">
            <button type="button" onclick="abandonGame();>Abandonner</button>
        </div>
    </div>
    
    `;

    clientsIDs.forEach((client)=>{
        addPlayingClient(client);
    });

    teams.forEach((team)=>{
        updatePlayingTeam(team);
    });

    level.pictures.forEach((picture)=>{
        const picturesDiv = document.getElementById('pictures');
        picturesDiv.insertAdjacentHTML('beforeend', `
            <img src="assets/${picture}">
        `);
    });
};

abandonGame = () => {
    const messageBody = { type:'MASTER_REQUEST_ABANDON_GAME'};
    ws.send(JSON.stringify(messageBody));
};