/**
 * ChatService - Realtime Chat Collaboration via WebSocket.
 * Features: typing indicators, code snippets, file transfer, reactions,
 * thread/reply, join approval, presence/cursor sharing, AI agent, persistence.
 */
import { BrowserWindow, clipboard, app } from 'electron';
import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from '../../utils/nanoid';
import { CHAT_IPC, MAX_FILE_SIZE_BYTES } from '../../../shared/types/chat';
import type {
  ChatRoom, ChatUser, ChatMessage, ChatCreateOptions, ChatJoinOptions,
  WsEnvelope, JoinRequest,
} from '../../../shared/types/chat';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Internal record types
// ─────────────────────────────────────────────────────────────────────────────

interface HostRecord {
  kind: 'host';
  room: ChatRoom;
  wss: WebSocketServer;
  socketMap: Map<WebSocket, string>;
  pingInterval: NodeJS.Timeout;
  httpServer: http.Server;
  filePort: number;
}

interface GuestRecord {
  kind: 'guest';
  room: ChatRoom;
  ws: WebSocket;
  selfUser: ChatUser;
  pingInterval: NodeJS.Timeout;
  hostFileBase: string; // e.g. http://192.168.1.x:filePort
}

type RoomRecord = HostRecord | GuestRecord;

const USER_COLORS = [
  '#4fc1ff', '#f48771', '#89d185', '#d7ba7d',
  '#c586c0', '#9cdcfe', '#ce9178', '#6a9955',
];

const MAX_MESSAGES = 500;
const PING_INTERVAL_MS = 25_000;
const TYPING_DEBOUNCE_MS = 3_000;
const HISTORY_DIR = () => path.join(app.getPath('userData'), 'chat-history');
const FILES_DIR = (roomId: string) => path.join(app.getPath('userData'), 'chat-history', 'files', roomId);

// ─────────────────────────────────────────────────────────────────────────────

export class ChatService {
  private readonly records = new Map<string, RoomRecord>();
  private colorIdx = 0;
  /** typingTimers: roomId:userId -> clearTimeout handle */
  private typingTimers = new Map<string, NodeJS.Timeout>();
  /** agentService reference — injected after construction to avoid circular deps */
  private agentService: any = null;
  private appStore: any = null;

  setAgentService(svc: any): void { this.agentService = svc; }
  setAppStore(store: any): void { this.appStore = store; }

  // ── Persistence ────────────────────────────────────────────────────────────

  private historyFile(roomId: string): string {
    const dir = HISTORY_DIR();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${roomId}.json`);
  }

  private loadHistory(roomId: string): ChatMessage[] {
    try {
      const file = this.historyFile(roomId);
      if (!fs.existsSync(file)) return [];
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as ChatMessage[];
    } catch { return []; }
  }

  private saveHistory(room: ChatRoom): void {
    try {
      fs.writeFileSync(
        this.historyFile(room.id),
        JSON.stringify(room.messages.slice(-MAX_MESSAGES)),
        'utf-8',
      );
    } catch { /* non-critical */ }
  }

  private rewriteFileUrl(fileUrl: string, hostFileBase: string): string {
    try {
      // Replace 127.0.0.1 with actual host IP/port from hostFileBase
      const orig = new URL(fileUrl);
      const base = new URL(hostFileBase);
      orig.hostname = base.hostname;
      orig.port = base.port;
      return orig.toString();
    } catch { return fileUrl; }
  }

  private deleteHistory(roomId: string): void {
    try {
      const file = this.historyFile(roomId);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch { /* ignore */ }
  }

  private deleteFiles(roomId: string): void {
    try {
      const dir = FILES_DIR(roomId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }

  private createFileServer(roomId: string, filePort: number): http.Server {
    const filesDir = FILES_DIR(roomId);
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

    const MIME_MAP: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
      '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
      '.aac': 'audio/aac', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    };

    const server = http.createServer((req, res) => {
      try {
        const parsed = url.parse(req.url ?? '/');
        const filePath = path.join(filesDir, path.basename(parsed.pathname ?? ''));
        if (!filePath.startsWith(filesDir) || !fs.existsSync(filePath)) {
          res.writeHead(404); res.end('Not found'); return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_MAP[ext] ?? 'application/octet-stream';
        const stat = fs.statSync(filePath);
        // Range request support for video/audio streaming
        const range = req.headers.range;
        if (range) {
          const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
          const start = parseInt(startStr, 10);
          const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
          const chunkSize = end - start + 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mime,
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(filePath).pipe(res);
        }
      } catch { res.writeHead(500); res.end(); }
    });

    server.listen(filePort);
    return server;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async create(options: ChatCreateOptions): Promise<ChatRoom> {
    const id = nanoid();
    const port = options.localPort ?? (await this.findFreePort(4900));
    const filePort = await this.findFreePort(port + 1);

    const hostUser: ChatUser = {
      id: nanoid(), name: options.userName || 'Host',
      role: 'host', color: this.nextColor(),
      joinedAt: new Date().toISOString(), isOnline: true,
    };

    const history = this.loadHistory(id);

    const room: ChatRoom = {
      id, name: options.name || 'Chat Room',
      status: 'hosting', localPort: port,
      publicUrl: null, tunnelId: options.tunnelId ?? null,
      host: hostUser, participants: [hostUser],
      messages: history, createdAt: new Date().toISOString(),
      error: null, openJoin: options.openJoin ?? true,
      pendingJoins: [],
      aiEnabled: options.aiEnabled ?? false,
      aiAgentId: options.aiAgentId,
    };

    if (options.aiEnabled) {
      const aiUser: ChatUser = {
        id: 'ai', name: 'AI Assistant', role: 'ai',
        color: '#c586c0', joinedAt: new Date().toISOString(), isOnline: true,
      };
      room.participants.push(aiUser);
    }

    const wss = new WebSocketServer({ port });
    const httpServer = this.createFileServer(id, filePort);
    const pingInterval = setInterval(() => this.pingAll(record), PING_INTERVAL_MS);
    const record: HostRecord = {
      kind: 'host', room, wss,
      socketMap: new Map(), pingInterval,
      httpServer, filePort,
    };
    this.records.set(id, record);

    wss.on('connection', (ws: WebSocket) => this.handleGuestConnection(record, ws));
    wss.on('error', (err: Error) => {
      room.status = 'error'; room.error = err.message;
      this.broadcastStatus(room);
    });

    this.broadcastStatus(room);
    return { ...room };
  }

  async join(options: ChatJoinOptions): Promise<ChatRoom> {
    const id = nanoid();
    const selfUser: ChatUser = {
      id: nanoid(), name: options.userName || 'Guest',
      role: 'guest', color: this.nextColor(),
      joinedAt: new Date().toISOString(), isOnline: true,
    };

    const room: ChatRoom = {
      id, name: 'Connecting…', status: 'connecting',
      localPort: 0, publicUrl: options.url, tunnelId: null,
      host: selfUser, participants: [selfUser],
      messages: [], createdAt: new Date().toISOString(),
      error: null, openJoin: true, pendingJoins: [],
    };

    const ws = new WebSocket(options.url);
    // Extract host base URL for file serving (ws://host:port → http://host:filePort)
    const wsUrl = new URL(options.url.replace(/^ws/, 'http'));
    const hostFileBase = `http://${wsUrl.hostname}`; // filePort filled in from room-info/join-response
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN)
        this.wsSend(ws, { type: 'ping', payload: {} });
    }, PING_INTERVAL_MS);

    const record: GuestRecord = { kind: 'guest', room, ws, selfUser, pingInterval, hostFileBase };
    this.records.set(id, record);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { ws.terminate(); reject(new Error('Connection timed out')); }, 15_000);
      ws.once('open', () => {
        clearTimeout(timeout);
        this.wsSend(ws, { type: 'user-joined', payload: selfUser });
        resolve();
      });
      ws.once('error', (err: Error) => { clearTimeout(timeout); reject(err); });
    }).catch((err) => {
      clearInterval(pingInterval);
      room.status = 'error'; room.error = err.message;
      this.broadcastStatus(room);
      this.records.delete(id);
      throw err;
    });

    room.status = 'connected';
    this.broadcastStatus(room);

    ws.on('message', (raw: Buffer | string) => this.handleGuestMessage(record, raw.toString()));
    ws.on('close', () => {
      clearInterval(pingInterval);
      room.status = 'closed';
      this.broadcastStatus(room);
      this.broadcast(CHAT_IPC.EVT_ROOM_CLOSED, { roomId: id, reason: 'Connection closed' });
      this.records.delete(id);
    });
    ws.on('error', (err: Error) => { room.status = 'error'; room.error = err.message; this.broadcastStatus(room); });

    return { ...room };
  }

  async leave(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.kind === 'guest') {
      const { room, ws, selfUser, pingInterval } = record;
      clearInterval(pingInterval);
      this.wsSend(ws, { type: 'user-left', payload: { userId: selfUser.id, userName: selfUser.name } });
      ws.close();
      room.status = 'closed';
      this.broadcastStatus(room);
    }
    // Clear AI session for this room
    if (this.agentService) {
      this.agentService.deleteChatSession(`chat-room-${id}`);
    }
    this.records.delete(id);
  }

  async close(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.kind === 'host') {
      const { room, wss, socketMap, pingInterval, httpServer } = record;
      clearInterval(pingInterval);
      const goodbye: WsEnvelope = { type: 'system', payload: { content: 'Host closed the room.' } };
      socketMap.forEach((_uid, ws) => { this.wsSend(ws, goodbye); ws.close(); });
      wss.close();
      httpServer.close();
      this.deleteFiles(id);
      this.deleteHistory(id);
      room.status = 'closed';
      this.broadcastStatus(room);
      this.broadcast(CHAT_IPC.EVT_ROOM_CLOSED, { roomId: id, reason: 'Host closed the room' });
      // No saveHistory — room is deleted
    } else {
      await this.leave(id);
    }
    // Clear AI session for this room so next session starts fresh
    if (this.agentService) {
      this.agentService.deleteChatSession(`chat-room-${id}`);
    }
    this.records.delete(id);
  }

  list(): ChatRoom[] { return [...this.records.values()].map((r) => ({ ...r.room })); }
  get(id: string): ChatRoom | null { const r = this.records.get(id); return r ? { ...r.room } : null; }

  sendMessage(roomId: string, content: string, replyToId?: string): ChatMessage | null {
    const record = this.records.get(roomId);
    if (!record) return null;
    const sender = record.kind === 'host' ? record.room.host : record.selfUser;

    let replyToContent: string | undefined;
    let replyToSenderName: string | undefined;
    if (replyToId) {
      const orig = record.room.messages.find((m) => m.id === replyToId);
      if (orig) { replyToContent = orig.content.substring(0, 120); replyToSenderName = orig.senderName; }
    }

    const msg: ChatMessage = {
      id: nanoid(), roomId, senderId: sender.id, senderName: sender.name,
      senderColor: sender.color, type: 'text', content,
      timestamp: new Date().toISOString(),
      ...(replyToId ? { replyToId, replyToContent, replyToSenderName } : {}),
      reactions: {}, readBy: [sender.id],
    };

    this.appendMessage(record.room, msg);
    const envelope: WsEnvelope = { type: 'chat', payload: msg };
    this.relayToOthers(record, null, envelope);
    this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: msg });
    this.saveHistory(record.room);

    // AI mention detection
    const hasAiMention = /@ai\b/i.test(content);
    if (hasAiMention) {
      if (record.room.aiEnabled) {
        const prompt = content.replace(/@ai\s*/gi, '').trim();
        setImmediate(() => this.handleAiMention(record.room, prompt, replyToContent, replyToSenderName));
      } else {
        // AI is disabled — send a small note back only to the renderer (host sees it too)
        const noteMsg = this.systemMessage(roomId, '\u26a0\ufe0f AI assistant is currently disabled. The host can enable it via the robot icon in the header.');
        this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: noteMsg });
      }
    }

    return { ...msg };
  }

  sendCode(roomId: string, code: string, language: string, replyToId?: string): ChatMessage | null {
    const record = this.records.get(roomId);
    if (!record) return null;
    const sender = record.kind === 'host' ? record.room.host : record.selfUser;

    let replyToContent: string | undefined;
    let replyToSenderName: string | undefined;
    if (replyToId) {
      const orig = record.room.messages.find((m) => m.id === replyToId);
      if (orig) { replyToContent = orig.content.substring(0, 120); replyToSenderName = orig.senderName; }
    }

    const msg: ChatMessage = {
      id: nanoid(), roomId, senderId: sender.id, senderName: sender.name,
      senderColor: sender.color, type: 'code', content: code,
      timestamp: new Date().toISOString(), language,
      ...(replyToId ? { replyToId, replyToContent, replyToSenderName } : {}),
      reactions: {}, readBy: [sender.id],
    };

    this.appendMessage(record.room, msg);
    this.relayToOthers(record, null, { type: 'chat', payload: msg });
    this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: msg });
    this.saveHistory(record.room);
    return { ...msg };
  }

  sendFile(roomId: string, fileName: string, fileData: string, fileMimeType: string): ChatMessage | null {
    const record = this.records.get(roomId);
    if (!record) return null;
    const sender = record.kind === 'host' ? record.room.host : record.selfUser;

    const byteLen = Buffer.byteLength(fileData, 'base64');
    if (byteLen > MAX_FILE_SIZE_BYTES) return null;

    const msgId = nanoid();
    let fileUrl: string | undefined;
    let fileStoredPath: string | undefined;

    // Host stores file to disk and serves via HTTP
    if (record.kind === 'host') {
      const filesDir = FILES_DIR(roomId);
      if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
      // Sanitize filename to avoid path traversal
      const safeExt = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, '') || '';
      const safeName = `${msgId}${safeExt}`;
      fileStoredPath = path.join(filesDir, safeName);
      fs.writeFileSync(fileStoredPath, Buffer.from(fileData, 'base64'));
      fileUrl = `http://127.0.0.1:${record.filePort}/${safeName}`;
    }

    const msg: ChatMessage = {
      id: msgId, roomId, senderId: sender.id, senderName: sender.name,
      senderColor: sender.color, type: 'file',
      content: `Shared file: ${fileName}`,
      timestamp: new Date().toISOString(),
      fileName, fileSize: byteLen, fileMimeType,
      // Only send fileData to guests if no fileUrl (guest-to-guest fallback)
      fileData: record.kind === 'host' ? undefined : fileData,
      fileUrl,
      fileStoredPath,
      reactions: {}, readBy: [sender.id],
    };

    this.appendMessage(record.room, msg);
    // Relay to guests without fileStoredPath; guests get fileUrl
    const msgForRelay: ChatMessage = { ...msg, fileStoredPath: undefined, fileData: undefined };
    this.relayToOthers(record, null, { type: 'chat', payload: msgForRelay });
    this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: msg });
    // Save history without fileData/fileStoredPath
    const msgForDisk = { ...msg, fileData: undefined, fileStoredPath: undefined };
    const roomForDisk = { ...record.room, messages: record.room.messages.map((m) => m.id === msg.id ? msgForDisk : m) };
    this.saveHistory(roomForDisk as any);
    return { ...msg };
  }

  editMessage(roomId: string, messageId: string, newContent: string, senderId: string): boolean {
    const record = this.records.get(roomId);
    if (!record) return false;
    const msg = record.room.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== senderId) return false;
    msg.content = newContent;
    msg.edited = true;
    this.relayToOthers(record, null, { type: 'message-edited', payload: { messageId, newContent } });
    this.broadcast(CHAT_IPC.EVT_MESSAGE_EDITED, { roomId, messageId, newContent });
    this.saveHistory(record.room);
    return true;
  }

  deleteMessage(roomId: string, messageId: string, senderId: string): boolean {
    const record = this.records.get(roomId);
    if (!record) return false;
    const msg = record.room.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== senderId) return false;
    record.room.messages = record.room.messages.filter((m) => m.id !== messageId);
    this.relayToOthers(record, null, { type: 'message-deleted', payload: { messageId } });
    this.broadcast(CHAT_IPC.EVT_MESSAGE_DELETED, { roomId, messageId });
    this.saveHistory(record.room);
    return true;
  }

  sendTyping(roomId: string, userId: string, userName: string, isTyping: boolean): void {
    const record = this.records.get(roomId);
    if (!record) return;
    const key = `${roomId}:${userId}`;
    if (isTyping) {
      const existing = this.typingTimers.get(key);
      if (existing) clearTimeout(existing);
      this.typingTimers.set(key, setTimeout(() => {
        this.typingTimers.delete(key);
        this.broadcast(CHAT_IPC.EVT_TYPING, { roomId, userId, userName, isTyping: false });
      }, TYPING_DEBOUNCE_MS));
    } else {
      const existing = this.typingTimers.get(key);
      if (existing) { clearTimeout(existing); this.typingTimers.delete(key); }
    }
    this.relayToOthers(record, null, { type: 'typing', payload: { userId, userName, isTyping } });
    this.broadcast(CHAT_IPC.EVT_TYPING, { roomId, userId, userName, isTyping });
  }

  addReaction(roomId: string, messageId: string, emoji: string, userId: string, userName: string): boolean {
    const record = this.records.get(roomId);
    if (!record) return false;
    const msg = record.room.messages.find((m) => m.id === messageId);
    if (!msg) return false;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const arr = msg.reactions[emoji];
    const idx = arr.indexOf(userId);
    const added = idx === -1;
    if (added) arr.push(userId);
    else arr.splice(idx, 1);
    if (arr.length === 0) delete msg.reactions[emoji];
    this.relayToOthers(record, null, { type: 'reaction', payload: { messageId, emoji, userId, userName, added } });
    this.broadcast(CHAT_IPC.EVT_REACTION, { roomId, messageId, emoji, userId, userName, added });
    return true;
  }

  markRead(roomId: string, messageId: string, userId: string): void {
    const record = this.records.get(roomId);
    if (!record) return;
    const msg = record.room.messages.find((m) => m.id === messageId);
    if (!msg) return;
    if (!msg.readBy) msg.readBy = [];
    if (!msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
      this.relayToOthers(record, null, { type: 'read-ack', payload: { messageId, userId } });
      this.broadcast(CHAT_IPC.EVT_READ, { roomId, messageId, userId });
    }
  }

  sendPresence(roomId: string, userId: string, activeFile?: string, activeLine?: number): void {
    const record = this.records.get(roomId);
    if (!record) return;
    const user = record.room.participants.find((u) => u.id === userId);
    if (user) { user.activeFile = activeFile; user.activeLine = activeLine; }
    this.relayToOthers(record, null, { type: 'presence', payload: { userId, activeFile, activeLine } });
    this.broadcast(CHAT_IPC.EVT_PRESENCE, { roomId, userId, activeFile, activeLine });
  }

  approveJoin(roomId: string, requestId: string): void {
    const record = this.records.get(roomId);
    if (!record || record.kind !== 'host') return;
    const req = record.room.pendingJoins?.find((j) => j.id === requestId);
    if (!req) return;
    record.room.pendingJoins = record.room.pendingJoins?.filter((j) => j.id !== requestId) ?? [];
    // Find the socket
    let targetWs: WebSocket | undefined;
    record.socketMap.forEach((uid, ws) => { if (uid === `pending:${requestId}`) targetWs = ws; });
    if (!targetWs) return;
    const user = req.user;
    user.isOnline = true;
    record.socketMap.set(targetWs, user.id);
    record.room.participants.push(user);
    this.wsSend(targetWs, { type: 'join-response', payload: { approved: true, room: { ...record.room }, filePort: record.filePort } });
    const sysMsg = this.systemMessage(roomId, `${user.name} joined the room.`);
    this.appendMessage(record.room, sysMsg);
    this.broadcast(CHAT_IPC.EVT_USER_JOINED, { roomId, user });
    this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: sysMsg });
    this.broadcastStatus(record.room);
    record.socketMap.forEach((_uid, ws) => {
      if (ws !== targetWs) {
        this.wsSend(ws, { type: 'user-joined', payload: user });
        this.wsSend(ws, { type: 'chat', payload: sysMsg });
      }
    });
  }

  denyJoin(roomId: string, requestId: string): void {
    const record = this.records.get(roomId);
    if (!record || record.kind !== 'host') return;
    const req = record.room.pendingJoins?.find((j) => j.id === requestId);
    if (!req) return;
    record.room.pendingJoins = record.room.pendingJoins?.filter((j) => j.id !== requestId) ?? [];
    let targetWs: WebSocket | undefined;
    record.socketMap.forEach((uid, ws) => { if (uid === `pending:${requestId}`) targetWs = ws; });
    if (targetWs) {
      this.wsSend(targetWs, { type: 'join-rejected', payload: { reason: 'Your join request was denied by the host.' } });
      targetWs.close();
      record.socketMap.delete(targetWs);
    }
    this.broadcast(CHAT_IPC.EVT_JOIN_RESPONSE, { roomId, requestId, approved: false });
  }

  toggleAi(roomId: string, enabled: boolean, agentId?: string): ChatRoom | null {
    const record = this.records.get(roomId);
    if (!record || record.kind !== 'host') return null;
    record.room.aiEnabled = enabled;
    if (agentId) record.room.aiAgentId = agentId;
    const aiUser: ChatUser = { id: 'ai', name: 'AI Assistant', role: 'ai', color: '#c586c0', joinedAt: new Date().toISOString(), isOnline: true };
    if (enabled && !record.room.participants.find((u) => u.id === 'ai')) {
      record.room.participants.push(aiUser);
      const sysMsg = this.systemMessage(roomId, 'AI Assistant joined. Mention @ai to ask questions.');
      this.appendMessage(record.room, sysMsg);
      this.relayToOthers(record, null, { type: 'user-joined', payload: aiUser });
      this.relayToOthers(record, null, { type: 'chat', payload: sysMsg });
      this.broadcast(CHAT_IPC.EVT_USER_JOINED, { roomId, user: aiUser });
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: sysMsg });
    } else if (!enabled) {
      record.room.participants = record.room.participants.filter((u) => u.id !== 'ai');
      const sysMsg = this.systemMessage(roomId, 'AI Assistant left the room.');
      this.appendMessage(record.room, sysMsg);
      this.relayToOthers(record, null, { type: 'user-left', payload: { userId: 'ai', userName: 'AI Assistant' } });
      this.relayToOthers(record, null, { type: 'chat', payload: sysMsg });
      this.broadcast(CHAT_IPC.EVT_USER_LEFT, { roomId, userId: 'ai', userName: 'AI Assistant' });
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId, message: sysMsg });
    }
    this.broadcastStatus(record.room);
    return { ...record.room };
  }

  kick(roomId: string, userId: string): boolean {
    const r = this.records.get(roomId);
    if (!r || r.kind !== 'host') return false;
    const { room, socketMap } = r;
    let targetWs: WebSocket | undefined;
    socketMap.forEach((uid, ws) => { if (uid === userId) targetWs = ws; });
    if (!targetWs) return false;
    this.wsSend(targetWs, { type: 'system', payload: { content: 'You have been kicked from the room.' } });
    targetWs.close();
    const user = room.participants.find((u) => u.id === userId);
    room.participants = room.participants.filter((u) => u.id !== userId);
    socketMap.delete(targetWs);
    if (user) {
      const sysMsg = this.systemMessage(room.id, `${user.name} was kicked from the room.`);
      this.appendMessage(room, sysMsg);
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: sysMsg });
      this.broadcast(CHAT_IPC.EVT_USER_LEFT, { roomId: room.id, userId, userName: user.name });
      this.broadcastStatus(room);
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

  setPublicUrl(roomId: string, publicUrl: string, tunnelId: string): void {
    const r = this.records.get(roomId);
    if (!r) return;
    r.room.publicUrl = publicUrl.replace(/^http/, 'ws');
    r.room.tunnelId = tunnelId;
    // Notify all connected guests about the new public URL (info only — their WS connection stays alive)
    this.broadcast(CHAT_IPC.EVT_STATUS, {
      roomId,
      status: r.room.status,
      publicUrl: r.room.publicUrl,
    });
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
    // Collect ports already in use by active rooms
    const usedPorts = new Set([...this.records.values()].map((r) => r.room.localPort));
    for (let port = preferred; port < preferred + 100; port++) {
      if (usedPorts.has(port)) continue;
      if (await this.isPortFree(port)) return port;
    }
    throw new Error('No free port found in range');
  }

  dispose(): void {
    const ids = [...this.records.keys()];
    ids.forEach((id) => this.close(id));
    this.typingTimers.forEach((t) => clearTimeout(t));
    this.typingTimers.clear();
  }

  // ── AI mention handler ─────────────────────────────────────────────────────

  private async handleAiMention(room: ChatRoom, prompt: string, replyToContent?: string, replyToSenderName?: string): Promise<void> {
    if (!this.agentService) return;
    // Allow empty prompt when replying — use reply context as the question
    const effectivePrompt = prompt.trim()
      ? prompt.trim()
      : replyToContent
        ? `What do you think about this message from ${replyToSenderName ?? 'someone'}: "${replyToContent}"`
        : 'Hello! How can you help me?';
    try {
      const record = this.records.get(room.id);
      if (!record) return;
      // Build full prompt including reply context if present
      const fullPrompt = replyToContent
        ? `[Replying to ${replyToSenderName ?? 'someone'}: "${replyToContent}"]

${effectivePrompt}`
        : effectivePrompt;
      let responseText = '';
      const sessionId = `chat-room-${room.id}`;
      // Prefer per-room agentId, then settings override, then auto
      const agentId = room.aiAgentId
        ?? (this.appStore?.get('settings')?.[`chat.aiAgentId`] as string | undefined)
        ?? undefined;

      // Show AI typing indicator
      this.sendTyping(room.id, 'ai', 'AI Assistant', true);

      const CHAT_CONSTRAINTS = `\n\n---\nYou are currently participating in a real-time team chat room.\n\nAdditional rules:\n- Keep responses concise, professional, and chat-friendly.\n- This chat is for discussion, explanations, questions, and coordination.\n- Do not directly read, write, edit, create, delete, or modify files in chat.\n- Do not directly run commands, scripts, terminals, builds, tests, or other system operations in chat.\n- When the user requests any file or workspace operation, clearly direct the task to the AI Agent.\n- For coding tasks that require inspecting or modifying the workspace, tell the user to use the AI Agent to perform the task.\n- Do not pretend that a file was read, changed, created, deleted, or a command was executed unless the AI Agent has actually performed the operation.\n- If the request can be answered without workspace access, answer it directly.\n- Keep responses short. Prefer 1–3 concise sentences.\n- Avoid unnecessary explanations, disclaimers, or repetition.\n- Maintain a professional, helpful, and collaborative tone.`;

      const agentObj = this.agentService.getAgentById(agentId);
      const basePrompt = agentObj?.systemPrompt ?? '';
      const finalSystemPrompt = basePrompt
        ? `${basePrompt}${CHAT_CONSTRAINTS}`
        : `You are a helpful AI assistant.${CHAT_CONSTRAINTS}`;

      for await (const event of this.agentService.streamMessage(sessionId, fullPrompt, agentId, undefined, undefined, [], finalSystemPrompt)) {
        if (event.type === 'content_delta') {
          responseText += (event.data as { content: string }).content;
        }
        if (event.type === 'done') break;
      }

      // Clear AI typing indicator
      this.sendTyping(room.id, 'ai', 'AI Assistant', false);

      if (!responseText.trim()) return;
      const aiMsg: ChatMessage = {
        id: nanoid(), roomId: room.id, senderId: 'ai',
        senderName: 'AI Assistant', senderColor: '#c586c0',
        type: 'ai', content: responseText,
        timestamp: new Date().toISOString(),
        reactions: {}, readBy: ['ai'],
      };
      this.appendMessage(room, aiMsg);
      const freshRecord = this.records.get(room.id);
      if (freshRecord) {
        this.relayToOthers(freshRecord, null, { type: 'chat', payload: aiMsg });
      }
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: aiMsg });
      this.saveHistory(room);
    } catch {
      // Clear typing indicator on error so it doesn't get stuck
      this.sendTyping(room.id, 'ai', 'AI Assistant', false);
      /* AI errors are non-fatal */
    }
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
      if (!userId || userId.startsWith('pending:')) return;
      const user = record.room.participants.find((u) => u.id === userId);
      record.room.participants = record.room.participants.filter((u) => u.id !== userId);
      if (user) {
        const sysMsg = this.systemMessage(record.room.id, `${user.name} left the room.`);
        this.appendMessage(record.room, sysMsg);
        this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: record.room.id, message: sysMsg });
        this.broadcast(CHAT_IPC.EVT_USER_LEFT, { roomId: record.room.id, userId, userName: user.name });
        this.broadcastStatus(record.room);
        record.socketMap.forEach((_uid, s) =>
          this.wsSend(s, { type: 'user-left', payload: { userId, userName: user.name } }),
        );
      }
    });

    // Send room-info so the guest knows who's in the room
    this.wsSend(ws, { type: 'room-info', payload: { ...record.room, filePort: record.filePort } });
  }

  private handleHostIncoming(record: HostRecord, ws: WebSocket, env: WsEnvelope): void {
    const { room, socketMap } = record;

    if (env.type === 'user-joined') {
      const incoming = env.payload as ChatUser;
      if (!room.openJoin) {
        // Approval flow
        const reqId = nanoid();
        const req: JoinRequest = {
          id: reqId,
          user: { ...incoming, id: incoming.id || nanoid(), role: 'guest', color: incoming.color || this.nextColor(), joinedAt: new Date().toISOString(), isOnline: false },
          requestedAt: new Date().toISOString(),
        };
        if (!room.pendingJoins) room.pendingJoins = [];
        room.pendingJoins.push(req);
        socketMap.set(ws, `pending:${reqId}`);
        this.wsSend(ws, { type: 'system', payload: { content: 'Your join request has been sent. Waiting for host approval…' } });
        this.broadcast(CHAT_IPC.EVT_JOIN_REQUEST, { roomId: room.id, request: req });
        return;
      }
      const user: ChatUser = {
        ...incoming, id: incoming.id || nanoid(), role: 'guest',
        color: incoming.color || this.nextColor(),
        joinedAt: new Date().toISOString(), isOnline: true,
      };
      socketMap.set(ws, user.id);
      room.participants.push(user);
      const sysMsg = this.systemMessage(room.id, `${user.name} joined the room.`);
      this.appendMessage(room, sysMsg);
      this.broadcast(CHAT_IPC.EVT_USER_JOINED, { roomId: room.id, user });
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: sysMsg });
      this.broadcastStatus(room);
      socketMap.forEach((_uid, s) => {
        if (s !== ws) {
          this.wsSend(s, { type: 'user-joined', payload: user });
          this.wsSend(s, { type: 'chat', payload: sysMsg });
        }
      });
      return;
    }

    if (env.type === 'chat') {
      const msg = env.payload as ChatMessage;
      msg.roomId = room.id;
      if (!msg.reactions) msg.reactions = {};
      if (!msg.readBy) msg.readBy = [msg.senderId];
      this.appendMessage(room, msg);
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, { type: 'chat', payload: msg }); });
      this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: msg });
      this.saveHistory(room);
      const hasAiMention = /@ai\b/i.test(msg.content);
      if (hasAiMention) {
        if (room.aiEnabled) {
          const prompt = msg.content.replace(/@ai\s*/gi, '').trim();
          setImmediate(() => this.handleAiMention(room, prompt, msg.replyToContent, msg.replyToSenderName));
        } else {
          const noteMsg = this.systemMessage(room.id, '\u26a0\ufe0f AI assistant is currently disabled. The host can enable it via the robot icon in the header.');
          this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: noteMsg });
          this.wsSend(ws, { type: 'chat', payload: noteMsg });
        }
      }
      return;
    }

    if (env.type === 'typing') {
      const { userId, userName, isTyping } = env.payload as { userId: string; userName: string; isTyping: boolean };
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, { type: 'typing', payload: { userId, userName, isTyping } }); });
      this.broadcast(CHAT_IPC.EVT_TYPING, { roomId: room.id, userId, userName, isTyping });
      return;
    }

    if (env.type === 'reaction') {
      const { messageId, emoji, userId, userName, added } = env.payload as any;
      const msg = room.messages.find((m) => m.id === messageId);
      if (msg) {
        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
        const arr = msg.reactions[emoji];
        const idx = arr.indexOf(userId);
        if (added && idx === -1) arr.push(userId);
        else if (!added && idx !== -1) arr.splice(idx, 1);
        if (arr.length === 0) delete msg.reactions[emoji];
      }
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, { type: 'reaction', payload: env.payload }); });
      this.broadcast(CHAT_IPC.EVT_REACTION, { roomId: room.id, messageId, emoji, userId, userName, added });
      return;
    }

    if (env.type === 'read-ack') {
      const { messageId, userId } = env.payload as { messageId: string; userId: string };
      const msg = room.messages.find((m) => m.id === messageId);
      if (msg) {
        if (!msg.readBy) msg.readBy = [];
        if (!msg.readBy.includes(userId)) msg.readBy.push(userId);
      }
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, { type: 'read-ack', payload: env.payload }); });
      this.broadcast(CHAT_IPC.EVT_READ, { roomId: room.id, messageId, userId });
      return;
    }

    if (env.type === 'presence') {
      const { userId, activeFile, activeLine } = env.payload as any;
      const user = room.participants.find((u) => u.id === userId);
      if (user) { user.activeFile = activeFile; user.activeLine = activeLine; }
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, { type: 'presence', payload: env.payload }); });
      this.broadcast(CHAT_IPC.EVT_PRESENCE, { roomId: room.id, userId, activeFile, activeLine });
      return;
    }

    if (env.type === 'message-edited') {
      const { messageId, newContent } = env.payload as any;
      const msg = room.messages.find((m) => m.id === messageId);
      if (msg) { msg.content = newContent; msg.edited = true; }
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, env); });
      this.broadcast(CHAT_IPC.EVT_MESSAGE_EDITED, { roomId: room.id, messageId, newContent });
      this.saveHistory(room);
      return;
    }

    if (env.type === 'message-deleted') {
      const { messageId } = env.payload as any;
      room.messages = room.messages.filter((m) => m.id !== messageId);
      socketMap.forEach((_uid, s) => { if (s !== ws) this.wsSend(s, env); });
      this.broadcast(CHAT_IPC.EVT_MESSAGE_DELETED, { roomId: room.id, messageId });
      this.saveHistory(room);
      return;
    }

    if (env.type === 'ping') { this.wsSend(ws, { type: 'pong', payload: {} }); }
  }

  // ── Guest: handle incoming from host ──────────────────────────────────────

  private handleGuestMessage(record: GuestRecord, raw: string): void {
    try {
      const env: WsEnvelope = JSON.parse(raw);
      const { room } = record;

      if (env.type === 'room-info') {
        const info = env.payload as ChatRoom & { filePort?: number };
        room.name = info.name; room.host = info.host;
        room.participants = info.participants;
        room.messages = info.messages ?? [];
        room.openJoin = info.openJoin;
        room.aiEnabled = info.aiEnabled;
        // Store filePort for URL rewriting
        if (info.filePort) record.hostFileBase = `${record.hostFileBase}:${info.filePort}`;
        // Rewrite fileUrl in history messages
        room.messages.forEach((m) => {
          if (m.type === 'file' && m.fileUrl) m.fileUrl = this.rewriteFileUrl(m.fileUrl, record.hostFileBase);
        });
        this.broadcastStatus(room);
        room.messages.forEach((m) => this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: m }));
        return;
      }

      if (env.type === 'join-response') {
        const { approved, room: roomInfo, filePort } = env.payload as { approved: boolean; room?: ChatRoom; filePort?: number };
        if (approved && roomInfo) {
          room.name = roomInfo.name; room.host = roomInfo.host;
          room.participants = roomInfo.participants;
          room.messages = roomInfo.messages ?? [];
          room.status = 'connected';
          if (filePort) record.hostFileBase = `${record.hostFileBase}:${filePort}`;
          // Rewrite fileUrl in history messages
          room.messages.forEach((m) => {
            if (m.type === 'file' && m.fileUrl) m.fileUrl = this.rewriteFileUrl(m.fileUrl, record.hostFileBase);
          });
          this.broadcastStatus(room);
          room.messages.forEach((m) => this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: m }));
        }
        this.broadcast(CHAT_IPC.EVT_JOIN_RESPONSE, { roomId: room.id, requestId: '', approved });
        return;
      }

      if (env.type === 'join-rejected') {
        const { reason } = env.payload as { reason: string };
        room.status = 'error'; room.error = reason;
        this.broadcastStatus(room);
        return;
      }

      if (env.type === 'chat') {
        const msg = env.payload as ChatMessage;
        if (!msg.reactions) msg.reactions = {};
        // Rewrite fileUrl so guest fetches from host's HTTP server
        if (msg.type === 'file' && msg.fileUrl) {
          msg.fileUrl = this.rewriteFileUrl(msg.fileUrl, record.hostFileBase);
        }
        this.appendMessage(room, msg);
        this.broadcast(CHAT_IPC.EVT_MESSAGE, { roomId: room.id, message: msg });
        return;
      }

      if (env.type === 'user-joined') {
        const user = env.payload as ChatUser;
        if (!room.participants.find((u) => u.id === user.id)) room.participants.push(user);
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

      if (env.type === 'typing') {
        const { userId, userName, isTyping } = env.payload as any;
        this.broadcast(CHAT_IPC.EVT_TYPING, { roomId: room.id, userId, userName, isTyping });
        return;
      }

      if (env.type === 'reaction') {
        const { messageId, emoji, userId, userName, added } = env.payload as any;
        const msg = room.messages.find((m) => m.id === messageId);
        if (msg) {
          if (!msg.reactions) msg.reactions = {};
          if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
          const arr = msg.reactions[emoji];
          const idx = arr.indexOf(userId);
          if (added && idx === -1) arr.push(userId);
          else if (!added && idx !== -1) arr.splice(idx, 1);
          if (arr.length === 0) delete msg.reactions[emoji];
        }
        this.broadcast(CHAT_IPC.EVT_REACTION, { roomId: room.id, messageId, emoji, userId, userName, added });
        return;
      }

      if (env.type === 'read-ack') {
        const { messageId, userId } = env.payload as any;
        const msg = room.messages.find((m) => m.id === messageId);
        if (msg) { if (!msg.readBy) msg.readBy = []; if (!msg.readBy.includes(userId)) msg.readBy.push(userId); }
        this.broadcast(CHAT_IPC.EVT_READ, { roomId: room.id, messageId, userId });
        return;
      }

      if (env.type === 'presence') {
        const { userId, activeFile, activeLine } = env.payload as any;
        const user = room.participants.find((u) => u.id === userId);
        if (user) { user.activeFile = activeFile; user.activeLine = activeLine; }
        this.broadcast(CHAT_IPC.EVT_PRESENCE, { roomId: room.id, userId, activeFile, activeLine });
        return;
      }

      if (env.type === 'message-edited') {
        const { messageId, newContent } = env.payload as any;
        const msg = room.messages.find((m) => m.id === messageId);
        if (msg) { msg.content = newContent; msg.edited = true; }
        this.broadcast(CHAT_IPC.EVT_MESSAGE_EDITED, { roomId: room.id, messageId, newContent });
        return;
      }

      if (env.type === 'message-deleted') {
        const { messageId } = env.payload as any;
        room.messages = room.messages.filter((m) => m.id !== messageId);
        this.broadcast(CHAT_IPC.EVT_MESSAGE_DELETED, { roomId: room.id, messageId });
        return;
      }

      if (env.type === 'pong') return;
    } catch { /* ignore */ }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private appendMessage(room: ChatRoom, msg: ChatMessage): void {
    room.messages.push(msg);
    if (room.messages.length > MAX_MESSAGES) room.messages = room.messages.slice(-MAX_MESSAGES);
  }

  private systemMessage(roomId: string, content: string): ChatMessage {
    return {
      id: nanoid(), roomId, senderId: 'system', senderName: 'System',
      senderColor: '#888', type: 'system', content,
      timestamp: new Date().toISOString(), reactions: {}, readBy: [],
    };
  }

  private relayToOthers(record: RoomRecord, excludeWs: WebSocket | null, envelope: WsEnvelope): void {
    if (record.kind === 'host') {
      record.socketMap.forEach((_uid, ws) => {
        if (ws !== excludeWs) this.wsSend(ws, envelope);
      });
    } else {
      if (record.ws !== excludeWs) this.wsSend(record.ws, envelope);
    }
  }

  private pingAll(record: RoomRecord): void {
    if (record.kind === 'host') {
      record.socketMap.forEach((_uid, ws) => this.wsSend(ws, { type: 'ping', payload: {} }));
    } else {
      if (record.ws.readyState === WebSocket.OPEN)
        this.wsSend(record.ws, { type: 'ping', payload: {} });
    }
  }

  private broadcastStatus(room: ChatRoom): void {
    this.broadcast(CHAT_IPC.EVT_STATUS, {
      roomId: room.id, status: room.status,
      publicUrl: room.publicUrl, error: room.error,
      participants: room.participants, name: room.name,
      pendingJoins: room.pendingJoins,
      aiEnabled: room.aiEnabled,
    });
  }

  private broadcast(channel: string, payload: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    });
  }

  private wsSend(ws: WebSocket, envelope: WsEnvelope): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(envelope));
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
