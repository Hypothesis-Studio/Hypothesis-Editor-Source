/**
 * ChatService - Realtime Chat Collaboration via WebSocket.
 *
 * Supports two modes:
 *   - Local:  ws://localhost:<port>  (LAN / same machine)
 *   - Public: wss://<tunnel-url>     (via existing localtunnel public URL)
 *
 * Architecture:
 *   Host  → creates a ws.Server on a free local port.
 *   Guest → connects to a ws:// or wss:// URL.
 *   Both sides get the same ChatRoom state mirrored to the renderer.
 */
import { BrowserWindow, clipboard } from 'electron';
import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from '../../utils/nanoid';
import { CHAT_IPC } from '../../../shared/types/chat';
import type {
  ChatRoom,
  ChatUser,
  ChatMessage,
  ChatCreateOptions,
  ChatJoinOptions,
  ChatRoomStatus,
  WsEnvelope,
} from '../../../shared/types/chat';
import * as net from 'net';

// ─────────────────────────────────────────────────────────────────────────────
// Internal record types
// ─────────────────────────────────────────────────────────────────────────────

interface HostRecord {
  kind: 'host';
  room: ChatRoom;
  wss: WebSocketServer;
  /** socket → user id */
  socketMap: Map<WebSocket, string>;
}

interface GuestRecord {
  kind: 'guest';
  room: ChatRoom;
  ws: WebSocket;
  /** our own user entry */
  selfUser: ChatUser;
}

type RoomRecord = HostRecord | GuestRecord;

const USER_COLORS = [
  '#4fc1ff', '#f48771', '#89d185', '#d7ba7d',
  '#c586c0', '#9cdcfe', '#ce9178', '#6a9955',
];

const MAX_MESSAGES = 200;

// ─────────────────────────────────────────────────────────────────────────────

export class ChatService {
  private readonly records = new Map<string, RoomRecord>();
  private colorIdx = 0;

  // ── Public API ─────────────────────────────────────────────────────────────

  async create(options: ChatCreateOptions): Promise<ChatRoom> {
    const id = nanoid();
    const port = options.localPort ?? (await this.findFreePort(4900));

    const hostUser: ChatUser = {
      id: nanoid(),
      name: options.userName || 'Host',
      role: 'host',
      color: this.nextColor(),
      joinedAt: new Date().toISOString(),
      isOnline: true,
    };

    const room: ChatRoom = {
      id,
      name: options.name || 'Chat Room',
      status: 'hosting',
      localPort: port,
      publicUrl: null,
      tunnelId: options.tunnelId ?? null,
      host: hostUser,
      participants: [hostUser],
      messages: [],
      createdAt: new Date().toISOString(),
      error: null,
      openJoin: options.openJoin ?? true,
    };

    const wss = new WebSocketServer({ port });
    const record: HostRecord = {
      kind: 'host',
      room,
      wss,
      socketMap: new Map(),
    };
    this.records.set(id, record);

    wss.on('connection', (ws: WebSocket) => this.handleGuestConnection(record, ws));
    wss.on('error', (err: Error) => {
      room.status = 'error';
      room.error = err.message;
      this.broadcastStatus(room);
    });

    // If a tunnelId is supplied, pull the public URL from the tunnel store
    // (renderer side sets it; we just note it in the room when available)
    // The renderer can also call updatePublicUrl() after tunnel connects.

    this.broadcastStatus(room);
    return { ...room };
  }

  async join(options: ChatJoinOptions): Promise<ChatRoom> {
    const id = nanoid();
    const selfUser: ChatUser = {
      id: nanoid(),
      name: options.userName || 'Guest',
      role: 'guest',
      color: this.nextColor(),
      joinedAt: new Date().toISOString(),
      isOnline: true,
    };

    const room: ChatRoom = {
      id,
      name: 'Connecting…',
      status: 'connecting',
      localPort: 0,
      publicUrl: options.url,
      tunnelId: null,
      host: selfUser, // placeholder until room-info arrives
      participants: [selfUser],
      messages: [],
      createdAt: new Date().toISOString(),
      error: null,
      openJoin: true,
    };

    const ws = new WebSocket(options.url);
    const record: GuestRecord = { kind: 'guest', room, ws, selfUser };
    this.records.set(id, record);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Connection timed out'));
      }, 15_000);

      ws.once('open', () => {
        clearTimeout(timeout);
        // announce ourselves
        this.wsSend(ws, { type: 'user-joined', payload: selfUser });
        resolve();
      });
      ws.once('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    }).catch((err) => {
      room.status = 'error';
      room.error = err.message;
      this.broadcastStatus(room);
      this.records.delete(id);
      throw err;
    });

    room.status = 'connected';
    this.broadcastStatus(room);

    ws.on('message', (raw: Buffer | string) => this.handleGuestMessage(record, raw.toString()));
    ws.on('close', () => {
      room.status = 'closed';
      this.broadcastStatus(room);
      this.broadcast(CHAT_IPC.EVT_ROOM_CLOSED, { roomId: id, reason: 'Connection closed' });
      this.records.delete(id);
    });
    ws.on('error', (err: Error) => {
      room.status = 'error';
      room.error = err.message;
      this.broadcastStatus(room);
    });

    return { ...room };
  }

  async leave(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.kind === 'guest') {
      const { room, ws, selfUser } = record;
      this.wsSend(ws, { type: 'user-left', payload: { userId: selfUser.id, userName: selfUser.name } });
      ws.close();
      room.status = 'closed';
      this.broadcastStatus(room);
    }
    this.records.delete(id);
  }

  async close(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.kind === 'host') {
      const { room, wss, socketMap } = record;
      // notify all guests
      const goodbye: WsEnvelope = {
        type: 'system',
        payload: { content: 'Host closed the room.' },
      };
      socketMap.forEach((_uid, ws) => {
        this.wsSend(ws, goodbye);
        ws.close();
      });
      wss.close();
      room.status = 'closed';
      this.broadcastStatus(room);
      this.broadcast(CHAT_IPC.EVT_ROOM_CLOSED, { roomId: id, reason: 'Host closed the room' });
    } else {
      await this.leave(id);
    }
    this.records.delete(id);
  }

  list(): ChatRoom[] {
    return [...this.records.values()].map((r) => ({ ...r.room }));
  }

  get(id: string): ChatRoom | null {
    const r = this.records.get(id);
    return r ? { ...r.room } : null;
  }

  sendMessage(roomId: string, content: string): ChatMessage | null {
    const record = this.records.get(roomId);
    if (!record) return null;

    let sender: ChatUser;
    if (record.kind === 'host') {
      sender = record.room.host;
    } else {
      sender = record.selfUser;
    }

    const msg: ChatMessage = {
      id: nanoid(),
      roomId,
      senderId: sender.id,
      senderName: sender.name,
      senderColor: sender.color,
      type: 'text',
      content,
      timestamp: new Date().toISOString(),
    };

    this.appendMessage(record.room, msg);

    const envelope: WsEnvelope = { type: 'chat', payload: msg };

    if (record.kind === 'host') {
      // broadcast to all connected guests
      record.socketMap.forEach((_uid, ws) => this.wsSend(ws, envelope));
    } else {
      // send to host
      this.wsSend(record.ws, envelope);
    }

    // emit to our own renderer
    this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: msg });
    return { ...msg };
  }

  /** Kick a guest (host only) */
  kick(roomId: string, userId: string): boolean {
    const r = this.records.get(roomId);
    if (!r || r.kind !== 'host') return false;
    const { room, socketMap } = r;
    // find the socket for this user
    let targetWs: WebSocket | undefined;
    socketMap.forEach((uid, ws) => { if (uid === userId) targetWs = ws; });
    if (!targetWs) return false;
    // send kick notice to the guest
    this.wsSend(targetWs, { type: 'system', payload: { content: 'You have been kicked from the room.' } });
    targetWs.close();
    // remove from participants
    const user = room.participants.find((u) => u.id === userId);
    room.participants = room.participants.filter((u) => u.id !== userId);
    socketMap.delete(targetWs);
    if (user) {
      const sysMsg = this.systemMessage(room.id, `${user.name} was kicked from the room.`);
      this.appendMessage(room, sysMsg);
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: sysMsg });
      this.broadcast(CHAT_IPC.EVT_USER_LEFT, { roomId: room.id, userId, userName: user.name });
      this.broadcastStatus(room);
      // notify remaining guests
      socketMap.forEach((_uid, s) =>
        this.wsSend(s, { type: 'user-left', payload: { userId, userName: user.name } }),
      );
    }
    return true;
  }

  updateName(id: string, name: string): ChatRoom | null {
    const r = this.records.get(id);
    if (!r) return null;
    r.room.name = name.trim() || r.room.name;
    this.broadcastStatus(r.room);
    return { ...r.room };
  }

  /** Called by tunnel store / IPC when the tunnel URL is known */
  setPublicUrl(roomId: string, publicUrl: string, tunnelId: string): void {
    const r = this.records.get(roomId);
    if (!r) return;
    r.room.publicUrl = publicUrl.replace(/^http/, 'ws');
    r.room.tunnelId = tunnelId;
    this.broadcastStatus(r.room);
  }

  copyUrl(roomId: string): boolean {
    const r = this.records.get(roomId);
    if (!r) return false;
    const url = r.room.publicUrl ?? `ws://localhost:${r.room.localPort}`;
    clipboard.writeText(url);
    return true;
  }

  async findFreePort(preferred = 4900): Promise<number> {
    for (let port = preferred; port < preferred + 100; port++) {
      if (await this.isPortFree(port)) return port;
    }
    throw new Error('No free port found in range');
  }

  dispose(): void {
    const ids = [...this.records.keys()];
    ids.forEach((id) => this.close(id));
  }

  // ── Host: handle incoming guest connection ─────────────────────────────────

  private handleGuestConnection(record: HostRecord, ws: WebSocket): void {
    const tmpId = nanoid();
    record.socketMap.set(ws, tmpId);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const env: WsEnvelope = JSON.parse(raw.toString());
        this.handleHostIncoming(record, ws, env);
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      const userId = record.socketMap.get(ws);
      record.socketMap.delete(ws);
      if (userId) {
        const user = record.room.participants.find((u) => u.id === userId);
        record.room.participants = record.room.participants.filter((u) => u.id !== userId);
        if (user) {
          const sysMsg = this.systemMessage(record.room.id, `${user.name} left the room.`);
          this.appendMessage(record.room, sysMsg);
          this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: record.room.id, message: sysMsg });
          this.broadcast(CHAT_IPC.EVT_USER_LEFT, { roomId: record.room.id, userId, userName: user.name });
          this.broadcastStatus(record.room);
          // notify remaining guests
          record.socketMap.forEach((_uid, s) =>
            this.wsSend(s, { type: 'user-left', payload: { userId, userName: user.name } }),
          );
        }
      }
    });

    // send room-info to the new guest
    this.wsSend(ws, { type: 'room-info', payload: { ...record.room } });
  }

  private handleHostIncoming(record: HostRecord, ws: WebSocket, env: WsEnvelope): void {
    const { room, socketMap } = record;

    if (env.type === 'user-joined') {
      const incoming = env.payload as ChatUser;
      const user: ChatUser = {
        ...incoming,
        id: incoming.id || nanoid(),
        role: 'guest',
        color: incoming.color || this.nextColor(),
        joinedAt: new Date().toISOString(),
        isOnline: true,
      };
      socketMap.set(ws, user.id);
      room.participants.push(user);

      const sysMsg = this.systemMessage(room.id, `${user.name} joined the room.`);
      this.appendMessage(room, sysMsg);

      // notify renderer
      this.broadcast(CHAT_IPC.EVT_USER_JOINED, { roomId: room.id, user });
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: sysMsg });
      this.broadcastStatus(room);

      // notify other guests
      socketMap.forEach((_uid, s) => {
        if (s !== ws) this.wsSend(s, { type: 'user-joined', payload: user });
        // also relay the system message
        if (s !== ws) this.wsSend(s, { type: 'chat', payload: sysMsg });
      });
      return;
    }

    if (env.type === 'chat') {
      const msg = env.payload as ChatMessage;
      msg.roomId = room.id; // ensure correct roomId
      this.appendMessage(room, msg);
      // relay to all other guests
      socketMap.forEach((_uid, s) => {
        if (s !== ws) this.wsSend(s, { type: 'chat', payload: msg });
      });
      // emit to our renderer
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: msg });
      return;
    }

    if (env.type === 'ping') {
      this.wsSend(ws, { type: 'pong', payload: {} });
    }
  }

  // ── Guest: handle incoming from host ──────────────────────────────────────

  private handleGuestMessage(record: GuestRecord, raw: string): void {
    try {
      const env: WsEnvelope = JSON.parse(raw);
      const { room } = record;

      if (env.type === 'room-info') {
        const info = env.payload as ChatRoom;
        room.name = info.name;
        room.host = info.host;
        room.participants = info.participants;
        room.messages = info.messages ?? [];
        room.openJoin = info.openJoin;
        this.broadcastStatus(room);
        // replay history to renderer
        room.messages.forEach((m) =>
          this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: m }),
        );
        return;
      }

      if (env.type === 'chat') {
        const msg = env.payload as ChatMessage;
        this.appendMessage(room, msg);
        this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: msg });
        return;
      }

      if (env.type === 'user-joined') {
        const user = env.payload as ChatUser;
        if (!room.participants.find((u) => u.id === user.id)) {
          room.participants.push(user);
        }
        this.broadcast(CHAT_IPC.EVT_USER_JOINED, { roomId: room.id, user });
        this.broadcastStatus(room);
        return;
      }

      if (env.type === 'user-left') {
        const { userId, userName } = env.payload as { userId: string; userName: string };
        room.participants = room.participants.filter((u) => u.id !== userId);
        this.broadcast(CHAT_IPC.EVT_USER_LEFT, { roomId: room.id, userId, userName });
        this.broadcastStatus(room);
        return;
      }

      if (env.type === 'system') {
        const { content } = env.payload as { content: string };
        const sysMsg = this.systemMessage(room.id, content);
        this.appendMessage(room, sysMsg);
        this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: sysMsg });
        return;
      }

      if (env.type === 'pong') return;
    } catch { /* ignore */ }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private appendMessage(room: ChatRoom, msg: ChatMessage): void {
    room.messages.push(msg);
    if (room.messages.length > MAX_MESSAGES) {
      room.messages = room.messages.slice(-MAX_MESSAGES);
    }
  }

  private systemMessage(roomId: string, content: string): ChatMessage {
    return {
      id: nanoid(),
      roomId,
      senderId: 'system',
      senderName: 'System',
      senderColor: '#888',
      type: 'system',
      content,
      timestamp: new Date().toISOString(),
    };
  }

  private broadcastStatus(room: ChatRoom): void {
    this.broadcast(CHAT_IPC.EVT_STATUS, {
      roomId: room.id,
      status: room.status,
      publicUrl: room.publicUrl,
      error: room.error,
      participants: room.participants,
      name: room.name,
    });
  }

  private broadcast(channel: string, payload: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    });
  }

  private wsSend(ws: WebSocket, envelope: WsEnvelope): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }

  private nextColor(): string {
    const c = USER_COLORS[this.colorIdx % USER_COLORS.length];
    this.colorIdx++;
    return c;
  }

  private isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(port, '127.0.0.1');
    });
  }
}
