
console.log('Client started.');

var clientId='UNKNOWN';
var currentOrientation = 0;

var myStorage = window.localStorage;
var storedClientId = myStorage.getItem('leChantier-clientId');
if (storedClientId != null && storedClientId != undefined) {
    clientId = storedClientId;
    console.log('Retrieved stored client id:', clientId);
}

var wsURL = 'wss://game.home:8080/ws';
if (window.location.protocol != "https:") {
    console.log('HTTP Client detected.');
    wsURL = 'ws://game.home:8081/ws';
 }
 var connectInProgress = true;
var ws = new WebSocket(wsURL);

// Websocket survey loop.
setInterval(function(){
    var wsState = 'UNKNOWN_UNDEFINED';
    if (ws !== undefined) {
        switch(ws.readyState) {
            case 0:
                wsState = 'CONNECTING';
                break;
            case 1:
                wsState = 'OPEN';
                break;
            case 2:
                wsState = 'CLOSING';
                break;
            case 3:
                wsState = 'CLOSED';
                break;
            default:
                wsState = 'UNKNOWN';
        }
    }
    //console.log('webSocket state:',wsState);

    if (wsState === 'CONNECTING' && !connectInProgress) {
        connectInProgress = true;
    }
    if (wsState === 'OPEN' && connectInProgress) {
        wsConnection();
    }
    if (wsState === 'CLOSED' && !connectInProgress) {
        wsReconnect();
    }
}, 1000);

ws.onopen = function() {
    wsConnection();
};
ws.onclose = function() {
    console.log('WebServer disconnected.');
    wsReconnect();
};

function wsReconnect() {
    console.log('Retrying to connect to WebServer ', wsURL);
    connectInProgress = true;
    ws = new WebSocket(wsURL);
};

function wsConnection() {
    console.log('WebServer connected.');
    connectInProgress = false;

    console.log('Send message to server.');
    const messageBody = { type:'CONNECTION', clientId: clientId };
    ws.send(JSON.stringify(messageBody));

    ws.onmessage = function(webSocketMessage) {
        console.log('Received message from server.');
        const message = JSON.parse(webSocketMessage.data);
        console.log(message);

        if (message.type === 'SET_CLIENT_ID') {
            clientId = message.clientId;
            myStorage.setItem('leChantier-clientId', clientId);
            console.log('Stored client id:',message.clientId);
            var text = getOrientationText(currentOrientation);
            const messageBody = { type: 'ORIENTATION', clientId: clientId, orientation: currentOrientation, text: text };
            ws.send(JSON.stringify(messageBody));
        } else if (message.type === 'SET_CLIENT_NAME') {
            var element = document.getElementById('name');
            element.innerText = message.clientName;
        } else if (message.type === 'SET_CLIENT_TEAM') {
            var element = document.getElementById('team');
            element.innerText = message.teamName;
        } else if (message.type === 'SET_CLIENT_PICTURE') {     
            var img = document.querySelector('.shown');
            if (img !== undefined && img !== null) {
                img.classList.remove('shown');   
                img.classList.add('hidden');
            }
            img = document.querySelector('[src="assets/'+message.picture+'"]');
            if (img !== undefined && img !== null) {
                img.classList.remove('hidden');   
                img.classList.add('shown');
            }
        } else if (message.type === 'GET_ORIENTATION') {
            var text = getOrientationText(currentOrientation);
            const messageBody = { type: 'ORIENTATION', clientId: clientId, orientation: currentOrientation, text: text };
            ws.send(JSON.stringify(messageBody));
        }
    };
}

console.log(window.DeviceMotionEvent);
if (window.DeviceMotionEvent) {
    console.log("DeviceMotionEvent ok.");
    window.addEventListener("devicemotion", handleMotionEvent, true);
} else {
    console.log("DeviceMotionEvent NOK.");
}

var orientations = [];


function handleMotionEvent(event) {

    var x = parseFloat(event.accelerationIncludingGravity.x).toFixed(2);
    var y = parseFloat(event.accelerationIncludingGravity.y).toFixed(2);
    var z = parseFloat(event.accelerationIncludingGravity.z).toFixed(2);

    if (isIE()) {
        x = -x;
        y = -y;
        z = -z;
    }

    //console.log(x+" "+y+" "+z);

    // G = 9.8 m/s2
    // G x cos(45°)= 6.9
    var thrd = 5;

    // 3x2 bits: x1 x2 y1 y2 z1 z2; x=right, y=top, z=face, 1=up(1)/down(0), 2=known(1)/unknown(0) 
    var orientation = 0;
    if (z>thrd) {
        orientation |= 3; // 000011="FACE_UP ";
    }
    if (z<-thrd) {
        orientation |= 1; // 000001="FACE_DOWN ";
    }
    if (y>thrd) {
        orientation |= 12;  // 001100="TOP_UP ";
    }
    if (y<-thrd) {
        orientation |= 4; // 000100="TOP_DOWN ";
    }
    if (x>thrd) {
        orientation |= 48; // 110000="RIGHT_UP ";
    }
    if (x<-thrd) {
        orientation |= 16; // 010000="RIGHT_DOWN ";
    }

    // Add this orientation to the dataset
    orientations.push(orientation);

    // find the "mode" to filter "shake" events.
    // https://en.wikipedia.org/wiki/Mode_%28statistics%29
    var mode=0;
    var start=0;
    var persistence=0; // Number of occurrences of the mode
    var previousItem=0;
    var shallowCopy = JSON.parse(JSON.stringify(orientations));
    // Sort the dataset
    shallowCopy.sort();
    shallowCopy.forEach(function(item, index) {
        if (item != previousItem) {
            // Change of value
            // Store the starting index of the new value.
            start = index;
        }
        if (item != mode) {
            // Maybe a new mode ?
            // Length of the new mode
            var length = 1 + index - start;
            if (length > persistence) {
                mode = item;
                persistence = length;
            }
        } else {
            // Increase the number of occurrences of the current mode.
            persistence++;
        }
        previousItem=item;
    });

    var text = getOrientationText(mode);

    debug(orientations.length+" "+mode+" "+text);

    // Remove the oldest orientation to keep the dataset at constant length.
    if (orientations.length > 25) {
        orientations.shift();
    }

    if (currentOrientation != mode) {
        currentOrientation = mode;
        if (ws != undefined) {
            const messageBody = { type: 'ORIENTATION', clientId: clientId, orientation: currentOrientation, text: text };
            ws.send(JSON.stringify(messageBody));
        }
    }
};

function debug(message) {
    var element = document.getElementById("orientation");
    element.innerText = message;
};

function isIE() {
    return navigator.userAgent.toUpperCase().indexOf("TRIDENT/") != -1;
};

function getOrientationText(orientation) {
    var text = "";
    if (orientation == 0) {
        test = "UNKNOWN";
    }
    if ((orientation & 3) == 1) {
        text += "FACE_DOWN ";
    }
    if ((orientation & 3) == 3) {
        text += "FACE_UP ";
    }    
    if ((orientation & 12) == 4) {
        text += "TOP_DOWN ";
    }    
    if ((orientation & 12) == 12) {
        text += "TOP_UP ";
    } 
    if ((orientation & 48) == 16) {
        text += "RIGHT_DOWN ";
    }
    if ((orientation & 48) == 48) {
        text += "RIGHT_UP ";
    } 

    return text;
}
