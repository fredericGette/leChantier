
console.log('Client started.');

const ws = new WebSocket('wss://game.home:8080/ws');
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

    orientations.push(orientation);

    if (orientations.length >50 ) {
        // find the "mode" to filter "shake" events.
        // https://en.wikipedia.org/wiki/Mode_%28statistics%29
        var mode=0;
        var indice=0
        var persistence=0;
        var shallowCopy = Array.from(orientations);
        shallowCopy.sort();
        shallowCopy.forEach(function(item, index) {
            if (item != mode) {
                var length = index - indice;
                if (length > persistence) {
                    mode = item;
                    indice = index;
                    persistence = length;
                }
            }
          });

        var text = "";
        if (mode == 0) {
            test = "UNKOWN";
        }
        if ((mode & 3) == 3) {
            text += "FACE_UP ";
        }
        if ((mode & 3) == 1) {
            text += "FACE_DOWN ";
        }
        if ((mode & 12) == 12) {
            text += "TOP_UP ";
        } 
        if ((mode & 12) == 4) {
            text += "TOP_DOWN ";
        }
        if ((mode & 48) == 48) {
            text += "RIGHT_UP ";
        } 
        if ((mode & 48) == 16) {
            text += "RIGHT_DOWN ";
        }

        debug(orientations.length+" "+mode+" "+text);

        orientations.pop();
    }
};

function debug(message) {
    var element = document.getElementById("orientation");
    element.innerText = message;
};

function isIE() {
    return navigator.userAgent.toUpperCase().indexOf("TRIDENT/") != -1;
};
