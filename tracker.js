// tracker.js
// node js libary
const WebSocket = require("ws");

// tracker port and websocket creation, default port number set to 3000
const trackerPort = 3000;
const wss = new WebSocket.Server({ port: trackerPort });

// tracker start print
console.log(`Tracker running port ${trackerPort}`);

// peer list var
const peers = {};

// func to send peer list to all connected clients
function givePeerList() {
    // map peer ids with port numbers
    const peerList = Object.keys(peers).map((id) => ({
        id,
        ip: peers[id].ip,
        port: peers[id].port,
    }));

    // JSON to convert peerList to string before sending to each client
    const message = JSON.stringify({ type: "peerList", peers: peerList });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    // print that updated list sent to all clients
    console.log("Broadcasted updated peer list to all connected clients.");
}

// when a new client connects to tracker
wss.on("connection", (ws, req) => {
    try {
        // print new client ip, removing extra characters in ip addressing
        const peerIp = req.socket.remoteAddress.replace(/^::ffff:/, "");
        console.log(`New connection from ${peerIp}`);
        // multiple types of messages for tracker to process
        ws.on("message", (message) => {
            try {
                const data = JSON.parse(message);
                // when new client registers
                if (data.type === "register") {
                    const peerId = data.id;
                    const peerPort = data.port;

                    // new client data formatted, print to console data
                    peers[peerId] = { ip: peerIp, port: peerPort, ws, lastSeen: Date.now() };
                    console.log(`Peer registered: ${peerId}, IP: ${peerIp}, Port: ${peerPort}`);

                    // give updated peer list to all clients
                    givePeerList();
                }
                // if tracker gets a request to send peer list
                else if (data.type === "getPeers") {
                    const peerList = Object.keys(peers)
                        // filter out requesting peer from list to send
                        .filter((id) => id !== data.id)
                        .map((id) => ({ id, ip: peers[id].ip, port: peers[id].port }));

                    // send converted to string peer list to requesting client
                    ws.send(JSON.stringify({ type: "peerList", peers: peerList }));
                    console.log(`Sent peer list to: ${data.id}`);
                }
                else {
                    console.warn(`Unknown message type: ${data.type}`);
                }
            } 
            catch (err) {
                console.error("Error processing message:", err.message, "Message content:", message);
                ws.send(JSON.stringify({ type: "error", message: "Invalid message format or content." }));
            }
        });

        // when a client disconnects
        ws.on("close", () => {
            // get disconnected peer id
            const disconPeerId = Object.keys(peers).find((id) => peers[id].ws === ws);
            // if var has value
            if (disconPeerId) {
                // remove specific client from peer list and print out status message
                delete peers[disconPeerId];
                console.log(`Peer disconnected: ${disconPeerId}`);
                // send updated peer list to all connected clients
                givePeerList();
            }
        });
        // error message, prints which ip it came from
        ws.on("error", (err) => {
            console.error(`WebSocket error from ${peerIp}:`, err.message);
        });
    }
    catch (err) {
        console.error("Error during connection handling:", err.message);
    }
});

// closing tracker
process.on("SIGINT", () => {
    console.log("Shutting down tracker...");
    // remove every connected client before close
    wss.clients.forEach((client) => client.close());
    process.exit(0);
});

// any other error
process.on("uncaughtException", (err) => {
    console.error("Unhandled exception:", err.message);
});