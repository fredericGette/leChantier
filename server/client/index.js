(function() {
    console.log('Client started.');

    const ws = new WebSocket('ws://192.168.1.30:8080/ws');
    ws.onopen = function() {
        console.log('Server connected.');

        console.log('Send message to server.');
        const messageBody = { x: 1, y: 2 };
        ws.send(JSON.stringify(messageBody));

        ws.onmessage = function(webSocketMessage) {
            console.log('Received message from server.');
            const messageBody = JSON.parse(webSocketMessage.data);
            console.log(messageBody);
        };
    };
})();
