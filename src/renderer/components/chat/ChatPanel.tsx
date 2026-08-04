/**
 * ChatPanel - WhatsApp Web-style layout: sidebar + main chat area.
 */
import React, { useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { ChatSidebar } from './ChatSidebar';
import { ChatRoomView } from './ChatRoom';
import type {
  ChatMessageEvent,
  ChatUserJoinedEvent,
  ChatUserLeftEvent,
  ChatRoomStatusEvent,
  ChatRoomClosedEvent,
  ChatTypingEvent,
  ChatReactionEvent,
  ChatReadReceiptEvent,
  ChatPresenceEvent,
  ChatJoinRequestEvent,
  ChatMessageEditedEvent,
  ChatMessageDeletedEvent,
} from '../../../shared/types/chat';

export const ChatPanel: React.FC = () => {
  const {
    selectedRoomId,
    loadRooms,
    handleMessage,
    handleUserJoined,
    handleUserLeft,
    handleStatus,
    handleRoomClosed,
    handleTyping,
    handleReaction,
    handleReadReceipt,
    handlePresence,
    handleJoinRequest,
    handleMessageEdited,
    handleMessageDeleted,
    handleTunnelStatus,
  } = useChatStore();

  useEffect(() => {
    loadRooms();
    const api = (window as any).api;
    if (!api?.chat) return;
    const unsubs: Array<(() => void) | undefined> = [
      api.chat.onMessage?.((evt: ChatMessageEvent) => handleMessage(evt)),
      api.chat.onUserJoined?.((evt: ChatUserJoinedEvent) => handleUserJoined(evt)),
      api.chat.onUserLeft?.((evt: ChatUserLeftEvent) => handleUserLeft(evt)),
      api.chat.onStatus?.((evt: ChatRoomStatusEvent & { participants?: any[]; name?: string; pendingJoins?: any[]; aiEnabled?: boolean }) => handleStatus(evt)),
      api.chat.onRoomClosed?.((evt: ChatRoomClosedEvent) => handleRoomClosed(evt)),
      api.chat.onTyping?.((evt: ChatTypingEvent) => handleTyping(evt)),
      api.chat.onReaction?.((evt: ChatReactionEvent) => handleReaction(evt)),
      api.chat.onRead?.((evt: ChatReadReceiptEvent) => handleReadReceipt(evt)),
      api.chat.onPresence?.((evt: ChatPresenceEvent) => handlePresence(evt)),
      api.chat.onJoinRequest?.((evt: ChatJoinRequestEvent) => handleJoinRequest(evt)),
      api.chat.onMessageEdited?.((evt: ChatMessageEditedEvent) => handleMessageEdited(evt)),
      api.chat.onMessageDeleted?.((evt: ChatMessageDeletedEvent) => handleMessageDeleted(evt)),
      api.tunnel?.onStatusChanged?.((evt: any) => handleTunnelStatus(evt)),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--theme-bg)', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <ChatSidebar />

      {/* Right main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--theme-border)' }}>
        {selectedRoomId ? (
          <ChatRoomView roomId={selectedRoomId} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    color: 'var(--theme-fg-muted)',
    padding: 32,
    textAlign: 'center',
  }}>
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.25}>
      <rect x="6" y="10" width="40" height="30" rx="6" />
      <path d="M14 40v10l8-6h18a6 6 0 006-6V28" />
      <path d="M18 22h20M18 30h12" />
    </svg>
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Select a room to start chatting</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Host a new room or join one from the sidebar</div>
    </div>
  </div>
);
