import { useEffect } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose?: () => void;
    duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 4000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onClose) onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bg = type === 'success' ? 'bg-green-50 text-green-800' : type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800';

    // translate known server-side English messages to Japanese for UX consistency
    const localizedMessage = (() => {
        if (!message) return message;
        // common AuthorizationException default message from Laravel
        if (message.includes('This action is unauthorized')) return 'この操作は許可されていません。';
        // keep original otherwise
        return message;
    })();

    const icon = type === 'success' ? (
        <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ) : type === 'error' ? (
        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ) : (
        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
        </svg>
    );

    return (
        <div className={`fixed right-6 bottom-6 z-50 max-w-sm rounded-md p-3 shadow ${bg} transition-opacity duration-300`} role="status">
            <div className="flex items-start gap-3">
                <div className="mt-0.5">{icon}</div>
                <div className="text-sm">{localizedMessage}</div>
            </div>
        </div>
    );
}
