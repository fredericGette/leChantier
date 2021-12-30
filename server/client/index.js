(function() {
    console.log('Client started.');

    const ws = new WebSocket('ws://game.home:8080/ws');
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

    console.log(window.DeviceMotionEvent);
    if (window.DeviceMotionEvent) {
        console.log("DeviceMotionEvent ok.");
        window.addEventListener("devicemotion", handleMotionEvent, true);
    } else {
        console.log("DeviceMotionEvent NOK.");
        // Try Accelerometer
        if ('LinearAccelerationSensor' in window) {
            navigator.permissions.query({ name: "accelerometer" }).then(result => {
              if (result.state != 'granted') {
                console.log("Sorry, we're not allowed to access sensors " +
                            "on your device..");
              }
            }).catch(err => {
              console.log("Integration with Permissions API is not enabled, still try to start");
            });
          } else {
            console.log("Your browser doesn't support sensors.");
          }
    }

    
})();


function handleMotionEvent(event) {

    var x = parseFloat(event.accelerationIncludingGravity.x).toFixed(2);
    var y = parseFloat(event.accelerationIncludingGravity.y).toFixed(2);
    var z = parseFloat(event.accelerationIncludingGravity.z).toFixed(2);

    var orientation = x+" "+y+" "+z;
    console.log(orientation);

    var thrs = 5;

    if (Math.abs(x)<thrs && Math.abs(y)<thrs && z<-thrs) {
        orientation="flat up";
    }
    if (Math.abs(x)<thrs && Math.abs(y)<thrs && z>thrs) {
        orientation="flat down";
    }
    if (Math.abs(x)<thrs && y<-thrs && Math.abs(z)<thrs) {
        orientation="up";
    }
    if (Math.abs(x)<thrs && y>thrs && Math.abs(z)<thrs) {
        orientation="down";
    }
    if (x<-thrs && Math.abs(y)<thrs && Math.abs(z)<thrs) {
        orientation="left";
    }
    if (x>thrs && Math.abs(y)<thrs && Math.abs(z)<thrs) {
        orientation="right";
    }
    if (x<-thrs && y<-thrs && Math.abs(z)<thrs) {
        orientation="up left";
    }
    if (x>thrs && y<-thrs && Math.abs(z)<thrs) {
        orientation="up right";
    }
    if (x<-thrs && y>thrs && Math.abs(z)<thrs) {
        orientation="down left";
    }
    if (x>thrs && y>thrs && Math.abs(z)<thrs) {
        orientation="down right";
    }

    var element = document.getElementById("orientation");
    element.innerText = orientation;
}

