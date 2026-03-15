var webSocket = {};

function isObject(val) {
    if (val === null) return false;
    return typeof val === 'object';
}

webSocket.send = function(msg) {
    if (this.connection.readyState == 1)
        this.connection.send(isObject(msg) ? JSON.stringify(msg) : msg);
    else if (this.connection.readyState == 0) {
        this.connection.addEventListener("open", function() {
            this.send(isObject(msg) ? JSON.stringify(msg) : msg);
        }, false);
    }
};

var wsurl = ((window.location.protocol == 'http:') ? 'ws://' : 'wss://')
    + window.location.host + '/websocket' + window.location.search;

try {
    webSocket.connection = new WebSocket(wsurl);
    webSocket.connection.binaryType = 'arraybuffer';
    webSocket.connection.onerror = function(error) {
        console.log('WebSocket Error: ' + error);
    };
    webSocket.connection.onclose = function() {
        console.log('WebSocket closed');
        webSocket.connected = false;
    };
    webSocket.connection.onmessage = function(messageEvent) {
        if (!messageEvent.data || messageEvent.data.length < 10) return;
        var msgData = JSON.parse(messageEvent.data);
        var fn = webSocket[msgData.cmd];
        if (typeof fn !== 'function') return;
        fn(msgData);
    };
} catch(e) {
    console.log('WebSocket Exception: ' + e);
}

webSocket.close = function() {
    if (this.connection.readyState == 1)
        this.connection.close();
};

export default webSocket;
