import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export const dynamic = "force-dynamic";

const uploadRoot = join(process.cwd(), "uploads");

function slugifyBaseName(value: string) {
  const stem = value.replace(/\.[^.]+$/, "");
  const normalized = stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "asset";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = `${formData.get("folder") ?? "videos"}`.trim() || "videos";

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    const extension = extname(file.name) || ".bin";
    const baseName = slugifyBaseName(file.name);
    const filename = `${baseName}-${Date.now()}${extension}`;
    const targetDir = join(uploadRoot, folder);
    const targetPath = join(targetDir, filename);

    await mkdir(targetDir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, bytes);

    return Response.json({
      url: `/uploads/${folder}/${filename}`,
      filename,
      size: file.size,
      contentType: file.type || null,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 },
    );
  }
}
