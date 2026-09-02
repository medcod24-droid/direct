import { clsx } from "clsx";
import type { TextareaHTMLAttributes } from "react";
import { CONTROL_CLASS } from "./Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return <textarea rows={rows} className={clsx(CONTROL_CLASS, "py-2 leading-relaxed", className)} {...props} />;
}
