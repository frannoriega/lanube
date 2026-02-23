import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from "crypto";
import bcrypt from "bcryptjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex")
}

export function bcryptHash(text: string) {
  const saltRounds = 12; // recomendado entre 10–14
  return bcrypt.hash(text, saltRounds);
}
