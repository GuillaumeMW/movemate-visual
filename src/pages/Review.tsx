import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit3, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  volume: number; // in cu ft
  weight: number; // in lbs
  notes?: string;
}

// Mock data - in real app this would come from AI analysis
const mockItems: InventoryItem[] = [
  {
    id: '1',
    name: 'Queen Size Bed',
    quantity: 1,
    volume: 88.4, // cu ft
    weight: 99, // lbs
  },
  {
    id: '2',
    name: 'Dining Table',
    quantity: 1,
    volume: 63.5,
    weight: 77,
  },
  {
    id: '3',
    name: 'Medium Boxes',
    quantity: 5,
    volume: 2.0,
    weight: 18,
  },
  {
    id: '4',
    name: 'Television (55 inch)',
    quantity: 1,
    volume: 28.3,
    weight: 33,
    notes: 'Handle with care - fragile electronics'
  }
];


export default function Review() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        // Load session info and items from database
        const [sessionResult, itemsResult] = await Promise.all([
          supabase
            .from('inventory_sessions')
            .select('*')
            .eq('id', sessionId)
            .single(),
          supabase
            .from('inventory_items')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
        ]);

        if (sessionResult.error) throw sessionResult.error;
        if (itemsResult.error) throw itemsResult.error;

        setSessionInfo(sessionResult.data);
        setItems(itemsResult.data || []);
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
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    quantity: 1,
    volume: 0,
    weight: 0
  });

  const totalVolume = items.reduce((sum, item) => sum + (item.volume * item.quantity), 0);
  const totalWeight = items.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
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
      setEditingItem(null);
      toast.success('Item updated');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
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
        notes: newItem.notes
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
            notes: item.notes,
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
        weight: 0
      });
      setShowAddForm(false);
      toast.success('Item added');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const deleteSelectedItems = async () => {
    try {
      if (sessionId) {
        const { error } = await supabase
          .from('inventory_items')
          .delete()
          .in('id', selectedItems);
        
        if (error) throw error;
        
        // Update session totals
        await updateSessionTotals();
      }
      
      setItems(items.filter(item => !selectedItems.includes(item.id)));
      const deletedCount = selectedItems.length;
      setSelectedItems([]);
      toast.success(`${deletedCount} items deleted`);
    } catch (error) {
      console.error('Error deleting selected items:', error);
      toast.error('Failed to delete selected items');
    }
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


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Review Your Inventory</h1>
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

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <Card className="mb-6 border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedItems.length} item(s) selected
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={deleteSelectedItems}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedItems([])}
                  >
                    Clear Selection
                  </Button>
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

        {/* Items List */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inventory Items</CardTitle>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="p-4 w-12">
                      <Checkbox
                        checked={selectedItems.length === items.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(items.map(item => item.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Quantity</th>
                    <th className="p-4">Volume (cu ft)</th>
                    <th className="p-4">Weight (lbs)</th>
                    <th className="p-4">Notes</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div>
                            {editingItem === item.id ? (
                              <Input
                                value={item.name}
                                onChange={(e) => updateItem(item.id, { name: e.target.value })}
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
                            {item.notes && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="h-8 w-16"
                          min="1"
                        />
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          value={item.volume}
                          onChange={(e) => updateItem(item.id, { volume: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-20"
                          step="0.1"
                          min="0"
                        />
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          value={item.weight}
                          onChange={(e) => updateItem(item.id, { weight: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-20"
                          step="0.5"
                          min="0"
                        />
                      </td>
                      <td className="p-4">
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                          className="h-8 w-32"
                          placeholder="Add notes..."
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
          </CardContent>
        </Card>

        {/* Add Item Form */}
        {showAddForm && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Item</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div>
                <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
                <Input
                  value={newItem.notes || ''}
                  onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                  placeholder="Additional notes about this item"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addNewItem}>
                  <Save className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate(sessionId ? `/upload?session=${sessionId}` : '/upload')}>
            Upload More Photos
          </Button>
          <Button onClick={() => navigate('/finalize')}>
            Finalize Report
          </Button>
        </div>
      </div>
    </div>
  );
}