import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ArrowLeft, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

const FilePreview = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  useEffect(() => {
    loadFile();
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [fileId]);

  const loadFile = async () => {
    if (!fileId) return;

    setLoading(true);
    try {
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .maybeSingle();

      if (fileError) throw fileError;
      if (!fileData) {
        toast.error("Bestand niet gevonden");
        navigate(-1);
        return;
      }
      
      setFile(fileData);
      setNewFileName(fileData.filename);

      // Download file for preview
      const { data, error } = await supabase.storage
        .from('user-files')
        .download(fileData.storage_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
    } catch (error: any) {
      toast.error("Kon bestand niet laden");
      console.error(error);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file || !previewUrl) return;

    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Bestand gedownload");
  };

  const handleRename = async () => {
    if (!file || !newFileName.trim()) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ filename: newFileName.trim() })
        .eq('id', file.id);

      if (error) throw error;

      setFile({ ...file, filename: newFileName.trim() });
      setIsEditingName(false);
      toast.success("Bestandsnaam gewijzigd");
    } catch (error: any) {
      toast.error("Kon bestandsnaam niet wijzigen");
      console.error(error);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const isImage = file?.file_type.includes('image');
  const isPdf = file?.file_type.includes('pdf');
  const isWord = file?.file_type.includes('word');
  const isExcel = file?.file_type.includes('excel') || file?.file_type.includes('spreadsheet');
  const isPowerPoint = file?.file_type.includes('powerpoint') || file?.file_type.includes('presentation');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="h-9 rounded-full"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={handleRename} className="rounded-full">
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  setNewFileName(file.filename);
                  setIsEditingName(false);
                }} className="rounded-full">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-lg font-semibold truncate">{file?.filename}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 rounded-full"
                  onClick={() => setIsEditingName(true)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <Button
            variant="default"
            onClick={handleDownload}
            className="rounded-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Downloaden
          </Button>
        </div>
      </header>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-6 bg-background">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {!loading && previewUrl && (
          <div className="max-w-7xl mx-auto">
            {isImage && (
              <img
                src={previewUrl}
                alt={file?.filename}
                className="max-w-full h-auto mx-auto rounded-2xl shadow-lg"
              />
            )}

            {isPdf && (
              <iframe
                src={previewUrl}
                className="w-full h-[calc(100vh-200px)] rounded-2xl border shadow-lg"
                title={file?.filename}
              />
            )}

            {(isWord || isExcel || isPowerPoint) && (
              <div className="border rounded-2xl p-12 text-center bg-card">
                <p className="text-muted-foreground mb-4">
                  Voorbeeld niet beschikbaar voor dit bestandstype
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Dubbelklik op het bestand in de bestandslijst om het te openen in {isWord ? 'Word' : isExcel ? 'Excel' : 'PowerPoint'}
                </p>
                <Button onClick={handleDownload} className="rounded-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download om te bekijken
                </Button>
              </div>
            )}

            {!isImage && !isPdf && !isWord && !isExcel && !isPowerPoint && (
              <div className="border rounded-2xl p-12 text-center bg-card">
                <p className="text-muted-foreground mb-4">
                  Voorbeeld niet beschikbaar voor dit bestandstype
                </p>
                <Button onClick={handleDownload} className="rounded-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download om te bekijken
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreview;
