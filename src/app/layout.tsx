import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SViam · Interactive agent assignment", description: "Local LiveKit and TypeScript editor starter." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
