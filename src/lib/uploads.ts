import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveUploadPdfPath(uploadId: string | undefined): Promise<string | null> {
  if (!uploadId || !UUID_RE.test(uploadId)) return null;
  const candidate = path.resolve(UPLOADS_DIR, `${uploadId}.pdf`);
  if (!candidate.startsWith(UPLOADS_DIR + path.sep)) return null;
  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile()) return null;
    return `data/uploads/${uploadId}.pdf`;
  } catch {
    return null;
  }
}
