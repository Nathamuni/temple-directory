import ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * exceljs 4.4 cannot open a real-world .xlsx that contains cell comments or
 * Excel Tables (ListObjects): it throws
 *   TypeError: Cannot read properties of undefined (reading 'comments')
 * and, once comments are gone, the same for `tables`. `ignoreNodes` does not
 * help — the crash is in the worksheet model setter, after parsing.
 *
 * Both features are pure presentation for our purposes: we only ever read cell
 * values. So strip those parts out of the zip before handing the buffer to
 * exceljs. Temple_Directory_Input_Schema.xlsx itself has 9 comment parts and 10
 * table parts, and any workbook a reviewer has commented on will have them too.
 */
export type WorkbookInput = ArrayBuffer | Uint8Array;

export async function sanitizeWorkbookBuffer(buffer: WorkbookInput): Promise<WorkbookInput> {
  const zip = await JSZip.loadAsync(buffer);

  let touched = false;
  for (const partPath of Object.keys(zip.files)) {
    if (/^xl\/(comments\/|drawings\/commentsDrawing|tables\/)/i.test(partPath)) {
      zip.remove(partPath);
      touched = true;
    }
  }
  if (!touched) return buffer;

  for (const partPath of Object.keys(zip.files)) {
    const file = zip.file(partPath);
    if (!file) continue;

    if (partPath.endsWith(".rels")) {
      const xml = await file.async("string");
      const next = xml.replace(
        /<Relationship\b[^>]*Type="[^"]*\/(comments|vmlDrawing|table)"[^>]*\/>/gi,
        ""
      );
      if (next !== xml) zip.file(partPath, next);
    } else if (partPath === "[Content_Types].xml") {
      const xml = await file.async("string");
      const next = xml.replace(
        /<Override\b[^>]*PartName="\/xl\/(comments|tables)\/[^"]*"[^>]*\/>/gi,
        ""
      );
      if (next !== xml) zip.file(partPath, next);
    } else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(partPath)) {
      const xml = await file.async("string");
      const next = xml
        .replace(/<legacyDrawing\b[^>]*\/>/gi, "")
        .replace(/<tableParts[\s\S]*?<\/tableParts>/gi, "")
        .replace(/<tableParts\b[^>]*\/>/gi, "");
      if (next !== xml) zip.file(partPath, next);
    }
  }

  return zip.generateAsync({ type: "uint8array" });
}

/** Loads a workbook, tolerating comments and tables. */
export async function readWorkbook(buffer: WorkbookInput): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const clean = await sanitizeWorkbookBuffer(buffer);
  // exceljs types `load` as taking its own `Buffer` alias; it accepts any
  // ArrayBuffer-backed view at runtime, which is what we hand it here.
  await workbook.xlsx.load(clean as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}
