import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Trash2, Download, File } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface GroupMaterial {
  id: string;
  group_id: string;
  uploaded_by: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_url: string;
  created_at: string;
  uploader?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface GroupMaterialsProps {
  groupId: string;
}

export function GroupMaterials({ groupId }: GroupMaterialsProps) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<GroupMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (groupId) {
      loadMaterials();

      const channel = supabase
        .channel(`group-materials-${groupId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'group_materials',
            filter: `group_id=eq.${groupId}`,
          },
          () => loadMaterials()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [groupId]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("group_materials")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with uploader profiles
      if (data && data.length > 0) {
        const uploaderIds = [...new Set(data.map(m => m.uploaded_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", uploaderIds);

        const enrichedMaterials = data.map(m => ({
          ...m,
          uploader: profiles?.find(p => p.user_id === m.uploaded_by)
        }));
        setMaterials(enrichedMaterials);
      } else {
        setMaterials([]);
      }
    } catch (error) {
      console.error("Failed to load materials:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Bestand mag maximaal 50MB zijn");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `group-materials/${groupId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("group_materials")
        .insert({
          group_id: groupId,
          uploaded_by: user.id,
          filename: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          storage_url: filePath,
        });

      if (insertError) throw insertError;

      toast.success("Bestand geüpload");
      loadMaterials();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Kon bestand niet uploaden");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (material: GroupMaterial) => {
    const { data } = await supabase.storage
      .from('user-files')
      .getPublicUrl(material.storage_url);

    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    }
  };

  const handleDelete = async (material: GroupMaterial) => {
    if (!user) return;

    try {
      await supabase.storage
        .from('user-files')
        .remove([material.storage_url]);

      await supabase
        .from("group_materials")
        .delete()
        .eq("id", material.id);

      toast.success("Bestand verwijderd");
      loadMaterials();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Kon bestand niet verwijderen");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    return '📁';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Lesmateriaal</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-full gap-2"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Uploaden
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {materials.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <File className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Nog geen lesmateriaal gedeeld</p>
          <p className="text-sm">Upload bestanden om te delen met je groepsleden</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="text-2xl">{getFileIcon(material.file_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{material.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(material.file_size)} • 
                    {material.uploader?.full_name} • 
                    {format(new Date(material.created_at), "d MMM", { locale: nl })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(material)}
                    className="rounded-full h-8 w-8"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {material.uploaded_by === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(material)}
                      className="rounded-full h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
