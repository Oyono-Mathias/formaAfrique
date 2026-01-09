
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useMemoFirebase } from '@/firebase';
import { getFirestore, collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Ticket, Clock, Search, Inbox, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AdminTicketDetailsPage } from './[ticketId]/page';

interface SupportTicket {
    id: string;
    subject: string;
    lastMessage: string;
    status: 'open' | 'closed';
    priority?: 'urgent' | 'normal';
    userId: string;
    userName?: string;
    userAvatar?: string;
    updatedAt: any; // Firestore Timestamp
}

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string; value: string; icon: React.ElementType; isLoading?: boolean; }) => (
  <Card className="bg-white border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</CardTitle>
      <Icon className="h-4 w-4 text-slate-400" />
    </CardHeader>
    <CardContent>
      {isLoading ? <Skeleton className="h-8 w-3/4 dark:bg-slate-700" /> : <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>}
    </CardContent>
  </Card>
);

const TicketListItem = ({ ticket, isActive, onClick }: { ticket: SupportTicket, isActive: boolean, onClick: (id: string) => void }) => {
    const [lastActivity, setLastActivity] = useState('');
    useEffect(() => {
        if (ticket.updatedAt) {
            setLastActivity(formatDistanceToNow(ticket.updatedAt.toDate(), { locale: fr, addSuffix: true }));
        }
    }, [ticket.updatedAt]);
    
    return (
    <button onClick={() => onClick(ticket.id)} className={cn("w-full text-left block p-4 rounded-2xl cursor-pointer transition-colors", isActive ? "bg-primary/10" : "hover:bg-slate-100 dark:hover:bg-slate-800")}>
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={ticket.userAvatar} />
                    <AvatarFallback>{ticket.userName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className={cn("font-semibold text-sm", isActive && "text-primary")}>{ticket.userName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{ticket.subject}</p>
                </div>
            </div>
            {ticket.priority === 'urgent' && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
        </div>
        <p className="text-xs text-slate-400 mt-2 pl-11 line-clamp-1">{ticket.lastMessage}</p>
        <p className="text-[11px] text-slate-400 mt-1 pl-11">{lastActivity}</p>
    </button>
);}


export default function AdminSupportPage() {
    const db = getFirestore();
    const router = useRouter();
    const isMobile = useIsMobile();
    
    const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const ticketsQuery = useMemoFirebase(() => query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc')), [db]);
    const { data: rawTickets, isLoading: ticketsLoading, error } = useCollection<SupportTicket>(ticketsQuery);

    const [tickets, setTickets] = useState<SupportTicket[]>([]);

    useEffect(() => {
      if(!rawTickets) return;
      
      const populateTickets = async () => {
          const userIds = [...new Set(rawTickets.map(t => t.userId))];
          if(userIds.length === 0) {
              setTickets(rawTickets);
              return;
          }
          const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', userIds.slice(0, 30))));
          const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));
          
          const populated = rawTickets.map(t => {
              const user = usersMap.get(t.userId);
              return {
                  ...t,
                  userName: user?.fullName || 'Utilisateur inconnu',
                  userAvatar: user?.profilePictureURL,
              }
          });
          setTickets(populated);

          if (!isMobile && !activeTicketId && populated.length > 0) {
              setActiveTicketId(populated[0].id);
          }
      };

      populateTickets();

    }, [rawTickets, db, isMobile, activeTicketId]);

    const openTicketsCount = useMemo(() => tickets?.filter(t => t.status === 'open').length || 0, [tickets]);
    const averageResponseTime = "3h 15m";

    const filteredTickets = useMemo(() => {
        if (!tickets) return [];
        return tickets.filter(t => 
            t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.userName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [tickets, searchTerm]);
    
    const handleTicketClick = (id: string) => {
        if (isMobile) {
            router.push(`/admin/support/${id}`);
        } else {
            setActiveTicketId(id);
        }
    }
    
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Tickets ouverts" value={openTicketsCount.toString()} icon={Ticket} isLoading={ticketsLoading} />
                <StatCard title="Temps de réponse moyen" value={averageResponseTime} icon={Clock} isLoading={ticketsLoading} />
                <StatCard title="Total Utilisateurs" value={"342"} icon={Users} isLoading={ticketsLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-22rem)]">
                <Card className="lg:col-span-1 rounded-2xl shadow-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex flex-col">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                            placeholder="Rechercher..."
                            className="pl-9 dark:bg-slate-700"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 flex-1">
                        <ScrollArea className="h-full">
                             {ticketsLoading ? (
                                <div className="space-y-2 p-2">
                                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl dark:bg-slate-700" />)}
                                </div>
                            ) : filteredTickets.length > 0 ? (
                                <div>
                                    {filteredTickets.map(ticket => <TicketListItem key={ticket.id} ticket={ticket} isActive={activeTicketId === ticket.id} onClick={handleTicketClick} />)}
                                </div>
                            ): (
                                 <div className="text-center pt-20 text-slate-500">
                                    <Inbox className="mx-auto h-12 w-12" />
                                    <p className="mt-4 font-semibold">Boîte de réception vide</p>
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
                
                 <div className="lg:col-span-2 hidden lg:block rounded-2xl shadow-sm bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 overflow-hidden">
                    {activeTicketId ? (
                        <AdminTicketDetailsPage key={activeTicketId} ticketId={activeTicketId} />
                    ) : (
                         <div className="h-full flex items-center justify-center text-slate-500 flex-col">
                            <Inbox className="h-16 w-16" />
                            <p className="mt-4">Sélectionnez un ticket pour l'afficher</p>
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
}

