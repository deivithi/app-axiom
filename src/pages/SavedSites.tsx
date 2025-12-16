import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useAxiomSync } from '@/contexts/AxiomSyncContext';
import { Plus, Loader2, Trash2, Pin, PinOff, Search, ExternalLink, Pencil, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SavedSite {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['geral', 'trabalho', 'estudos', 'entretenimento', 'ferramentas', 'referência', 'outros'];

export default function SavedSites() {
  const [sites, setSites] = useState<SavedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSite, setSelectedSite] = useState<SavedSite | null>(null);
  const [newSite, setNewSite] = useState({ title: '', url: '', description: '', category: 'geral' });
  const [editSite, setEditSite] = useState({ title: '', url: '', description: '', category: 'geral' });
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyAction } = useAxiomSync();

  useEffect(() => {
    if (user) loadSites();
  }, [user]);

  // Realtime sync for saved sites
  const handleInsert = useCallback((newSite: SavedSite) => {
    setSites(prev => {
      if (prev.some(s => s.id === newSite.id)) return prev;
      return [newSite, ...prev].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    });
  }, []);

  const handleUpdate = useCallback((updatedSite: SavedSite) => {
    setSites(prev => prev.map(s => s.id === updatedSite.id ? updatedSite : s));
  }, []);

  const handleDelete = useCallback(({ old }: { old: SavedSite }) => {
    setSites(prev => prev.filter(s => s.id !== old.id));
  }, []);

  useRealtimeSync<SavedSite>('saved_sites', user?.id, {
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  });

  const loadSites = async () => {
    const { data, error } = await supabase
      .from('saved_sites')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar sites', variant: 'destructive' });
    } else {
      setSites((data || []) as SavedSite[]);
    }
    setLoading(false);
  };

  const createSite = async () => {
    if (!newSite.title.trim() || !newSite.url.trim()) return;

    // Ensure URL has protocol
    let url = newSite.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const { error } = await supabase.from('saved_sites').insert({
      user_id: user?.id,
      title: newSite.title,
      url,
      description: newSite.description || null,
      category: newSite.category,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao salvar site', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Site salvo!' });
      setNewSite({ title: '', url: '', description: '', category: 'geral' });
      setDialogOpen(false);
      loadSites();
    }
  };

  const updateSite = async () => {
    if (!selectedSite || !editSite.title.trim() || !editSite.url.trim()) return;

    // Ensure URL has protocol
    let url = editSite.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const { error } = await supabase
      .from('saved_sites')
      .update({ 
        title: editSite.title, 
        url,
        description: editSite.description || null,
        category: editSite.category
      })
      .eq('id', selectedSite.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Site atualizado!' });
      setEditDialogOpen(false);
      loadSites();
    }
  };

  const openEditDialog = (site: SavedSite) => {
    setEditSite({
      title: site.title,
      url: site.url,
      description: site.description || '',
      category: site.category
    });
    setSelectedSite(site);
    setEditDialogOpen(true);
  };

  const togglePin = async (site: SavedSite) => {
    await supabase.from('saved_sites').update({ is_pinned: !site.is_pinned }).eq('id', site.id);
    loadSites();
  };

  const deleteSite = async (id: string) => {
    await supabase.from('saved_sites').delete().eq('id', id);
    setSelectedSite(null);
    loadSites();
    toast({ title: 'Site excluído' });
  };

  const openSite = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredSites = sites.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.url.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedSites = filteredSites.filter((s) => s.is_pinned);
  const otherSites = filteredSites.filter((s) => !s.is_pinned);

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Sites Salvos</h1>
            <p className="text-muted-foreground">Guarde links para visitar depois</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Salvar Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={newSite.title}
                    onChange={(e) => setNewSite({ ...newSite, title: e.target.value })}
                    placeholder="Nome do site"
                  />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input
                    value={newSite.url}
                    onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                    placeholder="https://exemplo.com"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={newSite.category} onValueChange={(v) => setNewSite({ ...newSite, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={newSite.description}
                    onChange={(e) => setNewSite({ ...newSite, description: e.target.value })}
                    placeholder="Por que você está salvando este site?"
                    className="min-h-[80px]"
                  />
                </div>
                <Button onClick={createSite} className="w-full">
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Site</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={editSite.title}
                  onChange={(e) => setEditSite({ ...editSite, title: e.target.value })}
                  placeholder="Nome do site"
                />
              </div>
              <div>
                <Label>URL</Label>
                <Input
                  value={editSite.url}
                  onChange={(e) => setEditSite({ ...editSite, url: e.target.value })}
                  placeholder="https://exemplo.com"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editSite.category} onValueChange={(v) => setEditSite({ ...editSite, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={editSite.description}
                  onChange={(e) => setEditSite({ ...editSite, description: e.target.value })}
                  placeholder="Por que você está salvando este site?"
                  className="min-h-[80px]"
                />
              </div>
              <Button onClick={updateSite} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sites..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {pinnedSites.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Pin className="h-3 w-3" /> Fixados
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pinnedSites.map((site) => (
                    <SiteCard
                      key={site.id}
                      site={site}
                      onOpen={() => openSite(site.url)}
                      onTogglePin={() => togglePin(site)}
                      onDelete={() => deleteSite(site.id)}
                      onEdit={() => openEditDialog(site)}
                      getDomain={getDomainFromUrl}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              {pinnedSites.length > 0 && (
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Outros sites</h3>
              )}
              {otherSites.length === 0 && pinnedSites.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum site salvo ainda</p>
                  <p className="text-sm mt-1">Clique em "Novo Site" para começar</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherSites.map((site) => (
                    <SiteCard
                      key={site.id}
                      site={site}
                      onOpen={() => openSite(site.url)}
                      onTogglePin={() => togglePin(site)}
                      onDelete={() => deleteSite(site.id)}
                      onEdit={() => openEditDialog(site)}
                      getDomain={getDomainFromUrl}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SiteCard({
  site,
  onOpen,
  onTogglePin,
  onDelete,
  onEdit,
  getDomain,
}: {
  site: SavedSite;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onEdit: () => void;
  getDomain: (url: string) => string;
}) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="font-medium truncate">{site.title}</p>
            </div>
            <p className="text-xs text-primary truncate">{getDomain(site.url)}</p>
            {site.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{site.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {site.category}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(site.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpen}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onTogglePin}
            >
              {site.is_pinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
