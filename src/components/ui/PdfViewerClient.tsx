
'use client';

import { Viewer, Worker } from '@react-pdf-viewer/core';
import { Skeleton } from './skeleton';

export function PdfViewerClient({ fileUrl }: { fileUrl: string }) {
    if (!fileUrl) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucun document à afficher.
            </div>
        );
    }
    
    return (
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
           <div className="h-full w-full">
              <Viewer fileUrl={fileUrl} />
           </div>
        </Worker>
    );
}

export function PdfViewerSkeleton() {
    return <Skeleton className="w-full h-full" />;
}
