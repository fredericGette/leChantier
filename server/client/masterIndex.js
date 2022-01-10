console.log('Master client started.');

var ws = new WebSocket('ws://localhost:8081/ws');
ws.onopen = function() {
    const messageBody = { type:'MASTER_CONNECTION' };
    ws.send(JSON.stringify(messageBody));

    document.body.innerHTML=`
    <div id="game-container">
        <div class="team">Team 1</div>
        <div class="team">Model</div>
        <div class="team">Team 2</div>
    </div>
    `;

    ws.onmessage = function(webSocketMessage) {
        console.log('Received message from server.');
        const message = JSON.parse(webSocketMessage.data);
        console.log(message);
    }
};