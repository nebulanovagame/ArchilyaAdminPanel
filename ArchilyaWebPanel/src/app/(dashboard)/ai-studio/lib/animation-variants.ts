import type { Variants, Transition } from "framer-motion";

// ── Premium Easing Curves ─────────────────────────────────
export const PREMIUM_EASE: Transition["ease"] = [0.25, 0.1, 0.25, 1];
export const SNAP_EASE: Transition["ease"] = [0.34, 1.56, 0.64, 1];
export const SMOOTH_EASE: Transition["ease"] = "easeOut";

// ── Shared Transitions ────────────────────────────────────
export const fastTransition: Transition = { duration: 0.2, ease: PREMIUM_EASE };
export const mediumTransition: Transition = { duration: 0.35, ease: PREMIUM_EASE };
export const slowTransition: Transition = { duration: 0.5, ease: PREMIUM_EASE };
export const snapTransition: Transition = { duration: 0.3, ease: SNAP_EASE };

// ── Entrance Variants ─────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: fastTransition },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: mediumTransition },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: fastTransition },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: (index: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { ...mediumTransition, delay: index * 0.04 },
  }),
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: PREMIUM_EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: mediumTransition },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

// ── Hover/Tap Variants ────────────────────────────────────
export const hoverLift = {
  whileHover: { y: -1, transition: fastTransition },
  whileTap: { scale: 0.98, transition: fastTransition },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 20px rgba(198,168,124,0.08)",
    transition: fastTransition,
  },
};

export const buttonTap = {
  whileTap: { scale: 0.97, transition: fastTransition },
};

// ── Layout Variants ───────────────────────────────────────
export const expandCollapse: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: "auto", opacity: 1, transition: { duration: 0.25, ease: PREMIUM_EASE } },
};

// ── Staggered List Item ───────────────────────────────────
export const listItem = (index: number): Variants => ({
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1, x: 0,
    transition: { ...fastTransition, delay: index * 0.04 },
  },
});
