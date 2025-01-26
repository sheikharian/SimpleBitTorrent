// peer.js
// node js libraries
const WebSocket = require("ws");
const natpmp = require("nat-pmp");
const axios = require("axios");

// tracker ip and port #
const trackerUrl = "ws://<INSERTIPHERE>:<INSERTTRACKPORTHERE>";
// peer id is randomly generated, peer chunk data in title and data format
const peerId = Math.random().toString(36).substring(7);
const fileChunks = { "chunk<INSERTNUMBERHERE>": `This is the chunk data from peer ${peerId}.`};

// NAT-PMP client for port forwarding
const client = new natpmp.Client();
const externalPort = 4000;

// re-registration with tracker to prevent idle timeout, time in milliseconds
const reRegTime = 30000; // 30 seconds

// func to get user public ip to give to tracker on connection using axios
async function getPublicIP() {
    try {
        const res = await axios.get("https://api.ipify.org?format=json");
        const publicIp = res.data.ip;
        console.log(`Public IP fetched: ${publicIp}`);
        return publicIp;
    } 
    catch (err) {
        console.error("Failed to fetch public IP:", err.message);
        return null;
    }
}

console.log(`Peer server running on port ${externalPort}`);

// websocket to use communincate with tracker
const ws = new WebSocket(trackerUrl);
ws.on("open", async () => {
    try {
        // connect to peer and get public ip for initial registration
        console.log(`Connected to tracker as peer ${peerId}`);
        const publicIp = await getPublicIP();
        if (!publicIp) {
            console.error("Cannot proceed without a valid public IP.");
            return;
        }
        registerWithTracker(ws, publicIp);

        // timer for re-registration, on reset send request for peer list
        setInterval(() => {
            registerWithTracker(ws, publicIp);
        }, reRegTime);
        setTimeout(() => {
            ws.send(JSON.stringify({ type: "getPeers", id: peerId }));
        }, 1000);
    } 
    catch (err) {
        console.error("Error during WebSocket open:", err.message);
    }
});

// peer receiving differing message types from tracker
ws.on("message", (message) => {
    try {
        // parse message from tracker with JSON
        const data = JSON.parse(message);
        // if peerList print out list and start chunk download from other peers
        if (data.type === "peerList") {
            console.log(`Received peer list:`, data.peers);
            downloadChunk(data.peers);
        } 
        else if (data.type === "error") {
            console.error(`Tracker error: ${data.message}`);
        } 
        else {
            console.warn(`Unknown message type received: ${data.type}`);
        }
    } 
    catch (err) {
        console.error("Error processing tracker message:", err.message, "Message content:", message);
    }
});

// create new websocketserver for other peer connections
const { WebSocketServer } = require("ws");
const peerServer = new WebSocketServer({ port: externalPort });
// chunk request from fellow peer, starting with connection establishment
peerServer.on("connection", (socket) => {
    try {
        console.log("Connection request from peer");
        // connection made, chunk request received
        socket.on("message", (message) => {
            try {
                // parse request with JSON, if request send chunk data under JSON format
                const data = JSON.parse(message);
                if (data.type === "requestChunk" && fileChunks[data.chunkId]) {
                    socket.send(JSON.stringify({
                        type: "chunkData",
                        chunkId: data.chunkId,
                        data: fileChunks[data.chunkId],
                    }));
                }
                // if unknown chunk request, print warning and tell requesting peer
                else {
                    console.log(data);
                    console.warn(`Chunk ${data.chunkId} not found.`);
                    socket.send(JSON.stringify({ type: "error", message: "Chunk not found." }));
                }
            } 
            catch (err) {
                console.error("Error processing peer message:", err.message);
            }
        });
    } 
    catch (err) {
        console.error("Error handling peer connection:", err.message);
    }
});

// func for first register with tracker
function registerWithTracker(ws, publicIp) {
    try {
        // send to tracker peer data as JSON data
        ws.send(JSON.stringify({
            type: "register",
            id: peerId,
            ip: publicIp,
            port: externalPort,
        }));
        console.log(`Reintroduced to tracker as peer ${peerId}`);
    } 
    catch (err) {
        console.error("Error during registration with tracker:", err.message);
    }
}

// func for requesting other peers in received peer list for their chunk data
function downloadChunk(peerList) {
    peerList.forEach((peer) => {
        const peerUrl = `ws://${peer.ip}:${peer.port}`;
        const peerSocket = new WebSocket(peerUrl);
        // on connection to other peer, send chunk request
        peerSocket.on("open", () => {
            try {
                console.log(`Connected to peer ${peer.id}`);
                // loop and try to get current connected peer for their chunk via matching chunkId
                for(let i = 0; i < peerList.length(); i++) {
                    peerSocket.send(JSON.stringify({ type: "requestChunk", chunkId: `chunk${i}` }));
                }
            } 
            catch (err) {
                console.error("Error during chunk request:", err.message);
            }
        });
        // on receiving message from current connected peer
        peerSocket.on("message", (message) => {
            try {
                // if message chunk data add to fileChunks list after JSON parsing
                const data = JSON.parse(message);
                if (data.type === "chunkData") {
                    fileChunks[data.chunkId] = data.data;
                    console.log(`Received chunk: ${data.chunkId}`);
                    console.log(`Chunk data: ${data.data}`);
                } 
                else {
                    console.warn(`Unknown chunk message type: ${data.type}`);
                }
            } 
            catch (err) {
                console.error("Error processing chunk message:", err.message);
            }
        });
        peerSocket.on("error", (err) => {
            console.error(`Error connecting to peer ${peer.id}:`, err.message);
        });
    });
}