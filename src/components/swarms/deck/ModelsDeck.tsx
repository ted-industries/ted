import { useDraggable } from "@dnd-kit/core";
import { MODELS } from "../constants";

function DraggableCard({ id, name, Icon }: { id: string; name: string; Icon: React.ComponentType<any> }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`deck-model-card ${isDragging ? "dragging" : ""}`}
            {...listeners}
            {...attributes}
            title={`Drag ${name} onto the map`}
        >
            <Icon className="deck-model-icon" />
            <span className="deck-model-name">{name}</span>
        </div>
    );
}

export function ModelsDeck() {
    return (
        <div className="swarms-deck">
            {MODELS.map((m) => (
                <DraggableCard key={m.id} id={m.id} name={m.name} Icon={m.Icon} />
            ))}
        </div>
    );
}
