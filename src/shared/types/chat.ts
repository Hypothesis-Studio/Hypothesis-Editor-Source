/**
 * Chat Collaboration Types - Shared between main, preload, and renderer.
 * Supports local (LAN/WebSocket) and public (via existing Tunnel) modes.
 */

// ============================================================================
// Core Types
// ============================================================================

export type ChatRoomStatus = 'idle' | 'hosting' | 'connected' | 'connecting' | 'error' | 'closed';
export type ChatMessageType = 'text' | 'system' | 'code' | 'file' | 'ai';
export type ChatUserRole = 'host' | 'guest' | 'ai';

export interface ChatUser {
  id: string;
  name: string;
  role: ChatUserRole;
  color: string;
  joinedAt: string;
  isOnline: boolean;
  /** Current file being edited (presence sharing) */
  activeFile?: string;
  /** Current cursor line (presence sharing) */
  activeLine?: number;
}

export interface ChatReaction {
  emoji: string;
  userIds: string[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  type: ChatMessageType;
  content: string;
  timestamp: string;
  edited?: boolean;
  /** Message this is replying to */
  replyToId?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  /** Emoji reactions: emoji → array of userIds */
  reactions?: Record<string, string[]>;
  /** Read receipts: array of userIds who have read */
  readBy?: string[];
  /** For type='code': language hint */
  language?: string;
  /** For type='file': file metadata */
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  fileData?: string; // base64, only present during transfer
}

export interface JoinRequest {
  id: string;
  user: ChatUser;
  requestedAt: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  status: ChatRoomStatus;
  localPort: number;
  publicUrl: string | null;
  tunnelId: string | null;
  host: ChatUser;
  participants: ChatUser[];
  messages: ChatMessage[];
  createdAt: string;
  error: string | null;
  openJoin: boolean;
  /** Pending join requests when openJoin=false */
  pendingJoins?: JoinRequest[];
  /** Whether AI agent is invited to this room */
  aiEnabled?: boolean;
  /** AI agent ID to use for @ai mentions */
  aiAgentId?: string;
}

export interface ChatCreateOptions {
  name: string;
  userName: string;
  localPort?: number;
  openJoin?: boolean;
  tunnelId?: string | null;
  aiEnabled?: boolean;
  aiAgentId?: string;
}

export interface ChatJoinOptions {
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
  participants?: ChatUser[];
  name?: string;
}

export interface ChatRoomClosedEvent {
  roomId: string;
  reason: string;
}

export interface ChatTypingEvent {
  roomId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface ChatReactionEvent {
  roomId: string;
  messageId: string;
  emoji: string;
  userId: string;
  userName: string;
  added: boolean;
}

export interface ChatReadReceiptEvent {
  roomId: string;
  messageId: string;
  userId: string;
}

export interface ChatPresenceEvent {
  roomId: string;
  userId: string;
  activeFile?: string;
  activeLine?: number;
}

export interface ChatJoinRequestEvent {
  roomId: string;
  request: JoinRequest;
}

export interface ChatJoinResponseEvent {
  roomId: string;
  requestId: string;
  approved: boolean;
  room?: ChatRoom;
}

export interface ChatMessageEditedEvent {
  roomId: string;
  messageId: string;
  newContent: string;
}

export interface ChatMessageDeletedEvent {
  roomId: string;
  messageId: string;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

export const CHAT_IPC = {
  // Invokable (renderer → main)
  CREATE:             'chat:create',
  JOIN:               'chat:join',
  LEAVE:              'chat:leave',
  CLOSE:              'chat:close',
  LIST:               'chat:list',
  GET:                'chat:get',
  SEND:               'chat:send',
  SEND_CODE:          'chat:send-code',
  SEND_FILE:          'chat:send-file',
  UPDATE_NAME:        'chat:update-name',
  COPY_URL:           'chat:copy-url',
  FIND_FREE_PORT:     'chat:find-free-port',
  UPDATE_PUBLIC_URL:  'chat:update-public-url',
  KICK:               'chat:kick',
  TYPING:             'chat:typing',
  REACT:              'chat:react',
  READ:               'chat:read',
  PRESENCE:           'chat:presence',
  APPROVE_JOIN:       'chat:approve-join',
  DENY_JOIN:          'chat:deny-join',
  TOGGLE_AI:          'chat:toggle-ai',
  EDIT_MESSAGE:       'chat:edit-message',
  DELETE_MESSAGE:     'chat:delete-message',
  DOWNLOAD_FILE:      'chat:download-file',

  // Events (main → renderer)
  EVT_MESSAGE:        'chat:evt:message',
  EVT_USER_JOINED:    'chat:evt:user-joined',
  EVT_USER_LEFT:      'chat:evt:user-left',
  EVT_STATUS:         'chat:evt:status',
  EVT_ROOM_CLOSED:    'chat:evt:room-closed',
  EVT_TYPING:         'chat:evt:typing',
  EVT_REACTION:       'chat:evt:reaction',
  EVT_READ:           'chat:evt:read',
  EVT_PRESENCE:       'chat:evt:presence',
  EVT_JOIN_REQUEST:   'chat:evt:join-request',
  EVT_JOIN_RESPONSE:  'chat:evt:join-response',
  EVT_MESSAGE_EDITED: 'chat:evt:message-edited',
  EVT_MESSAGE_DELETED:'chat:evt:message-deleted',
} as const;

// ============================================================================
// WebSocket wire protocol
// ============================================================================

export type WsMessageType =
  | 'chat'
  | 'system'
  | 'user-joined'
  | 'user-left'
  | 'room-info'
  | 'ping'
  | 'pong'
  | 'typing'
  | 'reaction'
  | 'read-ack'
  | 'presence'
  | 'join-request'
  | 'join-response'
  | 'message-edited'
  | 'message-deleted'
  | 'join-rejected';

export interface WsEnvelope {
  type: WsMessageType;
  payload: unknown;
}

// ============================================================================
// File transfer constraints
// ============================================================================

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'application/json', 'text/markdown',
  'application/octet-stream',
];
