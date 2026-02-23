import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from "bcryptjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hash(text: string) {
  const saltRounds = 12; // recomendado entre 10–14
  return bcrypt.hash(text, saltRounds);
}
