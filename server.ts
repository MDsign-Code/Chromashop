import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PeerInfo {
  clientId: string;
  name: string;
  color: string;
  tool: string;
  x: number;
  y: number;
  pressure: number;
  lastActive: number;
}

interface RoomComment {
  id: string;
  authorName: string;
  authorColor: string;
  text: string;
  x: number;
  y: number;
  urgent: boolean;
  resolved: boolean;
  createdAt: number;
}

interface RoomOp {
  opId: string;
  senderId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface CollabRoom {
  roomCode: string;
  peers: Map<WebSocket, PeerInfo>;
  comments: RoomComment[];
  recentOps: RoomOp[];
  seenOpIds: Set<string>;
}

const rooms = new Map<string, CollabRoom>();

function getOrCreateRoom(roomCode: string): CollabRoom {
  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      roomCode,
      peers: new Map(),
      comments: [],
      recentOps: [],
      seenOpIds: new Set(),
    };
    rooms.set(roomCode, room);
  }
  return room;
}

function broadcastToRoom(room: CollabRoom, data: unknown, exclude?: WebSocket) {
  const serialized = JSON.stringify(data);
  for (const [client] of room.peers) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function broadcastPresence(room: CollabRoom) {
  const peersList = Array.from(room.peers.values());
  broadcastToRoom(room, { type: 'presence:update', peers: peersList });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size, timestamp: Date.now() });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/collab' });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoom: CollabRoom | null = null;
    let currentPeer: PeerInfo | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        const msgType = typeof msg.type === 'string' ? msg.type : '';

        if (msgType === 'room:join') {
          const roomCode = String(msg.roomCode || 'STUDIO-DEFAULT').slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '');
          const clientId = String(msg.clientId || `peer_${Math.random().toString(36).slice(2, 9)}`).slice(0, 64);
          const name = String(msg.name || 'Desainer').slice(0, 48);
          const color = String(msg.color || '#3B82F6').slice(0, 16);

          if (currentRoom) {
            currentRoom.peers.delete(ws);
            broadcastPresence(currentRoom);
          }

          currentRoom = getOrCreateRoom(roomCode || 'STUDIO-DEFAULT');
          currentPeer = {
            clientId,
            name,
            color,
            tool: 'brush',
            x: 0,
            y: 0,
            pressure: 0,
            lastActive: Date.now(),
          };
          currentRoom.peers.set(ws, currentPeer);

          ws.send(JSON.stringify({
            type: 'room:init',
            roomCode: currentRoom.roomCode,
            peers: Array.from(currentRoom.peers.values()),
            comments: currentRoom.comments.slice(-40),
            recentOps: currentRoom.recentOps.slice(-30),
          }));

          broadcastPresence(currentRoom);
          return;
        }

        if (!currentRoom || !currentPeer) return;

        if (msgType === 'cursor:move') {
          currentPeer.x = Number(msg.x) || 0;
          currentPeer.y = Number(msg.y) || 0;
          currentPeer.pressure = Number(msg.pressure) || 0;
          currentPeer.tool = String(msg.tool || currentPeer.tool).slice(0, 32);
          currentPeer.lastActive = Date.now();
          broadcastToRoom(currentRoom, {
            type: 'cursor:moved',
            peer: currentPeer,
          }, ws);
          return;
        }

        if (msgType === 'canvas:op') {
          const opId = String(msg.opId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).slice(0, 64);
          if (currentRoom.seenOpIds.has(opId)) return;
          currentRoom.seenOpIds.add(opId);
          if (currentRoom.seenOpIds.size > 500) {
            const first = currentRoom.seenOpIds.values().next().value;
            if (first) currentRoom.seenOpIds.delete(first);
          }

          const op: RoomOp = {
            opId,
            senderId: currentPeer.clientId,
            type: String(msg.opType || 'stroke').slice(0, 40),
            payload: (typeof msg.payload === 'object' && msg.payload !== null ? msg.payload : {}) as Record<string, unknown>,
            timestamp: Date.now(),
          };
          currentRoom.recentOps.push(op);
          if (currentRoom.recentOps.length > 50) {
            currentRoom.recentOps.shift();
          }
          broadcastToRoom(currentRoom, { type: 'canvas:op', op }, ws);
          return;
        }

        if (msgType === 'comment:add') {
          const id = String(msg.id || `cmt_${Date.now()}`).slice(0, 64);
          if (currentRoom.comments.some((c) => c.id === id)) return;
          const comment: RoomComment = {
            id,
            authorName: currentPeer.name,
            authorColor: currentPeer.color,
            text: String(msg.text || '').slice(0, 500),
            x: Number(msg.x) || 0,
            y: Number(msg.y) || 0,
            urgent: Boolean(msg.urgent),
            resolved: false,
            createdAt: Date.now(),
          };
          currentRoom.comments.push(comment);
          if (currentRoom.comments.length > 100) currentRoom.comments.shift();
          broadcastToRoom(currentRoom, { type: 'comment:added', comment });

          if (comment.urgent) {
            broadcastToRoom(currentRoom, {
              type: 'notification:urgent',
              notification: {
                id: `notif_${Date.now()}`,
                title: `Revisi Mendesak dari ${comment.authorName}`,
                body: comment.text,
                roomCode: currentRoom.roomCode,
                createdAt: Date.now(),
                urgent: true,
              },
            }, ws);
          }
          return;
        }

        if (msgType === 'comment:resolve') {
          const id = String(msg.id || '');
          const target = currentRoom.comments.find((c) => c.id === id);
          if (target) {
            target.resolved = Boolean(msg.resolved);
            broadcastToRoom(currentRoom, { type: 'comment:resolved', id: target.id, resolved: target.resolved });
          }
          return;
        }

        if (msgType === 'notification:broadcast') {
          broadcastToRoom(currentRoom, {
            type: 'notification:urgent',
            notification: {
              id: `notif_${Date.now()}`,
              title: String(msg.title || `Pembaruan Proyek oleh ${currentPeer.name}`).slice(0, 120),
              body: String(msg.body || '').slice(0, 400),
              roomCode: currentRoom.roomCode,
              createdAt: Date.now(),
              urgent: true,
            },
          });
        }
      } catch {
        // Ignore malformed payloads
      }
    });

    ws.on('close', () => {
      if (currentRoom) {
        currentRoom.peers.delete(ws);
        if (currentRoom.peers.size === 0) {
          rooms.delete(currentRoom.roomCode);
        } else {
          broadcastPresence(currentRoom);
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ChromaStudio Pro server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
