import { useEffect, useState } from 'react';

type Props = {
    images: string[];
    startIndex?: number;
    onClose: () => void;
};

export default function ImageModal({ images, startIndex = 0, onClose }: Props) {
    const [index, setIndex] = useState(Math.min(Math.max(0, startIndex), images.length - 1));

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [index, images]);

    useEffect(() => {
        setIndex(Math.min(Math.max(0, startIndex), images.length - 1));
    }, [startIndex, images]);

    const prev = () => setIndex((i) => (images.length ? (i - 1 + images.length) % images.length : i));
    const next = () => setIndex((i) => (images.length ? (i + 1) % images.length : i));

    if (!images || images.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-full max-w-4xl rounded bg-white p-4" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        {index + 1} / {images.length}
                    </div>
                    <div>
                        <button onClick={onClose} className="p-1">
                            閉じる
                        </button>
                    </div>
                </div>

                <div className="relative flex items-center">
                    <button aria-label="前へ" onClick={prev} className="absolute left-0 z-10 ml-2 rounded bg-white/80 p-2 hover:bg-white">
                        ◀
                    </button>

                    <img src={images[index]} alt={`attachment-${index}`} className="mx-auto max-h-[70vh] w-auto object-contain" />

                    <button aria-label="次へ" onClick={next} className="absolute right-0 z-10 mr-2 rounded bg-white/80 p-2 hover:bg-white">
                        ▶
                    </button>
                </div>

                {/* thumbnails */}
                {images.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                        {images.map((src, i) => (
                            <button key={i} onClick={() => setIndex(i)} className={`rounded border ${i === index ? 'ring-2 ring-primary' : ''}`}>
                                <img src={src} alt={`thumb-${i}`} className="h-16 w-24 object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
