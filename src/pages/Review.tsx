import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit3, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';

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
  
  // Load items from localStorage (from Upload page) or fall back to mock data
  const loadInventoryItems = (): InventoryItem[] => {
    const storedData = localStorage.getItem('inventoryAnalysis');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        // Check if the data has the new structure (name, volume, weight instead of label, estimatedVolume, estimatedWeight)
        if (parsed.length > 0 && parsed[0].name && typeof parsed[0].volume === 'number') {
          return parsed;
        } else {
          // Clear old data format
          localStorage.removeItem('inventoryAnalysis');
        }
      } catch (error) {
        console.error('Error parsing stored inventory data:', error);
        localStorage.removeItem('inventoryAnalysis');
      }
    }
    return mockItems; // Fallback to mock data
  };

  const [items, setItems] = useState<InventoryItem[]>(loadInventoryItems());
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

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
    setEditingItem(null);
    toast.success('Item updated');
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    toast.success('Item deleted');
  };

  const addNewItem = () => {
    if (!newItem.name) {
      toast.error('Please enter an item name');
      return;
    }

    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name!,
      quantity: newItem.quantity || 1,
      volume: newItem.volume || 0,
      weight: newItem.weight || 0,
      notes: newItem.notes
    };

    setItems([...items, item]);
    setNewItem({
      name: '',
      quantity: 1,
      volume: 0,
      weight: 0
    });
    setShowAddForm(false);
    toast.success('Item added');
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const deleteSelectedItems = () => {
    setItems(items.filter(item => !selectedItems.includes(item.id)));
    setSelectedItems([]);
    toast.success(`${selectedItems.length} items deleted`);
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
                  {localStorage.getItem('inventoryAnalysis') 
                    ? `Showing ${items.length} items analyzed from your uploaded photos` 
                    : `Showing ${items.length} sample items (upload photos to analyze real inventory)`}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  You can edit quantities, add notes, or add/remove items as needed
                </p>
              </div>
              {!localStorage.getItem('inventoryAnalysis') && (
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
          <Button variant="outline" onClick={() => navigate('/upload')}>
            Back to Upload
          </Button>
          <Button onClick={() => navigate('/finalize')}>
            Finalize Report
          </Button>
        </div>
      </div>
    </div>
  );
}