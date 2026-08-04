/**
 * Chat Store - Zustand state management for Realtime Chat Collaboration.
 * Covers: typing indicators, code snippets, file transfer, reactions,
 * thread/reply, join approval, presence/cursor sharing, AI agent, persistence.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChatRoom, ChatMessage, ChatUser, ChatCreateOptions, ChatJoinOptions,
  ChatRoomStatusEvent, ChatUserJoinedEvent, ChatUserLeftEvent,
  ChatRoomClosedEvent, ChatTypingEvent, ChatReactionEvent,
  ChatReadReceiptEvent, ChatPresenceEvent, ChatJoinRequestEvent,
  ChatMessageEditedEvent, ChatMessageDeletedEvent, JoinRequest,
} from '../../shared/types/chat';

// ─── UI state ────────────────────────────────────────────────────────────────

export type HostingMode = 'local' | 'public';

/** Per-room UI state not stored in ChatRoom itself */
export interface RoomUIState {
  /** userId → true when typing */
  typingUsers: Record<string, { name: string; since: number }>;
}

interface ChatState {
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  roomUI: Record<string, RoomUIState>;
  selectedRoomId: string | null;
  unreadCounts: Record<string, number>;
  isLoading: boolean;

  sidebarPanel: 'create' | 'join' | null;

  // Create form
  createName: string;
  createUserName: string;
  createPort: string;
  createOpenJoin: boolean;
  createAiEnabled: boolean;
  hostingMode: HostingMode;
  createSubdomain: string;
  createTunnelId: string | null;
  tunnelProvider: 'localtunnel' | 'cloudflare';

  // Join form
  joinUrl: string;
  joinUserName: string;

  // Compose
  draftMessages: Record<string, string>;
  replyingTo: Record<string, ChatMessage | null>;

  // Pending tunnel
  pendingTunnelRoomId: string | null;
  // Tunnel status per room: 'generating' | 'connecting' | 'connected' | 'failed'
  tunnelStatuses: Record<string, 'generating' | 'connecting' | 'connected' | 'failed'>;

  // ── Setters ──────────────────────────────────────────────────────────────
  setSidebarPanel: (v: 'create' | 'join' | null) => void;
  setCreateName: (v: string) => void;
  setCreateUserName: (v: string) => void;
  setCreatePort: (v: string) => void;
  setCreateOpenJoin: (v: boolean) => void;
  setCreateAiEnabled: (v: boolean) => void;
  setHostingMode: (v: HostingMode) => void;
  setCreateSubdomain: (v: string) => void;
  setCreateTunnelId: (v: string | null) => void;
  setTunnelProvider: (v: 'localtunnel' | 'cloudflare') => void;
  setJoinUrl: (v: string) => void;
  setJoinUserName: (v: string) => void;
  setDraft: (roomId: string, v: string) => void;
  setReplyingTo: (roomId: string, msg: ChatMessage | null) => void;
  clearMessages: (roomId: string) => void;
  setSelectedRoom: (id: string | null) => void;
  clearUnread: (roomId: string) => void;

  // ── Async actions ────────────────────────────────────────────────────────
  loadRooms: () => Promise<void>;
  createRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
  leaveRoom: (id: string) => Promise<void>;
  closeRoom: (id: string) => Promise<void>;
  sendMessage: (roomId: string, content: string) => Promise<void>;
  sendCode: (roomId: string, code: string, language: string) => Promise<void>;
  sendFile: (roomId: string, file: File) => Promise<{ error?: string }>;
  editMessage: (roomId: string, messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (roomId: string, messageId: string) => Promise<void>;
  copyUrl: (roomId: string) => Promise<void>;
  findFreePort: () => Promise<number>;
  kickUser: (roomId: string, userId: string) => Promise<void>;
  sendTyping: (roomId: string, isTyping: boolean) => Promise<void>;
  addReaction: (roomId: string, messageId: string, emoji: string) => Promise<void>;
  markRead: (roomId: string, messageId: string) => Promise<void>;
  sendPresence: (roomId: string, activeFile?: string, activeLine?: number) => Promise<void>;
  approveJoin: (roomId: string, requestId: string) => Promise<void>;
  denyJoin: (roomId: string, requestId: string) => Promise<void>;
  toggleAi: (roomId: string, enabled: boolean) => Promise<void>;
  regenerateTunnel: (roomId: string) => Promise<void>;

  // ── IPC event handlers ───────────────────────────────────────────────────
  handleMessage: (event: { roomId: string; message: ChatMessage }) => void;
  handleUserJoined: (event: ChatUserJoinedEvent) => void;
  handleUserLeft: (event: ChatUserLeftEvent) => void;
  handleStatus: (event: ChatRoomStatusEvent & { participants?: ChatUser[]; name?: string; pendingJoins?: JoinRequest[]; aiEnabled?: boolean }) => void;
  handleRoomClosed: (event: ChatRoomClosedEvent) => void;
  handleTunnelStatus: (event: { tunnelId: string; status: string; publicUrl: string | null }) => void;
  handleTyping: (event: ChatTypingEvent) => void;
  handleReaction: (event: ChatReactionEvent) => void;
  handleReadReceipt: (event: ChatReadReceiptEvent) => void;
  handlePresence: (event: ChatPresenceEvent) => void;
  handleJoinRequest: (event: ChatJoinRequestEvent) => void;
  handleMessageEdited: (event: ChatMessageEditedEvent) => void;
  handleMessageDeleted: (event: ChatMessageDeletedEvent) => void;
}

const MAX_MESSAGES = 500;
/** Typing indicator auto-expires after this many ms of silence */
const TYPING_EXPIRE_MS = 4_000;

/** Resolve current user for a room */
function selfId(rooms: ChatRoom[], roomId: string): string {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return '';
  // host is always the local user when status=hosting
  if (room.status === 'hosting') return room.host.id;
  // guest: use the first guest participant (the local user who joined)
  return room.participants.find((u) => u.role === 'guest')?.id ?? '';
}

export const useChatStore = create<ChatState>()(persist((set, get) => ({
  rooms: [],
  messages: {},
  roomUI: {},
  selectedRoomId: null,
  unreadCounts: {},
  isLoading: false,
  sidebarPanel: null,

  createName: '',
  createUserName: '',
  createPort: '',
  createOpenJoin: true,
  createAiEnabled: false,
  hostingMode: 'local',
  createSubdomain: '',
  createTunnelId: null,
  tunnelProvider: 'cloudflare',

  joinUrl: '',
  joinUserName: '',
  draftMessages: {},
  replyingTo: {},
  pendingTunnelRoomId: null,
  tunnelStatuses: {},

  // ── Setters ───────────────────────────────────────────────────────────────
  setSidebarPanel: (v) => set({ sidebarPanel: v }),
  setCreateName: (v) => set({ createName: v }),
  setCreateUserName: (v) => set({ createUserName: v }),
  setCreatePort: (v) => set({ createPort: v }),
  setCreateOpenJoin: (v) => set({ createOpenJoin: v }),
  setCreateAiEnabled: (v) => set({ createAiEnabled: v }),
  setHostingMode: (v) => set({ hostingMode: v }),
  setCreateSubdomain: (v) => set({ createSubdomain: v }),
  setCreateTunnelId: (v) => set({ createTunnelId: v }),
  setTunnelProvider: (v) => set({ tunnelProvider: v }),
  setJoinUrl: (v) => set({ joinUrl: v }),
  setJoinUserName: (v) => set({ joinUserName: v }),
  setDraft: (roomId, v) => set((s) => ({ draftMessages: { ...s.draftMessages, [roomId]: v } })),
  setReplyingTo: (roomId, msg) => set((s) => ({ replyingTo: { ...s.replyingTo, [roomId]: msg } })),
  clearMessages: (roomId) => set((s) => ({ messages: { ...s.messages, [roomId]: [] } })),
  setSelectedRoom: (id) => set((s) => ({
    selectedRoomId: id,
    unreadCounts: id ? { ...s.unreadCounts, [id]: 0 } : s.unreadCounts,
  })),
  clearUnread: (roomId) => set((s) => ({ unreadCounts: { ...s.unreadCounts, [roomId]: 0 } })),

  // ── Async actions ─────────────────────────────────────────────────────────

  loadRooms: async () => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const result = await api.chat.list();
    if (result?.rooms) {
      // Merge with persisted state — preserve publicUrl/tunnelId/tunnelStatuses
      // that may be ahead of what main process reports (tunnel connected but
      // list() was called before setPublicUrl ran)
      set((s) => ({
        rooms: result.rooms.map((r: any) => {
          const persisted = s.rooms.find((p) => p.id === r.id);
          return {
            ...r,
            publicUrl: r.publicUrl ?? persisted?.publicUrl ?? null,
            tunnelId: r.tunnelId ?? persisted?.tunnelId ?? null,
          };
        }),
      }));
    }
  },

  createRoom: async () => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const { createName, createUserName, createPort, createOpenJoin, createAiEnabled, hostingMode, createSubdomain, createTunnelId, tunnelProvider } = get();
    if (!createName.trim() || !createUserName.trim()) return;
    set({ isLoading: true });
    try {
      const port = createPort ? parseInt(createPort, 10) : undefined;
      const options: ChatCreateOptions = {
        name: createName.trim(), userName: createUserName.trim(),
        localPort: port, openJoin: createOpenJoin,
        tunnelId: createTunnelId, aiEnabled: createAiEnabled,
        tunnelProvider,
      };
      const result = await api.chat.create(options);
      if (!result?.success || !result.room) return;
      const room: ChatRoom = result.room;
      set((s) => ({
        rooms: [...s.rooms, room],
        messages: { ...s.messages, [room.id]: room.messages ?? [] },
        selectedRoomId: room.id,
        sidebarPanel: null,
        createName: '', createPort: '',
        isLoading: false,
      }));
      if (hostingMode === 'public' && api.tunnel) {
        set((s) => ({ pendingTunnelRoomId: room.id, tunnelStatuses: { ...s.tunnelStatuses, [room.id]: 'generating' } }));
        const subdomain = tunnelProvider === 'localtunnel' ? (createSubdomain.trim() || undefined) : undefined;
        api.tunnel.open({ localPort: room.localPort, label: `Chat: ${room.name}`, subdomain, autoReconnect: true, provider: tunnelProvider, source: 'chat-room' })
          .then((tunnelResult: any) => {
            if (tunnelResult?.success && tunnelResult.tunnel) {
              // Store tunnelId so handleTunnelStatus can match later
              set((s) => ({
                rooms: s.rooms.map((r) =>
                  r.id === room.id ? { ...r, tunnelId: tunnelResult.tunnel.id } : r,
                ),
                tunnelStatuses: { ...s.tunnelStatuses, [room.id]: 'connecting' },
              }));
              const publicUrl = tunnelResult.tunnel.publicUrl;
              if (publicUrl) {
                api.chat.updatePublicUrl?.(room.id, publicUrl, tunnelResult.tunnel.id);
                set((s) => ({
                  rooms: s.rooms.map((r) =>
                    r.id === room.id
                      ? { ...r, publicUrl: publicUrl.replace(/^http/, 'ws'), tunnelId: tunnelResult.tunnel.id }
                      : r,
                  ),
                  pendingTunnelRoomId: null,
                  tunnelStatuses: { ...s.tunnelStatuses, [room.id]: 'connected' },
                }));
              }
            } else {
              set((s) => ({ pendingTunnelRoomId: null, tunnelStatuses: { ...s.tunnelStatuses, [room.id]: 'failed' } }));
            }
          })
          .catch(() => set((s) => ({ pendingTunnelRoomId: null, tunnelStatuses: { ...s.tunnelStatuses, [room.id]: 'failed' } })));
      }
    } finally {
      set({ isLoading: false });
    }
  },

  joinRoom: async () => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const { joinUrl, joinUserName } = get();
    if (!joinUrl.trim() || !joinUserName.trim()) return;
    set({ isLoading: true });
    try {
      const result = await api.chat.join({ url: joinUrl.trim(), userName: joinUserName.trim() } as ChatJoinOptions);
      if (result?.success && result.room) {
        set((s) => ({
          rooms: [...s.rooms, result.room],
          messages: { ...s.messages, [result.room.id]: result.room.messages ?? [] },
          selectedRoomId: result.room.id,
          sidebarPanel: null, joinUrl: '',
        }));
      }
    } finally {
      set({ isLoading: false });
    }
  },

  leaveRoom: async (id) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    await api.chat.leave(id);
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== id),
      selectedRoomId: s.selectedRoomId === id ? null : s.selectedRoomId,
    }));
  },

  closeRoom: async (id) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const room = get().rooms.find((r) => r.id === id);
    await api.chat.close(id);
    if (room?.tunnelId && api.tunnel) await api.tunnel.close(room.tunnelId).catch(() => {});
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== id),
      selectedRoomId: s.selectedRoomId === id ? null : s.selectedRoomId,
    }));
  },

  sendMessage: async (roomId, content) => {
    const api = (window as any).api;
    if (!api?.chat || !content.trim()) return;
    const replyTo = get().replyingTo[roomId];
    set((s) => ({
      draftMessages: { ...s.draftMessages, [roomId]: '' },
      replyingTo: { ...s.replyingTo, [roomId]: null },
    }));
    await api.chat.send(roomId, content.trim(), replyTo?.id);
    // Clear typing indicator
    await api.chat.typing?.(roomId, selfId(get().rooms, roomId), '', false);
  },

  sendCode: async (roomId, code, language) => {
    const api = (window as any).api;
    if (!api?.chat || !code.trim()) return;
    const replyTo = get().replyingTo[roomId];
    set((s) => ({
      draftMessages: { ...s.draftMessages, [roomId]: '' },
      replyingTo: { ...s.replyingTo, [roomId]: null },
    }));
    await api.chat.sendCode?.(roomId, code, language, replyTo?.id);
  },

  sendFile: async (roomId, file) => {
    const api = (window as any).api;
    if (!api?.chat) return {};
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (!base64) { resolve({ error: 'Failed to read file.' }); return; }
        const result = await api.chat.sendFile?.(roomId, file.name, base64, file.type || 'application/octet-stream');
        resolve(result?.success ? {} : { error: result?.error ?? 'Failed to send file.' });
      };
      reader.onerror = () => resolve({ error: 'Failed to read file.' });
      reader.readAsDataURL(file);
    });
  },

  editMessage: async (roomId, messageId, newContent) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const sid = selfId(get().rooms, roomId);
    await api.chat.editMessage?.(roomId, messageId, newContent, sid);
  },

  deleteMessage: async (roomId, messageId) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const sid = selfId(get().rooms, roomId);
    await api.chat.deleteMessage?.(roomId, messageId, sid);
  },

  copyUrl: async (roomId) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    await api.chat.copyUrl(roomId);
  },

  findFreePort: async () => {
    const api = (window as any).api;
    if (!api?.chat) return 4900;
    const result = await api.chat.findFreePort();
    return result?.port ?? 4900;
  },

  kickUser: async (roomId, userId) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    await api.chat.kick(roomId, userId);
  },

  sendTyping: async (roomId, isTyping) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const sid = selfId(get().rooms, roomId);
    const room = get().rooms.find((r) => r.id === roomId);
    const user = room?.participants.find((u) => u.id === sid);
    if (!sid || !user) return;
    await api.chat.typing?.(roomId, sid, user.name, isTyping);
  },

  addReaction: async (roomId, messageId, emoji) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const sid = selfId(get().rooms, roomId);
    const room = get().rooms.find((r) => r.id === roomId);
    const user = room?.participants.find((u) => u.id === sid);
    if (!sid) return;

    // 1 reaction per user per message — remove existing reaction on a different emoji first
    const msgs = get().messages[roomId] ?? [];
    const msg = msgs.find((m) => m.id === messageId);
    if (msg?.reactions) {
      for (const [existingEmoji, users] of Object.entries(msg.reactions)) {
        if (existingEmoji !== emoji && (users as string[]).includes(sid)) {
          await api.chat.react?.(roomId, messageId, existingEmoji, sid, user?.name ?? '');
          break;
        }
      }
    }

    await api.chat.react?.(roomId, messageId, emoji, sid, user?.name ?? '');
  },

  markRead: async (roomId, messageId) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const sid = selfId(get().rooms, roomId);
    if (!sid) return;
    await api.chat.read?.(roomId, messageId, sid);
  },

  sendPresence: async (roomId, activeFile, activeLine) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const sid = selfId(get().rooms, roomId);
    if (!sid) return;
    await api.chat.presence?.(roomId, sid, activeFile, activeLine);
  },

  approveJoin: async (roomId, requestId) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    await api.chat.approveJoin?.(roomId, requestId);
  },

  denyJoin: async (roomId, requestId) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    await api.chat.denyJoin?.(roomId, requestId);
  },

  toggleAi: async (roomId, enabled) => {
    const api = (window as any).api;
    if (!api?.chat) return;
    await api.chat.toggleAi?.(roomId, enabled);
  },

  regenerateTunnel: async (roomId) => {
    const api = (window as any).api;
    if (!api?.chat || !api?.tunnel) return;
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room || !room.localPort) return;

    // Close old tunnel if exists
    if (room.tunnelId) {
      await api.tunnel.close(room.tunnelId).catch(() => {});
    }

    // Mark as connecting immediately
    set((s) => ({ 
      pendingTunnelRoomId: roomId,
      tunnelStatuses: { ...s.tunnelStatuses, [roomId]: 'connecting' },
    }));

    try {
      const result = await api.tunnel.open({
        localPort: room.localPort,
        label: `Chat: ${room.name}`,
        autoReconnect: true,
        source: 'chat-room',
        provider: get().tunnelProvider,
        subdomain: get().createSubdomain || undefined,
      });
      if (result?.success && result.tunnel) {
        // Update tunnelId immediately so handleTunnelStatus can match
        set((s) => ({
          rooms: s.rooms.map((r) => 
            r.id === roomId ? { ...r, tunnelId: result.tunnel.id } : r
          ),
        }));
        const publicUrl = result.tunnel.publicUrl;
        if (publicUrl) {
          await api.chat.updatePublicUrl?.(roomId, publicUrl, result.tunnel.id);
          set((s) => ({
            rooms: s.rooms.map((r) =>
              r.id === roomId
                ? { ...r, publicUrl: publicUrl.replace(/^http/, 'ws'), tunnelId: result.tunnel.id }
                : r,
            ),
            tunnelStatuses: { ...s.tunnelStatuses, [roomId]: 'connected' },
            pendingTunnelRoomId: null,
          }));
        }
        // If no publicUrl yet, handleTunnelStatus will update when tunnel connects
      } else {
        // Failed to open
        set((s) => ({
          tunnelStatuses: { ...s.tunnelStatuses, [roomId]: 'failed' },
          pendingTunnelRoomId: null,
        }));
      }
    } catch (err) {
      set((s) => ({
        tunnelStatuses: { ...s.tunnelStatuses, [roomId]: 'failed' },
        pendingTunnelRoomId: null,
      }));
    } finally {
      set({ pendingTunnelRoomId: null });
    }
  },

  // ── IPC event handlers ────────────────────────────────────────────────────

  handleMessage: (event) => {
    set((s) => {
      const prev = s.messages[event.roomId] ?? [];
      // Deduplicate by id
      if (prev.find((m) => m.id === event.message.id)) return {};
      const next = [...prev, event.message].slice(-MAX_MESSAGES);
      // Increment unread if room is not currently selected
      const isActive = s.selectedRoomId === event.roomId;
      const prevUnread = s.unreadCounts[event.roomId] ?? 0;
      const unreadCounts = isActive
        ? s.unreadCounts
        : { ...s.unreadCounts, [event.roomId]: prevUnread + 1 };
      // Desktop notification for non-self, non-system messages
      const msg = event.message;
      const isSelf = msg.senderId === s.rooms.find((r) => r.id === event.roomId)?.host?.id;
      if (!isActive && msg.type !== 'system' && !isSelf) {
        const api = (window as any).api;
        api?.chat?.showNotification?.(msg.senderName, msg.type === 'code' ? '[Code snippet]' : msg.type === 'file' ? `[File: ${msg.fileName}]` : msg.content, event.roomId);
      }
      return { messages: { ...s.messages, [event.roomId]: next }, unreadCounts };
    });
  },

  handleUserJoined: (event) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === event.roomId
          ? { ...r, participants: r.participants.find((u) => u.id === event.user.id) ? r.participants : [...r.participants, event.user] }
          : r,
      ),
    }));
  },

  handleUserLeft: (event) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === event.roomId
          ? { ...r, participants: r.participants.filter((u) => u.id !== event.userId) }
          : r,
      ),
    }));
  },

  handleStatus: (event) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === event.roomId
          ? {
              ...r,
              status: event.status,
              // Never override publicUrl from status event — tunnelStatus handler owns this
              publicUrl: r.publicUrl,
              error: event.error ?? r.error,
              participants: event.participants ?? r.participants,
              name: event.name ?? r.name,
              pendingJoins: (event as any).pendingJoins ?? r.pendingJoins,
              aiEnabled: (event as any).aiEnabled ?? r.aiEnabled,
            }
          : r,
      ),
    }));
  },

  handleRoomClosed: (event) => {
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== event.roomId),
      selectedRoomId: s.selectedRoomId === event.roomId ? null : s.selectedRoomId,
    }));
  },

  handleTunnelStatus: (event) => {
    set((s) => {
      // Find room with matching tunnelId
      const room = s.rooms.find((r) => r.tunnelId === event.tunnelId);
      if (!room) return {};
      const roomId = room.id;
      const status = event.status;
      const publicUrl = event.publicUrl;

      let tunnelPhase: 'generating' | 'connecting' | 'connected' | 'failed' = s.tunnelStatuses[roomId] ?? 'connecting';
      if (status === 'connected' && publicUrl) tunnelPhase = 'connected';
      else if (status === 'error') tunnelPhase = 'failed';
      else if (status === 'connecting' || status === 'closed') tunnelPhase = 'connecting';

      // Update publicUrl: set on connected (new URL), clear only on error
      // On closed: keep last known URL — autoReconnect will restore it shortly
      const updatedRooms = s.rooms.map((r) => {
        if (r.id !== roomId) return r;
        if (status === 'connected' && publicUrl) {
          return { ...r, publicUrl: publicUrl.replace(/^http/, 'ws') };
        }
        if (status === 'error') {
          return { ...r, publicUrl: null };
        }
        return r;
      });

      const pendingTunnelRoomId = tunnelPhase === 'connected' || tunnelPhase === 'failed'
        ? (s.pendingTunnelRoomId === roomId ? null : s.pendingTunnelRoomId)
        : s.pendingTunnelRoomId;

      return {
        rooms: updatedRooms,
        tunnelStatuses: { ...s.tunnelStatuses, [roomId]: tunnelPhase },
        pendingTunnelRoomId,
      };
    });
  },

  handleTyping: (event) => {
    set((s) => {
      const ui = s.roomUI[event.roomId] ?? { typingUsers: {} };
      const typingUsers = { ...ui.typingUsers };
      if (event.isTyping) {
        typingUsers[event.userId] = { name: event.userName, since: Date.now() };
      } else {
        delete typingUsers[event.userId];
      }
      return { roomUI: { ...s.roomUI, [event.roomId]: { ...ui, typingUsers } } };
    });
    // Auto-expire after TYPING_EXPIRE_MS — skip for AI (it clears itself when done)
    if (event.isTyping && event.userId !== 'ai') {
      setTimeout(() => {
        set((s) => {
          const ui = s.roomUI[event.roomId];
          if (!ui) return {};
          const entry = ui.typingUsers[event.userId];
          if (!entry || Date.now() - entry.since < TYPING_EXPIRE_MS) return {};
          const typingUsers = { ...ui.typingUsers };
          delete typingUsers[event.userId];
          return { roomUI: { ...s.roomUI, [event.roomId]: { ...ui, typingUsers } } };
        });
      }, TYPING_EXPIRE_MS + 100);
    }
  },

  handleReaction: (event) => {
    set((s) => {
      const msgs = s.messages[event.roomId];
      if (!msgs) return {};
      return {
        messages: {
          ...s.messages,
          [event.roomId]: msgs.map((m) => {
            if (m.id !== event.messageId) return m;
            const reactions = { ...(m.reactions ?? {}) };
            if (!reactions[event.emoji]) reactions[event.emoji] = [];
            const arr = [...reactions[event.emoji]];
            const idx = arr.indexOf(event.userId);
            if (event.added && idx === -1) arr.push(event.userId);
            else if (!event.added && idx !== -1) arr.splice(idx, 1);
            if (arr.length === 0) delete reactions[event.emoji];
            else reactions[event.emoji] = arr;
            return { ...m, reactions };
          }),
        },
      };
    });
  },

  handleReadReceipt: (event) => {
    set((s) => {
      const msgs = s.messages[event.roomId];
      if (!msgs) return {};
      return {
        messages: {
          ...s.messages,
          [event.roomId]: msgs.map((m) => {
            if (m.id !== event.messageId) return m;
            const readBy = [...(m.readBy ?? [])];
            if (!readBy.includes(event.userId)) readBy.push(event.userId);
            return { ...m, readBy };
          }),
        },
      };
    });
  },

  handlePresence: (event) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === event.roomId
          ? {
              ...r,
              participants: r.participants.map((u) =>
                u.id === event.userId
                  ? { ...u, activeFile: event.activeFile, activeLine: event.activeLine }
                  : u,
              ),
            }
          : r,
      ),
    }));
  },

  handleJoinRequest: (event) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === event.roomId
          ? { ...r, pendingJoins: [...(r.pendingJoins ?? []), event.request] }
          : r,
      ),
    }));
  },

  handleMessageEdited: (event) => {
    set((s) => {
      const msgs = s.messages[event.roomId];
      if (!msgs) return {};
      return {
        messages: {
          ...s.messages,
          [event.roomId]: msgs.map((m) =>
            m.id === event.messageId ? { ...m, content: event.newContent, edited: true } : m,
          ),
        },
      };
    });
  },

  handleMessageDeleted: (event) => {
    set((s) => {
      const msgs = s.messages[event.roomId];
      if (!msgs) return {};
      return {
        messages: {
          ...s.messages,
          [event.roomId]: msgs.filter((m) => m.id !== event.messageId),
        },
      };
    });
  },
}),
{
  name: 'hypothesis-chat-store',
  partialize: (state) => ({
    rooms: state.rooms,
    messages: state.messages,
    selectedRoomId: state.selectedRoomId,
    tunnelStatuses: state.tunnelStatuses,
  }),
}));
