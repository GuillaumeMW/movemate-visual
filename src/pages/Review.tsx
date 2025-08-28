import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Edit3, Plus, Save, X, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RoomDropdown } from '@/components/RoomDropdown';

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
  
  // Debounce timer reference
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Debounced input handler to prevent re-renders on every keystroke
  const handleDebouncedInputChange = useCallback((itemId: string, field: 'quantity' | 'volume' | 'weight', value: string) => {
    // Update local editing state immediately for responsive UI
    setEditingValues(prev => ({...prev, [`${itemId}-${field}`]: value}));

    // Clear any existing debounce timer for this item
    if (debounceTimers.current[`${itemId}-${field}`]) {
      clearTimeout(debounceTimers.current[`${itemId}-${field}`]);
    }

    // Set a new timer to update the main state after a delay
    debounceTimers.current[`${itemId}-${field}`] = setTimeout(() => {
      // Convert the string value to a number
      let numValue;
      if (field === 'quantity') {
        numValue = parseInt(value) || 1;
      } else {
        numValue = parseFloat(value) || 0;
      }

      // Update the main items state
      setItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, [field]: numValue } : item));
      setHasUnsavedChanges(true);
      
      // Clean up the editing value once it's applied
      setEditingValues(prev => {
        const newValues = {...prev};
        delete newValues[`${itemId}-${field}`];
        return newValues;
      });
    }, 500); // 500ms debounce time
  }, []);

  // Handle room changes immediately (no debounce needed for dropdowns)
  const handleRoomChange = useCallback((itemId: string, room: string) => {
    setItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, room } : item));
    setHasUnsavedChanges(true);
  }, []);

  // Handle name changes with debouncing
  const handleDebouncedNameChange = useCallback((itemId: string, value: string) => {
    // Update local editing state immediately for responsive UI
    setEditingValues(prev => ({...prev, [`${itemId}-name`]: value}));

    // Clear any existing debounce timer for this item
    if (debounceTimers.current[`${itemId}-name`]) {
      clearTimeout(debounceTimers.current[`${itemId}-name`]);
    }

    // Set a new timer to update the main state after a delay
    debounceTimers.current[`${itemId}-name`] = setTimeout(() => {
      // Update the main items state
      setItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, name: value } : item));
      setHasUnsavedChanges(true);
      
      // Clean up the editing value once it's applied
      setEditingValues(prev => {
        const newValues = {...prev};
        delete newValues[`${itemId}-name`];
        return newValues;
      });
    }, 500); // 500ms debounce time
  }, []);

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
  
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [activeAddFormRoom, setActiveAddFormRoom] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    quantity: 1,
    volume: 0,
    weight: 0,
    room: '',
    is_going: true
  });

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Local editing state for inputs to prevent slow updates
  const [editingValues, setEditingValues] = useState<{[key: string]: string}>({});

  // Cached calculations - only update when user clicks "Update & Save"
  const [cachedTotals, setCachedTotals] = useState({
    totalVolume: 0,
    totalWeight: 0,
    totalItems: 0,
    roomGroups: {} as Record<string, InventoryItem[]>,
    roomStats: {} as Record<string, { volume: number; weight: number; photos: UploadedImage[] }>
  });

  // Recalculate all expensive operations - only run when user explicitly requests it
  const recalculateAll = () => {
    // Get current items and images from state
    const currentItems = items;
    const currentImages = uploadedImages;
    
    const totalVolume = currentItems.reduce((sum, item) => sum + (item.volume * item.quantity), 0);
    const totalWeight = currentItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
    const totalItems = currentItems.reduce((sum, item) => sum + item.quantity, 0);

    // Group items by room
    const roomGroups = currentItems.reduce((groups, item) => {
      const room = item.room || 'Unassigned';
      if (!groups[room]) groups[room] = [];
      groups[room].push(item);
      return groups;
    }, {} as Record<string, InventoryItem[]>);

    // Calculate room stats
    const roomStats: Record<string, { volume: number; weight: number; photos: UploadedImage[] }> = {};
    Object.entries(roomGroups).forEach(([room, roomItems]) => {
      const roomVolume = roomItems.reduce((sum, item) => sum + (item.volume * item.quantity), 0);
      const roomWeight = roomItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
      
      // Get photos for this room
      const imageNumbers = new Set(roomItems.map(item => item.found_in_image).filter(Boolean));
      const roomPhotos = currentImages.filter(img => {
        const imgNumber = parseInt(img.file_path.split('_')[1]) || 0;
        return imageNumbers.has(imgNumber);
      });

      roomStats[room] = { volume: roomVolume, weight: roomWeight, photos: roomPhotos };
    });

    setCachedTotals({
      totalVolume,
      totalWeight,
      totalItems,
      roomGroups,
      roomStats
    });
  };

  // Initial calculation when data loads - run when items are first loaded
  useEffect(() => {
    if (!isLoading && items.length > 0 && Object.keys(cachedTotals.roomGroups).length === 0) {
      recalculateAll();
    }
  }, [isLoading, items.length]);

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
      setEditingItem(null);
      toast.success('Item updated');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  // Update item locally (without saving to database)
  const updateItemLocally = useCallback((id: string, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    setHasUnsavedChanges(true);
  }, []);

  // Update & Save all changes to database
  const updateAndSave = async () => {
    if (!sessionId) return;

    try {
      // Recalculate everything with current state
      recalculateAll();
      
      // Update all items in database
      const updatePromises = items.map(item => 
        supabase
          .from('inventory_items')
          .update({
            name: item.name,
            quantity: item.quantity,
            volume: item.volume,
            weight: item.weight,
            room: item.room,
            is_going: item.is_going
          })
          .eq('id', item.id)
      );

      await Promise.all(updatePromises);
      
      // Update session totals
      await updateSessionTotals();
      
      setHasUnsavedChanges(false);
      toast.success('All changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    }
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


  // Helper function to update session totals
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
            total_weight: totalWeight
          })
          .eq('id', sessionId);
      }
    } catch (error) {
      console.error('Error updating session totals:', error);
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

  // Cleanup debounce timers on unmount
  React.useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Review Your Inventory</h1>
              <p className="text-muted-foreground">
                Review and edit the items we detected. Click on any field to edit it.
              </p>
            </div>
            {sessionId && hasUnsavedChanges && (
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-muted-foreground">
                  Totals may be outdated - click Update & Save to refresh
                </p>
                <Button onClick={updateAndSave} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Update & Save
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{cachedTotals.totalItems}</div>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{cachedTotals.totalVolume.toFixed(1)} cu ft</div>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{cachedTotals.totalWeight.toFixed(0)} lbs</div>
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
                    ? `Created: ${new Date(sessionInfo?.created_at).toLocaleDateString()} - ${hasUnsavedChanges ? 'You have unsaved changes' : 'All changes saved'}`
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
            <Button onClick={() => {}}>
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
          </div>

          {Object.entries(cachedTotals.roomGroups).map(([room, cachedRoomItems]) => {
            // Get current items for this room (live updates)
            const currentRoomItems = items.filter(item => (item.room || 'Unassigned') === room);
            const roomStats = cachedTotals.roomStats[room];
            const roomPhotos = roomStats?.photos || [];
            const roomVolume = roomStats?.volume || 0;
            const roomWeight = roomStats?.weight || 0;

              return (
                <Card key={room} className="mb-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {room}
                          <Badge variant="secondary">{currentRoomItems.length} items</Badge>
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
                          {currentRoomItems.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-muted/50">
                              <td className="p-4">
                                 <div className="flex flex-col items-center gap-1">
                                   <Switch
                                     checked={item.is_going !== false}
                                     onCheckedChange={(checked) => updateItemLocally(item.id, { is_going: checked })}
                                   />
                                   <span className="text-xs text-muted-foreground">
                                     {item.is_going !== false ? 'Going' : 'Not going'}
                                   </span>
                                 </div>
                              </td>
                               <td className="p-4">
                                 <div className="flex items-center gap-3">
                                   <div>
                                       {editingItem === item.id ? (
                                          <Input
                                            value={editingValues[`${item.id}-name`] ?? item.name}
                                            onChange={(e) => handleDebouncedNameChange(item.id, e.target.value)}
                                            className="h-8"
                                            onBlur={() => setEditingItem(null)}
                                            onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                                            autoFocus
                                          />
                                        ) : (
                                        <div 
                                          className="font-medium cursor-pointer hover:text-primary"
                                          onClick={() => setEditingItem(item.id)}
                                        >
                                          {item.name}
                                        </div>
                                      )}
                                   </div>
                                 </div>
                               </td>
                               <td className="p-4">
                                  <Badge variant="outline" className="text-xs">
                                    #{item.found_in_image || 'N/A'}
                                  </Badge>
                               </td>
                                  <td className="p-4">
                                    <Input
                                      type="number"
                                      value={editingValues[`${item.id}-quantity`] ?? item.quantity.toString()}
                                      onChange={(e) => handleDebouncedInputChange(item.id, 'quantity', e.target.value)}
                                      className="h-8 w-16"
                                      min="1"
                                    />
                                  </td>
                                 <td className="p-4">
                                    <Input
                                      type="number"
                                      value={editingValues[`${item.id}-volume`] ?? item.volume.toString()}
                                      onChange={(e) => handleDebouncedInputChange(item.id, 'volume', e.target.value)}
                                      className="h-8 w-20"
                                      step="0.1"
                                      min="0"
                                    />
                                  </td>
                                 <td className="p-4">
                                    <Input
                                      type="number"
                                      value={editingValues[`${item.id}-weight`] ?? item.weight.toString()}
                                      onChange={(e) => handleDebouncedInputChange(item.id, 'weight', e.target.value)}
                                      className="h-8 w-20"
                                      step="0.5"
                                      min="0"
                                    />
                                   </td>
                                  <td className="p-4">
                                    <RoomDropdown
                                      value={item.room}
                                      onValueChange={(room) => handleRoomChange(item.id, room)}
                                    />
                                  </td>
                              <td className="p-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteItem(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
                               value={newItem.quantity?.toString() || ''}
                               onChange={(e) => setNewItem({...newItem, quantity: e.target.value === '' ? undefined : parseInt(e.target.value) || 1})}
                               min="1"
                             />
                           </div>
                           <div>
                             <label className="text-sm font-medium mb-2 block">Volume (cu ft)</label>
                             <Input
                               type="number"
                               value={newItem.volume?.toString() || ''}
                               onChange={(e) => setNewItem({...newItem, volume: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0})}
                               step="0.1"
                               min="0"
                             />
                           </div>
                           <div>
                             <label className="text-sm font-medium mb-2 block">Weight (lbs)</label>
                             <Input
                               type="number"
                               value={newItem.weight?.toString() || ''}
                               onChange={(e) => setNewItem({...newItem, weight: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0})}
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
             })}
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

        {/* Navigation */}
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(sessionId ? `/upload?session=${sessionId}` : '/upload')}>
              Upload More Photos
            </Button>
            <Button variant="outline" onClick={() => navigate('/upload')}>
              New Inventory
            </Button>
          </div>
          <Button onClick={() => navigate('/finalize')}>
            Finalize Report
          </Button>
        </div>
      </div>
    </div>
  );
}