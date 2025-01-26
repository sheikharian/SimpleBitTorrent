# SimpleBitTorrent
RealTime Tracker &amp; Peer BitTorrent protocol using string chunk data.

Multiple Peers from different devices and IPs connect to a running Tracker and send &amp; receive chunks to fellow peers connected to Tracker.

## Pre-Requisites for Running
- Establish Port Forwarding for both Tracker and Peers:
  - Port numbers must match with what is in the code.
  - Protocol can be either TCP, UDP or both.
- For peer.js:
  - Input Tracker IP and port number for variable 'trackerURL'.
  - Give your chunk a number in its chunkId for variable 'fileChunks'.
- Install Libraries:
  - NodeJS
  - NPM
  - NATPMP
  - AXIOS
  - WebSocket

## How to Run
- tracker.js runs first.
- peer.js runs when tracker is up and properly established.
- peers will start chunk requests and transmissions when 2+ peers connected to same tracker.
- new peer list sent out to all connected peers when there's a new user or a user disconnects.
