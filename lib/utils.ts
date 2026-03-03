import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDocsifyPreviewUrl(baseUrl: string, filePath: string) {
  // 1. Remove the 'docs/' prefix if it exists
  let cleanPath = filePath.startsWith("docs/") ? filePath.replace("docs/", "") : filePath;

  // 2. Remove the '.md' extension
  cleanPath = cleanPath.endsWith(".md") ? cleanPath.slice(0, -3) : cleanPath;

  // 3. Handle 'README' or 'index' as the root of a folder
  if (cleanPath.toLowerCase() === "readme" || cleanPath.toLowerCase() === "index") {
    cleanPath = "";
  }

  // 4. Construct the URL (Docsify uses /#/path for routing)
  const separator = baseUrl.endsWith("/") ? "#/" : "/#/";
  return `${baseUrl}${separator}${cleanPath}`;
}
