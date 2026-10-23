// Firefox Android can intercept application/pdf blob downloads with its PDF
// viewer (or a blank tab in an installed PWA). Keep the PDF bytes and .pdf
// filename, but use Mozilla's binary-download workaround for that browser.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1945314
export function progressDownloadBlob(pdfBlob, userAgent = '') {
  if (/Android/i.test(userAgent) && /(?:Firefox|Fennec)\//i.test(userAgent)) {
    return new Blob([pdfBlob], { type: 'application/x-binary' });
  }
  return pdfBlob;
}

export function progressPdfFile(artifacts, FileConstructor = globalThis.File) {
  if (typeof FileConstructor !== 'function') return null;
  try { return new FileConstructor([artifacts.pdfBlob], artifacts.filename, { type:'application/pdf' }); }
  catch { return null; }
}

export function canShareProgressPdf(file, nav = navigator) {
  // share() alone can support text/URLs while ignoring the files property.
  if (!file || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try { return nav.canShare({ files:[file] }) === true; }
  catch { return false; }
}

export function createProgressDownloads(artifacts, userAgent = '', urls = URL) {
  if (!artifacts.pdfBlob?.size) throw new Error('Il PDF è vuoto. Riprova a preparare il report.');
  const pdfUrl = urls.createObjectURL(progressDownloadBlob(artifacts.pdfBlob,userAgent));
  let pngUrl;
  try { pngUrl = artifacts.summaryPng ? urls.createObjectURL(artifacts.summaryPng) : null; }
  catch (error) { urls.revokeObjectURL(pdfUrl); throw error; }
  return { pdfUrl, pngUrl, filename:artifacts.filename,
    dispose:() => { urls.revokeObjectURL(pdfUrl); if (pngUrl) urls.revokeObjectURL(pngUrl); } };
}

// Invoke from a click, with the File already prepared: no rendering/await
// before navigator.share, so browsers keep the user activation.
export async function shareProgressPdf(file, fallback, nav = navigator) {
  if (!canShareProgressPdf(file,nav)) { fallback(); return 'download'; }
  try {
    await nav.share({ title:'I miei progressi su EliteJIM', files:[file] });
    return 'shared';
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
    fallback();
    return 'download';
  }
}
