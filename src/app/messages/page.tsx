
'use client';

import { useRole } from '@/context/RoleContext';
import {
  collection,
  query,
  where,
  getFirestore,
  orderBy,
  onSnapshot,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquareDashed, Search, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { usePathname, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type { FormaAfriqueUser } from '@/context/RoleContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatRoom } from '@/components/chat/ChatRoom';

// --- INTERFACES ---
interface Chat {
  id: string;
  participants: string[];
  participantDetails: Record<string, { fullName: string; profilePictureURL?: string; isOnline?: boolean }>;
  lastMessage?: string;
  updatedAt?: any;
  lastSenderId?: string;
  unreadBy?: string[];
}

// --- MAIN PAGE COMPONENT ---
export default function MessagesPage() {
  const { user, isUserLoading } = useRole();
  const pathname = usePathname();
  const db = getFirestore();
  const router = useRouter();
  const isMobile = useIsMobile();
  
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<FormaAfriqueUser[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  // This state is only relevant on desktop
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Listen for user's conversations in real-time
  useEffect(() => {
    if (!user?.uid) {
      if (!isUserLoading) setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(chatsQuery, async (querySnapshot) => {
        const rawChats = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const allParticipantIds = [...new Set(rawChats.flatMap(c => c.participants))];
        
        if (allParticipantIds.length === 0) {
            setChatList([]);
            setIsLoading(false);
            return;
        }

        const detailsMap: Record<string, any> = {};
        const usersRef = collection(db, 'users');

        for (let i = 0; i < allParticipantIds.length; i += 30) {
            const batchIds = allParticipantIds.slice(i, i + 30);
            if (batchIds.length === 0) continue;
            const q = query(usersRef, where('uid', 'in', batchIds));
            const snap = await getDocs(q);
            snap.forEach(d => detailsMap[d.data().uid] = d.data());
        }
      
        const populated = rawChats.map(chat => ({
            ...chat,
            participantDetails: chat.participants.reduce((acc: any, pid: string) => {
              acc[pid] = detailsMap[pid] || { fullName: "Utilisateur inconnu" };
              return acc;
            }, {})
        }));

        setChatList(populated);
        
        // On desktop, if no chat is selected, select the first one
        if (!isMobile && !activeChatId && populated.length > 0) {
          setActiveChatId(populated[0].id);
        }
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching chats:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, db, isUserLoading, isMobile, activeChatId]);
  
  // Fetch all students when opening the new chat modal
  useEffect(() => {
    if (isNewChatModalOpen && allStudents.length === 0) {
        const fetchStudents = async () => {
            const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            const snapshot = await getDocs(studentsQuery);
            const studentList = snapshot.docs.map(doc => doc.data() as FormaAfriqueUser);
            setAllStudents(studentList);
        };
        fetchStudents();
    }
  }, [isNewChatModalOpen, allStudents.length, db]);
  
  const handleStartChat = async (studentId: string) => {
    if (!user || user.uid === studentId) return;
    setIsCreatingChat(true);

    const chatsRef = collection(db, 'chats');
    const sortedParticipants = [user.uid, studentId].sort();
    
    const q = query(chatsRef, where('participants', '==', sortedParticipants));
    
    try {
        const querySnapshot = await getDocs(q);
        let chatId: string | null = null;
        if (!querySnapshot.empty) {
            chatId = querySnapshot.docs[0].id;
        } else {
            const newChatRef = doc(collection(db, 'chats'));
            await setDoc(newChatRef, {
                participants: sortedParticipants,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: `Conversation initiée.`,
            });
            chatId = newChatRef.id;
        }
        setIsNewChatModalOpen(false);
        if (isMobile) {
            router.push(`/messages/${chatId}`);
        } else {
            setActiveChatId(chatId);
        }
    } catch (error) {
        console.error("Error starting chat:", error);
    } finally {
        setIsCreatingChat(false);
    }
  };

  const filteredChatList = chatList.filter(chat => {
    const otherId = chat.participants.find(p => p !== user?.uid);
    const other = otherId ? chat.participantDetails[otherId] : null;
    return other?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  const filteredStudents = allStudents.filter(student => student.fullName.toLowerCase().includes(modalSearchTerm.toLowerCase()));

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Messages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  const currentChatId = pathname.split('/').pop();
  
  // On desktop, this component renders the split view
  if (!isMobile) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[400px_1fr] h-full">
            {/* Left Column: Chat List */}
            <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
                 <div className="p-4 border-b border-slate-800">
                    <h1 className="font-bold text-xl text-white">Messagerie</h1>
                     <div className="relative pt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Rechercher une discussion..."
                            className="pl-10 h-9 rounded-full bg-slate-800 border-slate-700 text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                     {filteredChatList.length > 0 ? (
                        <div className="space-y-0">
                            {filteredChatList.map(chat => {
                                const otherId = chat.participants.find(p => p !== user?.uid);
                                const other = otherId ? chat.participantDetails[otherId] : null;
                                const isUnread = chat.lastSenderId !== user?.uid && (chat.unreadBy ? chat.unreadBy.includes(user?.uid || '') : true);
                                const isActive = activeChatId === chat.id;

                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => setActiveChatId(chat.id)}
                                        className={cn(
                                            "w-full text-left p-3 flex items-center gap-4 transition-all border-b border-slate-800",
                                            isActive ? "bg-primary/10" : "hover:bg-slate-800/50"
                                        )}
                                    >
                                        <div className="relative">
                                            <Avatar className="h-12 w-12 border-2 border-slate-700">
                                                <AvatarImage src={other?.profilePictureURL} alt={other?.fullName}/>
                                                <AvatarFallback className="bg-slate-700 text-slate-300">{other?.fullName?.charAt(0) || '?'}</AvatarFallback>
                                            </Avatar>
                                            {other?.isOnline && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-slate-900" />}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-baseline">
                                                <p className={cn("truncate text-sm text-slate-200", isUnread ? "font-bold" : "font-semibold")}>
                                                {other?.fullName || "Utilisateur"}
                                                </p>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className={cn("text-sm truncate leading-relaxed", isUnread ? "font-medium text-slate-300" : "text-slate-400")}>
                                                    {chat.lastMessage || "Cliquez pour lire les messages"}
                                                </p>
                                                {isUnread && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"></div>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500 h-full flex flex-col justify-center items-center">
                            <MessageSquareDashed className="mx-auto mb-4 h-12 w-12 opacity-50" />
                            <h3 className="font-semibold text-lg">Aucune conversation</h3>
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t border-slate-800">
                    <Button variant="ghost" className="w-full" onClick={() => setIsNewChatModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle discussion
                    </Button>
                </div>
            </div>

            {/* Right Column: Active Chat */}
            <div className="h-full">
                {activeChatId ? <ChatRoom chatId={activeChatId} /> : (
                    <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500">
                        <MessageSquareDashed className="h-16 w-16 mb-4" />
                        <p>Sélectionnez une conversation pour commencer</p>
                    </div>
                )}
            </div>
             <Dialog open={isNewChatModalOpen} onOpenChange={setIsNewChatModalOpen}>
              <DialogContent className="dark:bg-slate-900 dark:border-slate-800">
                  <DialogHeader>
                      <DialogTitle>Démarrer une nouvelle discussion</DialogTitle>
                      <DialogDescription>Sélectionnez un étudiant pour commencer à discuter.</DialogDescription>
                  </DialogHeader>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                          placeholder="Rechercher un étudiant..." 
                          className="pl-10 dark:bg-slate-800 dark:border-slate-700" 
                          value={modalSearchTerm}
                          onChange={e => setModalSearchTerm(e.target.value)}
                      />
                  </div>
                  <ScrollArea className="h-72">
                      <div className="space-y-1 pr-4">
                          {filteredStudents.map(student => (
                              <button key={student.uid} onClick={() => handleStartChat(student.uid)} disabled={isCreatingChat} className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                                  <Avatar className="h-9 w-9">
                                      <AvatarImage src={student.profilePictureURL} />
                                      <AvatarFallback>{student.fullName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm">{student.fullName}</span>
                              </button>
                          ))}
                      </div>
                  </ScrollArea>
              </DialogContent>
            </Dialog>
        </div>
    );
  }

  // On mobile, this component renders just the list
  return (
    <>
    <Card className="dark:bg-slate-900 dark:border-slate-800 flex flex-col h-full">
        <CardHeader className="border-b dark:border-slate-800">
            <CardTitle className="dark:text-white">Messagerie</CardTitle>
             <div className="relative pt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Rechercher une discussion..."
                    className="pl-10 h-9 rounded-full bg-slate-800 border-slate-700 text-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
             <ScrollArea className="h-full">
                {filteredChatList.length > 0 ? (
                    <div className="space-y-0">
                        {filteredChatList.map(chat => {
                            const otherId = chat.participants.find(p => p !== user?.uid);
                            const other = otherId ? chat.participantDetails[otherId] : null;
                            const isUnread = chat.lastSenderId !== user?.uid && (chat.unreadBy ? chat.unreadBy.includes(user?.uid || '') : true);
                            const isActive = currentChatId === chat.id;

                            return (
                                <Link
                                    key={chat.id}
                                    href={`/messages/${chat.id}`}
                                    className={cn(
                                        "block p-3 flex items-center gap-4 transition-all border-b dark:border-slate-800",
                                        isActive ? "bg-primary/10 dark:bg-slate-800" : "hover:bg-slate-800/50"
                                    )}
                                >
                                    <div className="relative">
                                      <Avatar className="h-12 w-12 border-2 dark:border-slate-700">
                                          <AvatarImage src={other?.profilePictureURL} alt={other?.fullName}/>
                                          <AvatarFallback className="dark:bg-slate-700 dark:text-slate-300">{other?.fullName?.charAt(0) || '?'}</AvatarFallback>
                                      </Avatar>
                                      {other?.isOnline && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-slate-900" />}
                                    </div>

                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex justify-between items-baseline">
                                            <p className={cn("truncate text-sm dark:text-slate-200", isUnread ? "font-bold" : "font-semibold")}>
                                              {other?.fullName || "Utilisateur"}
                                            </p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={cn("text-sm truncate leading-relaxed", isUnread ? "font-medium text-slate-300" : "text-slate-400")}>
                                                {chat.lastMessage || "Cliquez pour lire les messages"}
                                            </p>
                                            {isUnread && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"></div>}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-500 h-full flex flex-col justify-center items-center">
                        <MessageSquareDashed className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <h3 className="font-semibold text-lg">Aucune conversation</h3>
                        <p className="text-sm">Commencez une nouvelle discussion pour la voir apparaître ici.</p>
                    </div>
                )}
            </ScrollArea>
        </CardContent>
    </Card>
    
    <Dialog open={isNewChatModalOpen} onOpenChange={setIsNewChatModalOpen}>
        <DialogContent className="dark:bg-slate-900 dark:border-slate-800">
            <DialogHeader>
                <DialogTitle>Démarrer une nouvelle discussion</DialogTitle>
                <DialogDescription>Sélectionnez un étudiant pour commencer à discuter.</DialogDescription>
            </DialogHeader>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Rechercher un étudiant..." 
                    className="pl-10 dark:bg-slate-800 dark:border-slate-700" 
                    value={modalSearchTerm}
                    onChange={e => setModalSearchTerm(e.target.value)}
                />
            </div>
            <ScrollArea className="h-72">
                <div className="space-y-1 pr-4">
                    {filteredStudents.map(student => (
                        <button key={student.uid} onClick={() => handleStartChat(student.uid)} disabled={isCreatingChat} className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={student.profilePictureURL} />
                                <AvatarFallback>{student.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{student.fullName}</span>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    </Dialog>

    <Button onClick={() => setIsNewChatModalOpen(true)} className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-lg z-50 flex items-center justify-center">
        <Plus className="h-8 w-8" />
        <span className="sr-only">Nouveau Message</span>
    </Button>
    </>
  );
}
