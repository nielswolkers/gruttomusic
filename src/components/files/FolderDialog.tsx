import { useState } from "react";
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
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import folderOrange from "@/assets/folder-orange.png";
import folderPink from "@/assets/folder-pink.png";
import folderRed from "@/assets/folder-red.png";
import folderBlue from "@/assets/folder-blue.png";
import folderGreen from "@/assets/folder-green.png";
import folderBlueDark from "@/assets/folder-blue-dark.png";
import folderYellow from "@/assets/folder-yellow.png";
import folderGold from "@/assets/folder-gold.png";

interface FolderDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  parentFolderId?: string;
}

const FOLDER_COLORS = [
  { name: "Oranje", color: "#ECA869", icon: folderOrange },
  { name: "Roze", color: "#E4B4E6", icon: folderPink },
  { name: "Rood", color: "#E86C6C", icon: folderRed },
  { name: "Blauw", color: "#7FABDB", icon: folderBlue },
  { name: "Groen", color: "#6BC497", icon: folderGreen },
  { name: "Donkerblauw", color: "#4B8FBA", icon: folderBlueDark },
  { name: "Geel", color: "#E8C547", icon: folderYellow },
  { name: "Goud", color: "#D4A017", icon: folderGold },
];

export const FolderDialog = ({ open, onClose, onSuccess, userId, parentFolderId }: FolderDialogProps) => {
  const [folderName, setFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].color);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast.error("Voer een mapnaam in");
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('folders')
        .insert({
          name: folderName.trim(),
          color: selectedColor,
          owner_id: userId,
          parent_folder_id: parentFolderId || null,
        });

      if (error) throw error;

      toast.success("Map aangemaakt");
      setFolderName("");
      setSelectedColor(FOLDER_COLORS[0].color);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Kon map niet aanmaken");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuwe Map Aanmaken</DialogTitle>
          <DialogDescription>
            Organiseer je bestanden met aangepaste mappen
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
            />
          </div>

          <div className="space-y-2">
            <Label>Mapkleur</Label>
            <div className="grid grid-cols-4 gap-3">
              {FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption.color}
                  onClick={() => setSelectedColor(colorOption.color)}
                  className={`h-20 rounded-xl border-2 transition-all flex items-center justify-center bg-background ${
                    selectedColor === colorOption.color
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-border hover:border-primary/50"
                  }`}
                  title={colorOption.name}
                >
                  <img
                    src={colorOption.icon}
                    alt={colorOption.name}
                    className="w-12 h-10 object-contain"
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
              onClick={handleCreate}
              disabled={!folderName.trim() || isCreating}
              className="flex-1"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              {isCreating ? "Aanmaken..." : "Map Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
