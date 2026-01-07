'use client';

import { useState, useEffect, useRef } from 'react';
import { useRole } from '@/context/RoleContext';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  getFirestore
} from 'firebase/firestore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Loader2, Send, Shield, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { Badge } from '../ui/badge';
import type { FormaAfriqueUser, UserRole } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt?: any;
}

interface ParticipantDetails {
    fullName: string;
    profilePictureURL?: string;
    role: UserRole;
}

export function ChatRoom({ chatId }: { chatId: string }) {
  const { user } = useRole();
  const db = getFirestore();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<ParticipantDetails | null>(null);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);


  // Fetch chat details, listen for messages, and mark as read
  useEffect(() => {
    if (!chatId || !user) return;
    setIsLoading(true);

    const chatDocRef = doc(db, "chats", chatId);

    const markAsRead = async () => {
        try {
            const chatDoc = await getDoc(chatDocRef);
            if (chatDoc.exists()) {
                const data = chatDoc.data();
                const unreadBy = data.unreadBy || [];
                if (unreadBy.includes(user.uid)) {
                    const batch = writeBatch(db);
                    batch.update(chatDocRef, {
                        unreadBy: unreadBy.filter((uid: string) => uid !== user.uid)
                    });
                    await batch.commit();
                }
            }
        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: chatDocRef.path,
                operation: 'update',
                requestResourceData: { unreadBy: [] }
            }));
        }
    };
    markAsRead();

    // Fetch details of the other participant
    getDoc(chatDocRef).then(async (chatDoc) => {
        if(chatDoc.exists()) {
            const participants = chatDoc.data().participants as string[];
            const otherId = participants.find(p => p !== user.uid);
            if(otherId) {
                setOtherParticipantId(otherId);
                const userDocRef = doc(db, 'users', otherId);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setOtherParticipant(userDoc.data() as ParticipantDetails);
                }
            }
        }
    });

    // Listen for new messages
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(docs);
      setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `chats/${chatId}/messages`,
            operation: 'list'
        }));
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, user, db]);

  // Auto-scroll to the bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // Send a message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !otherParticipantId) return;
    
    const textToSend = newMessage.trim();
    setNewMessage("");
    
    const chatDocRef = doc(db, "chats", chatId);
    const messageDocRef = doc(collection(chatDocRef, "messages"));

    try {
        const batch = writeBatch(db);
        
        batch.set(messageDocRef, {
            text: textToSend,
            senderId: user.uid,
            createdAt: serverTimestamp(),
        });
        
        batch.update(chatDocRef, {
            lastMessage: textToSend,
            updatedAt: serverTimestamp(),
            lastSenderId: user.uid,
            unreadBy: [otherParticipantId]
        });

        await batch.commit();

    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: chatDocRef.path,
        operation: 'write'
      }));
    }
  };
  
  const RoleBadge = ({ role }: { role: UserRole | undefined }) => {
    if (!role || role === 'student') return null;

    const styles = {
        admin: 'bg-destructive text-destructive-foreground',
        instructor: 'bg-blue-600 text-white',
    };

    return (
        <Badge className={cn('ml-2 capitalize text-xs', styles[role])}>
            <Shield className="h-3 w-3 mr-1"/>
            {role}
        </Badge>
    );
};

  if (isLoading) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-slate-100">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100">
        <header className="flex items-center p-3 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push('/messages')}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
                <AvatarImage src={otherParticipant?.profilePictureURL} />
                <AvatarFallback>{otherParticipant?.fullName?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
                <h2 className="font-bold text-base flex items-center">
                    {otherParticipant?.fullName || "Utilisateur"}
                    <RoleBadge role={otherParticipant?.role} />
                </h2>
            </div>
        </header>

        <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6 space-y-4">
                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    return (
                        <div 
                            key={msg.id} 
                            className={cn("flex items-end gap-2 max-w-[85%]", isMe ? "ml-auto" : "mr-auto")}
                        >
                            <div className={cn(
                                "rounded-xl px-3 py-2 text-[15px] shadow-sm",
                                isMe 
                                    ? "bg-[#dcf8c6] text-slate-900 rounded-br-none" 
                                    : "bg-white text-slate-900 rounded-bl-none"
                            )}>
                                {msg.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>

        <div className="p-2 border-t bg-white/80 backdrop-blur-sm sticky bottom-0">
            <form onSubmit={handleSend} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre message..."
                    className="flex-1 h-11 rounded-full bg-white border-slate-300 focus-visible:ring-primary text-base"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()} className="shrink-0 h-11 w-11 rounded-full bg-primary hover:bg-primary/90">
                    <Send className="h-5 w-5" />
                    <span className="sr-only">Envoyer</span>
                </Button>
            </form>
        </div>
    </div>
  );
}
