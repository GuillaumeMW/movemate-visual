import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [contentToDisplay, setContentToDisplay] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fallback content
  const fallbackText = `World War I, known as the Great War, began in 1914 and forever changed the course of human history. The conflict started with the assassination of Archduke Franz Ferdinand of Austria-Hungary in Sarajevo on June 28, 1914. This single event triggered a complex web of alliances that pulled major European powers into what would become the first global industrial war. The Central Powers, consisting primarily of Germany, Austria-Hungary, and the Ottoman Empire, faced off against the Allied Powers, including France, Britain, Russia, and later the United States.

The war introduced unprecedented technological horrors that transformed the nature of combat. Poison gas, first used by German forces at the Second Battle of Ypres in 1915, created a new dimension of terror on the battlefield. Machine guns, barbed wire, and artillery created deadly killing fields that led to the infamous trench warfare system stretching from the English Channel to the Swiss border. These innovations in warfare technology resulted in casualties on a scale never before seen in human history, with entire generations of young men lost to the conflict.

The Great War officially ended on November 11, 1918, with the signing of the Armistice at Compiègne. However, its consequences would echo throughout the 20th century and beyond. The Treaty of Versailles imposed harsh reparations on Germany, contributing to economic instability that would later facilitate the rise of extremist movements. The war also led to the collapse of four major empires: the German, Austro-Hungarian, Russian, and Ottoman empires, fundamentally redrawing the map of Europe and the Middle East and setting the stage for future conflicts.`;

  // Fetch dynamic content when overlay becomes visible
  useEffect(() => {
    if (!isVisible || contentReady) return;

    const fetchContent = async () => {
      setIsLoadingContent(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-loading-content');
        
        if (error) throw error;
        
        if (data.content) {
          setContentToDisplay(data.content);
        } else {
          setContentToDisplay(fallbackText);
        }
      } catch (error) {
        console.error('Failed to fetch dynamic content:', error);
        setContentToDisplay(fallbackText);
      } finally {
        setIsLoadingContent(false);
        setContentReady(true);
      }
    };

    // Small delay before fetching content
    const timer = setTimeout(fetchContent, 1000);
    return () => clearTimeout(timer);
  }, [isVisible, contentReady]);

  useEffect(() => {
    if (!isVisible) {
      setDisplayedText('');
      setCurrentCharIndex(0);
      setContentReady(false);
      setIsLoadingContent(false);
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
      return;
    }

    // Only start typewriter effect when content is ready
    if (!contentReady || !contentToDisplay) return;

    // Start typewriter effect
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
    }

    typewriterIntervalRef.current = setInterval(() => {
      setCurrentCharIndex(prevIndex => {
        if (prevIndex < contentToDisplay.length) {
          const newIndex = prevIndex + 1;
          setDisplayedText(contentToDisplay.slice(0, newIndex));
          return newIndex;
        } else {
          // Reset and start over
          setDisplayedText('');
          return 0;
        }
      });
    }, 30); // Typing speed

    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, [isVisible, contentReady, contentToDisplay]);

  // Auto-scroll to keep cursor visible
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const shouldScroll = container.scrollHeight > container.clientHeight;
      
      if (shouldScroll) {
        // Scroll to bottom to show the typing cursor
        container.scrollTop = container.scrollHeight - container.clientHeight;
      }
    }
  }, [displayedText]);

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

        {/* Typewriter Text */}
        <div 
          ref={scrollContainerRef}
          className="relative h-64 overflow-hidden bg-muted/30 border border-border rounded-lg p-4"
        >
          {isLoadingContent ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Preparing today's content...</span>
              </div>
            </div>
          ) : (
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {displayedText}
              {contentReady && <span className="animate-pulse">|</span>}
            </div>
          )}
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
