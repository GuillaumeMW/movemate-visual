import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import LoadingOverlay from "@/components/LoadingOverlay";
import { ClientInfoDialog } from "@/components/ClientInfoDialog";
import { 
  Package, 
  Scale, 
  Ruler, 
  FileText, 
  Eye, 
  Edit2, 
  Trash2, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  X,
  AlertTriangle,
  Phone,
  Mail,
  User
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  volume: number;
  weight: number;
  room?: string;
  is_going: boolean;
}

interface AccessToken {
  id: string;
  session_id: string;
  access_level: string;
  recipient_name: string;
  recipient_email?: string;
  notes?: string;
  created_by_name: string;
  created_by_email: string;
}

interface InventorySession {
  id: string;
  name?: string;
  total_volume: number;
  total_weight: number;
  safety_factor: number;
  shared_by_name?: string;
  shared_by_email?: string;
  created_at: string;
}

export default function SharedInventory() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<AccessToken | null>(null);
  const [session, setSession] = useState<InventorySession | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<InventoryItem>>({});
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentRoom, setCurrentRoom] = useState("");
  const [showImageDialog, setShowImageDialog] = useState(false);

  const canEdit = accessToken?.access_level === "edit";

  // Load shared inventory data
  useEffect(() => {
    const loadSharedData = async () => {
      if (!token) {
        toast({
          title: "Invalid share link",
          description: "This share link is not valid.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        setLoading(true);

        // Validate access token and get session info
        const { data: accessData, error: accessError } = await supabase
          .from("inventory_access_tokens")
          .select("*, inventory_sessions(*)")
          .eq("token", token)
          .eq("is_active", true)
          .single();

        if (accessError || !accessData) {
          throw new Error("Invalid or expired share link");
        }

        setAccessToken(accessData);
        setSession(accessData.inventory_sessions);

        // Track access
        await supabase
          .from("inventory_access_tokens")
          .update({
            access_count: (accessData.access_count || 0) + 1,
            last_accessed_at: new Date().toISOString()
          })
          .eq("id", accessData.id);

        // Load inventory items
        const { data: itemsData, error: itemsError } = await supabase
          .from("inventory_items")
          .select("*")
          .eq("session_id", accessData.session_id)
          .order("room", { ascending: true })
          .order("name", { ascending: true });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Load uploaded images
        const { data: imagesData, error: imagesError } = await supabase
          .from("uploaded_images")
          .select("*")
          .eq("session_id", accessData.session_id)
          .order("analyzed_at", { ascending: true });

        if (imagesError) throw imagesError;
        setUploadedImages(imagesData || []);

      } catch (error: any) {
        console.error("Error loading shared inventory:", error);
        toast({
          title: "Error loading inventory",
          description: error.message || "Failed to load shared inventory.",
          variant: "destructive",
        });
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    loadSharedData();
  }, [token, navigate, toast]);

  const updateItem = useCallback(async (id: string, updates: Partial<InventoryItem>) => {
    if (!canEdit) return;
    
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setItems(prevItems => 
        prevItems.map(item => 
          item.id === id ? { ...item, ...updates } : item
        )
      );

      toast({
        title: "Item updated",
        description: "Inventory item has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error updating item:", error);
      toast({
        title: "Error updating item",
        description: error.message || "Failed to update item.",
        variant: "destructive",
      });
    }
  }, [canEdit, toast]);

  const deleteItem = useCallback(async (id: string) => {
    if (!canEdit) return;
    
    try {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setItems(prevItems => prevItems.filter(item => item.id !== id));
      
      toast({
        title: "Item deleted",
        description: "Inventory item has been deleted successfully.",
      });
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast({
        title: "Error deleting item",
        description: error.message || "Failed to delete item.",
        variant: "destructive",
      });
    }
  }, [canEdit, toast]);

  const addNewItem = useCallback(async (room: string) => {
    if (!canEdit || !session) return;
    
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          session_id: session.id,
          name: "New Item",
          quantity: 1,
          volume: 0,
          weight: 0,
          room: room,
          is_going: true,
          ai_generated: false,
        })
        .select()
        .single();

      if (error) throw error;

      setItems(prevItems => [...prevItems, data]);
      
      toast({
        title: "Item added",
        description: "New inventory item has been added successfully.",
      });
    } catch (error: any) {
      console.error("Error adding item:", error);
      toast({
        title: "Error adding item",
        description: error.message || "Failed to add item.",
        variant: "destructive",
      });
    }
  }, [canEdit, session, toast]);

  const handleGeneratePdf = async (clientInfo: { clientName: string; city: string; quoteId?: string }) => {
    if (!session) return;
    
    setIsGeneratingPdf(true);
    try {
      const response = await fetch(
        `https://ahtqiuhimddklgkrevzi.supabase.co/functions/v1/generate-inventory-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodHFpdWhpbWRka2xna3JldnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1Njc5ODMsImV4cCI6MjA3MTE0Mzk4M30.asYR6zp7-6nbBopx3dspFjQnHOYrQ9Jd7mpeS_t5RY0`,
          },
          body: JSON.stringify({
            sessionId: session.id,
            clientInfo,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      toast({
        title: "PDF Generated Successfully",
        description: "Your inventory report has been generated and opened for printing.",
      });
      
      setShowClientDialog(false);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error Generating PDF",
        description: error.message || "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getImageUrl = (filePath: string) => {
    const { data } = supabase.storage.from("inventory-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handlePreviousImage = () => {
    setCurrentImageIndex((prevIndex) => {
      const roomImages = uploadedImages.filter(img => {
        const fileName = img.file_name.toLowerCase();
        return fileName.includes(currentRoom.toLowerCase()) || currentRoom.toLowerCase().includes(fileName.replace(/\.[^/.]+$/, ""));
      });
      return (prevIndex - 1 + roomImages.length) % roomImages.length;
    });
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) => {
      const roomImages = uploadedImages.filter(img => {
        const fileName = img.file_name.toLowerCase();
        return fileName.includes(currentRoom.toLowerCase()) || currentRoom.toLowerCase().includes(fileName.replace(/\.[^/.]+$/, ""));
      });
      return (prevIndex + 1) % roomImages.length;
    });
  };

  if (loading) {
    return (
      <LoadingOverlay
        isVisible={true}
        currentStep="Loading shared inventory..."
        progress={{ current: 0, total: 0 }}
      />
    );
  }

  if (!accessToken || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              This share link is invalid or has expired. Please request a new link from the inventory owner.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const applySafetyFactor = (value: number) => value * (session?.safety_factor || 1);

  const totalItems = items.filter(item => item.is_going).length;
  const totalVolume = applySafetyFactor(
    items
      .filter(item => item.is_going)
      .reduce((sum, item) => sum + (item.volume * item.quantity), 0)
  );
  const totalWeight = applySafetyFactor(
    items
      .filter(item => item.is_going)
      .reduce((sum, item) => sum + (item.weight * item.quantity), 0)
  );

  const roomGroups = items.reduce((groups, item) => {
    const room = item.room || "Unassigned";
    if (!groups[room]) {
      groups[room] = [];
    }
    groups[room].push(item);
    return groups;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Shared Inventory Review
              </h1>
              <p className="text-muted-foreground mt-1">
                {canEdit ? "View and Edit" : "View Only"} • Shared by {accessToken.created_by_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={canEdit ? "default" : "secondary"}>
                {canEdit ? "Can Edit" : "View Only"}
              </Badge>
              <Button onClick={() => setShowClientDialog(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
            </div>
          </div>

          {/* Contact Information */}
          {(session.shared_by_name || session.shared_by_email) && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  {session.shared_by_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{session.shared_by_name}</span>
                    </div>
                  )}
                  {session.shared_by_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${session.shared_by_email}`}
                        className="text-primary hover:underline"
                      >
                        {session.shared_by_email}
                      </a>
                    </div>
                  )}
                </div>
                {accessToken.notes && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Notes:</p>
                    <p className="text-sm text-muted-foreground">{accessToken.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">
                Items to be moved
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <Ruler className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalVolume.toFixed(2)} m³</div>
              <p className="text-xs text-muted-foreground">
                With {((session?.safety_factor || 1) * 100).toFixed(0)}% safety factor
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWeight.toFixed(2)} kg</div>
              <p className="text-xs text-muted-foreground">
                With {((session?.safety_factor || 1) * 100).toFixed(0)}% safety factor
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory by Room */}
        <div className="space-y-6">
          {Object.entries(roomGroups).map(([room, roomItems]) => {
            const roomImages = uploadedImages.filter(img => {
              const fileName = img.file_name.toLowerCase();
              return fileName.includes(room.toLowerCase()) || room.toLowerCase().includes(fileName.replace(/\.[^/.]+$/, ""));
            });

            return (
              <Card key={room}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{room}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {roomItems.filter(item => item.is_going).length} items
                      </Badge>
                      {canEdit && (
                        <Button
                          size="sm"
                          onClick={() => addNewItem(room)}
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Item
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {roomImages.length > 0 && (
                    <div className="flex gap-2 mt-4 overflow-x-auto">
                      {roomImages.slice(0, 4).map((image, idx) => (
                        <img
                          key={image.id}
                          src={getImageUrl(image.file_path)}
                          alt={`Room ${room} - ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded cursor-pointer border"
                          onClick={() => {
                            setCurrentRoom(room);
                            setCurrentImageIndex(idx);
                            setShowImageDialog(true);
                          }}
                        />
                      ))}
                      {roomImages.length > 4 && (
                        <div className="w-20 h-20 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                          +{roomImages.length - 4} more
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
                
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-24">Volume (m³)</TableHead>
                        <TableHead className="w-24">Weight (kg)</TableHead>
                        <TableHead className="w-20">Going?</TableHead>
                        {canEdit && <TableHead className="w-20">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roomItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {editingItem === item.id && canEdit ? (
                              <Input
                                value={editingData.name || item.name}
                                onChange={(e) => setEditingData(prev => ({...prev, name: e.target.value}))}
                                className="h-8"
                              />
                            ) : (
                              <span className={!item.is_going ? "line-through text-muted-foreground" : ""}>
                                {item.name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItem === item.id && canEdit ? (
                              <Input
                                type="number"
                                value={editingData.quantity ?? item.quantity}
                                onChange={(e) => setEditingData(prev => ({...prev, quantity: parseInt(e.target.value) || 0}))}
                                className="h-8 w-16"
                                min="0"
                              />
                            ) : (
                              item.quantity
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItem === item.id && canEdit ? (
                              <Input
                                type="number"
                                value={editingData.volume ?? item.volume}
                                onChange={(e) => setEditingData(prev => ({...prev, volume: parseFloat(e.target.value) || 0}))}
                                className="h-8 w-20"
                                min="0"
                                step="0.01"
                              />
                            ) : (
                              item.volume.toFixed(2)
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItem === item.id && canEdit ? (
                              <Input
                                type="number"
                                value={editingData.weight ?? item.weight}
                                onChange={(e) => setEditingData(prev => ({...prev, weight: parseFloat(e.target.value) || 0}))}
                                className="h-8 w-20"
                                min="0"
                                step="0.01"
                              />
                            ) : (
                              item.weight.toFixed(2)
                            )}
                          </TableCell>
                          <TableCell>
                            {editingItem === item.id && canEdit ? (
                              <input
                                type="checkbox"
                                checked={editingData.is_going ?? item.is_going}
                                onChange={(e) => setEditingData(prev => ({...prev, is_going: e.target.checked}))}
                              />
                            ) : (
                              <Badge variant={item.is_going ? "default" : "secondary"}>
                                {item.is_going ? "Yes" : "No"}
                              </Badge>
                            )}
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              {editingItem === item.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      updateItem(item.id, editingData);
                                      setEditingItem(null);
                                      setEditingData({});
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    ✓
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingItem(null);
                                      setEditingData({});
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingItem(item.id);
                                      setEditingData(item);
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => deleteItem(item.id)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {Object.keys(roomGroups).length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Inventory Items</h3>
              <p className="text-muted-foreground">
                This shared inventory doesn't contain any items yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image Gallery Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Room Images - {currentRoom}</DialogTitle>
          </DialogHeader>
          <div className="relative w-full">
            {uploadedImages.filter(img => {
              const fileName = img.file_name.toLowerCase();
              return fileName.includes(currentRoom.toLowerCase()) || currentRoom.toLowerCase().includes(fileName.replace(/\.[^/.]+$/, ""));
            }).length > 0 ? (
              <img
                src={getImageUrl(
                  uploadedImages.filter(img => {
                    const fileName = img.file_name.toLowerCase();
                    return fileName.includes(currentRoom.toLowerCase()) || currentRoom.toLowerCase().includes(fileName.replace(/\.[^/.]+$/, ""));
                  })[currentImageIndex].file_path
                )}
                alt={`Room ${currentRoom} - ${currentImageIndex + 1}`}
                className="w-full object-contain rounded-md"
              />
            ) : (
              <div className="flex items-center justify-center h-64 bg-muted rounded-md">
                <p className="text-muted-foreground">No images for this room</p>
              </div>
            )}
            <div className="absolute top-1/2 transform -translate-y-1/2 left-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handlePreviousImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute top-1/2 transform -translate-y-1/2 right-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setShowImageDialog(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Info Dialog for PDF */}
      <ClientInfoDialog
        isOpen={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onSubmit={handleGeneratePdf}
        isGenerating={isGeneratingPdf}
      />
    </div>
  );
}
