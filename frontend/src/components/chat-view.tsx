"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Eye, FileText, ImageIcon, Mic, MoreVertical, Paperclip, Pause,
  Phone, Pin, Play, Plus, Search, Send, Share2, Smile, Video, X,
} from "lucide-react";
import { crmApi, type ApiChatMessage, type ApiChatThread, type ApiChatUser } from "@/lib/api";
import { Avatar, Badge, Button, PageHeader } from "./ui";

type Thread = { id: string; name: string; type: "GROUP" | "PRIVATE"; latest: string; time?: string };
type Message = { id: string; body: string; cardType: "NONE" | "CLIENT_CARD" | "IMAGE" | "DOC" | "VOICE"; sender: string; createdAt: string; metadata?: Record<string, string> };
type User = { id: string; name: string; role: string; active: boolean };

const emojiChoices = [":)", ":D", "OK", "Done", "Thanks", "Need review"];

function avatarTone(index: number) {
  return ["blue", "rose", "green", "amber", "avatar-violet"][index % 5];
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

function threadFromApi(row: ApiChatThread): Thread {
  return {
    id: row._id ?? row.id ?? "",
    name: row.name,
    type: row.type,
    latest: row.latest || "No messages yet",
    time: formatTime(row.lastMessageAt),
  };
}

function messageFromApi(row: ApiChatMessage): Message {
  const sender = typeof row.sender === "object" ? row.sender.name ?? "User" : "User";
  return {
    id: row._id ?? row.id ?? "",
    body: row.body,
    cardType: row.cardType,
    sender,
    createdAt: formatTime(row.createdAt) || "Now",
    metadata: row.metadata,
  };
}

function userFromApi(row: ApiChatUser): User {
  return { id: row._id ?? row.id ?? "", name: row.name, role: row.role.replaceAll("_", " "), active: row.active };
}

export function ChatView() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [active, setActive] = useState("");
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({});
  const [filter, setFilter] = useState<"All" | "Private" | "Groups">("All");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<"Media" | "Link" | "Docs">("Media");
  const [playing, setPlaying] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const activeThread = threads.find((thread) => thread.id === active) ?? { id: "", name: "No chat selected", type: "GROUP" as const, latest: "" };
  const messages = active ? messagesByThread[active] ?? [] : [];
  const activeUsers = users.filter((user) => user.active);
  const sharedMedia = messages.filter((message) => message.cardType === "IMAGE" || message.cardType === "DOC");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([crmApi.chatUsers(), crmApi.chatThreads()]).then(async ([apiUsers, apiThreads]) => {
      if (cancelled) return;
      const nextThreads = apiThreads.map(threadFromApi).filter((thread) => thread.id);
      setUsers(apiUsers.map(userFromApi).filter((user) => user.id));
      setThreads(nextThreads);
      const first = nextThreads[0]?.id ?? "";
      setActive(first);
      if (first) {
        const messages = await crmApi.chatMessages(first);
        if (!cancelled) setMessagesByThread({ [first]: messages.map(messageFromApi) });
      }
    }).catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load chat"));
    return () => { cancelled = true; };
  }, []);

  const visibleThreads = useMemo(() => threads.filter((thread) => {
    const text = `${thread.name} ${thread.latest}`.toLowerCase();
    return (filter === "All" || (filter === "Groups" ? thread.type === "GROUP" : thread.type === "PRIVATE")) && text.includes(query.toLowerCase());
  }), [filter, query, threads]);

  async function openThread(id: string) {
    setActive(id);
    if (!messagesByThread[id]) {
      setMessagesByThread((current) => ({ ...current, [id]: [] }));
      setMessagesByThread((current) => ({ ...current, [id]: current[id] ?? [] }));
      const rows = await crmApi.chatMessages(id);
      setMessagesByThread((current) => ({ ...current, [id]: rows.map(messageFromApi) }));
    }
  }

  async function openPrivate(user: User) {
    const existing = threads.find((thread) => thread.type === "PRIVATE" && thread.name === user.name);
    const thread = existing ?? threadFromApi(await crmApi.createChatThread({ name: user.name, type: "PRIVATE", members: [user.id] }));
    if (!existing) setThreads((current) => [thread, ...current]);
    await openThread(thread.id);
    setNewOpen(false);
  }

  async function addMessage(cardType: Message["cardType"], body: string, metadata?: Record<string, string>) {
    if (!active) return;
    const saved = messageFromApi(await crmApi.sendChatMessage(active, { body, cardType, metadata }));
    setMessagesByThread((current) => ({ ...current, [active]: [...(current[active] ?? []), saved] }));
    setThreads((current) => current.map((thread) => thread.id === active ? { ...thread, latest: body, time: "Now" } : thread));
    setToolsOpen(false);
  }

  function addFile(file: File, forcedType?: "IMAGE" | "DOC") {
    const isImage = forcedType === "IMAGE" || file.type.startsWith("image/");
    void addMessage(isImage ? "IMAGE" : "DOC", file.name, { fileName: file.name, mimeType: file.type || "file" });
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void addMessage("VOICE", "Voice note", { fileName: `voice-${Date.now()}.webm`, mimeType: "audio/webm" });
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setNotice("Recording voice");
    } catch {
      setNotice("Mic permission needed");
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !active) return;
    await addMessage("NONE", body);
    setDraft("");
  }

  function handlePaste(event: React.ClipboardEvent<HTMLFormElement>) {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    addFile(file, "IMAGE");
    setNotice("Pasted screenshot attached");
  }

  function viewMessage(message: Message) {
    setNotice(message.metadata?.fileName ? `Preview: ${message.metadata.fileName}` : "Preview opened");
  }

  function downloadMessage(message: Message) {
    setNotice(message.metadata?.fileName ? `Download requested: ${message.metadata.fileName}` : "Download requested");
  }

  return <>
    <PageHeader eyebrow="Internal chat" title="Team chat" description="Standing CST groups with structured client-event cards." />
    <div className={`chat-shell ${detailOpen || mediaOpen ? "with-side" : ""}`}>
      <aside className="chat-sidebar">
        <div className="chat-profile">
          <Avatar name="Team chat" tone="avatar-violet" />
          <div><strong>Team chat</strong><span>CST command</span></div>
          <button type="button" className="icon-button" onClick={() => setNewOpen((value) => !value)} aria-label="New chat"><Plus size={16} /></button>
          {newOpen && <div className="chat-popover new-chat-menu">{activeUsers.map((user) => <button key={user.id} type="button" onClick={() => openPrivate(user)}><Avatar name={user.name} tone="blue" /><span>{user.name}</span><small>{user.role}</small></button>)}</div>}
        </div>
        <label className="chat-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats..." /></label>
        <div className="chat-filter-tabs">{(["All", "Private", "Groups"] as const).map((tab) => <button key={tab} type="button" className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>{tab}</button>)}</div>
        <div className="chat-thread-list">
          <div className="chat-pinned"><span>Pinned Message</span><Pin size={12} /></div>
          {visibleThreads.map((thread, index) => <button key={thread.id} type="button" onClick={() => openThread(thread.id)} className={active === thread.id ? "active" : ""}>
            <Avatar name={thread.type === "GROUP" ? "Group" : thread.name} tone={avatarTone(index)} />
            <span><strong>{thread.name}</strong><small>{thread.latest}</small></span>
            <em>{thread.time}</em>
          </button>)}
          {!visibleThreads.length && <div className="chat-empty">No chats found</div>}
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <Avatar name={activeThread.type === "GROUP" ? "Group" : activeThread.name} tone="rose" />
          <div><h2>{activeThread.name}</h2><p>In-app only</p></div>
          {notice && <span>{notice}</span>}
          <button type="button" className="icon-button" onClick={() => setNotice("Video call queued")} aria-label="Video call"><Video size={16} /></button>
          <button type="button" className="icon-button" onClick={() => setNotice("Voice call queued")} aria-label="Voice call"><Phone size={16} /></button>
          <button type="button" className="icon-button" onClick={() => setMoreOpen((value) => !value)} aria-label="More"><MoreVertical size={16} /></button>
          {moreOpen && <div className="chat-popover more-menu"><button type="button" onClick={() => { setDetailOpen(true); setMoreOpen(false); }}>Open detail</button><button type="button" onClick={() => { setMediaOpen(true); setMoreOpen(false); }}>Open media</button></div>}
        </header>
        <div className="chat-messages">
          <div className="chat-day">Today</div>
          {messages.map((message, index) => {
            const mine = message.sender === "You";
            const media = message.cardType === "IMAGE" || message.cardType === "DOC";
            return <div key={message.id} className={`chat-message ${mine ? "mine" : ""}`}>
              {!mine && <Avatar name={message.sender} tone={avatarTone(index)} />}
              <div>
                <div className="chat-message-meta"><span>{message.sender}</span><span>{message.createdAt}</span></div>
                {message.cardType === "VOICE" ? <div className="chat-voice"><Button type="button" variant="secondary" onClick={() => setPlaying(playing === message.id ? null : message.id)}>{playing === message.id ? <Pause size={15} /> : <Play size={15} />}</Button><i /></div>
                  : media ? <div className="chat-media-card">{message.cardType === "IMAGE" ? <span className="chat-media-preview" aria-label={message.metadata?.fileName || "Shared image"} /> : <div><FileText size={38} /><strong>{message.metadata?.fileName || "Document"}</strong></div>}<div><button type="button" onClick={() => viewMessage(message)}><Eye size={15} />View</button><button type="button" onClick={() => downloadMessage(message)}><Download size={15} />Download</button><button type="button" onClick={() => setShareFor(shareFor === message.id ? null : message.id)}><Share2 size={15} />Share</button></div>{shareFor === message.id && <div className="chat-share-menu">{activeUsers.map((user) => <button key={user.id} type="button" onClick={() => { openPrivate(user); setNotice(`Shared with ${user.name}`); setShareFor(null); }}>{user.name}</button>)}</div>}</div>
                  : message.cardType === "CLIENT_CARD" ? <div className="chat-client-card"><div><strong>{message.metadata?.event}</strong><Badge tone={message.metadata?.badge === "Non-active" ? "neutral" : "info"}>{message.metadata?.badge}</Badge></div><dl><div><dt>Client</dt><dd>{message.metadata?.client}</dd></div><div><dt>Handler</dt><dd>{message.metadata?.handler}</dd></div>{message.metadata?.fromStatus && <div><dt>From</dt><dd>{message.metadata.fromStatus}</dd></div>}{message.metadata?.toStatus && <div><dt>To</dt><dd>{message.metadata.toStatus}</dd></div>}<div><dt>Update</dt><dd>{message.body}</dd></div></dl>{message.metadata?.detailUrl && <Link className="chat-card-link" href={message.metadata.detailUrl}><Eye size={14} />{message.metadata.actionLabel || "View detail"}</Link>}</div>
                  : <p className={`chat-bubble ${mine ? "mine" : ""}`}>{message.body}</p>}
              </div>
              {mine && <MoreVertical className="chat-message-more" size={15} />}
            </div>;
          })}
          {!messages.length && <div className="chat-empty">No messages found</div>}
        </div>
        <form onSubmit={send} onPaste={handlePaste} className="chat-compose">
          <button type="button" className="icon-button" onClick={() => setEmojiOpen((value) => !value)} aria-label="Emoji"><Smile size={16} /></button>
          {emojiOpen && <div className="chat-popover emoji-menu">{emojiChoices.map((emoji) => <button key={emoji} type="button" onClick={() => setDraft((value) => `${value}${value ? " " : ""}${emoji}`)}>{emoji}</button>)}</div>}
          <input name="body" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={active ? "Write a message..." : "Select or create a chat"} disabled={!active} />
          <button type="button" className="icon-button circle" onClick={() => setToolsOpen((value) => !value)} aria-label="Chat tools" disabled={!active}><Plus size={16} /></button>
          <Button type="submit" className="circle" disabled={!active}><Send size={16} /></Button>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) addFile(file, "IMAGE"); event.currentTarget.value = ""; }} />
          <input ref={fileInputRef} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) addFile(file, "DOC"); event.currentTarget.value = ""; }} />
          {toolsOpen && <div className="chat-popover tools-menu"><button type="button" onClick={toggleRecording}>{recording ? <Pause size={15} /> : <Mic size={15} />}{recording ? "Stop voice" : "Voice"}</button><button type="button" onClick={() => fileInputRef.current?.click()}><Paperclip size={15} />File</button><button type="button" onClick={() => imageInputRef.current?.click()}><ImageIcon size={15} />Image</button></div>}
        </form>
      </section>

      {(detailOpen || mediaOpen) && <aside className="chat-side">
        {detailOpen && <section className="chat-side-card"><div><strong>Detail group</strong><button type="button" className="icon-button" onClick={() => setDetailOpen(false)} aria-label="Close detail"><X size={16} /></button></div><div className="chat-group-detail"><Avatar name={activeThread.name} tone="rose" /><h2>{activeThread.name}</h2><Badge tone="neutral">{activeThread.type}</Badge></div><p>CST chat keeps team discussion synced to the backend.</p><button type="button" onClick={() => setMembersOpen(true)}><span>Members</span><Badge tone="info">{activeUsers.length}</Badge></button></section>}
        {mediaOpen && <section className="chat-side-card"><div><strong>Media</strong><button type="button" className="icon-button" onClick={() => setMediaOpen(false)} aria-label="Close media"><X size={16} /></button></div><div className="chat-media-tabs">{(["Media", "Link", "Docs"] as const).map((tab) => <button key={tab} type="button" className={mediaTab === tab ? "active" : ""} onClick={() => setMediaTab(tab)}>{tab}</button>)}</div><div className="chat-link-list">{sharedMedia.length ? sharedMedia.map((item) => <div key={item.id}>{item.metadata?.fileName ?? item.body}</div>) : <div>No shared files found</div>}</div></section>}
      </aside>}
    </div>
    {membersOpen && <div className="chat-members-backdrop"><section><div><strong>Members</strong><button type="button" className="icon-button" onClick={() => setMembersOpen(false)} aria-label="Close members"><X size={16} /></button></div>{activeUsers.map((user) => <button key={user.id} type="button" onClick={() => openPrivate(user)}><Avatar name={user.name} tone="blue" /><span>{user.name}</span><small>{user.role}</small></button>)}</section></div>}
  </>;
}
