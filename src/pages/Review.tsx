import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trash2, Edit3, Plus, Save, X, Image as ImageIcon, ChevronLeft, ChevronRight, Share2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RoomDropdown } from '@/components/RoomDropdown';
import { ClientInfoDialog } from '@/components/ClientInfoDialog';

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

interface UploadedImage {
  id: string;
  file_name: string;
  file_path: string;
  analyzed_at: string;
}

// Mock data - in real app this would come from AI analysis
const mockItems: InventoryItem[] = [
  {
    id: '1',
    name: 'Queen Size Bed',
    quantity: 1,
    volume: 88.4, // cu ft
    weight: 99, // lbs
    room: 'Bedroom',
    is_going: true
  },
  {
    id: '2',
    name: 'Dining Table',
    quantity: 1,
    volume: 63.5,
    weight: 77,
    room: 'Dining Room',
    is_going: true
  },
  {
    id: '3',
    name: 'Medium Boxes',
    quantity: 5,
    volume: 2.0,
    weight: 18,
    room: 'Living Room',
    is_going: true
  },
  {
    id: '4',
    name: 'Television (55 inch)',
    quantity: 1,
    volume: 28.3,
    weight: 33,
    room: 'Living Room',
    is_going: true
  }
];


export default function Review() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageRoom, setSelectedImageRoom] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Safety factor state
  const [safetyFactor, setSafetyFactor] = useState(0.2);
  
  // Inline editing state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<InventoryItem>>({});
  
  // PDF generation state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Load inventory items from database
  useEffect(() => {
    const loadInventoryData = async () => {
      if (!sessionId) {
        // Fallback to localStorage if no session ID (backward compatibility)
        const storedData = localStorage.getItem('inventoryAnalysis');
        if (storedData) {
          try {
            const parsed = JSON.parse(storedData);
            setItems(parsed);
          } catch (error) {
            console.error('Error parsing stored inventory data:', error);
            setItems(mockItems);
          }
        } else {
          setItems(mockItems);
        }
        setIsLoading(false);
        return;
      }

      try {
        // Load session info, items, and images from database
        const [sessionResult, itemsResult, imagesResult] = await Promise.all([
          supabase
            .from('inventory_sessions')
            .select('*')
            .eq('id', sessionId)
            .single(),
          supabase
            .from('inventory_items')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true }),
          supabase
            .from('uploaded_images')
            .select('*')
            .eq('session_id', sessionId)
            .order('file_path', { ascending: true })
        ]);

        if (sessionResult.error) throw sessionResult.error;
        if (itemsResult.error) throw itemsResult.error;
        if (imagesResult.error) throw imagesResult.error;

        setSessionInfo(sessionResult.data);
        // Load safety factor from session data or use default
        setSafetyFactor(sessionResult.data?.safety_factor ?? 0.2);
        setItems(itemsResult.data || []);
        
        // Sort uploaded images by the image number in file path
        const sortedImages = (imagesResult.data || []).sort((a, b) => {
          const aNum = parseInt(a.file_path.split('_')[1]) || 0;
          const bNum = parseInt(b.file_path.split('_')[1]) || 0;
          return aNum - bNum;
        });
        setUploadedImages(sortedImages);
      } catch (error) {
        console.error('Error loading inventory data:', error);
        toast.error('Failed to load inventory data');
        setItems(mockItems);
      } finally {
        setIsLoading(false);
      }
    };

    loadInventoryData();
  }, [sessionId]);
  
  const [activeAddFormRoom, setActiveAddFormRoom] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    quantity: 1,
    volume: 0,
    weight: 0,
    room: '',
    is_going: true
  });

  // Apply safety factor to calculations
  const applyLoadingSafetyFactor = (value: number) => value * (1 + safetyFactor);
  
  const totalVolume = applyLoadingSafetyFactor(items.reduce((sum, item) => sum + (item.volume * item.quantity), 0));
  const totalWeight = applyLoadingSafetyFactor(items.reduce((sum, item) => sum + (item.weight * item.quantity), 0));
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      if (sessionId) {
        const { error } = await supabase
          .from('inventory_items')
          .update(updates)
          .eq('id', id);
        
        if (error) throw error;
        
        // Update session totals
        await updateSessionTotals();
      }
      
      setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
      toast.success('Item updated');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

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

  const deleteItem = async (id: string) => {
    try {
      if (sessionId) {
        const { error } = await supabase
          .from('inventory_items')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        // Update session totals
        await updateSessionTotals();
      }
      
      setItems(items.filter(item => item.id !== id));
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

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

      if (sessionId) {
        const { error } = await supabase
          .from('inventory_items')
          .insert({
            session_id: sessionId,
            name: item.name,
            quantity: item.quantity,
            volume: item.volume,
            weight: item.weight,
            room: item.room,
            is_going: item.is_going !== false,
            ai_generated: false
          });
        
        if (error) throw error;
        
        // Update session totals
        await updateSessionTotals();
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


  // Helper function to update session totals and safety factor
  const updateSessionTotals = async () => {
    if (!sessionId) return;
    
    try {
      const { data: currentItems } = await supabase
        .from('inventory_items')
        .select('volume, weight, quantity')
        .eq('session_id', sessionId);

      if (currentItems) {
        const totalVolume = currentItems.reduce((sum, item) => sum + (item.volume * item.quantity), 0);
        const totalWeight = currentItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);

        await supabase
          .from('inventory_sessions')
          .update({
            total_volume: totalVolume,
            total_weight: totalWeight,
            safety_factor: safetyFactor
          })
          .eq('id', sessionId);
      }
    } catch (error) {
      console.error('Error updating session totals:', error);
    }
  };

  // Function to update safety factor in database
  const updateSafetyFactor = async (newSafetyFactor: number) => {
    setSafetyFactor(newSafetyFactor);
    
    if (sessionId) {
      try {
        await supabase
          .from('inventory_sessions')
          .update({
            safety_factor: newSafetyFactor
          })
          .eq('id', sessionId);
      } catch (error) {
        console.error('Error updating safety factor:', error);
        toast.error('Failed to save safety factor');
      }
    }
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

  // Handle PDF generation
  const handleGeneratePdf = async (clientInfo: { clientName: string; city: string; quoteId?: string }) => {
    if (!sessionId) {
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
          sessionId,
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

      toast.success("PDF report generated and downloaded successfully!");
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


  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navigation Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold">Inventory Review</h1>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/upload')}>
                New Inventory
              </Button>
              <Button variant="outline" onClick={() => {}}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button onClick={handleFinalizeClick}>
                Finalize Report
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Review Your Inventory</h1>
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
            Review and edit the items we detected. Click on any field to edit it.
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


        {/* Data Source Info */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {sessionId && sessionInfo
                    ? `Session: ${sessionInfo.name} - ${items.length} items` 
                    : `Showing ${items.length} sample items (upload photos to analyze real inventory)`}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {sessionId 
                    ? `Created: ${new Date(sessionInfo?.created_at).toLocaleDateString()} - All changes are automatically saved`
                    : 'You can edit quantities, add notes, or add/remove items as needed'}
                </p>
              </div>
              {!sessionId && (
                <Button 
                  onClick={() => navigate('/upload')}
                  size="sm"
                  variant="outline"
                >
                  Upload Photos
                </Button>
              )}
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
                            <th className="p-4">Actions</th>
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
                             </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Add Item Button for this room */}
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

                    {/* Add Item Form for this room */}
                    {activeAddFormRoom === room && (
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">Item Name *</label>
                            <Input
                              value={newItem.name || ''}
                              onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                              placeholder="e.g., Sofa, Box, Table"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Quantity</label>
                            <Input
                              type="number"
                              value={newItem.quantity || 1}
                              onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Volume (cu ft)</label>
                            <Input
                              type="number"
                              value={newItem.volume || 0}
                              onChange={(e) => setNewItem({...newItem, volume: parseFloat(e.target.value) || 0})}
                              step="0.1"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Weight (lbs)</label>
                            <Input
                              type="number"
                              value={newItem.weight || 0}
                              onChange={(e) => setNewItem({...newItem, weight: parseFloat(e.target.value) || 0})}
                              step="0.5"
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={addNewItem}>
                            <Save className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                          <Button variant="outline" onClick={closeAddForm}>
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



         {/* Image Preview Dialog */}
        <Dialog open={selectedImage !== null} onOpenChange={closeImageGallery}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Photo Preview {selectedImageRoom && `- ${selectedImageRoom}`}</span>
                {(() => {
                  if (!selectedImageRoom) return null;
                  const roomItems = items.filter(item => (item.room || 'Unassigned') === selectedImageRoom);
                  const imageNumbers = new Set(roomItems.map(item => item.found_in_image).filter(Boolean));
                  const roomPhotos = uploadedImages.filter(img => {
                    const imgNumber = parseInt(img.file_path.split('_')[1]) || 0;
                    return imageNumbers.has(imgNumber);
                  });
                  
                  if (roomPhotos.length > 1) {
                    return (
                      <span className="text-sm text-muted-foreground font-normal">
                        {currentImageIndex + 1} of {roomPhotos.length}
                      </span>
                    );
                  }
                  return null;
                })()}
              </DialogTitle>
            </DialogHeader>
            {selectedImage && (
              <div className="relative flex items-center justify-center p-4">
                {(() => {
                  if (!selectedImageRoom) return null;
                  const roomItems = items.filter(item => (item.room || 'Unassigned') === selectedImageRoom);
                  const imageNumbers = new Set(roomItems.map(item => item.found_in_image).filter(Boolean));
                  const roomPhotos = uploadedImages.filter(img => {
                    const imgNumber = parseInt(img.file_path.split('_')[1]) || 0;
                    return imageNumbers.has(imgNumber);
                  });
                  
                  if (roomPhotos.length > 1) {
                    return (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background"
                          onClick={() => navigateImage('prev')}
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background"
                          onClick={() => navigateImage('next')}
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </>
                    );
                  }
                  return null;
                })()}
                <img
                  src={selectedImage}
                  alt="Selected photo"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Client Info Dialog */}
        <ClientInfoDialog
          isOpen={showClientDialog}
          onClose={() => setShowClientDialog(false)}
          onSubmit={handleGeneratePdf}
          isGenerating={isGeneratingPdf}
        />
      </div>
    </div>
  );
}