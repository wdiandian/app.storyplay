import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

export const dynamic = "force-dynamic";

const uploadRoot = join(process.cwd(), "uploads");

const contentTypeByExt: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const joinedPath = normalize(path.join("/")).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = join(uploadRoot, joinedPath);
    const file = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypeByExt[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
