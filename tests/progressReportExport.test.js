import { describe, expect, it, vi } from 'vitest';
import { canShareProgressPdf, createProgressDownloads, progressDownloadBlob, progressPdfFile, shareProgressPdf } from '../src/utils/progressReportExport';

const firefoxAndroid = 'Mozilla/5.0 (Android 14; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0';
const artifacts = () => ({ filename:'EliteJIM-progressi.pdf', pdfBlob:new Blob(['%PDF-1.3 full report'],{type:'application/pdf'}), summaryPng:new Blob(['cover'],{type:'image/png'}) });

describe('complete progress report export across browsers',()=>{
  it('forces a binary download on Firefox Android without losing any PDF page or changing the file extension',async()=>{
    const testWindow=window;
    vi.stubGlobal('window',undefined);
    const { jsPDF }=await import('jspdf');
    vi.stubGlobal('window',testWindow);
    const pdf=new jsPDF();
    pdf.text('Summary',10,10); pdf.addPage(); pdf.text('Exercises',10,10); pdf.addPage(); pdf.text('Science',10,10);
    const blob=pdf.output('blob'), download=progressDownloadBlob(blob,firefoxAndroid);
    expect(download.type).toBe('application/x-binary');
    expect(await download.arrayBuffer()).toEqual(await blob.arrayBuffer());
    const bytes=await download.text();
    expect(bytes.match(/\/Type \/Page\b/g)).toHaveLength(3);
    const file=progressPdfFile({...artifacts(),pdfBlob:blob});
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe('EliteJIM-progressi.pdf');
  });
  it.each(['Mozilla/5.0 Firefox/144.0','Mozilla/5.0 (Android 14) Chrome/140.0','Mozilla/5.0 (iPhone) FxiOS/144.0'])('keeps PDF MIME for browsers outside the Android Firefox workaround: %s',agent=>{
    const blob=artifacts().pdfBlob;
    expect(progressDownloadBlob(blob,agent)).toBe(blob);
  });
  it('never treats text-only sharing as support for files and handles throwing capability probes',()=>{
    const file=progressPdfFile(artifacts());
    expect(canShareProgressPdf(file,{share:vi.fn()})).toBe(false);
    expect(canShareProgressPdf(file,{share:vi.fn(),canShare:()=>{throw new Error('unsupported');}})).toBe(false);
    expect(canShareProgressPdf(file,{share:vi.fn(),canShare:()=>false})).toBe(false);
    expect(canShareProgressPdf(null,{share:vi.fn(),canShare:()=>true})).toBe(false);
    expect(progressPdfFile(artifacts(),null)).toBeNull();
    expect(progressPdfFile(artifacts(),class {constructor(){throw new Error('unavailable');}})).toBeNull();
  });
  it('shares the complete prepared PDF as a file, without a URL or PNG substitution',async()=>{
    const file=progressPdfFile(artifacts()),fallback=vi.fn(),nav={share:vi.fn().mockResolvedValue(),canShare:vi.fn().mockReturnValue(true)};
    const operation=shareProgressPdf(file,fallback,nav);
    expect(nav.share).toHaveBeenCalledWith({title:'I miei progressi su EliteJIM',files:[file]});
    expect(await operation).toBe('shared');
    expect(fallback).not.toHaveBeenCalled();
  });
  it.each(['NotAllowedError','TypeError','DataError'])('falls back to the full PDF when native sharing rejects with %s',async name=>{
    const fallback=vi.fn(),file=progressPdfFile(artifacts());
    expect(await shareProgressPdf(file,fallback,{canShare:()=>true,share:()=>Promise.reject({name})})).toBe('download');
    expect(fallback).toHaveBeenCalledTimes(1);
  });
  it('allows cancellation without starting an unwanted download',async()=>{
    const fallback=vi.fn();
    expect(await shareProgressPdf(progressPdfFile(artifacts()),fallback,{canShare:()=>true,share:()=>Promise.reject({name:'AbortError'})})).toBe('cancelled');
    expect(fallback).not.toHaveBeenCalled();
  });
  it('uses the download path when file sharing is unavailable or its probe throws',async()=>{
    for(const nav of [{},{share:vi.fn()},{share:vi.fn(),canShare:()=>{throw new Error();}}]){
      const fallback=vi.fn();
      expect(await shareProgressPdf(progressPdfFile(artifacts()),fallback,nav)).toBe('download');
      expect(fallback).toHaveBeenCalledTimes(1);
      if(nav.share) expect(nav.share).not.toHaveBeenCalled();
    }
  });
  it('keeps real download links alive until disposal and separates the full PDF from the PNG cover',()=>{
    const blobs=[],urls={createObjectURL:vi.fn(blob=>{blobs.push(blob);return `blob:${blobs.length}`;}),revokeObjectURL:vi.fn()};
    const result=createProgressDownloads(artifacts(),firefoxAndroid,urls);
    expect(result).toMatchObject({pdfUrl:'blob:1',pngUrl:'blob:2',filename:'EliteJIM-progressi.pdf'});
    expect(blobs.map(b=>b.type)).toEqual(['application/x-binary','image/png']);
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
    result.dispose();
    expect(urls.revokeObjectURL.mock.calls).toEqual([['blob:1'],['blob:2']]);
  });
});
