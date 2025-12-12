import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import folderOrange from "@/assets/folder-orange.png";
import folderPink from "@/assets/folder-pink.png";
import folderRed from "@/assets/folder-red.png";
import folderBlue from "@/assets/folder-blue.png";
import folderGreen from "@/assets/folder-green.png";
import folderYellow from "@/assets/folder-yellow.png";
import folderSalmon from "@/assets/folder-salmon.png";
import folderGray from "@/assets/folder-gray.png";

interface FolderRenameDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  folderId: string;
  currentName: string;
  currentColor: string;
}

const FOLDER_COLORS = [
  { name: "Geel", color: "#E8C547", icon: folderYellow },
  { name: "Oranje", color: "#ECA869", icon: folderOrange },
  { name: "Roze", color: "#E4B4E6", icon: folderPink },
  { name: "Rood", color: "#E86C6C", icon: folderRed },
  { name: "Blauw", color: "#7FABDB", icon: folderBlue },
  { name: "Groen", color: "#6BC497", icon: folderGreen },
  { name: "Zalm", color: "#FFB6B6", icon: folderSalmon },
  { name: "Grijs", color: "#9CA3AF", icon: folderGray },
];

export const FolderRenameDialog = ({
  open,
  onClose,
  onSuccess,
  folderId,
  currentName,
  currentColor
}: FolderRenameDialogProps) => {
  const [folderName, setFolderName] = useState(currentName);
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      setFolderName(currentName);
      setSelectedColor(currentColor);
    }
  }, [open, currentName, currentColor]);

  const handleSave = async () => {
    if (!folderName.trim()) {
      toast.error("Voer een mapnaam in");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('folders')
        .update({
          name: folderName.trim(),
          color: selectedColor
        })
        .eq('id', folderId);

      if (error) throw error;

      toast.success("Map bijgewerkt");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Kon map niet bijwerken");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Map Wijzigen</DialogTitle>
          <DialogDescription>
            Wijzig de naam en kleur van deze map
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Mapnaam</Label>
            <Input
              id="folder-name"
              placeholder="Voer mapnaam in"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Mapkleur</Label>
            <div className="grid grid-cols-4 gap-3">
              {FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption.color}
                  onClick={() => setSelectedColor(colorOption.color)}
                  className={`h-16 rounded-xl border-2 transition-all flex items-center justify-center bg-background ${
                    selectedColor === colorOption.color
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-border hover:border-primary/50"
                  }`}
                  title={colorOption.name}
                >
                  <img
                    src={colorOption.icon}
                    alt={colorOption.name}
                    className="w-10 h-8 object-contain"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuleren
            </Button>
            <Button
              onClick={handleSave}
              disabled={!folderName.trim() || isUpdating}
              className="flex-1"
            >
              {isUpdating ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
