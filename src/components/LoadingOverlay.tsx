import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'progress';
  timestamp: number;
}

interface LoadingOverlayProps {
  isVisible: boolean;
  currentStep: string;
  progress: { current: number; total: number };
  roomsDetected?: string[];
  currentImage?: number;
  currentRoom?: string;
  itemsFound?: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  currentStep,
  progress,
  roomsDetected = [],
  currentImage = 0,
  currentRoom = '',
  itemsFound = 0
}) => {
  const [messages, setMessages] = useState<LoadingMessage[]>([]);
  const [messageCounter, setMessageCounter] = useState(0);

  const tips = [
    "Did you know? It makes my job easier if you keep photos of the same room in order",
    "Did you know? I will try and group smaller items into boxes",
    "Did you know? Please review carefully. As an AI I can miss items or count them twice",
    "Tip: Better lighting in photos helps me identify items more accurately",
    "Tip: Take photos from different angles for better item detection"
  ];

  const addMessage = (text: string, type: LoadingMessage['type'] = 'info') => {
    const newMessage: LoadingMessage = {
      id: `msg-${messageCounter}`,
      text,
      type,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageCounter(prev => prev + 1);
    
    // Remove old messages after 5 seconds to prevent overflow
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
    }, 8000);
  };

  useEffect(() => {
    if (!isVisible) {
      setMessages([]);
      setMessageCounter(0);
      return;
    }

    // Initial setup message
    addMessage("Scanning photos to determine home layout and rooms");

  }, [isVisible]);

  useEffect(() => {
    if (currentStep === 'room-detection' && roomsDetected.length > 0) {
      const roomTypes = roomsDetected.reduce((acc, room) => {
        const type = room.toLowerCase();
        if (type.includes('bedroom')) acc.bedrooms = (acc.bedrooms || 0) + 1;
        else if (type.includes('kitchen')) acc.kitchen = (acc.kitchen || 0) + 1;
        else if (type.includes('bathroom')) acc.bathrooms = (acc.bathrooms || 0) + 1;
        else if (type.includes('living') || type.includes('room')) acc.livingRooms = (acc.livingRooms || 0) + 1;
        else if (type.includes('balcony')) acc.balconies = (acc.balconies || 0) + 1;
        else acc.others = (acc.others || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const roomDescription = [
        roomTypes.bedrooms && `${roomTypes.bedrooms} bedroom${roomTypes.bedrooms > 1 ? 's' : ''}`,
        roomTypes.kitchen && `${roomTypes.kitchen} kitchen`,
        roomTypes.bathrooms && `${roomTypes.bathrooms} bathroom${roomTypes.bathrooms > 1 ? 's' : ''}`,
        roomTypes.livingRooms && `${roomTypes.livingRooms} living room${roomTypes.livingRooms > 1 ? 's' : ''}`,
        roomTypes.balconies && `${roomTypes.balconies} balcony${roomTypes.balconies > 1 ? 'ies' : ''}`,
        roomTypes.others && `${roomTypes.others} other room${roomTypes.others > 1 ? 's' : ''}`
      ].filter(Boolean).join(', ');

      setTimeout(() => {
        addMessage(`Found ${roomsDetected.length} rooms, including ${roomDescription}`, 'success');
      }, 1500);

      setTimeout(() => {
        addMessage("I will now analyse each photo individually and extract its content and match it to each room");
      }, 3000);

      setTimeout(() => {
        addMessage("Please be patient, this can take up to 10 seconds per photo");
      }, 4500);

      setTimeout(() => {
        addMessage(tips[0]);
      }, 6000);
    }
  }, [currentStep, roomsDetected]);

  useEffect(() => {
    if (currentStep === 'item-analysis' && progress.total > 0 && currentImage > 0) {
      const roomText = currentRoom ? ` from ${currentRoom}` : '';
      addMessage(`Analyzing picture ${currentImage}/${progress.total}${roomText}`, 'progress');
      
      if (itemsFound > 0) {
        setTimeout(() => {
          addMessage(`Found ${itemsFound} items`, 'success');
        }, 2000);
      }

      // Add tips occasionally
      if (currentImage === 2) {
        setTimeout(() => addMessage(tips[1]), 3000);
      } else if (currentImage === Math.floor(progress.total / 2)) {
        setTimeout(() => addMessage(tips[2]), 3000);
      } else if (currentImage === progress.total - 1) {
        setTimeout(() => addMessage(tips[Math.floor(Math.random() * tips.length)]), 3000);
      }
    }
  }, [currentImage, progress, currentRoom, itemsFound]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      
      {/* Content */}
      <div className="relative bg-card border border-border rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Analyzing Your Inventory</h2>
          </div>
          
          {/* Progress bar */}
          {progress.total > 0 && (
            <div className="w-full bg-secondary rounded-full h-2 mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}
          
          <p className="text-muted-foreground">
            {progress.total > 0 
              ? `Processing ${progress.current} of ${progress.total} photos` 
              : "Preparing analysis..."
            }
          </p>
        </div>

        {/* Animated Messages */}
        <div className="relative h-64 overflow-hidden">
          <div className="space-y-3">
            {messages.slice(-6).map((message, index) => (
              <div
                key={message.id}
                className={`transform transition-all duration-500 ease-out ${
                  index === messages.slice(-6).length - 1
                    ? 'animate-fade-in translate-y-0 opacity-100'
                    : 'opacity-75'
                }`}
                style={{
                  transform: `translateY(${index * 40}px)`,
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div className={`flex items-start gap-3 p-3 rounded-lg ${
                  message.type === 'success' 
                    ? 'bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                    : message.type === 'progress'
                    ? 'bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                    : 'bg-muted border border-border'
                }`}>
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    message.type === 'success' 
                      ? 'bg-green-500' 
                      : message.type === 'progress'
                      ? 'bg-blue-500'
                      : 'bg-muted-foreground'
                  }`} />
                  <p className={`text-sm leading-relaxed ${
                    message.type === 'success'
                      ? 'text-green-800 dark:text-green-200'
                      : message.type === 'progress'
                      ? 'text-blue-800 dark:text-blue-200'
                      : 'text-foreground'
                  }`}>
                    {message.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            AI is processing your photos... Please do not close this window
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;