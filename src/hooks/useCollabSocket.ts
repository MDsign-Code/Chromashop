import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollabComment, CollabPeer, PushNotificationItem } from '../types/studio';

interface RemoteCanvasOp {
  opId: string;
  senderId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface UseCollabSocketOptions {
  roomCode: string;
  userName: string;
  enabled: boolean;
  onRemoteOp?: (op: RemoteCanvasOp) => void;
  onUrgentNotification?: (notif: PushNotificationItem) => void;
}

const PEER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];

export function useCollabSocket({
  roomCode,
  userName,
  enabled,
  onRemoteOp,
  onUrgentNotification,
}: UseCollabSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [comments, setComments] = useState<CollabComment[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastCursorSentRef = useRef<number>(0);
  const clientIdRef = useRef<string>(`peer_${Math.random().toString(36).slice(2, 10)}`);
  const colorRef = useRef<string>(PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]);
  const onRemoteOpRef = useRef(onRemoteOp);
  const onUrgentNotifRef = useRef(onUrgentNotification);

  onRemoteOpRef.current = onRemoteOp;
  onUrgentNotifRef.current = onUrgentNotification;

  const connect = useCallback(() => {
    if (!enabled || !roomCode) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/collab`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomCode,
            clientId: clientIdRef.current,
            name: userName || 'Desainer',
            color: colorRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'room:init') {
            setPeers(Array.isArray(data.peers) ? data.peers : []);
            setComments(Array.isArray(data.comments) ? data.comments : []);
          } else if (data.type === 'presence:update') {
            setPeers(Array.isArray(data.peers) ? data.peers : []);
          } else if (data.type === 'cursor:moved' && data.peer) {
            setPeers((prev) => {
              const exists = prev.some((p) => p.clientId === data.peer.clientId);
              if (!exists) return [...prev, data.peer];
              return prev.map((p) => (p.clientId === data.peer.clientId ? data.peer : p));
            });
          } else if (data.type === 'canvas:op' && data.op) {
            onRemoteOpRef.current?.(data.op as RemoteCanvasOp);
          } else if (data.type === 'comment:added' && data.comment) {
            setComments((prev) => {
              if (prev.some((c) => c.id === data.comment.id)) return prev;
              return [...prev, data.comment];
            });
          } else if (data.type === 'comment:resolved') {
            setComments((prev) =>
              prev.map((c) => (c.id === data.id ? { ...c, resolved: Boolean(data.resolved) } : c))
            );
          } else if (data.type === 'notification:urgent' && data.notification) {
            const item: PushNotificationItem = {
              id: data.notification.id || `notif_${Date.now()}`,
              title: data.notification.title || 'Pembaruan Proyek Mendesak',
              body: data.notification.body || '',
              roomCode: data.notification.roomCode,
              createdAt: data.notification.createdAt || Date.now(),
              urgent: true,
              read: false,
            };
            onUrgentNotifRef.current?.(item);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (enabled) {
          reconnectTimerRef.current = window.setTimeout(connect, 3500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
    }
  }, [enabled, roomCode, userName]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendCursor = useCallback((x: number, y: number, pressure: number, tool: string) => {
    const now = performance.now();
    if (now - lastCursorSentRef.current < 45) return;
    lastCursorSentRef.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor:move', x, y, pressure, tool }));
    }
  }, []);

  const sendCanvasOp = useCallback((opType: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'canvas:op',
          opId: `${clientIdRef.current}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          opType,
          payload,
        })
      );
    }
  }, []);

  const addComment = useCallback((text: string, x: number, y: number, urgent: boolean) => {
    const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const localComment: CollabComment = {
      id,
      authorName: userName || 'Desainer',
      authorColor: colorRef.current,
      text,
      x,
      y,
      urgent,
      resolved: false,
      createdAt: Date.now(),
    };
    setComments((prev) => [...prev, localComment]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'comment:add', id, text, x, y, urgent }));
    }
  }, [userName]);

  const toggleResolveComment = useCallback((id: string, resolved: boolean) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved } : c)));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'comment:resolve', id, resolved }));
    }
  }, []);

  const broadcastUrgentAlert = useCallback((title: string, body: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'notification:broadcast', title, body }));
    }
  }, []);

  return {
    connected,
    clientId: clientIdRef.current,
    myColor: colorRef.current,
    peers: peers.filter((p) => p.clientId !== clientIdRef.current),
    allPeersCount: Math.max(1, peers.length),
    comments,
    sendCursor,
    sendCanvasOp,
    addComment,
    toggleResolveComment,
    broadcastUrgentAlert,
  };
}
