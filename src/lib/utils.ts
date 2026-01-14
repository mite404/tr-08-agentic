import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names using clsx and tailwind-merge
 * Prevents conflicting Tailwind classes when composing components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
