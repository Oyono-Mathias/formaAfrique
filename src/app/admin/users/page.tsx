
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { useCollection, useMemoFirebase } from '@/firebase';
import { getFirestore, collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Search, UserX, Loader2, UserCog, Trash2, Ban, Eye } from 'lucide-react';
import type { FormaAfriqueUser, UserRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { deleteUserAccount } from '@/app/actions/userActions';


const getRoleBadgeVariant = (role: FormaAfriqueUser['role']) => {
  switch (role) {
    case 'admin':
      return 'destructive';
    case 'instructor':
      return 'default';
    default:
      return 'secondary';
  }
};

const getStatusBadgeVariant = (status?: 'active' | 'suspended') => {
    return status === 'suspended' ? 'destructive' : 'default';
};

const UserActions = ({ user }: { user: FormaAfriqueUser }) => {
    const { toast } = useToast();
    const router = useRouter();
    const db = getFirestore();
    const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
    
    const userDocRef = useMemo(() => doc(db, 'users', user.uid), [db, user.uid]);

    const handleRoleChange = async () => {
        setIsSubmitting(true);
        try {
            await updateDoc(userDocRef, { role: selectedRole });
            toast({ title: "Rôle mis à jour", description: `Le rôle de ${user.fullName} est maintenant ${selectedRole}.` });
            setIsRoleDialogOpen(false);
        } catch (error) {
            console.error("Failed to update role:", error);
            toast({ variant: 'destructive', title: "Erreur", description: "Impossible de modifier le rôle." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusToggle = async () => {
        const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
        setIsSubmitting(true);
        try {
            await updateDoc(userDocRef, { status: newStatus });
            toast({ title: "Statut mis à jour", description: `${user.fullName} est maintenant ${newStatus === 'active' ? 'actif' : 'suspendu'}.` });
        } catch (error) {
            console.error("Failed to toggle status:", error);
            toast({ variant: 'destructive', title: "Erreur", description: "Impossible de modifier le statut." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        setIsSubmitting(true);
        const auth = getAuth();
        const adminUser = auth.currentUser;

        if (!adminUser) {
            toast({ variant: "destructive", title: "Erreur d'authentification", description: "Administrateur non connecté." });
            setIsSubmitting(false);
            return;
        }

        try {
            const token = await adminUser.getIdToken();
            // Pass the token as a direct argument
            const result = await deleteUserAccount({ userId: user.uid, idToken: token });
            
            if (result.success) {
                toast({ title: "Utilisateur supprimé", description: `${user.fullName} a été définitivement supprimé.` });
                setIsDeleteAlertOpen(false);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error: any) {
            console.error("Failed to delete user:", error);
            toast({ variant: "destructive", title: "Erreur de suppression", description: error.message || "Impossible de supprimer l'utilisateur." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Ouvrir le menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => router.push(`/admin/users/${user.uid}`)}>
                        <Eye className="mr-2 h-4 w-4"/>
                        Voir le profil
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsRoleDialogOpen(true)}>
                        <UserCog className="mr-2 h-4 w-4"/>
                        Modifier le rôle
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleStatusToggle} disabled={isSubmitting}>
                        <Ban className="mr-2 h-4 w-4"/>
                        {user.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsDeleteAlertOpen(true)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Supprimer
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Role Change Dialog */}
            <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifier le rôle de {user.fullName}</DialogTitle>
                        <DialogDescription>
                            Sélectionnez le nouveau rôle pour l'utilisateur. Ce changement prendra effet immédiatement.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="student">Étudiant</SelectItem>
                                <SelectItem value="instructor">Instructeur</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRoleDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleRoleChange} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert */}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet utilisateur ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Le compte et les données associées de {user.fullName} seront définitivement supprimés.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Supprimer'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};


export default function AdminUsersPage() {
  const { formaAfriqueUser: adminUser, isUserLoading } = useRole();
  const db = getFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const usersQuery = useMemoFirebase(
    () => query(collection(db, 'users'), orderBy('createdAt', 'desc')),
    [db]
  );
  const { data: users, isLoading: usersLoading } = useCollection<FormaAfriqueUser & {createdAt?: any; status?: 'active' | 'suspended'}>(usersQuery);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!debouncedSearchTerm) return users;
    return users.filter(user =>
      user.fullName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [users, debouncedSearchTerm]);

  const isLoading = isUserLoading || usersLoading;

  if (adminUser?.role !== 'admin') {
    return <div className="p-8 text-center">Accès non autorisé.</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Gestion des Utilisateurs</h1>
        <p className="text-muted-foreground">Recherchez, consultez et gérez tous les utilisateurs de la plateforme.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs de FormaAfrique</CardTitle>
          <CardDescription>
            Liste de tous les utilisateurs enregistrés.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              className="max-w-sm pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Rôle</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.profilePictureURL} alt={user.fullName} />
                            <AvatarFallback>{user.fullName?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">{user.fullName}</span>
                            <div className="sm:hidden mt-1">
                                <Badge variant={getStatusBadgeVariant(user.status)} className={cn('text-xs', user.status !== 'suspended' && 'bg-green-100 text-green-800')}>
                                    {user.status === 'suspended' ? 'Suspendu' : 'Actif'}
                                </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{user.email}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                       <TableCell className="hidden sm:table-cell">
                          <Badge variant={getStatusBadgeVariant(user.status)} className={cn(user.status !== 'suspended' && 'bg-green-100 text-green-800')}>
                            {user.status === 'suspended' ? 'Suspendu' : 'Actif'}
                          </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <UserActions user={user} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <UserX className="h-12 w-12" />
                          <p className="font-medium">Aucun utilisateur trouvé</p>
                          <p className="text-sm">
                              {searchTerm 
                                  ? `Aucun résultat pour "${searchTerm}".`
                                  : "Il n'y a pas encore d'utilisateurs sur la plateforme."
                              }
                          </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
