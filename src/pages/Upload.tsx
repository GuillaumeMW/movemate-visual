import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Camera, X, Loader2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import LoadingOverlay from "@/components/LoadingOverlay";

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
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Loading overlay state
  const [currentStep, setCurrentStep] = useState('');
  const [roomsDetected, setRoomsDetected] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [currentRoom, setCurrentRoom] = useState('');
  const [itemsFound, setItemsFound] = useState(0);

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

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeInMB = 10; // 10MB limit
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

    const validFiles: UploadedFile[] = [];
    const errors: string[] = [];
    const heicFiles: string[] = [];

    Array.from(selectedFiles).forEach(file => {
      // Check for HEIC files and provide helpful message
      if (file.name.toLowerCase().endsWith('.heic')) {
        heicFiles.push(file.name);
        return;
      }

      // Check file format
      if (!supportedFormats.includes(file.type)) {
        errors.push(`${file.name}: Unsupported format. Please use JPG, PNG, GIF, or WEBP.`);
        return;
      }

      // Check file size
      if (file.size > maxSizeInBytes) {
        errors.push(`${file.name}: File too large. Maximum size is ${maxSizeInMB}MB.`);
        return;
      }

      // Add valid file
      validFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        progress: 0
      });
    });

    // Handle HEIC files with helpful message
    if (heicFiles.length > 0) {
      toast.error(
        `HEIC files detected: ${heicFiles.join(', ')}. Please convert to JPG first using your Photos app.`,
        { 
          duration: 8000,
          description: "iPhone users: Select photos → Share → Save as Files → Choose JPEG format"
        }
      );
    }

    // Show other errors
    if (errors.length > 0) {
      errors.forEach(error => toast.error(error, { duration: 5000 }));
    }

    // Add valid files
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      toast.success(`Added ${validFiles.length} photo(s)`);
    }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileSelect(e.dataTransfer.files);
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
        const fileName = `${session.id}_${index + 1}_${Date.now()}.${fileExt}`;
        
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
      
      // TWO-PASS ANALYSIS SYSTEM
      
      // PASS 1: Room Detection
      setCurrentStep('room-detection');
      toast.info("Step 1: Detecting rooms across all images...", { duration: 3000 });
      
      const allBase64Images = await Promise.all(
        files.map(file => convertFileToBase64(file.file))
      );
      
      const { data: roomData, error: roomError } = await supabase.functions.invoke('analyze-inventory', {
        body: { 
          mode: 'room-detection',
          images: allBase64Images
        }
      });

      if (roomError) {
        console.error('Room detection error:', roomError);
        toast.error('Failed to detect rooms. Using default room assignment.');
      }

      const roomMappings = roomData?.image_room_mapping || {};
      const detectedRooms = roomData?.rooms_detected || [];
      
      console.log('Room detection results:', { roomMappings, detectedRooms });
      setRoomsDetected(detectedRooms);
      toast.success(`✓ Detected ${detectedRooms.length} rooms: ${detectedRooms.join(', ')}`, { duration: 4000 });
      
      // PASS 2: Item Analysis with Room Context
      setCurrentStep('item-analysis');
      toast.info("Step 2: Analyzing items with room context...", { duration: 2000 });
      setAnalysisProgress({ current: 0, total: files.length });
      let allItems: any[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setAnalysisProgress({ current: i + 1, total: files.length });
        setCurrentImage(i + 1);
        
        // Get room for this image
        const imageRoom = roomMappings[i + 1] || 'unknown room';
        setCurrentRoom(imageRoom);
        
        toast.info(`Analyzing image ${i + 1} of ${files.length}...`, { 
          duration: 1000,
          id: 'analysis-progress'
        });

        try {
          // Convert file to base64
          const base64Image = await convertFileToBase64(file.file);
          
          // Call the analyze-inventory edge function for single image with room context
          const { data, error } = await supabase.functions.invoke('analyze-inventory', {
            body: { 
              mode: 'item-analysis',
              image: base64Image,
              imageNumber: i + 1,
              existingItems: allItems,
              roomMappings: roomMappings
            }
          });

          if (error) {
            console.error(`Error analyzing image ${i + 1}:`, error);
            toast.error(`Failed to analyze image ${i + 1}`);
            continue;
          }

          if (data.items && data.items.length > 0) {
            allItems.push(...data.items);
            setItemsFound(data.items.length);
            toast.success(`✓ Found ${data.items.length} items in image ${i + 1}`, { 
              duration: 2000 
            });
          } else {
            setItemsFound(0);
            toast.info(`No items found in image ${i + 1}`, { duration: 1500 });
          }
        } catch (imageError) {
          console.error(`Error processing image ${i + 1}:`, imageError);
          toast.error(`Failed to process image ${i + 1}`);
        }
      }

      if (allItems.length > 0) {
        // Save all analysis results to database
        const itemsToInsert = allItems.map((item: any) => ({
          session_id: session.id,
          name: item.name,
          quantity: item.quantity,
          volume: item.volume,
          weight: item.weight,
          found_in_image: item.found_in_image || null,
          room: item.room,
          ai_generated: true
        }));

        const { error: itemsError } = await supabase
          .from('inventory_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Database insertion error:', itemsError);
          throw new Error(`Failed to save items to database: ${itemsError.message}`);
        }

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
        
        toast.success(`Analyzed ${files.length} photos and found ${allItems.length} items!`);
        navigate(`/review?session=${session.id}`);
      } else {
        toast.error("No items were detected in the photos. Please try different images.");
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze photos. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress({ current: 0, total: 0 });
      setCurrentStep('');
      setCurrentImage(0);
      setCurrentRoom('');
      setItemsFound(0);
      setRoomsDetected([]);
    }
  };

  return (
    <>
      <LoadingOverlay
        isVisible={isAnalyzing}
        currentStep={currentStep}
        progress={analysisProgress}
        roomsDetected={roomsDetected}
        currentImage={currentImage}
        currentRoom={currentRoom}
        itemsFound={itemsFound}
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/start">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Upload Photos</h1>
            </div>
            {currentSession && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/upload')}
              >
                New Inventory
              </Button>
            )}
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
                    Or click to select files. Supports JPG, PNG, GIF, WEBP (max 10MB each).
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
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={async (e) => await handleFileSelect(e.target.files)}
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
                    {analysisProgress.total > 0 ? 
                      `Analyzing ${analysisProgress.current}/${analysisProgress.total}...` : 
                      'Analyzing...'
                    }
                  </>
                ) : (
                  `Analyze Items (${files.length} photos)`
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UploadPage;