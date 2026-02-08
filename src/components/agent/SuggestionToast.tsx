import { useSuggestionStore } from "../../store/suggestion-store";
import { useEffect, useState } from "react";
import "./SuggestionToast.css";

export default function SuggestionToast() {
    const suggestions = useSuggestionStore((s: any) => s.suggestions);
    const dismiss = useSuggestionStore((s: any) => s.dismissSuggestion);
    const [active, setActive] = useState(false);

    // Show only the first one
    const current = suggestions[0];

    useEffect(() => {
        if (current) {
            setActive(true);
        } else {
            setActive(false);
        }
    }, [current]);

    if (!current || !active) return null;

    const handleDismiss = () => {
        setActive(false);
        setTimeout(() => dismiss(current.id), 300); // Animation delay
    };

    const handleAction = () => {
        if (current.action) {
            current.action.handler();
        }
        handleDismiss();
    };

    return (
        <div className={`suggestion-toast type-${current.type}`}>
            <div className="suggestion-icon">
                {current.type === "behavior" && "🧠"}
                {current.type === "ast" && "📜"}
                {current.type === "git" && "git"}
            </div>
            <div className="suggestion-content">
                <div className="suggestion-message">{current.message}</div>
                <div className="suggestion-actions">
                    {current.action && (
                        <button className="action-btn" onClick={handleAction}>
                            {current.action.label}
                        </button>
                    )}
                    <button className="dismiss-btn" onClick={handleDismiss}>
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
