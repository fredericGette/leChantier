let sound = {
    name: undefined,
    audio: undefined
};
const songs = ['Dorothee.mp3','Henri Salvador.mp3','Zoufris Maracas.mp3'];

let ws = undefined;
    
let step = {
    id:'UNKNOWN'
};
const clientsIDs = new Map();
const teams = new Map();
const stopwatchs = new Map();

start = () => {
    console.log('Master client started.');

    ws = new WebSocket('ws://localhost:8081/ws');
    
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
            } else if (message.type === 'SCORE_TEAM') {
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
            }  else if (message.type === 'STOPWATCH') {
                stopwatchManage(message.name, message.action, message.startTime);
            } 
        }
    };
};

updateStep = (newStep) => {
    stopwatchs.forEach((stopwatch, name)=>{
        clearInterval(stopwatch.interval);
        const stopwatchElt = document.getElementById(name);
        if (stopwatchElt !== null) {
            stopwatchElt.value = 0;
            stopwatchElt.hidden = true;
        }
    });
    stopwatchs.clear();
    console.log('Stopwatch: clear all.');

    if (newStep.id === 'WAITING_CLIENTS') {
        displayWaitingClients();
    } else if (newStep.id === 'WAITING_READY') {
        displayWaitingReady(newStep.level);
    } else if (newStep.id === 'WAITING_COUNTDOWN_3') {
        displayWaitingCountdown(newStep.level, 3);     
    } else if (newStep.id === 'WAITING_COUNTDOWN_2') {
        displayWaitingCountdown(newStep.level, 2);    
    } else if (newStep.id === 'WAITING_COUNTDOWN_1') {
        displayWaitingCountdown(newStep.level, 1);   
    } else if (newStep.id === 'WAITING_COUNTDOWN_0') {
        displayWaitingCountdown(newStep.level, 0);     
    } else if (newStep.id === 'START_LEVEL') {
        displayLevel(newStep.level);
    } else if (newStep.id === 'TEAM_WIN') {
        displayTeamWin(newStep.teamName, newStep.level);
    } else if (newStep.id === 'FINISH') {
        displayFinishScreen(newStep.winTeamNames);
    }
    step = newStep;
};

addClient = (client) => {
    if (step.id === 'WAITING_CLIENTS') {
        addWaitingClient(client);
    } else if (step.id === 'WAITING_READY' 
    || step.id === 'WAITING_COUNTDOWN_3'
    || step.id === 'WAITING_COUNTDOWN_2'
    || step.id === 'WAITING_COUNTDOWN_1'
    || step.id === 'START_LEVEL') {
        addPlayingClient(client);
    }
};

updateClient = (client) => {
    if (step.id === 'WAITING_CLIENTS') {
        updateWaitingClient(client);
    } else if (step.id !== 'WAITING_CLIENTS') {
        updatePlayingClient(client);
    }
};

removeClient = (client) => {
    if (step.id === 'WAITING_CLIENTS') {
        removeWaitingClient(client);
    }
};

updateTeam = (team) => {
    if (step.id !== 'WAITING_CLIENTS') {
        updatePlayingTeam(team);
    }
};

// WAITING_CLIENTS

displayWaitingClients = () => {
    playWaitingSong();

    document.body.innerHTML=`
    <div id="waiting-clients">
        <div id="clients"></div>
        <div id="command">
            <button type="button" onclick="startGame();">Commencer</button>
            <button type="button" onclick="resetGame();">Reinitialiser</button>
        </div>
    </div>
    `;

    clientsIDs.forEach((client)=>{
        addWaitingClient(client);
    });
};

addWaitingClient = (client) => {
    const mainDiv = document.getElementById('clients');
    mainDiv.insertAdjacentHTML('beforeend', `
    <div class="client ${client.connected?'connected':'disconnected'}" id="${client.id}">
        <span>${client.name}</span>
        <div class="team-radio">
            <label class="radio-container">
                <input type="radio" name="${client.id}Team" ${client.teamName === 'RED' ? 'checked':''} value="RED" onclick="teamClick('${client.id}', this.value);">
                <span class="checkmark red"></span>
            </label>
            <label class="radio-container">
                <input type="radio" name="${client.id}Team" ${client.teamName === undefined ? 'checked':''} value="undefined" disabled>
                <span class="checkmark"></span>
            </label>
            <label class="radio-container">
                <input type="radio" name="${client.id}Team" ${client.teamName === 'BLUE' ? 'checked':''} value="BLUE" onclick="teamClick('${client.id}', this.value);">
                <span class="checkmark blue"></span>
            </label>
        </div>
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

stopwatchManage = (name, action, startTime) => {
    if (action === 'START') {
        const interval = setInterval(()=>{
            const stopwatchValue = Date.now() - startTime;
            const stopwatchElt = document.getElementById(name);
            stopwatchElt.value = stopwatchValue;
            stopwatchElt.hidden = false;
        },100);
        stopwatchs.set(name, {
            startTime: startTime,
            interval : interval
        });
        console.log('Stopwatch start: '+name);

    } else if (action === 'CANCEL') {
        const stopwatch = stopwatchs.get(name);
        clearInterval(stopwatch.interval);
        stopwatchs.delete(name);
        const stopwatchElt = document.getElementById(name);
        stopwatchElt.value = 0;
        stopwatchElt.hidden = true;

        console.log('Stopwatch cancel: '+name);
    }
};

// WAITING_READY

displayWaitingReady = (level) => {
    document.body.innerHTML=`
    <div id="game-container">
        <div id="teams-models">
            <div class="team" id="RED">
                <div class="score"></div>
                <progress id="stopwatchRED" max="1000" value="0" hidden></progress>
                <div class="clients"></div>
            </div>
            <div id="models">
                <div id="level-text">
                    Niveau
                    <span id="level">${level.id}</span>
                </div>
                <div id="waiting-text">
                    Tenez votre matériel verticalement devant vous pour continuer.
                    <progress id="stopwatchWaitingReady" max="2000" value="0" hidden></progress>
                </div>
            </div>
            <div class="team" id="BLUE">
                <div class="score"></div>
                <progress id="stopwatchBLUE" max="1000" value="0" hidden></progress>
                <div class="clients"></div>
            </div>
        </div>
        <div id="command">
            <button type="button" onclick="abandonGame();">Abandonner</button>
        </div>
    </div>
    `;

    clientsIDs.forEach((client)=>{
        addPlayingClient(client);
        updatePlayingClient(client);
    });

    teams.forEach((team)=>{
        updatePlayingTeam(team);
    });


};

// WAITING_COUNTDOWN

displayWaitingCountdown = (level, countdown) => {
    const picturesDiv = document.getElementById('pictures');
    if (picturesDiv !== undefined && picturesDiv !== null) {
        picturesDiv.remove();
    }

    const textDiv = document.getElementById('waiting-text');
    if (textDiv !== undefined && textDiv !== null) {
        textDiv.remove();
    }

    let countdownDiv = document.getElementById('countdown');
    if (countdownDiv === undefined || countdownDiv === null) {
        const modelsDiv = document.getElementById('models');
        modelsDiv.insertAdjacentHTML('beforeend', `
            <div id='countdown'></div>
        `);
    }

    countdownDiv = document.getElementById('countdown');
    if (countdown > 0) {
        countdownDiv.innerHTML = `<img src="assets/trafficLightWait${countdown}.png">`;
    } else {
        countdownDiv.innerHTML = `<img src="assets/trafficLightGreen.png">`;
    }
    

    const levelElt = document.getElementById('level');
    if (levelElt !== null) {
        levelElt.innerText = level.id;
    }
};

// LEVELS

addPlayingClient = (client) => {
    if (client.teamName !== undefined) {
        const teamDiv = document.getElementById(client.teamName);
        if (teamDiv != null) {
            const clientsDiv = teamDiv.querySelector('.clients');
            clientsDiv.insertAdjacentHTML('beforeend', `
                <div class="client ${client.connected?'connected':'disconnected'}" id="${client.id}">
                    <span>${client.name}</span>
                    <img src="assets/unknown.png">
                </div>
            `);
        }
    }
};

updatePlayingTeam = (team) => {
    const teamDiv = document.getElementById(team.name);
    if (teamDiv !== null) {
        const scoreElt = teamDiv.querySelector('.score');
        scoreElt.innerText = team.score;
    }
};

updatePlayingClient = (client) => {
    const clientDiv = document.getElementById(client.id);
    if (clientDiv !== undefined && clientDiv !== null) {
        if (client.connected) {
            clientDiv.classList.add('connected');
            clientDiv.classList.remove('disconnected');
        } else {
            clientDiv.classList.remove('connected');
            clientDiv.classList.add('disconnected');
        }
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
    playRandomSong();

    const textDiv = document.getElementById('waiting-text');
    if (textDiv !== undefined && textDiv !== null) {
        textDiv.remove();
    }

    const countdownDiv = document.getElementById('countdown');
    if (countdownDiv !== undefined && countdownDiv !== null) {
        countdownDiv.remove();
    }

    let picturesDiv = document.getElementById('pictures');
    if (picturesDiv !== undefined && picturesDiv !== null) {
        picturesDiv.remove();
    }

    const modelsDiv = document.getElementById('models');
    if (modelsDiv != null) {
        modelsDiv.insertAdjacentHTML('beforeend', `
            <div id="pictures"></div>
        `);
    }

    picturesDiv = document.getElementById('pictures');
    if (picturesDiv !== null) {
        level.pictures.forEach((picture)=>{
            picturesDiv.insertAdjacentHTML('beforeend', `
                <img src="assets/${picture}">
            `);
        });
    }

    const levelElt = document.getElementById('level');
    if (levelElt !== null) {
        levelElt.innerText = level.id;
    }

    // In case of issue
    const commandDiv = document.getElementById('command');
    if (commandDiv === null) {
        document.body.innerHTML=`
            <button type="button" onclick="abandonGame();">Abandonner</button>
        `;
    }
};

abandonGame = () => {
    const messageBody = { type:'MASTER_REQUEST_ABANDON_GAME'};
    ws.send(JSON.stringify(messageBody));
};

// TEAM_WIN

displayTeamWin = (teamName, level) => {
    document.body.innerHTML=`
    <div id="game-container">
        <div id="teams-models">
            <div class="team" id="RED">
                <div class="score"></div>
                <progress id="stopwatchRED" max="1000" value="0" hidden></progress>
                <div class="clients"></div>
            </div>
            <div id="models">
                <div id="level-text">
                    Niveau
                    <span id="level">${level.id}</span>
                </div>
                <div id="pictures"></div>
                <div id="waiting-text" class="small">
                    Tenez votre matériel verticalement devant vous pour continuer.
                    <progress id="stopwatchWaitingReady" max="2000" value="0" hidden></progress>
                </div>
            </div>
            <div class="team" id="BLUE">
                <div class="score"></div>
                <progress id="stopwatchBLUE" max="1000" value="0" hidden></progress>
                <div class="clients"></div>
            </div>
        </div>
        <div id="command">
            <button type="button" onclick="abandonGame();">Abandonner</button>
        </div>
    </div>
    `;

    clientsIDs.forEach((client)=>{
        addPlayingClient(client);
        updatePlayingClient(client);
    });

    level.pictures.forEach((picture)=>{
        const picturesDiv = document.getElementById('pictures');
        picturesDiv.insertAdjacentHTML('beforeend', `
            <img src="assets/${picture}">
        `);
    });

    teams.forEach((team)=>{
        updatePlayingTeam(team);
    });
};

displayFinishScreen = (winTeamNames) => {
    playFinishSong();

    document.body.innerHTML=`
    <div id="finish-screen">
        <div id="teams-models">
            <div class="team" id="RED">
                <div class="score"></div>
                <div class="clients"></div>
            </div>
            <div class="team" id="BLUE">
                <div class="score"></div>
                <div class="clients"></div>
            </div>
        </div>
        <div id="command">
            <button type="button" onclick="abandonGame();">Recommencer</button>
        </div>
    </div>
    `;

    clientsIDs.forEach((client)=>{
        if (client.teamName !== undefined) {
            const teamDiv = document.getElementById(client.teamName);
            const clientsDiv = teamDiv.querySelector('.clients');
            clientsDiv.insertAdjacentHTML('beforeend', `
                <div class="client" id="${client.id}">
                    <span>${client.name}</span>
                </div>
            `);
        }
    });

    winTeamNames.forEach((winTeamName)=>{
        const teamWinDiv = document.getElementById(winTeamName);
        teamWinDiv.classList.add('winner');
    });

    teams.forEach((team)=>{
        updatePlayingTeam(team);
    });
};

playWaitingSong = async () => {
    if (sound.name !== 'WAIT_SONG') {
        if (sound.audio !== undefined) {
            sound.audio.pause();
        }
        sound.name = 'WAIT_SONG';
        sound.audio = new Audio('assets/worksite.mp3');
        await sound.audio.play();
    }
};

playRandomSong = async () => {
    if (sound.name !== 'RANDOM_SONG') {
        if (sound.audio !== undefined) {
            sound.audio.pause();
        }
        sound.name = 'RANDOM_SONG';

        const song = songs[Math.floor(Math.random() * songs.length)];
        sound.audio = new Audio(`assets/${song}`);
        await sound.audio.play();
        sound.audio.onended = () => {
            console.log('audio end');
            const song = songs[Math.floor(Math.random() * songs.length)];
            sound.audio.src = `assets/${song}`;
            sound.audio.load();
            sound.audio.play();
        };
    }
};

playFinishSong = async () => {
    if (sound.name !== 'FINISH_SONG') {
        if (sound.audio !== undefined) {
            sound.audio.pause();
        }
        sound.name = 'FINISH_SONG';
        sound.audio = new Audio('assets/finish.mp3');
        await sound.audio.play();
    }
};