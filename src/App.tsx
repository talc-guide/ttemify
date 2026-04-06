import React, { useState, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const WATERMARK_TEXT = 'TTEM©';

interface FileStatus {
  file: File;
  status: 'idle' | 'processing' | 'completed' | 'error';
  error?: string;
  id: string;
}

export default function App() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFiles = useCallback((incomingFiles: FileList | null) => {
    if (!incomingFiles) return;
    
    const newFiles: FileStatus[] = Array.from(incomingFiles)
      .filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'pdf' || ext === 'docx' || ext === 'doc';
      })
      .map(file => ({
        file,
        status: 'idle',
        id: Math.random().toString(36).substring(7)
      }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processPdf = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    pages.forEach(page => {
      const { width, height } = page.getSize();
      const fontSize = 12;
      const textWidth = font.widthOfTextAtSize(WATERMARK_TEXT, fontSize);
      
      page.drawText(WATERMARK_TEXT, {
        x: width - textWidth - 20,
        y: 20,
        size: fontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.6,
      });
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  const processDocx = async (file: File) => {
    // For DOCX, we use PizZip to modify the XML directly
    // This is a lightweight way to add a footer watermark without full reconstruction
    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    
    // 1. Try to find existing footers
    const footerFiles = Object.keys(zip.files).filter(name => name.startsWith('word/footer'));
    
    if (footerFiles.length > 0) {
      // Modify existing footers
      footerFiles.forEach(footerName => {
        let content = zip.files[footerName].asText();
        // Simple injection before the closing p tag of the last paragraph or at the end of sdtContent
        if (content.includes('</w:p>')) {
          const lastPIndex = content.lastIndexOf('</w:p>');
          const watermarkXml = `
            <w:r>
              <w:rPr><w:color w:val="808080"/><w:sz w:val="20"/></w:rPr>
              <w:t xml:space="preserve">   ${WATERMARK_TEXT}</w:t>
            </w:r>
          `;
          content = content.slice(0, lastPIndex) + watermarkXml + content.slice(lastPIndex);
          zip.file(footerName, content);
        }
      });
    } else {
      // If no footer exists, this approach is more complex as it requires updating document.xml.rels
      // For simplicity in this "optimized and quick" app, we'll notify if we can't patch easily
      // or we can try a basic text replacement if the user has a placeholder.
      // But let's try to append to document.xml if footer is missing
      let docContent = zip.files['word/document.xml'].asText();
      if (docContent.includes('</w:body>')) {
        const bodyEndIndex = docContent.lastIndexOf('</w:body>');
        const watermarkXml = `
          <w:p>
            <w:pPr><w:jc w:val="right"/></w:pPr>
            <w:r>
              <w:rPr><w:color w:val="808080"/><w:sz w:val="20"/></w:rPr>
              <w:t>${WATERMARK_TEXT}</w:t>
            </w:r>
          </w:p>
        `;
        docContent = docContent.slice(0, bodyEndIndex) + watermarkXml + docContent.slice(bodyEndIndex);
        zip.file('word/document.xml', docContent);
      }
    }

    const output = zip.generate({ type: 'blob', compression: 'DEFLATE' });
    return output;
  };

  const processFile = async (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));
    
    const fileStatus = files.find(f => f.id === id);
    if (!fileStatus) return;

    try {
      let blob: Blob;
      const ext = fileStatus.file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'pdf') {
        blob = await processPdf(fileStatus.file);
      } else if (ext === 'docx') {
        blob = await processDocx(fileStatus.file);
      } else {
        throw new Error('Unsupported file type');
      }

      const fileName = fileStatus.file.name.replace(/(\.[^.]+)$/, `_${WATERMARK_TEXT}$1`);
      saveAs(blob, fileName);
      
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'completed' } : f));
    } catch (err) {
      console.error(err);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Failed to process' } : f));
    }
  };

  const processAll = async () => {
    const idleFiles = files.filter(f => f.status === 'idle');
    for (const f of idleFiles) {
      await processFile(f.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-blue-600 text-white rounded-2xl mb-4 shadow-lg shadow-blue-200"
          >
            <FileText size={32} />
          </motion.div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">TTEMify</h1>
          <p className="text-slate-500 text-lg">Add <span className="font-mono font-bold text-blue-600">{WATERMARK_TEXT}</span> to your documents instantly.</p>
        </header>

        <main className="space-y-6">
          {/* Upload Area */}
          <motion.div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`
              relative border-2 border-dashed rounded-3xl p-12 transition-all duration-200
              flex flex-col items-center justify-center text-center
              ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-200 bg-white hover:border-slate-300'}
            `}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.docx"
              onChange={(e) => handleFiles(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="p-4 bg-slate-50 rounded-full mb-4">
              <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            </div>
            <h3 className="text-xl font-semibold mb-1">Drop your files here</h3>
            <p className="text-slate-400">PDF or Word documents (max 20MB)</p>
          </motion.div>

          {/* File List */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <span className="text-sm font-medium text-slate-500">{files.length} files selected</span>
                  <button 
                    onClick={processAll}
                    disabled={files.every(f => f.status !== 'idle')}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Process All
                  </button>
                </div>
                <ul className="divide-y divide-slate-50">
                  {files.map((fileStatus) => (
                    <motion.li 
                      key={fileStatus.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{fileStatus.file.name}</p>
                        <p className="text-xs text-slate-400">{(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {fileStatus.status === 'idle' && (
                          <button 
                            onClick={() => processFile(fileStatus.id)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Process"
                          >
                            <Download size={18} />
                          </button>
                        )}
                        {fileStatus.status === 'processing' && (
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        )}
                        {fileStatus.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        )}
                        {fileStatus.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-rose-500" title={fileStatus.error} />
                        )}
                        <button 
                          onClick={() => removeFile(fileStatus.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {files.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400 italic">No files selected yet.</p>
            </div>
          )}
        </main>

        <footer className="mt-16 text-center text-slate-400 text-sm">
          <p>© 2026 TTEMify • Optimized for Speed</p>
        </footer>
      </div>
    </div>
  );
}
