import { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { PDFParse } from "pdf-parse";
import { createUploadedDocument, DocumentPage } from "../data/store";

const MAX_EXTRACTED_CHARACTERS = 120_000;
const execFileAsync = promisify(execFile);

async function extractScannedPdf(filePath: string): Promise<DocumentPage[]> {
  if (process.env.ENABLE_PDF_OCR === "false") return [];
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "iia-ocr-"));
  try {
    const prefix = path.join(temporaryDirectory, "page");
    await execFileAsync("pdftoppm", ["-f", "1", "-l", "10", "-scale-to", "1600", "-png", filePath, prefix], {
      timeout: 45_000, maxBuffer: 2 * 1024 * 1024,
    });
    const images = (await fs.promises.readdir(temporaryDirectory))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .slice(0, 10);
    const pages: DocumentPage[] = [];
    for (let index = 0; index < images.length; index++) {
      const imagePath = path.join(temporaryDirectory, images[index]);
      const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "-l", "eng", "--psm", "3"], {
        timeout: 20_000, maxBuffer: 2 * 1024 * 1024,
      });
      const text = stdout.trim();
      if (text) pages.push({ page: index + 1, text: text.slice(0, MAX_EXTRACTED_CHARACTERS) });
    }
    return pages;
  } finally {
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
const uploadsDir = () => path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));

export const uploadDocument = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ message: "No PDF uploaded" });
  const ownerUserId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!ownerUserId) {
    fs.unlinkSync(path.join(uploadsDir(), req.file.filename));
    return res.status(401).json({ message: "Sign in to upload a PDF." });
  }
  const filePath = path.join(uploadsDir(), req.file.filename);
  if (!fs.existsSync(filePath)) return res.status(400).json({ message: "Uploaded file was not saved correctly" });
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    fs.unlinkSync(filePath);
    return res.status(400).json({ message: "The uploaded file is not a valid PDF." });
  }
  let parser: PDFParse | undefined;
  let extractedText = "";
  let pages: DocumentPage[] = [];
  let ocrUsed = false;
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const parsed = await parser.getText();
    extractedText = (parsed.text || "").trim();
    pages = (parsed.pages || []).map((page, index) => ({
      page: Number.isFinite(page.num) && page.num > 0 ? page.num : index + 1,
      text: (page.text || "").trim(),
    })).filter((page) => page.text.length > 0);
  } catch (error) {
    console.warn("PDF text extraction failed; attempting OCR fallback", error instanceof Error ? error.message : "unknown error");
  } finally {
    if (parser) await parser.destroy().catch(() => undefined);
  }
  if (!extractedText) {
    try {
      pages = await extractScannedPdf(filePath);
      extractedText = pages.map((page) => page.text).join("\n\n").trim();
      ocrUsed = pages.length > 0;
    } catch (error) {
      console.warn("Scanned PDF OCR failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  if (!extractedText) {
    fs.unlinkSync(filePath);
    return res.status(422).json({
      message: process.env.ENABLE_PDF_OCR === "false"
        ? "No selectable text was found. PDF OCR is disabled on this server."
        : "IIA could not extract text from this PDF. Check that it is readable and try again.",
    });
  }
  const truncated = extractedText.length > MAX_EXTRACTED_CHARACTERS;
  extractedText = extractedText.slice(0, MAX_EXTRACTED_CHARACTERS);
  let remaining = MAX_EXTRACTED_CHARACTERS;
  pages = pages.map((page) => {
    const text = page.text.slice(0, remaining);
    remaining -= text.length;
    return { page: page.page, text };
  }).filter((page) => page.text.length > 0);
  const document = createUploadedDocument({
    filename: req.file.filename, originalName: req.file.originalname.slice(0, 255),
    mimeType: "application/pdf", size: req.file.size, url: "", extractedText, pages, ownerUserId,
  });
  return res.status(201).json({
    id: document.id, filename: document.filename, originalName: document.originalName,
    mimeType: document.mimeType, size: document.size, url: "", uploadedAt: document.uploadedAt,
    textCharacters: extractedText.length, pagesIndexed: pages.length, ocrUsed, textTruncated: truncated,
  });
};
