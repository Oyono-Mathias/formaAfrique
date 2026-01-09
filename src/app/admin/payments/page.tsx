
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  CreditCard,
  Users,
  ArrowUpRight,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

// --- TYPES ---
interface Payment {
  id: string;
  amount: number;
  currency: string;
  date: any; // Firestore Timestamp
  status: 'Completed' | 'Pending' | 'Failed';
  userId: string;
  courseId: string;
  // --- Populated fields ---
  userName?: string;
  userAvatar?: string;
  courseTitle?: string;
}

interface Payout {
  id: string;
  instructorId: string;
  amount: number;
  status: 'en_attente' | 'valide' | 'rejete';
  date: any; // Firestore Timestamp
  // --- Populated fields ---
  instructorName?: string;
}

// --- HELPER COMPONENTS ---
const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string; value: string; icon: React.ElementType; isLoading?: boolean; }) => (
  <Card className="shadow-sm border-slate-200 dark:bg-slate-800 dark:border-slate-700">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</CardTitle>
      <Icon className="h-4 w-4 text-slate-400" />
    </CardHeader>
    <CardContent>
      {isLoading ? <Skeleton className="h-8 w-3/4 dark:bg-slate-700" /> : <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>}
    </CardContent>
  </Card>
);

const getStatusBadge = (status: Payment['status']) => {
  switch (status) {
    case 'Completed': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1"/>Succès</Badge>;
    case 'Failed': return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1"/>Échoué</Badge>;
    default: return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"><Clock className="h-3 w-3 mr-1"/>En attente</Badge>;
  }
};

const getPayoutStatusBadge = (status: Payout['status']) => {
  switch (status) {
    case 'valide': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Validé</Badge>;
    case 'rejete': return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Rejeté</Badge>;
    default: return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">En attente</Badge>;
  }
};

// --- CSV EXPORT UTILITY ---
const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(fieldName => {
                let value = row[fieldName];
                if (typeof value === 'string') {
                    // Escape commas and quotes
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};


export default function AdminPaymentsPage() {
    const db = getFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // --- DATA FETCHING ---
    const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('date', 'desc')), [db]);
    const { data: rawPayments, isLoading: paymentsLoading, error: paymentsError } = useCollection<Payment>(paymentsQuery);

    const payoutsQuery = useMemoFirebase(() => query(collection(db, 'payouts'), where('status', '==', 'en_attente')), [db]);
    const { data: pendingPayouts, isLoading: payoutsLoading, error: payoutsError } = useCollection<Payout>(payoutsQuery);
    
    const [populatedData, setPopulatedData] = useState<{ payments: (Payment & { userName?: string; userAvatar?: string; courseTitle?: string; })[]; payouts: (Payout & { instructorName?: string; })[]; }>({ payments: [], payouts: [] });
    const [extraDataLoading, setExtraDataLoading] = useState(true);

    useEffect(() => {
        const populate = async () => {
            if (!rawPayments && !pendingPayouts) return;
            
            const userIds = new Set<string>();
            const courseIds = new Set<string>();
            const instructorIds = new Set<string>();

            rawPayments?.forEach(p => { userIds.add(p.userId); if(p.courseId) courseIds.add(p.courseId); });
            pendingPayouts?.forEach(p => instructorIds.add(p.instructorId));
            
            const usersMap = new Map();
            const coursesMap = new Map();
            const instructorsMap = new Map();
            
            const allUserIds = Array.from(new Set([...userIds, ...instructorIds]));

            if (allUserIds.length > 0) {
                 // Firestore 'in' query has a limit of 30. For more, batching would be needed.
                 const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', allUserIds.slice(0, 30))));
                 usersSnap.forEach(d => {
                    const userData = d.data();
                    if(userIds.has(userData.uid)) usersMap.set(userData.uid, userData);
                    if(instructorIds.has(userData.uid)) instructorsMap.set(userData.uid, userData);
                 });
            }
            if (courseIds.size > 0) {
                 const coursesSnap = await getDocs(query(collection(db, 'courses'), where('__name__', 'in', Array.from(courseIds).slice(0, 30))));
                 coursesSnap.forEach(d => coursesMap.set(d.id, d.data()));
            }

            const populatedPayments = rawPayments?.map(p => ({
                ...p,
                userName: usersMap.get(p.userId)?.fullName || 'Inconnu',
                userAvatar: usersMap.get(p.userId)?.profilePictureURL,
                courseTitle: coursesMap.get(p.courseId)?.title || 'Cours supprimé',
            })) || [];
            
            const populatedPayouts = pendingPayouts?.map(p => ({
                ...p,
                instructorName: instructorsMap.get(p.instructorId)?.fullName || 'Instructeur inconnu',
            })) || [];

            setPopulatedData({ payments: populatedPayments, payouts: populatedPayouts });
            setExtraDataLoading(false);
        };
        
        if(!paymentsLoading && !payoutsLoading) populate();
        
    }, [rawPayments, pendingPayouts, db, paymentsLoading, payoutsLoading]);
    
    const filteredPayments = useMemo(() => {
        if (!debouncedSearchTerm) return populatedData.payments;
        const lowercasedTerm = debouncedSearchTerm.toLowerCase();
        return populatedData.payments.filter(p => 
            p.userName?.toLowerCase().includes(lowercasedTerm) || 
            p.courseTitle?.toLowerCase().includes(lowercasedTerm)
        );
    }, [populatedData.payments, debouncedSearchTerm]);


    // --- STATS CALCULATION ---
    const { totalRevenue, monthlyRevenue } = useMemo(() => {
        const total = rawPayments?.reduce((sum, p) => p.status === 'Completed' ? sum + p.amount : sum, 0) || 0;
        const monthly = rawPayments?.filter(p => p.date.toDate() > new Date(new Date().setDate(1))).reduce((sum, p) => p.status === 'Completed' ? sum + p.amount : sum, 0) || 0;
        return { totalRevenue: total, monthlyRevenue: monthly };
    }, [rawPayments]);

    const handleValidatePayout = async (payoutId: string) => {
        const payoutRef = doc(db, 'payouts', payoutId);
        try {
            await updateDoc(payoutRef, { status: 'valide' });
            toast({ title: 'Paiement validé', description: "Le retrait a été marqué comme validé."});
        } catch (error) {
            console.error("Failed to validate payout:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de valider le paiement.' });
        }
    };
    
    const handleExport = () => {
        const dataToExport = filteredPayments.map(p => ({
            'ID Transaction': p.id,
            'Nom Utilisateur': p.userName,
            'Cours': p.courseTitle,
            'Montant': p.amount,
            'Devise': p.currency,
            'Date': format(p.date.toDate(), 'yyyy-MM-dd HH:mm:ss'),
            'Statut': p.status,
        }));
        const today = format(new Date(), 'yyyy-MM-dd');
        exportToCSV(dataToExport, `formaafrique_ventes_${today}.csv`);
    };

    const isLoading = paymentsLoading || payoutsLoading || extraDataLoading;
    const hasError = paymentsError || payoutsError;

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4">
            <header>
                <h1 className="text-3xl font-bold dark:text-white">Gestion des Finances</h1>
                <p className="text-muted-foreground dark:text-slate-400">Suivez les revenus, les transactions et gérez les retraits.</p>
            </header>
            
            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Revenu Total" value={`${totalRevenue.toLocaleString('fr-FR')} XOF`} icon={DollarSign} isLoading={isLoading} />
                <StatCard title="Ventes du mois" value={`${monthlyRevenue.toLocaleString('fr-FR')} XOF`} icon={CreditCard} isLoading={isLoading} />
                <StatCard title="Commissions (Mois)" value={`${(monthlyRevenue * 0.1).toLocaleString('fr-FR')} XOF`} icon={ArrowUpRight} isLoading={isLoading} />
                <StatCard title="Retraits en attente" value={pendingPayouts?.length.toString() || '0'} icon={Users} isLoading={isLoading} />
            </section>

             {hasError && (
                <div className="p-4 bg-destructive/10 text-destructive border border-destructive/50 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    <p>Une erreur est survenue lors du chargement des données financières. Un index Firestore est peut-être manquant.</p>
                </div>
            )}

            {/* Payouts Section */}
            {pendingPayouts && pendingPayouts.length > 0 && (
                <section>
                    <h2 className="text-2xl font-semibold mb-4 dark:text-white">Demandes de retrait</h2>
                    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/50">
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                     <TableRow className="hover:bg-amber-100/50 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-700/50">
                                        <TableHead className="dark:text-amber-200">Instructeur</TableHead>
                                        <TableHead className="dark:text-amber-200">Montant</TableHead>
                                        <TableHead className="dark:text-amber-200">Date</TableHead>
                                        <TableHead className="text-right dark:text-amber-200">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {populatedData.payouts.map((payout) => (
                                        <TableRow key={payout.id} className="hover:bg-amber-100/50 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-700/50">
                                            <TableCell className="font-medium dark:text-slate-100">{payout.instructorName}</TableCell>
                                            <TableCell className="font-bold dark:text-white">{payout.amount.toLocaleString('fr-FR')} XOF</TableCell>
                                            <TableCell className="dark:text-slate-300">{format(payout.date.toDate(), 'dd MMM yyyy', { locale: fr })}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleValidatePayout(payout.id)}>Valider le paiement</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </section>
            )}

            {/* Transactions Section */}
            <section>
                 <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-semibold dark:text-white">Toutes les transactions</h2>
                    <div className="flex w-full md:w-auto items-center gap-2">
                        <div className="relative flex-1 md:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Rechercher..." className="pl-9 dark:bg-slate-800 dark:border-slate-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <Button variant="outline" onClick={handleExport} className="dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"><Download className="mr-2 h-4 w-4"/> Exporter en CSV</Button>
                    </div>
                </div>
                <Card className="dark:bg-slate-800 dark:border-slate-700">
                    <CardContent className="pt-6">
                       <div className="hidden md:block">
                         <Table>
                            <TableHeader>
                                <TableRow className="dark:border-slate-700 dark:hover:bg-slate-700/50">
                                    <TableHead className="dark:text-slate-400">Utilisateur</TableHead>
                                    <TableHead className="dark:text-slate-400">Formation</TableHead>
                                    <TableHead className="dark:text-slate-400">Montant</TableHead>
                                    <TableHead className="dark:text-slate-400">Date</TableHead>
                                    <TableHead className="dark:text-slate-400">Statut</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i} className="dark:border-slate-700">
                                            <TableCell><Skeleton className="h-5 w-32 dark:bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-40 dark:bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20 dark:bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24 dark:bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-24 rounded-full dark:bg-slate-700" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredPayments.length > 0 ? (
                                    filteredPayments.map(payment => (
                                        <TableRow key={payment.id} className="dark:border-slate-700 dark:hover:bg-slate-700/50">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={payment.userAvatar} />
                                                        <AvatarFallback>{payment.userName?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium dark:text-slate-100">{payment.userName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-600 dark:text-slate-300">{payment.courseTitle}</TableCell>
                                            <TableCell className="font-semibold text-slate-800 dark:text-white">{payment.amount.toLocaleString('fr-FR')} {payment.currency}</TableCell>
                                            <TableCell className="dark:text-slate-400">{format(payment.date.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr })}</TableCell>
                                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow className="dark:border-slate-700"><TableCell colSpan={5} className="h-24 text-center dark:text-slate-400">Aucune transaction trouvée.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                       </div>
                       {/* Mobile View */}
                       <div className="md:hidden space-y-4">
                           {isLoading ? (
                                [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg dark:bg-slate-700" />)
                           ) : filteredPayments.length > 0 ? (
                                filteredPayments.map(payment => (
                                    <Card key={payment.id} className="p-4 dark:bg-slate-800/50 dark:border-slate-700">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-slate-800 dark:text-white">{payment.courseTitle}</p>
                                            <p className="font-bold text-slate-900 dark:text-white">{payment.amount.toLocaleString('fr-FR')} {payment.currency}</p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 text-sm text-slate-500 dark:text-slate-400">
                                            <p>{payment.userName}</p>
                                            <p>{format(payment.date.toDate(), 'dd/MM/yy', { locale: fr })}</p>
                                        </div>
                                        <div className="mt-2">{getStatusBadge(payment.status)}</div>
                                    </Card>
                                ))
                           ) : (
                                <div className="h-24 text-center flex items-center justify-center text-slate-500 dark:text-slate-400">Aucune transaction.</div>
                           )}
                       </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

    