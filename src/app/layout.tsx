import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "互动影游项目",
  description: "可编辑剧情节点与分支结构的互动影游原型",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
