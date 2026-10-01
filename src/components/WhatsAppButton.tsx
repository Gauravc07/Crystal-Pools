import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { usePanelContext } from '../contexts/PanelContext';
import { useSiteSettings, whatsappHref } from '../lib/siteSettings';

interface WhatsAppButtonProps {
  phoneNumber?: string;
  message?: string;
}

export default function WhatsAppButton({
  phoneNumber,
  message = "Hello! I would like to know more about your services."
}: WhatsAppButtonProps) {
  const { isPanelOpen } = usePanelContext();
  const settings = useSiteSettings();
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (isPanelOpen) return null;

  const whatsappUrl = whatsappHref(phoneNumber ?? settings.whatsapp, message);

  return (
    <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[90] pointer-events-none flex items-center justify-center">
      <div className="relative pointer-events-auto">
        {/* Soft backdrop glow */}
        {!shouldReduceMotion && (
          <motion.div 
            animate={{ 
              scale: isHovered ? 1.2 : [1, 1.1, 1],
              opacity: isHovered ? 0.6 : [0.3, 0.5, 0.3] 
            }}
            transition={{
              duration: 3,
              repeat: isHovered ? 0 : Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 rounded-full bg-[#25D366] blur-xl"
          />
        )}

        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          onMouseEnter={() => setIsHovered(true)}
          onFocus={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onBlur={() => setIsHovered(false)}
          animate={
            shouldReduceMotion
              ? { y: 0 }
              : { y: isHovered ? -2 : [0, -6, 0] }
          }
          transition={{
            y: {
              duration: isHovered ? 0.3 : 4,
              repeat: isHovered ? 0 : Infinity,
              ease: "easeInOut"
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center gap-2 sm:gap-3 p-3 sm:px-5 sm:py-3.5 rounded-full bg-gradient-to-b from-[#28e06e] to-[#20b858] text-white shadow-[0_8px_20px_rgba(37,211,102,0.3)] border border-white/20 transition-shadow duration-300 hover:shadow-[0_12px_25px_rgba(37,211,102,0.5)] overflow-hidden group"
        >
          {/* Subtle shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-30deg] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
          
          <div className="relative z-10 flex items-center justify-center bg-white/20 p-1.5 sm:p-2 rounded-full shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 sm:w-6 sm:h-6 shrink-0"
            >
              <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.525.146-.18.194-.3.297-.495.098-.21.046-.39-.034-.54-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.2 5.077 4.485.709.3 1.262.48 1.694.614.71.226 1.356.195 1.864.12.571-.09 1.767-.72 2.016-1.426.246-.705.246-1.305.174-1.425-.075-.135-.276-.21-.578-.36z" />
              <path d="M20.52 3.449C18.24 1.245 15.24 0 12 0 5.385 0 0 5.385 0 12c0 2.125.556 4.195 1.61 6.015L.305 24l6.115-1.605C8.196 23.36 10.087 24 12 24c6.615 0 12-5.385 12-12 0-3.24-1.245-6.255-3.48-8.551zM12 21.974c-1.815 0-3.59-.481-5.14-1.396l-.37-.21-3.815 1 1-3.725-.24-.37A9.914 9.914 0 011.996 12C1.996 6.476 6.48 1.996 12 1.996s10.004 4.48 10.004 10.004C22.004 17.525 17.524 21.974 12 21.974z" />
            </svg>
          </div>
          <span className="font-medium text-[15px] sm:text-base tracking-wide hidden sm:block pr-1 text-white drop-shadow-sm whitespace-nowrap">
            Chat with us
          </span>
        </motion.a>
      </div>
    </div>
  );
}
