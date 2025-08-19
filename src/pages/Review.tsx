import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit3, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  label: string;
  category: string;
  room: string;
  quantity: number;
  estimatedVolume: number;
  estimatedWeight: number;
  confidence: 'high' | 'medium' | 'low';
  thumbnail?: string;
  notes?: string;
}

// Mock data - in real app this would come from AI analysis
const mockItems: InventoryItem[] = [
  {
    id: '1',
    label: 'Queen Size Bed',
    category: 'Furniture',
    room: 'Bedroom',
    quantity: 1,
    estimatedVolume: 2.5,
    estimatedWeight: 45,
    confidence: 'high',
    thumbnail: '/placeholder.svg'
  },
  {
    id: '2',
    label: 'Dining Table',
    category: 'Furniture',
    room: 'Dining Room',
    quantity: 1,
    estimatedVolume: 1.8,
    estimatedWeight: 35,
    confidence: 'high',
    thumbnail: '/placeholder.svg'
  },
  {
    id: '3',
    label: 'Cardboard Box (Medium)',
    category: 'Boxes',
    room: 'Living Room',
    quantity: 5,
    estimatedVolume: 0.5,
    estimatedWeight: 8,
    confidence: 'medium',
    thumbnail: '/placeholder.svg'
  },
  {
    id: '4',
    label: 'Television',
    category: 'Electronics',
    room: 'Living Room',
    quantity: 1,
    estimatedVolume: 0.8,
    estimatedWeight: 15,
    confidence: 'low',
    notes: 'Unable to determine exact size from image'
  }
];

const categories = ['Furniture', 'Electronics', 'Boxes', 'Appliances', 'Clothing', 'Books', 'Decor', 'Other'];
const rooms = ['Living Room', 'Bedroom', 'Kitchen', 'Dining Room', 'Bathroom', 'Office', 'Garage', 'Storage'];

export default function Review() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>(mockItems);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    label: '',
    category: '',
    room: '',
    quantity: 1,
    estimatedVolume: 0,
    estimatedWeight: 0,
    confidence: 'medium'
  });

  const totalVolume = items.reduce((sum, item) => sum + (item.estimatedVolume * item.quantity), 0);
  const totalWeight = items.reduce((sum, item) => sum + (item.estimatedWeight * item.quantity), 0);
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
    if (!newItem.label || !newItem.category || !newItem.room) {
      toast.error('Please fill in all required fields');
      return;
    }

    const item: InventoryItem = {
      id: Date.now().toString(),
      label: newItem.label!,
      category: newItem.category!,
      room: newItem.room!,
      quantity: newItem.quantity || 1,
      estimatedVolume: newItem.estimatedVolume || 0,
      estimatedWeight: newItem.estimatedWeight || 0,
      confidence: 'medium',
      notes: newItem.notes
    };

    setItems([...items, item]);
    setNewItem({
      label: '',
      category: '',
      room: '',
      quantity: 1,
      estimatedVolume: 0,
      estimatedWeight: 0,
      confidence: 'medium'
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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
              <div className="text-2xl font-bold">{totalVolume.toFixed(1)} m³</div>
              <p className="text-sm text-muted-foreground">Estimated Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{totalWeight.toFixed(0)} kg</div>
              <p className="text-sm text-muted-foreground">Estimated Weight</p>
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
                    <th className="p-4">Item</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Room</th>
                    <th className="p-4">Qty</th>
                    <th className="p-4">Volume (m³)</th>
                    <th className="p-4">Weight (kg)</th>
                    <th className="p-4">Confidence</th>
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
                          {item.thumbnail && (
                            <img 
                              src={item.thumbnail} 
                              alt={item.label}
                              className="w-12 h-12 object-cover rounded border"
                            />
                          )}
                          <div>
                            {editingItem === item.id ? (
                              <Input
                                value={item.label}
                                onChange={(e) => updateItem(item.id, { label: e.target.value })}
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
                                {item.label}
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
                        <Select 
                          value={item.category} 
                          onValueChange={(value) => updateItem(item.id, { category: value })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <Select 
                          value={item.room} 
                          onValueChange={(value) => updateItem(item.id, { room: value })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rooms.map(room => (
                              <SelectItem key={room} value={room}>{room}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          value={item.estimatedVolume}
                          onChange={(e) => updateItem(item.id, { estimatedVolume: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-20"
                          step="0.1"
                          min="0"
                        />
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          value={item.estimatedWeight}
                          onChange={(e) => updateItem(item.id, { estimatedWeight: parseFloat(e.target.value) || 0 })}
                          className="h-8 w-20"
                          step="0.5"
                          min="0"
                        />
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className={getConfidenceColor(item.confidence)}>
                          {item.confidence}
                        </Badge>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Item Name *</label>
                  <Input
                    value={newItem.label || ''}
                    onChange={(e) => setNewItem({...newItem, label: e.target.value})}
                    placeholder="e.g., Sofa, Box, Table"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Category *</label>
                  <Select value={newItem.category || ''} onValueChange={(value) => setNewItem({...newItem, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Room *</label>
                  <Select value={newItem.room || ''} onValueChange={(value) => setNewItem({...newItem, room: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map(room => (
                        <SelectItem key={room} value={room}>{room}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="text-sm font-medium mb-2 block">Volume (m³)</label>
                  <Input
                    type="number"
                    value={newItem.estimatedVolume || 0}
                    onChange={(e) => setNewItem({...newItem, estimatedVolume: parseFloat(e.target.value) || 0})}
                    step="0.1"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Weight (kg)</label>
                  <Input
                    type="number"
                    value={newItem.estimatedWeight || 0}
                    onChange={(e) => setNewItem({...newItem, estimatedWeight: parseFloat(e.target.value) || 0})}
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