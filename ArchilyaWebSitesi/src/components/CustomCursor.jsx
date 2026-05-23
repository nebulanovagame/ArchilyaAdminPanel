import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomCursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [cursorLabel, setCursorLabel] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateMousePosition = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      const interactive = target.closest('a, button, [data-cursor], input, textarea, [role="button"]');

      if (interactive) {
        setIsHovering(true);
        const label = interactive.getAttribute('data-cursor') ||
          interactive.closest('[data-cursor]')?.getAttribute('data-cursor') || '';
        setCursorLabel(label);
      } else {
        setIsHovering(false);
        setCursorLabel('');
      }
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('mouseover', handleMouseOver);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseover', handleMouseOver);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 w-2 h-2 bg-primary rounded-full pointer-events-none z-[9998] hidden md:block"
        animate={{
          x: mousePosition.x - 4,
          y: mousePosition.y - 4,
          scale: isHovering ? 0 : 1,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ type: 'tween', ease: 'backOut', duration: 0 }}
      />

      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9998] hidden md:flex items-center justify-center"
        animate={{
          x: mousePosition.x - (isHovering && cursorLabel ? 40 : 24),
          y: mousePosition.y - (isHovering && cursorLabel ? 40 : 24),
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.5 }}
      >
        <motion.div
          animate={{
            width: isHovering && cursorLabel ? 80 : 48,
            height: isHovering && cursorLabel ? 80 : 48,
            backgroundColor: isHovering
              ? cursorLabel
                ? 'rgba(198, 168, 124, 0.92)'
                : 'rgba(198, 168, 124, 0.1)'
              : 'transparent',
            borderColor: isHovering
              ? 'rgba(198, 168, 124, 0.9)'
              : 'rgba(198, 168, 124, 0.3)',
            borderRadius: '50%',
          }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="border flex items-center justify-center"
        >
          <AnimatePresence>
            {isHovering && cursorLabel && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="text-black font-sans font-bold text-[9px] uppercase tracking-wider leading-none text-center px-1"
              >
                {cursorLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}
