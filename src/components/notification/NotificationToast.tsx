import { useEffect, useState } from "react";
import "./notification.css";

interface Toast {
    message: string;
    type: "info" | "warning" | "error";
    closing: boolean;
}

/**
 * Global notification toast — mount at App root.
 * Any part of the app can trigger via:
 *   window.dispatchEvent(new CustomEvent("ted:notification", { detail: { message, type } }))
 */
export default function NotificationToast() {
    const [toast, setToast] = useState<Toast | null>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            const { message, type = "info" } = (e as CustomEvent).detail;
            setToast({ message, type, closing: false });
        };
        window.addEventListener("ted:notification", handler);
        return () => window.removeEventListener("ted:notification", handler);
    }, []);

    useEffect(() => {
        if (!toast || toast.closing) return;
        const timer = setTimeout(() => {
            setToast((t) => (t ? { ...t, closing: true } : null));
            setTimeout(() => setToast(null), 200);
        }, 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    if (!toast) return null;

    return (
        <div className={`notification-toast type-${toast.type} ${toast.closing ? "closing" : ""}`}>
            {toast.message}
        </div>
    );
}
