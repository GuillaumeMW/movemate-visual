import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Camera, X, Loader2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  progress: number;
}

const UploadPage = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId) {
      loadExistingSession(sessionId);
    }
  }, [searchParams]);

  const loadExistingSession = async (sessionId: string) => {
    try {
      const { data: session, error } = await supabase
        .from('inventory_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setCurrentSession(session);
      toast.success(`Continuing with existing session: ${session.name}`);
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('Could not load existing session');
    }
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one photo");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Use existing session or create a new one
      let session = currentSession;
      
      if (!session) {
        const { data: newSession, error: sessionError } = await supabase
          .from('inventory_sessions')
          .insert({
            name: `Inventory Session ${new Date().toLocaleDateString()}`,
            status: 'active'
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        session = newSession;
      }

      // Upload files to Supabase Storage and track them
      const uploadPromises = files.map(async (file, index) => {
        const fileExt = file.file.name.split('.').pop();
        const fileName = `${session.id}_${index}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('inventory-images')
          .upload(fileName, file.file);

        if (uploadError) throw uploadError;

        // Track the uploaded image
        await supabase
          .from('uploaded_images')
          .insert({
            session_id: session.id,
            file_path: fileName,
            file_name: file.file.name
          });

        return fileName;
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      
      // Convert files to base64 for AI analysis
      const imagePromises = files.map(file => convertFileToBase64(file.file));
      const base64Images = await Promise.all(imagePromises);
      
      toast.info("Analyzing photos with AI...", { duration: 2000 });

      // Call the analyze-inventory edge function
      const { data, error } = await supabase.functions.invoke('analyze-inventory', {
        body: { 
          images: base64Images
        }
      });

      if (error) throw error;

      if (data.items && data.items.length > 0) {
        // Save analysis results to database
        const itemsToInsert = data.items.map((item: any) => ({
          session_id: session.id,
          name: item.name,
          quantity: item.quantity,
          volume: item.volume,
          weight: item.weight,
          notes: item.notes,
          ai_generated: true
        }));

        const { error: itemsError } = await supabase
          .from('inventory_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Get existing items to calculate totals correctly
        const { data: existingItems, error: fetchError } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('session_id', session.id);

        if (fetchError) throw fetchError;

        // Update session totals with all items
        const totalVolume = existingItems.reduce((sum, item) => sum + (item.volume * item.quantity), 0);
        const totalWeight = existingItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);

        await supabase
          .from('inventory_sessions')
          .update({
            total_volume: totalVolume,
            total_weight: totalWeight
          })
          .eq('id', session.id);
        
        toast.success(`Analyzed ${files.length} photos and found ${data.items.length} items!`);
        navigate(`/review?session=${session.id}`);
      } else {
        toast.error("No items were detected in the photos. Please try different images.");
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze photos. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/start">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Upload Photos</h1>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Session Info */}
          {currentSession && (
            <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-primary">Continuing Session</h3>
                  <p className="text-sm text-muted-foreground">{currentSession.name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/review?session=${currentSession.id}`)}
                >
                  View Existing Items
                </Button>
              </div>
            </div>
          )}

          {/* Upload Area */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add Your Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Drag and drop your photos here</h3>
                <p className="text-muted-foreground mb-4">
                  Or click to select files. Supports JPG, PNG files.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
                  </Button>
                  <Button
                    onClick={() => {
                      // For MVP, we'll show a toast about camera functionality
                      toast.info("Camera capture coming soon! Please use file upload for now.");
                    }}
                    variant="outline"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Uploaded Photos ({files.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {files.map((file) => (
                    <div key={file.id} className="relative group">
                      <img
                        src={file.preview}
                        alt={file.file.name}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(file.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      {file.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <div className="text-white text-center">
                            <Progress value={file.progress} className="mb-2" />
                            <span className="text-sm">{file.progress}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" asChild>
              <Link to="/manual">Add Manual Items</Link>
            </Button>
            <Button 
              onClick={handleAnalyze}
              disabled={files.length === 0 || isAnalyzing}
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                `Analyze Items (${files.length} photos)`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;