import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

// POST /api/files/upload — multipart file upload to workspace
export async function POST(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetDir = (formData.get('directory') as string) || '_uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Sanitize directory
    const normalizedDir = path.normalize(targetDir).replace(/^(\.\.[/\\])+/, '');
    const uploadDir = path.join(WORKSPACE_PATH, normalizedDir);
    if (!uploadDir.startsWith(WORKSPACE_PATH)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '';
    const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const fileName = `${base}-${timestamp}${ext}`;
    const filePath = path.join(normalizedDir, fileName);
    const fullPath = path.join(WORKSPACE_PATH, filePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buffer);

    return NextResponse.json({
      success: true,
      path: filePath,
      name: fileName,
      size: buffer.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
