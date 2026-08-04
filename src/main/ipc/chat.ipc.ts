/**
 * Chat IPC Handlers - Registers all chat collaboration IPC channels.
 */
import { ipcMain } from 'electron';
import type { ChatService } from '../services/chat/ChatService';
import type { ChatCreateOptions, ChatJoinOptions } from '../../shared/types/chat';
import { CHAT_IPC } from '../../shared/types/chat';

export function registerChatIPC(chatService: ChatService): void {
  ipcMain.handle(CHAT_IPC.CREATE, async (_e, options: ChatCreateOptions) => {
    try { return { success: true, room: await chatService.create(options) }; }
    catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.JOIN, async (_e, options: ChatJoinOptions) => {
    try { return { success: true, room: await chatService.join(options) }; }
    catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.LEAVE, async (_e, roomId: string) => {
    try { await chatService.leave(roomId); return { success: true }; }
    catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.CLOSE, async (_e, roomId: string) => {
    try { await chatService.close(roomId); return { success: true }; }
    catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.LIST, () => ({ rooms: chatService.list() }));

  ipcMain.handle(CHAT_IPC.GET, (_e, roomId: string) => ({ room: chatService.get(roomId) }));

  ipcMain.handle(CHAT_IPC.SEND, (_e, roomId: string, content: string, replyToId?: string) => {
    try {
      const message = chatService.sendMessage(roomId, content, replyToId);
      return { success: message !== null, message };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.SEND_CODE, (_e, roomId: string, code: string, language: string, replyToId?: string) => {
    try {
      const message = chatService.sendCode(roomId, code, language, replyToId);
      return { success: message !== null, message };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.SEND_FILE, (_e, roomId: string, fileName: string, fileData: string, fileMimeType: string) => {
    try {
      const message = chatService.sendFile(roomId, fileName, fileData, fileMimeType);
      if (!message) return { success: false, error: 'File too large or invalid (max 2 MB).' };
      return { success: true, message };
    } catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.EDIT_MESSAGE, (_e, roomId: string, messageId: string, newContent: string, senderId: string) => {
    return { success: chatService.editMessage(roomId, messageId, newContent, senderId) };
  });

  ipcMain.handle(CHAT_IPC.DELETE_MESSAGE, (_e, roomId: string, messageId: string, senderId: string) => {
    return { success: chatService.deleteMessage(roomId, messageId, senderId) };
  });

  ipcMain.handle(CHAT_IPC.UPDATE_NAME, (_e, roomId: string, name: string) => {
    const room = chatService.updateName(roomId, name);
    return { success: room !== null, room };
  });

  ipcMain.handle(CHAT_IPC.COPY_URL, (_e, roomId: string) => ({
    success: chatService.copyUrl(roomId),
  }));

  ipcMain.handle(CHAT_IPC.FIND_FREE_PORT, async (_e, preferred?: number) => {
    try { return { success: true, port: await chatService.findFreePort(preferred ?? 4900) }; }
    catch (err) { return { success: false, error: (err as Error).message }; }
  });

  ipcMain.handle(CHAT_IPC.UPDATE_PUBLIC_URL, (_e, roomId: string, publicUrl: string, tunnelId: string) => {
    chatService.setPublicUrl(roomId, publicUrl, tunnelId);
    return { success: true };
  });

  ipcMain.handle(CHAT_IPC.KICK, (_e, roomId: string, userId: string) => ({
    success: chatService.kick(roomId, userId),
  }));

  ipcMain.handle(CHAT_IPC.TYPING, (_e, roomId: string, userId: string, userName: string, isTyping: boolean) => {
    chatService.sendTyping(roomId, userId, userName, isTyping);
    return { success: true };
  });

  ipcMain.handle(CHAT_IPC.REACT, (_e, roomId: string, messageId: string, emoji: string, userId: string, userName: string) => ({
    success: chatService.addReaction(roomId, messageId, emoji, userId, userName),
  }));

  ipcMain.handle(CHAT_IPC.READ, (_e, roomId: string, messageId: string, userId: string) => {
    chatService.markRead(roomId, messageId, userId);
    return { success: true };
  });

  ipcMain.handle(CHAT_IPC.PRESENCE, (_e, roomId: string, userId: string, activeFile?: string, activeLine?: number) => {
    chatService.sendPresence(roomId, userId, activeFile, activeLine);
    return { success: true };
  });

  ipcMain.handle(CHAT_IPC.APPROVE_JOIN, (_e, roomId: string, requestId: string) => {
    chatService.approveJoin(roomId, requestId);
    return { success: true };
  });

  ipcMain.handle(CHAT_IPC.DENY_JOIN, (_e, roomId: string, requestId: string) => {
    chatService.denyJoin(roomId, requestId);
    return { success: true };
  });

  ipcMain.handle(CHAT_IPC.TOGGLE_AI, (_e, roomId: string, enabled: boolean, agentId?: string) => {
    const room = chatService.toggleAi(roomId, enabled, agentId);
    return { success: room !== null, room };
  });
}
