import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RoomDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  className?: string;
}

const ROOMS = [
  // Basic room types
  { name: 'Living Room', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: 'Kitchen', color: 'bg-green-100 text-green-800 border-green-200' },
  { name: 'Bedroom', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Bathroom', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { name: 'Office', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: 'Dining Room', color: 'bg-red-100 text-red-800 border-red-200' },
  { name: 'Garage', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { name: 'Basement', color: 'bg-stone-100 text-stone-800 border-stone-200' },
  { name: 'Closet', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { name: 'Laundry Room', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { name: 'Hallway', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  
  // Additional room types
  { name: 'Shed', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { name: 'Outdoor Area', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { name: 'Storage Room', color: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  { name: 'Sun Room', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: 'Patio', color: 'bg-lime-100 text-lime-800 border-lime-200' },
  { name: 'Deck', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { name: 'Balcony', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  { name: 'Attic', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  { name: 'Pantry', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { name: 'Mudroom', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  
  // Numbered variants for multiple rooms
  { name: 'Living Room 1', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: 'Living Room 2', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: 'Kitchen 1', color: 'bg-green-100 text-green-800 border-green-200' },
  { name: 'Kitchen 2', color: 'bg-green-100 text-green-800 border-green-200' },
  { name: 'Bedroom 1', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Bedroom 2', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Bedroom 3', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Bedroom 4', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Bathroom 1', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { name: 'Bathroom 2', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { name: 'Bathroom 3', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { name: 'Office 1', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: 'Office 2', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: 'Dining Room 1', color: 'bg-red-100 text-red-800 border-red-200' },
  { name: 'Dining Room 2', color: 'bg-red-100 text-red-800 border-red-200' },
  { name: 'Garage 1', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { name: 'Garage 2', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { name: 'Storage Room 1', color: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  { name: 'Storage Room 2', color: 'bg-neutral-100 text-neutral-800 border-neutral-200' },
  { name: 'Shed 1', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { name: 'Shed 2', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { name: 'Outdoor Area 1', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { name: 'Outdoor Area 2', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },

  { name: 'Other', color: 'bg-slate-100 text-slate-800 border-slate-200' }
];

export const RoomDropdown: React.FC<RoomDropdownProps> = ({ value, onValueChange, className }) => {
  const selectedRoom = ROOMS.find(room => room.name === value);
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`h-8 w-32 ${className}`}>
        <SelectValue placeholder="Select room">
          {selectedRoom && (
            <div className={`px-2 py-1 rounded text-xs font-medium ${selectedRoom.color}`}>
              {selectedRoom.name}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROOMS.map((room) => (
          <SelectItem key={room.name} value={room.name}>
            <div className={`px-2 py-1 rounded text-xs font-medium ${room.color}`}>
              {room.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export { ROOMS };