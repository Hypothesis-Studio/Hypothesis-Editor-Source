/**
 * Chat IPC Handlers - Registers all chat collaboration IPC channels.
 */
import { ipcMain } from 'electron';
import type { ChatService } from '../services/chat/ChatService';
import type { ChatCreateOptions, ChatJoinOptions } from '../../shared/types/chat';
import { CHAT_IPC } from '../../shared/types/chat';

export function registerChatIPC(chatService: ChatService): void {
  // Create / host a new room
  ipcMain.handle(CHAT_IPC.CREATE, async (_event, options: ChatCreateOptions) => {
    try {
      const room = await chatService.create(options);
      return { success: true, room };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Join an existing room via URL
  ipcMain.handle(CHAT_IPC.JOIN, async (_event, options: ChatJoinOptions) => {
    try {
      const room = await chatService.join(options);
      return { success: true, room };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Leave a room (guest side)
  ipcMain.handle(CHAT_IPC.LEAVE, async (_event, roomId: string) => {
    try {
      await chatService.leave(roomId);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Close a room (host side)
  ipcMain.handle(CHAT_IPC.CLOSE, async (_event, roomId: string) => {
    try {
      await chatService.close(roomId);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // List all rooms
  ipcMain.handle(CHAT_IPC.LIST, () => {
    return { rooms: chatService.list() };
  });

  // Get a single room
  ipcMain.handle(CHAT_IPC.GET, (_event, roomId: string) => {
    return { room: chatService.get(roomId) };
  });

  // Send a message
  ipcMain.handle(CHAT_IPC.SEND, (_event, roomId: string, content: string) => {
    try {
      const message = chatService.sendMessage(roomId, content);
      return { success: message !== null, message };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Update room name
  ipcMain.handle(CHAT_IPC.UPDATE_NAME, (_event, roomId: string, name: string) => {
    const room = chatService.updateName(roomId, name);
    return { success: room !== null, room };
  });

  // Copy room URL to clipboard
  ipcMain.handle(CHAT_IPC.COPY_URL, (_event, roomId: string) => {
    return { success: chatService.copyUrl(roomId) };
  });

  // Find a free port
  ipcMain.handle(CHAT_IPC.FIND_FREE_PORT, async (_event, preferred?: number) => {
    try {
      const port = await chatService.findFreePort(preferred ?? 4900);
      return { success: true, port };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Update public URL (called after tunnel opens)
  ipcMain.handle(CHAT_IPC.UPDATE_PUBLIC_URL, (_event, roomId: string, publicUrl: string, tunnelId: string) => {
    chatService.setPublicUrl(roomId, publicUrl, tunnelId);
    return { success: true };
  });

  // Kick a guest (host only)
  ipcMain.handle(CHAT_IPC.KICK, (_event, roomId: string, userId: string) => {
    return { success: chatService.kick(roomId, userId) };
  });
}
