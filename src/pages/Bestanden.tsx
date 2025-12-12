import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/files/FileUpload";
import { FileList } from "@/components/files/FileList";
import { FolderDialog } from "@/components/files/FolderDialog";
import { FolderCard } from "@/components/files/FolderCard";
import { useAuth } from "@/hooks/useAuth";

const Bestanden = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [activeView, setActiveView] = useState<"recent" | "shared" | "favorites">("recent");
  const [sortByRecent, setSortByRecent] = useState<"name" | "date">("date");
  const [sortByShared, setSortByShared] = useState<"name" | "date">("date");
  const [sortByFavorites, setSortByFavorites] = useState<"name" | "date">("date");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [folders, setFolders] = useState<any[]>([]);
  const [folderFileCounts, setFolderFileCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user) {
      loadFolders(user.id);
    }
  }, [user]);

  const loadFolders = async (userId: string) => {
    try {
      const { data: foldersData, error } = await supabase
        .from('folders')
        .select('*')
        .eq('owner_id', userId)
        .is('parent_folder_id', null)
        .order('name');

      if (error) throw error;

      setFolders(foldersData || []);

      const counts: Record<string, number> = {};
      for (const folder of foldersData || []) {
        const { count } = await supabase
          .from('files')
          .select('*', { count: 'exact', head: true })
          .eq('folder_id', folder.id);
        counts[folder.id] = count || 0;
      }
      setFolderFileCounts(counts);
    } catch (error) {
      console.error("Failed to load folders:", error);
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    setRefreshTrigger(prev => prev + 1);
    toast.success("Bestand geüpload!");
  };

  const handleFolderCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    if (user) loadFolders(user.id);
  };

  if (!user) return null;

  return (
    <div className="w-full">
      <div className="mb-8 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setActiveView("recent")}
            className={`text-[1.15rem] font-medium pb-2 border-b-2 transition-colors ${
              activeView === "recent" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setActiveView("shared")}
            className={`text-[1.15rem] font-medium pb-2 border-b-2 transition-colors ${
              activeView === "shared" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Gedeeld
          </button>
          <button
            onClick={() => setActiveView("favorites")}
            className={`text-[1.15rem] font-medium pb-2 border-b-2 transition-colors ${
              activeView === "favorites" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Favorieten
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Zoeken..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-full bg-secondary border-0 focus-visible:ring-1"
            />
          </div>

          <Button onClick={() => setShowFolderDialog(true)} variant="outline" className="rounded-full gap-2 h-11 px-5 border-primary text-primary hover:bg-primary/5">
            <FolderPlus className="w-4 h-4" />
            Voeg map toe
          </Button>

          <Button onClick={() => setShowUpload(!showUpload)} variant="outline" className="rounded-full gap-2 h-11 px-5 border-primary text-primary hover:bg-primary/5">
            <Upload className="w-4 h-4" />
            Importeer
          </Button>
        </div>
      </div>

      {showUpload && (
        <div className="mb-6 p-6 bg-secondary rounded-2xl shadow-sm border border-border/60">
          <FileUpload userId={user.id} onUploadComplete={handleUploadComplete} />
        </div>
      )}

      {activeView === "recent" && folders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[0.8rem] font-semibold mb-4 text-muted-foreground">Mappen</h2>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                fileCount={folderFileCounts[folder.id] || 0}
                onUpdate={() => {
                  loadFolders(user.id);
                  setRefreshTrigger(prev => prev + 1);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[0.8rem] font-semibold text-muted-foreground">Bestanden</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sorteren:</span>
          <select
            value={activeView === "recent" ? sortByRecent : activeView === "shared" ? sortByShared : sortByFavorites}
            onChange={(e) => {
              const value = e.target.value as "name" | "date";
              if (activeView === "recent") setSortByRecent(value);
              else if (activeView === "shared") setSortByShared(value);
              else setSortByFavorites(value);
            }}
            className="h-9 px-3 rounded-full border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="name">Naam (A-Z)</option>
            <option value="date">Datum</option>
          </select>
        </div>
      </div>

      <FileList
        userId={user.id}
        viewType={activeView}
        searchQuery={searchQuery}
        refreshTrigger={refreshTrigger}
        sortBy={activeView === "recent" ? sortByRecent : activeView === "shared" ? sortByShared : sortByFavorites}
        fileTypeFilter={fileTypeFilter}
        onFavoritesChange={() => {}}
      />

      <FolderDialog
        open={showFolderDialog}
        onClose={() => setShowFolderDialog(false)}
        onSuccess={handleFolderCreated}
        userId={user.id}
      />
    </div>
  );
};

export default Bestanden;
