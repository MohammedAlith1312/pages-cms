"use client";

import { Field } from "@/types/field";

const ViewComponent = ({
  value,
  field
}: {
  value: string,
  field: Field
}) => {
  if (!value) return null;

  const sanitizeHtml = (text: string) => {
    return text
      .replace(/<a[^>]*class="gh-issue-link"[^>]*>([\s\S]*?)<\/a>/g, '$1') // Keep text of issue links
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-zA-Z0-9#]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return Array.isArray(value)
    ? value.map(sanitizeHtml).join(', ')
    : sanitizeHtml(value);
}

export { ViewComponent };