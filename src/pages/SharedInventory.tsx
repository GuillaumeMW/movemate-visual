import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import LoadingOverlay from "@/components/LoadingOverlay";
import { ClientInfoDialog } from "@/components/ClientInfoDialog";
import { RoomDropdown } from "@/components/RoomDropdown";
import { 
  Package, 
  Scale, 
  Ruler, 
  FileText, 
  Edit3, 
  Trash2, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  X,
  AlertTriangle,
  Phone,
  Mail,
  User,
  Settings,
  Image as ImageIcon,
  Save
} from "lucide-react";
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  volume: number; // in cu ft
  weight: number; // in lbs
  found_in_image?: number; // which photo the item was found in
  room?: string; // room where item is located
  is_going?: boolean; // whether item is being moved
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

interface UploadedImage {
  id: string;
  file_name: string;
  file_path: string;
  analyzed_at: string;
}

export default function SharedInventory() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<AccessToken | null>(null);
  const [session, setSession] = useState<InventorySession | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageRoom, setSelectedImageRoom] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  
  // Safety factor state
  const [safetyFactor, setSafetyFactor] = useState(0.2);
  
  // Inline editing state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<InventoryItem>>({});
  
  // PDF generation state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Add new item states
  const [activeAddFormRoom, setActiveAddFormRoom] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    quantity: 1,
    volume: 0,
    weight: 0,
    room: '',
    is_going: true
  });

  const canEdit = accessToken?.access_level === "edit";

  // Load shared inventory data
  useEffect(() => {
    const loadSharedData = async () => {
      if (!token) {
        toast.error("Invalid share link: This share link is not valid.");
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

        // Load safety factor from session data or use default
        setSafetyFactor(accessData.inventory_sessions?.safety_factor ?? 0.2);
        
        // Sort uploaded images by the image number in file path
        const sortedImages = (imagesData || []).sort((a, b) => {
          const aNum = parseInt(a.file_path.split('_')[1]) || 0;
          const bNum = parseInt(b.file_path.split('_')[1]) || 0;
          return aNum - bNum;
        });
        setUploadedImages(sortedImages);

      } catch (error: any) {
        console.error("Error loading shared inventory:", error);
        toast.error("Failed to load shared inventory: " + (error.message || "Unknown error"));
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

      toast.success('Item updated');
    } catch (error: any) {
      console.error("Error updating item:", error);
      toast.error('Failed to update item');
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
      toast.success('Item deleted');
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast.error('Failed to delete item');
    }
  }, [canEdit, toast]);

  const addNewItem = async () => {
    if (!newItem.name) {
      toast.error('Please enter an item name');
      return;
    }

    try {
      const item: InventoryItem = {
        id: crypto.randomUUID(),
        name: newItem.name!,
        quantity: newItem.quantity || 1,
        volume: newItem.volume || 0,
        weight: newItem.weight || 0,
        room: newItem.room || activeAddFormRoom,
        is_going: newItem.is_going !== false
      };

      if (session) {
        const { error } = await supabase
          .from('inventory_items')
          .insert({
            session_id: session.id,
            name: item.name,
            quantity: item.quantity,
            volume: item.volume,
            weight: item.weight,
            room: item.room,
            is_going: item.is_going !== false,
            ai_generated: false
          });
        
        if (error) throw error;
      }

      setItems([...items, item]);
      setNewItem({
        name: '',
        quantity: 1,
        volume: 0,
        weight: 0,
        room: '',
        is_going: true
      });
      setActiveAddFormRoom(null);
      toast.success('Item added');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  // Apply safety factor to calculations
  const applyLoadingSafetyFactor = (value: number) => value * (1 + safetyFactor);
  
  const totalVolume = applyLoadingSafetyFactor(items.reduce((sum, item) => sum + (item.volume * item.quantity), 0));
  const totalWeight = applyLoadingSafetyFactor(items.reduce((sum, item) => sum + (item.weight * item.quantity), 0));
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const startEditing = (item: InventoryItem) => {
    setEditingItem(item.id);
    setEditingValues({
      name: item.name,
      quantity: item.quantity,
      volume: item.volume,
      weight: item.weight,
      room: item.room
    });
  };

  const saveEditing = async () => {
    if (!editingItem) return;
    
    const updates: Partial<InventoryItem> = {
      name: editingValues.name,
      quantity: editingValues.quantity,
      volume: editingValues.volume,
      weight: editingValues.weight,
      room: editingValues.room
    };
    
    await updateItem(editingItem, updates);
    setEditingItem(null);
    setEditingValues({});
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditingValues({});
  };

  const openAddFormForRoom = (room: string) => {
    setActiveAddFormRoom(room);
    setNewItem({
      name: '',
      quantity: 1,
      volume: 0,
      weight: 0,
      room: room,
      is_going: true
    });
  };

  const closeAddForm = () => {
    setActiveAddFormRoom(null);
    setNewItem({
      name: '',
      quantity: 1,
      volume: 0,
      weight: 0,
      room: '',
      is_going: true
    });
  };

  // Function to update safety factor in database
  const updateSafetyFactor = async (newSafetyFactor: number) => {
    setSafetyFactor(newSafetyFactor);
    
    if (session) {
      try {
        await supabase
          .from('inventory_sessions')
          .update({
            safety_factor: newSafetyFactor
          })
          .eq('id', session.id);
      } catch (error) {
        console.error('Error updating safety factor:', error);
        toast.error('Failed to save safety factor');
      }
    }
  };

  const handleGeneratePdf = async (clientInfo: { clientName: string; city: string; quoteId?: string }) => {
    if (!session) {
      toast.error("No session found. Please upload images first.");
      return;
    }

    setIsGeneratingPdf(true);
    
    try {
      const response = await fetch(`https://ahtqiuhimddklgkrevzi.supabase.co/functions/v1/generate-inventory-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodHFpdWhpbWRka2xna3JldnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1Njc5ODMsImV4cCI6MjA3MTE0Mzk4M30.asYR6zp7-6nbBopx3dspFjQnHOYrQ9Jd7mpeS_t5RY0`
        },
        body: JSON.stringify({
          sessionId: session.id,
          clientInfo,
          safetyFactor
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get HTML content and open in new window for printing
      const htmlContent = await response.text();
      
      // Show print settings recommendation
      toast.success(
        "Report ready! When printing, please use: Portrait layout, Letter paper size, Default margins, and enable Background graphics for best results.",
        { duration: 5000 }
      );
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load, then trigger print
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 1000);
      }

      setShowClientDialog(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF report. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleFinalizeClick = () => {
    setShowClientDialog(true);
  };

  const getImageUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('inventory-images')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const openImageGallery = (imageUrl: string, room: string, roomPhotos: UploadedImage[], clickedImageIndex: number) => {
    setSelectedImage(imageUrl);
    setSelectedImageRoom(room);
    setCurrentImageIndex(clickedImageIndex);
  };

  const closeImageGallery = () => {
    setSelectedImage(null);
    setSelectedImageRoom(null);
    setCurrentImageIndex(0);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImageRoom) return;
    
    // Get current room's photos
    const roomItems = items.filter(item => (item.room || 'Unassigned') === selectedImageRoom);
    const imageNumbers = new Set(roomItems.map(item => item.found_in_image).filter(Boolean));
    const roomPhotos = uploadedImages.filter(img => {
      const imgNumber = parseInt(img.file_path.split('_')[1]) || 0;
      return imageNumbers.has(imgNumber);
    });

    if (roomPhotos.length <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentImageIndex + 1) % roomPhotos.length;
    } else {
      newIndex = currentImageIndex === 0 ? roomPhotos.length - 1 : currentImageIndex - 1;
    }

    setCurrentImageIndex(newIndex);
    setSelectedImage(getImageUrl(roomPhotos[newIndex].file_path));
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedImage) return;
    
    if (e.key === 'ArrowLeft') {
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      navigateImage('next');
    } else if (e.key === 'Escape') {
      closeImageGallery();
    }
  };

  // Add keyboard event listener
  React.useEffect(() => {
    if (selectedImage) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedImage, currentImageIndex, selectedImageRoom]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navigation Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold">Shared Inventory Review</h1>
            <div className="flex items-center gap-3">
              <Badge variant={canEdit ? "default" : "secondary"}>
                {canEdit ? "Can Edit" : "View Only"}
              </Badge>
              <Button onClick={handleFinalizeClick}>
                Generate PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Review Shared Inventory</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  SF: {safetyFactor >= 0 ? '+' : ''}{(safetyFactor * 100).toFixed(0)}%
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                {[-0.1, 0, 0.1, 0.2, 0.3, 0.4].map((factor) => (
                  <DropdownMenuItem
                    key={factor}
                    onClick={() => updateSafetyFactor(factor)}
                    className={safetyFactor === factor ? "bg-accent" : ""}
                  >
                    {factor >= 0 ? '+' : ''}{(factor * 100).toFixed(0)}% Safety Factor
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-muted-foreground">
            {canEdit ? "Review and edit the shared inventory items. Click on any field to edit it." : "Review the shared inventory items."}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{totalVolume.toFixed(1)} cu ft</div>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{totalWeight.toFixed(0)} lbs</div>
              <p className="text-sm text-muted-foreground">Total Weight</p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information Card */}
        {(session.shared_by_name || session.shared_by_email) && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Information
                  </p>
                  <div className="flex items-center gap-6 text-sm mt-2">
                    {session.shared_by_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-700" />
                        <span className="text-blue-800">{session.shared_by_name}</span>
                      </div>
                    )}
                    {session.shared_by_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-700" />
                        <a 
                          href={`mailto:${session.shared_by_email}`}
                          className="text-blue-800 hover:underline"
                        >
                          {session.shared_by_email}
                        </a>
                      </div>
                    )}
                  </div>
                  {accessToken.notes && (
                    <div className="mt-2 p-2 bg-blue-100 rounded text-xs text-blue-800">
                      <span className="font-medium">Notes:</span> {accessToken.notes}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Source Info */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Session: {session.name} - {items.length} items
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Created: {new Date(session?.created_at).toLocaleDateString()} - {canEdit ? 'All changes are automatically saved' : 'Read-only access'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items by Room */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Inventory Items by Room</h2>
          </div>

          {(() => {
            // Group items by room
            const roomGroups = items.reduce((groups, item) => {
              const room = item.room || 'Unassigned';
              if (!groups[room]) groups[room] = [];
              groups[room].push(item);
              return groups;
            }, {} as Record<string, InventoryItem[]>);

            // Get photos for each room
            const getRoomPhotos = (roomItems: InventoryItem[]) => {
              const imageNumbers = new Set(roomItems.map(item => item.found_in_image).filter(Boolean));
              return uploadedImages.filter(img => {
                const imgNumber = parseInt(img.file_path.split('_')[1]) || 0;
                return imageNumbers.has(imgNumber);
              });
            };

            return Object.entries(roomGroups).map(([room, roomItems]) => {
              const roomPhotos = getRoomPhotos(roomItems);
              const roomVolume = roomItems.reduce((sum, item) => sum + (item.volume * item.quantity), 0);
              const roomWeight = roomItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);

              return (
                <Card key={room} className="mb-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {room}
                          <Badge variant="secondary">{roomItems.length} items</Badge>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {roomVolume.toFixed(1)} cu ft • {roomWeight.toFixed(0)} lbs
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Room Photos */}
                    {roomPhotos.length > 0 && (
                      <div className="p-4 border-b">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Photos from this room ({roomPhotos.length})
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {roomPhotos.map((image, index) => (
                            <div
                              key={image.id}
                              className="relative group cursor-pointer"
                              onClick={() => openImageGallery(getImageUrl(image.file_path), room, roomPhotos, index)}
                            >
                              <img
                                src={getImageUrl(image.file_path)}
                                alt={image.file_name}
                                className="w-full h-20 object-cover rounded-md border hover:border-primary transition-colors"
                              />
                               <div className="absolute top-1 left-1">
                                 <Badge variant="secondary" className="text-xs font-bold bg-white/90 text-black">
                                   #{image.file_path.split('_')[1] || index + 1}
                                 </Badge>
                               </div>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-md flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="bg-white/90 p-1 rounded text-xs font-medium">
                                    Click to view
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className="p-4 w-20">Going</th>
                            <th className="p-4">Item Name</th>
                            <th className="p-4">Image #</th>
                            <th className="p-4">Quantity</th>
                            <th className="p-4">Volume (cu ft)</th>
                            <th className="p-4">Weight (lbs)</th>
                            <th className="p-4">Room</th>
                            {canEdit && <th className="p-4">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {roomItems.map((item) => (
                             <tr key={item.id} className="border-b hover:bg-muted/50">
                               <td className="p-4">
                                 <div className="flex flex-col items-center gap-1">
                                   <Switch
                                     checked={item.is_going !== false}
                                     onCheckedChange={(checked) => updateItem(item.id, { is_going: checked })}
                                     disabled={!canEdit}
                                   />
                                   <span className="text-xs text-muted-foreground">
                                     {item.is_going !== false ? 'Going' : 'Not going'}
                                   </span>
                                 </div>
                               </td>
                                <td className="p-4">
                                  {editingItem === item.id ? (
                                    <Input
                                      value={editingValues.name || ''}
                                      onChange={(e) => setEditingValues(prev => ({ ...prev, name: e.target.value }))}
                                      className="h-8"
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="font-medium">{item.name}</div>
                                  )}
                                </td>
                                <td className="p-4">
                                   <Badge variant="outline" className="text-xs">
                                     #{item.found_in_image || 'N/A'}
                                   </Badge>
                                </td>
                                <td className="p-4">
                                  {editingItem === item.id ? (
                                    <Input
                                      type="number"
                                      value={editingValues.quantity || ''}
                                      onChange={(e) => setEditingValues(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                      className="h-8 w-16"
                                    />
                                  ) : (
                                    <div>{item.quantity}</div>
                                  )}
                                </td>
                                <td className="p-4">
                                  {editingItem === item.id ? (
                                    <Input
                                      type="number"
                                      value={editingValues.volume || ''}
                                      onChange={(e) => setEditingValues(prev => ({ ...prev, volume: parseFloat(e.target.value) || 0 }))}
                                      className="h-8 w-20"
                                      step="0.1"
                                    />
                                  ) : (
                                    <div>{item.volume}</div>
                                  )}
                                </td>
                                <td className="p-4">
                                  {editingItem === item.id ? (
                                    <Input
                                      type="number"
                                      value={editingValues.weight || ''}
                                      onChange={(e) => setEditingValues(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                                      className="h-8 w-20"
                                      step="0.5"
                                    />
                                  ) : (
                                    <div>{item.weight}</div>
                                  )}
                                 </td>
                                <td className="p-4">
                                  {editingItem === item.id ? (
                                    <RoomDropdown
                                      value={editingValues.room}
                                      onValueChange={(room) => setEditingValues(prev => ({ ...prev, room }))}
                                    />
                                  ) : (
                                    <div>{item.room || 'Unassigned'}</div>
                                  )}
                                </td>
                               {canEdit && (
                                 <td className="p-4">
                                   <div className="flex gap-1">
                                     {editingItem === item.id ? (
                                       <>
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={saveEditing}
                                           className="text-green-600 hover:text-green-700"
                                         >
                                           <Save className="h-4 w-4" />
                                         </Button>
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={cancelEditing}
                                           className="text-gray-600 hover:text-gray-700"
                                         >
                                           <X className="h-4 w-4" />
                                         </Button>
                                       </>
                                     ) : (
                                       <>
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => startEditing(item)}
                                           className="text-blue-600 hover:text-blue-700"
                                         >
                                           <Edit3 className="h-4 w-4" />
                                         </Button>
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => deleteItem(item.id)}
                                           className="text-destructive hover:text-destructive"
                                         >
                                           <Trash2 className="h-4 w-4" />
                                         </Button>
                                       </>
                                     )}
                                   </div>
                                 </td>
                               )}
                             </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Add Item Button for this room */}
                    {canEdit && (
                      <div className="p-4 border-t bg-muted/30">
                        <Button 
                          variant="outline" 
                          onClick={() => openAddFormForRoom(room)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item to {room}
                        </Button>
                      </div>
                    )}

                    {/* Add Item Form for this room */}
                    {activeAddFormRoom === room && canEdit && (
                      <div className="p-4 border-t bg-blue-50 border-blue-200">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Add New Item to {room}</h4>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={closeAddForm}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                              value={newItem.name || ''}
                              onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Item name"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Quantity</label>
                            <Input
                              type="number"
                              value={newItem.quantity || ''}
                              onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                              className="h-8"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Volume (cu ft)</label>
                            <Input
                              type="number"
                              value={newItem.volume || ''}
                              onChange={(e) => setNewItem(prev => ({ ...prev, volume: parseFloat(e.target.value) || 0 }))}
                              className="h-8"
                              step="0.1"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Weight (lbs)</label>
                            <Input
                              type="number"
                              value={newItem.weight || ''}
                              onChange={(e) => setNewItem(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                              className="h-8"
                              step="0.5"
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button 
                            onClick={addNewItem}
                            size="sm"
                          >
                            Add Item
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={closeAddForm}
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      </div>

      {/* Image Gallery Dialog */}
      <Dialog open={selectedImage !== null} onOpenChange={() => closeImageGallery()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Room Photos - {selectedImageRoom}</DialogTitle>
          </DialogHeader>
          
          <div className="relative px-6 pb-6">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <img
                src={selectedImage || ''}
                alt="Room photo"
                className="w-full max-h-[70vh] object-contain"
              />
              
              {/* Navigation Buttons */}
              <button
                onClick={() => navigateImage('prev')}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => navigateImage('next')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <ChevronRight size={24} />
              </button>
              
              {/* Close Button */}
              <button
                onClick={closeImageGallery}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              {/* Image Counter */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {(() => {
                  const roomItems = items.filter(item => (item.room || 'Unassigned') === selectedImageRoom);
                  const imageNumbers = new Set(roomItems.map(item => item.found_in_image).filter(Boolean));
                  return uploadedImages.filter(img => {
                    const imgNumber = parseInt(img.file_path.split('_')[1]) || 0;
                    return imageNumbers.has(imgNumber);
                  }).length;
                })()}
              </div>
            </div>
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
