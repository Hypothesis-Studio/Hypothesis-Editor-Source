/**
 * Chat Store - Zustand state management for Realtime Chat Collaboration.
 */
import { create } from 'zustand';
import type {
  ChatRoom,
  ChatMessage,
  ChatUser,
  ChatCreateOptions,
  ChatJoinOptions,
  ChatRoomStatusEvent,
  ChatMessageEvent,
  ChatUserJoinedEvent,
  ChatUserLeftEvent,
  ChatRoomClosedEvent,
} from '../../shared/types/chat';

// ─── UI state ────────────────────────────────────────────────────────────────

export type HostingMode = 'local' | 'public';

interface ChatState {
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>; // roomId → messages
  selectedRoomId: string | null;
  isLoading: boolean;

  // Sidebar panel: 'create' | 'join' | null (collapsed)
  sidebarPanel: 'create' | 'join' | null;

  // Create form
  createName: string;
  createUserName: string;
  createPort: string;
  createOpenJoin: boolean;
  hostingMode: HostingMode;
  createSubdomain: string;

  // Join form
  joinUrl: string;
  joinUserName: string;

  // Compose
  draftMessages: Record<string, string>; // roomId → draft

  // Tunnel status for public hosting
  pendingTunnelRoomId: string | null;

  // Actions
  setSidebarPanel: (v: 'create' | 'join' | null) => void;
  setCreateName: (v: string) => void;
  setCreateUserName: (v: string) => void;
  setCreatePort: (v: string) => void;
  setCreateOpenJoin: (v: boolean) => void;
  setHostingMode: (v: HostingMode) => void;
  setCreateSubdomain: (v: string) => void;
  setJoinUrl: (v: string) => void;
  setJoinUserName: (v: string) => void;
  setDraft: (roomId: string, v: string) => void;
  clearMessages: (roomId: string) => void;
  setSelectedRoom: (id: string | null) => void;

  loadRooms: () => Promise<void>;
  createRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
  leaveRoom: (id: string) => Promise<void>;
  closeRoom: (id: string) => Promise<void>;
  sendMessage: (roomId: string, content: string) => Promise<void>;
  copyUrl: (roomId: string) => Promise<void>;
  findFreePort: () => Promise<number>;

  kickUser: (roomId: string, userId: string) => Promise<void>;

  // IPC event handlers
  handleUserJoined: (event: ChatUserJoinedEvent) => void;
  handleUserLeft: (event: ChatUserLeftEvent) => void;
  handleStatus: (event: ChatRoomStatusEvent & { participants?: ChatUser[]; name?: string }) => void;
  handleRoomClosed: (event: ChatRoomClosedEvent) => void;
}

const MAX_MESSAGES = 200;

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  messages: {},
  selectedRoomId: null,
  isLoading: false,
  sidebarPanel: null,

  createName: '',
  createUserName: '',
  createPort: '',
  createOpenJoin: true,
  hostingMode: 'local',
  createSubdomain: '',

  joinUrl: '',
  joinUserName: '',
  draftMessages: {},
  pendingTunnelRoomId: null,

  // ── Setters ───────────────────────────────────────────────────────────────

  setSidebarPanel: (v) => set({ sidebarPanel: v }),
  setCreateName: (v) => set({ createName: v }),
  setCreateUserName: (v) => set({ createUserName: v }),
  setCreatePort: (v) => set({ createPort: v }),
  setCreateOpenJoin: (v) => set({ createOpenJoin: v }),
  setHostingMode: (v) => set({ hostingMode: v }),
  setCreateSubdomain: (v) => set({ createSubdomain: v }),
  setJoinUrl: (v) => set({ joinUrl: v }),
  setJoinUserName: (v) => set({ joinUserName: v }),
  setDraft: (roomId, v) =>
    set((s) => ({ draftMessages: { ...s.draftMessages, [roomId]: v } })),
  clearMessages: (roomId) =>
    set((s) => ({ messages: { ...s.messages, [roomId]: [] } })),
  setSelectedRoom: (id) => set({ selectedRoomId: id }),

  // ── Async actions ─────────────────────────────────────────────────────────

  loadRooms: async () => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const result = await api.chat.list();
    if (result?.rooms) set({ rooms: result.rooms });
  },

  createRoom: async () => {
    const api = (window as any).api;
    if (!api?.chat) return;
    const { createName, createUserName, createPort, createOpenJoin, hostingMode, createSubdomain } = get();
    if (!createName.trim() || !createUserName.trim()) return;

    set({ isLoading: true });
    try {
      // Step 1: create the WS room
      const port = createPort ? parseInt(createPort, 10) : undefined;
      const options: ChatCreateOptions = {
        name: createName.trim(),
        userName: createUserName.trim(),
        localPort: port,
        openJoin: true,
        tunnelId: null,
      };
      const result = await api.chat.create(options);
      if (!result?.success || !result.room) return;

      const room: ChatRoom = result.room;
      set((s) => ({
        rooms: [...s.rooms, room],
        messages: { ...s.messages, [room.id]: [] },
        selectedRoomId: room.id,
        sidebarPanel: null,
        createName: '',
        createPort: '',
        isLoading: false,
      }));

      // Step 2: if public mode, open tunnel NON-BLOCKING (room usable immediately)
      if (hostingMode === 'public' && api.tunnel) {
        set({ pendingTunnelRoomId: room.id });
        const subdomain = createSubdomain.trim() || undefined;
        // fire-and-forget: don't await, room is already open for local use
        api.tunnel.open({
          localPort: room.localPort,
          label: `Chat: ${room.name}`,
          subdomain,
          autoReconnect: true,
        }).then((tunnelResult: any) => {
          if (tunnelResult?.success && tunnelResult.tunnel) {
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
              }));
            }
          } else {
            set({ pendingTunnelRoomId: null });
          }
        }).catch(() => set({ pendingTunnelRoomId: null }));
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
      const result = await api.chat.join({ url: joinUrl.trim(), userName: joinUserName.trim() });
      if (result?.success && result.room) {
        set((s) => ({
          rooms: [...s.rooms, result.room],
          messages: { ...s.messages, [result.room.id]: result.room.messages ?? [] },
          selectedRoomId: result.room.id,
          sidebarPanel: null,
          joinUrl: '',
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
    // Also close the associated tunnel if public
    if (room?.tunnelId && api.tunnel) {
      await api.tunnel.close(room.tunnelId).catch(() => {});
    }
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== id),
      selectedRoomId: s.selectedRoomId === id ? null : s.selectedRoomId,
    }));
  },

  sendMessage: async (roomId, content) => {
    const api = (window as any).api;
    if (!api?.chat || !content.trim()) return;
    set((s) => ({ draftMessages: { ...s.draftMessages, [roomId]: '' } }));
    await api.chat.send(roomId, content.trim());
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

  // ── IPC event handlers ────────────────────────────────────────────────────

  handleMessage: (event) => {
    set((s) => {
      const prev = s.messages[event.roomId] ?? [];
      const next = [...prev, event.message].slice(-MAX_MESSAGES);
      return { messages: { ...s.messages, [event.roomId]: next } };
    });
  },

  handleUserJoined: (event) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === event.roomId
          ? {
              ...r,
              participants: r.participants.find((u) => u.id === event.user.id)
                ? r.participants
                : [...r.participants, event.user],
            }
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
              publicUrl: event.publicUrl ?? r.publicUrl,
              error: event.error ?? r.error,
              participants: event.participants ?? r.participants,
              name: event.name ?? r.name,
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
}));
