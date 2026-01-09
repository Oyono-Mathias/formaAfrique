
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  getFirestore,
  collection,
  doc,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Loader2, DollarSign, XCircle, User } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export function AdminTicketDetailsPage({ ticketId }: { ticketId: string }) {
    const router = useRouter();
    const db = getFirestore();
    const { toast } = useToast();
    const { formaAfriqueUser: adminUser } = useRole();
    const [newMessage, setNewMessage] = useState("");
    const [isRefundAlertOpen, setIsRefundAlertOpen] = useState(false);
    const [isProcessingRefund, setIsProcessingRefund] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const ticketRef = useMemoFirebase(() => doc(db, 'support_tickets', ticketId as string), [db, ticketId]);
    const { data: ticket, isLoading: ticketLoading } = useDoc(ticketRef);
    
    const messagesQuery = useMemoFirebase(() => query(collection(ticketRef, 'messages'), orderBy('createdAt', 'asc')), [ticketRef]);
    const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
    
    const userRef = useMemoFirebase(() => ticket ? doc(db, 'users', ticket.userId) : null, [db, ticket]);
    const { data: ticketUser, isLoading: userLoading } = useDoc(userRef);
    
    const [clientReady, setClientReady] = useState(false);
    useEffect(() => {
        setClientReady(true);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !adminUser) return;
        
        const textToSend = newMessage;
        setNewMessage("");

        const messagePayload = {
            senderId: adminUser.uid,
            text: textToSend,
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(ticketRef, 'messages'), messagePayload);
        await updateDoc(ticketRef, { 
            lastMessage: textToSend,
            updatedAt: serverTimestamp(),
            status: 'open',
        });
    };

    const handleRefund = async () => {
        if (!ticket) return;
        setIsProcessingRefund(true);
        
        try {
            const batch = writeBatch(db);

            // 1. Find the relevant payment document
            const paymentsQuery = query(
                collection(db, 'payments'),
                where('userId', '==', ticket.userId),
                where('courseId', '==', ticket.courseId),
                where('status', '==', 'Completed')
            );
            const paymentsSnap = await getDocs(paymentsQuery);

            if (paymentsSnap.empty) {
                toast({ variant: 'destructive', title: 'Erreur', description: 'Aucun paiement correspondant trouvé pour ce cours.' });
                setIsProcessingRefund(false);
                return;
            }
            
            // Mark the first found payment as refunded
            const paymentToRefundRef = paymentsSnap.docs[0].ref;
            batch.update(paymentToRefundRef, { status: 'Remboursé' });

            // 2. Find and delete the enrollment document
            const enrollmentId = `${ticket.userId}_${ticket.courseId}`;
            const enrollmentRef = doc(db, 'enrollments', enrollmentId);
            batch.delete(enrollmentRef);

            // 3. Close the ticket
            batch.update(ticketRef, { status: 'closed' });
            
            // Commit all operations
            await batch.commit();

            toast({ title: 'Remboursement traité', description: "Le paiement a été marqué comme remboursé et l'accès de l'étudiant au cours a été révoqué." });
            router.push('/admin/support');

        } catch (error) {
            console.error("Refund failed:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Le processus de remboursement a échoué.' });
        } finally {
            setIsProcessingRefund(false);
            setIsRefundAlertOpen(false);
        }
    };


    const handleCloseTicket = async () => {
        await updateDoc(ticketRef, { status: 'closed' });
        router.push('/admin/support');
    };

    const isLoading = ticketLoading || messagesLoading || userLoading;

    if (isLoading) {
        return (
             <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!ticket) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Sélectionnez un ticket pour l'afficher.
        </div>
      );
    }
    
    return (
        <>
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-800">
                <CardHeader className="flex flex-row items-center gap-4 border-b bg-white dark:bg-slate-800 dark:border-slate-700">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => router.push('/admin/support')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar>
                        <AvatarImage src={ticketUser?.profilePictureURL} />
                        <AvatarFallback>{ticketUser?.fullName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-base dark:text-white">{ticket?.subject}</CardTitle>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                           {clientReady && ticket?.updatedAt ? `Par ${ticketUser?.fullName || '...'} - il y a ${formatDistanceToNow(ticket.updatedAt.toDate(), { locale: fr })}` : 'Chargement...'}
                        </p>
                    </div>
                </CardHeader>
                
                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-6">
                        {messages?.map(message => {
                            const isFromAdmin = message.senderId === adminUser?.uid;
                            const sender = isFromAdmin ? adminUser : ticketUser;
                            return (
                                <div key={message.id} className={cn("flex items-start gap-3", isFromAdmin && "justify-end")}>
                                    {!isFromAdmin && (
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarImage src={sender?.profilePictureURL} />
                                            <AvatarFallback>{sender?.fullName?.charAt(0) || '?'}</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={cn("rounded-2xl p-3 max-w-[75%] shadow-sm", isFromAdmin ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white border rounded-bl-none dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200")}>
                                        <p className="text-sm">{message.text}</p>
                                    </div>
                                    {isFromAdmin && (
                                         <Avatar className="h-8 w-8 border">
                                            <AvatarImage src={sender?.profilePictureURL} />
                                            <AvatarFallback>{sender?.fullName?.charAt(0) || 'A'}</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            )
                        })}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
                
                <CardFooter className="bg-white border-t p-4 space-y-4 flex-col items-stretch dark:bg-slate-900 dark:border-slate-700">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Input 
                            placeholder="Répondre au client..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                             className="dark:bg-slate-800 dark:border-slate-600"
                        />
                        <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
                    </form>
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCloseTicket} className="dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700"><XCircle className="mr-2 h-4 w-4" /> Fermer le ticket</Button>
                            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/users/${ticket?.userId}`)} className="dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700"><User className="mr-2 h-4 w-4" /> Voir le profil</Button>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => setIsRefundAlertOpen(true)}><DollarSign className="mr-2 h-4 w-4" /> Rembourser</Button>
                    </div>
                </CardFooter>
            </div>

            <AlertDialog open={isRefundAlertOpen} onOpenChange={setIsRefundAlertOpen}>
                <AlertDialogContent className="dark:bg-slate-800 dark:border-slate-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="dark:text-white">Confirmer le remboursement</AlertDialogTitle>
                        <AlertDialogDescription className="dark:text-slate-400">
                            Êtes-vous sûr de vouloir rembourser ce cours à {ticketUser?.fullName} ? Cette action mettra à jour le statut du paiement sur "Remboursé" et révoquera immédiatement son accès au cours. Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-600 dark:text-white">Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRefund} disabled={isProcessingRefund} className="bg-destructive hover:bg-destructive/90">
                           {isProcessingRefund ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                           {isProcessingRefund ? 'Traitement...' : 'Confirmer le remboursement'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// Default export needed for Next.js pages, even if we use the named export elsewhere.
export default function TicketDetailsWrapper() {
  const { ticketId } = useParams();
  if (!ticketId) return null;
  return <AdminTicketDetailsPage ticketId={ticketId as string} />;
}
