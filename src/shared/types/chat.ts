/**
 * Chat Collaboration Types - Shared between main, preload, and renderer.
 * Supports local (LAN/WebSocket) and public (via existing Tunnel) modes.
 */

// ============================================================================
// Core Types
// ============================================================================

export type ChatRoomStatus = 'idle' | 'hosting' | 'connected' | 'connecting' | 'error' | 'closed';
export type ChatMessageType = 'text' | 'system' | 'file' | 'code';
export type ChatUserRole = 'host' | 'guest';

export interface ChatUser {
  id: string;
  name: string;
  role: ChatUserRole;
  color: string;          // assigned avatar color
  joinedAt: string;       // ISO timestamp
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  type: ChatMessageType;
  content: string;
  timestamp: string;      // ISO timestamp
  edited?: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  status: ChatRoomStatus;
  /** Local port the WebSocket server listens on */
  localPort: number;
  /** Public URL when shared via tunnel (null if local-only) */
  publicUrl: string | null;
  /** Tunnel ID if the room is exposed via an existing tunnel */
  tunnelId: string | null;
  /** Host user info */
  host: ChatUser;
  /** All connected participants including host */
  participants: ChatUser[];
  /** Message history (last N messages) */
  messages: ChatMessage[];
  /** ISO timestamp of room creation */
  createdAt: string;
  /** Error string when status === 'error' */
  error: string | null;
  /** Whether guests can join without approval */
  openJoin: boolean;
}

export interface ChatCreateOptions {
  name: string;
  userName: string;
  localPort?: number;
  openJoin?: boolean;
  /** If provided, the room will be shared through this tunnel's publicUrl */
  tunnelId?: string | null;
}

export interface ChatJoinOptions {
  /** ws:// or wss:// URL to connect to */
  url: string;
  userName: string;
}

// ============================================================================
// IPC Payload Types
// ============================================================================

export interface ChatCreateResult {
  success: boolean;
  room?: ChatRoom;
  error?: string;
}

export interface ChatJoinResult {
  success: boolean;
  room?: ChatRoom;
  error?: string;
}

export interface ChatSendResult {
  success: boolean;
  message?: ChatMessage;
  error?: string;
}

// ============================================================================
// IPC Events (main → renderer)
// ============================================================================

export interface ChatMessageEvent {
  roomId: string;
  message: ChatMessage;
}

export interface ChatUserJoinedEvent {
  roomId: string;
  user: ChatUser;
}

export interface ChatUserLeftEvent {
  roomId: string;
  userId: string;
  userName: string;
}

export interface ChatRoomStatusEvent {
  roomId: string;
  status: ChatRoomStatus;
  publicUrl: string | null;
  error: string | null;
}

export interface ChatRoomClosedEvent {
  roomId: string;
  reason: string;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

export const CHAT_IPC = {
  // Invokable (renderer → main)
  CREATE:         'chat:create',
  JOIN:           'chat:join',
  LEAVE:          'chat:leave',
  CLOSE:          'chat:close',
  LIST:           'chat:list',
  GET:            'chat:get',
  SEND:           'chat:send',
  UPDATE_NAME:    'chat:update-name',
  COPY_URL:       'chat:copy-url',
  FIND_FREE_PORT:    'chat:find-free-port',
  UPDATE_PUBLIC_URL:  'chat:update-public-url',
  KICK:               'chat:kick',

  // Events (main → renderer)
  EVT_MESSAGE:      'chat:evt:message',
  EVT_USER_JOINED:  'chat:evt:user-joined',
  EVT_USER_LEFT:    'chat:evt:user-left',
  EVT_STATUS:       'chat:evt:status',
  EVT_ROOM_CLOSED:  'chat:evt:room-closed',
} as const;

// ============================================================================
// WebSocket wire protocol (messages exchanged between peers)
// ============================================================================

export type WsMessageType =
  | 'chat'
  | 'system'
  | 'user-joined'
  | 'user-left'
  | 'room-info'
  | 'ping'
  | 'pong';

export interface WsEnvelope {
  type: WsMessageType;
  payload: unknown;
}
