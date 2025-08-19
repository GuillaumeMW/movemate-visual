import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Camera, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { toast } from "sonner";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one photo");
      return;
    }

    // For MVP, we'll simulate AI analysis and create sample data based on uploaded photos
    const mockAnalysisResults = files.map((file, index) => ({
      id: `item_${index + 1}`,
      label: `Item from ${file.file.name}`,
      category: ['Furniture', 'Electronics', 'Boxes', 'Appliances'][index % 4],
      room: ['Living Room', 'Bedroom', 'Kitchen', 'Office'][index % 4],
      quantity: Math.floor(Math.random() * 3) + 1,
      estimatedVolume: parseFloat((Math.random() * 2 + 0.5).toFixed(1)),
      estimatedWeight: Math.floor(Math.random() * 50 + 5),
      confidence: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
      thumbnail: file.preview,
      sourceImage: file.file.name
    }));

    // Store the analysis results in localStorage for the Review page
    localStorage.setItem('inventoryAnalysis', JSON.stringify(mockAnalysisResults));
    
    toast.success(`Analyzed ${files.length} photos and found ${mockAnalysisResults.length} items!`);
    navigate('/review');
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
              disabled={files.length === 0}
              size="lg"
            >
              Analyze Items ({files.length} photos)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;