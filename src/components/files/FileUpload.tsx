import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, X, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  userId: string;
  onUploadComplete: () => void;
  folderId?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.includes('word')) return <FileText className="w-8 h-8 text-blue-600" />;
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <FileSpreadsheet className="w-8 h-8 text-orange-600" />;
  if (fileType.includes('pdf')) return <FileText className="w-8 h-8 text-red-600" />;
  return <File className="w-8 h-8 text-muted-foreground" />;
};

export const FileUpload = ({ userId, onUploadComplete, folderId }: FileUploadProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const supportedFiles = acceptedFiles.filter(file => {
      const type = file.type;
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ];
      return validTypes.includes(type) && file.size <= 50 * 1024 * 1024;
    });

    if (supportedFiles.length !== acceptedFiles.length) {
      toast.error("Sommige bestanden werden geweigerd. Alleen PDF, Word, PowerPoint, Excel en afbeeldingen onder 50MB worden ondersteund.");
    }

    const newUploads = supportedFiles.map(file => ({
      file,
      progress: 0,
    }));
    setUploadingFiles(prev => [...prev, ...newUploads]);

    for (let i = 0; i < supportedFiles.length; i++) {
      const file = supportedFiles[i];
      const fileName = `${userId}/${Date.now()}_${file.name}`;

      try {
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev =>
            prev.map(uf =>
              uf.file === file && uf.progress < 90
                ? { ...uf, progress: uf.progress + 10 }
                : uf
            )
          );
        }, 200);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(fileName, file);

        clearInterval(progressInterval);

        setUploadingFiles(prev =>
          prev.map(uf =>
            uf.file === file ? { ...uf, progress: 100 } : uf
          )
        );

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('files')
          .insert({
            owner_id: userId,
            filename: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_url: fileName,
            folder_id: folderId || null,
          });

        if (dbError) throw dbError;

        setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
      } catch (error: any) {
        setUploadingFiles(prev =>
          prev.map(uf =>
            uf.file === file ? { ...uf, error: error.message } : uf
          )
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (supportedFiles.length > 0) {
      onUploadComplete();
    }
  }, [userId, onUploadComplete, folderId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const removeUploadingFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-accent' : 'border-border hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-lg font-medium">Sleep bestanden hier...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-2">Sleep bestanden hier</p>
            <p className="text-sm text-muted-foreground mb-4">
              of klik om bestanden te selecteren
            </p>
            <p className="text-xs text-muted-foreground">
              Ondersteunt PDF, Word, PowerPoint, Excel en Afbeeldingen • Max 50MB per bestand
            </p>
          </>
        )}
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf, index) => (
            <div key={index} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-3 mb-2">
                {getFileIcon(uf.file.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uf.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uf.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeUploadingFile(uf.file)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {uf.error ? (
                <p className="text-sm text-destructive">{uf.error}</p>
              ) : (
                <Progress value={uf.progress} className="h-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
