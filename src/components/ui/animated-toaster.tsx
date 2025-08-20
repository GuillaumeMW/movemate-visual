import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export function AnimatedToaster() {
  const { toasts } = useToast()
  const [toastPositions, setToastPositions] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    // Calculate positions for each toast to create stacking effect
    const newPositions: { [key: string]: number } = {}
    toasts.forEach((toast, index) => {
      // Each toast is offset by its index * height + gap
      newPositions[toast.id] = index * 80 // 72px height + 8px gap
    })
    setToastPositions(newPositions)
  }, [toasts])

  return (
    <ToastProvider>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
        {toasts.map(function ({ id, title, description, action, variant, ...props }, index) {
          const yOffset = toastPositions[id] || 0
          
          return (
            <div
              key={id}
              className="absolute transition-all duration-500 ease-out pointer-events-auto"
              style={{
                transform: `translateY(${yOffset}px)`,
                zIndex: 100 - index, // Higher z-index for newer toasts
              }}
            >
              <Toast 
                {...props}
                variant={variant as any}
                className={cn(
                  "w-80 shadow-2xl border-2 animate-toast-slide-in",
                  "transform-gpu will-change-transform",
                  index === 0 ? "scale-100" : "scale-95 opacity-90"
                )}
              >
                <div className="grid gap-1">
                  {title && <ToastTitle className="font-semibold">{title}</ToastTitle>}
                  {description && (
                    <ToastDescription className="text-sm">
                      {description}
                    </ToastDescription>
                  )}
                </div>
                {action}
                <ToastClose />
              </Toast>
            </div>
          )
        })}
      </div>
      <ToastViewport className="hidden" />
    </ToastProvider>
  )
}