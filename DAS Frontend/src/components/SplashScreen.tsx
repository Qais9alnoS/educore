import React, { useEffect, useState } from "react"

interface SplashScreenProps {
  onComplete: () => void
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2200)
    const completeTimer = setTimeout(() => onComplete(), 2700)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-700 ease-out ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />

      <div className="relative z-10 flex items-center justify-center">
        <div className="relative flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48">
          <div className="absolute inset-0 bg-primary/20 dark:bg-primary/30 rounded-full blur-3xl animate-pulse-glow" />
          <img
            src="/icon.png"
            alt="Logo"
            className="relative w-full h-full object-contain drop-shadow-2xl"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      </div>

      <style>
        {`
          @keyframes pulse-glow {
            0%, 100% {
              opacity: 0.25;
              transform: scale(0.95);
            }
            50% {
              opacity: 0.45;
              transform: scale(1.05);
            }
          }

          .animate-pulse-glow {
            animation: pulse-glow 3s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  )
}