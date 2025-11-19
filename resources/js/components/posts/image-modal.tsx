import { useEffect, useState } from 'react';

type ImageItem = string | { url: string; isVideo?: boolean };

type Props = {
    images: ImageItem[]; // can be strings or objects with {url, isVideo}
    startIndex?: number;
    onClose: () => void;
};

export default function ImageModal({ images, startIndex = 0, onClose }: Props) {
    const [index, setIndex] = useState(Math.min(Math.max(0, startIndex), images.length - 1));

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') setIndex((i) => (images.length ? (i - 1 + images.length) % images.length : i));
            if (e.key === 'ArrowRight') setIndex((i) => (images.length ? (i + 1) % images.length : i));
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [images, onClose]);

    useEffect(() => {
        setIndex(Math.min(Math.max(0, startIndex), images.length - 1));
    }, [startIndex, images]);

    const prev = () => setIndex((i) => (images.length ? (i - 1 + images.length) % images.length : i));
    const next = () => setIndex((i) => (images.length ? (i + 1) % images.length : i));

    const isVideoUrl = (url: string) => /\.(mp4|mov|webm|mkv|avi)(\?|$)/i.test(url);
    const getUrl = (it: ImageItem): string | null => {
        try {
            if (typeof it === 'string') return it || null;
            return it?.url || null;
        } catch {
            return null;
        }
    };
    const isVideoItem = (it: ImageItem) => {
        const url = getUrl(it);
        if (!url) return !!(typeof it !== 'string' && it && (it as any).isVideo);
        return (typeof it !== 'string' && !!(it as any).isVideo) || isVideoUrl(url);
    };

    if (!images || images.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-full max-w-4xl rounded bg-white p-4" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        {index + 1} / {images.length}
                    </div>
                    <div>
                        <button type="button" onClick={onClose} className="p-1">
                            閉じる
                        </button>
                    </div>
                </div>

                <div className="relative flex items-center">
                    <button
                        type="button"
                        aria-label="前へ"
                        onClick={prev}
                        className="absolute left-0 z-10 ml-2 rounded bg-white/80 p-2 hover:bg-white"
                    >
                        ◀
                    </button>

                    {(() => {
                        const src = getUrl(images[index]);
                        if (!src) return <div className="mx-auto max-h-[70vh] w-auto text-sm text-muted-foreground">ファイルを表示できません</div>;
                        return isVideoItem(images[index]) ? (
                            <video src={src} controls className="mx-auto max-h-[70vh] w-auto object-contain" />
                        ) : (
                            <img src={src} alt={`attachment-${index}`} className="mx-auto max-h-[70vh] w-auto object-contain" />
                        );
                    })()}

                    <button
                        type="button"
                        aria-label="次へ"
                        onClick={next}
                        className="absolute right-0 z-10 mr-2 rounded bg-white/80 p-2 hover:bg-white"
                    >
                        ▶
                    </button>
                </div>

                {/* thumbnails */}
                {images.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                        {images.map((it, i) => {
                            const src = getUrl(it);
                            const vid = isVideoItem(it);
                            return (
                                <button
                                    type="button"
                                    key={i}
                                    onClick={() => setIndex(i)}
                                    className={`rounded border ${i === index ? 'ring-2 ring-primary' : ''}`}
                                >
                                    {src ? (
                                        vid ? (
                                            <video src={src} className="h-16 w-24 object-cover" muted playsInline loop />
                                        ) : (
                                            <img src={src} alt={`thumb-${i}`} className="h-16 w-24 object-cover" />
                                        )
                                    ) : (
                                        <div className="flex h-16 w-24 items-center justify-center bg-gray-100 text-xs">N/A</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
