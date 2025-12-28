import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hasActivityEndDatePassed(endDate: string | Date): boolean {
  if (!endDate) return false;
  
  const activityEndDate = new Date(endDate);
  const today = new Date();
  
  // Set time to start of day for fair comparison
  activityEndDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  return today > activityEndDate;
}
