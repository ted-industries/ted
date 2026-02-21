export interface DAPMessage {
    seq: number;
    type: "request" | "response" | "event";
}

export interface DAPRequest extends DAPMessage {
    type: "request";
    command: string;
    arguments?: any;
}

export interface DAPResponse extends DAPMessage {
    type: "response";
    request_seq: number;
    success: boolean;
    command: string;
    message?: string;
    body?: any;
}

export interface DAPEvent extends DAPMessage {
    type: "event";
    event: string;
    body?: any;
}

export interface Breakpoint {
    id?: number;
    verified: boolean;
    line: number;
    column?: number;
    source?: Source;
    message?: string;
}

export interface Source {
    name?: string;
    path?: string;
    sourceReference?: number;
}

export interface StackFrame {
    id: number;
    name: string;
    source?: Source;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
}

export interface Scope {
    name: string;
    variablesReference: number;
    expensive: boolean;
    namedVariables?: number;
    indexedVariables?: number;
}

export interface Variable {
    name: string;
    value: string;
    type?: string;
    variablesReference: number;
    evaluateName?: string;
}
