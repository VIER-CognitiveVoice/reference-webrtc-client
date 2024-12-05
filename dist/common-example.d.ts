import { HeaderList } from './client';
export declare function getAndDisplayEnvironmentFromQuery(): string;
export declare function updateQueryParameter(name: string, value: string): void;
export declare function getCustomSipHeadersFromQuery(): HeaderList;
export interface WorkQueue<T> {
    submit(task: () => Promise<T>): Promise<T>;
    cancel(): Promise<void>;
    awaitEmpty(): Promise<void>;
}
export declare function concurrencyLimitedWorkQueue<T>(maxConcurrency: number): WorkQueue<T>;
export declare function getDialogId(headers: HeaderList): string | undefined;
export interface BaseDialogDataEntry {
    type: string;
    timestamp: number;
}
export interface StartDialogDataEntry extends BaseDialogDataEntry {
    type: "Start";
    customSipHeaders: {
        [name: string]: Array<string>;
    };
}
export interface SynthesisDialogDataEntry extends BaseDialogDataEntry {
    type: "Synthesis";
    text: string;
    plainText: string;
    vendor: string;
    language: string;
}
export interface ToneDialogDataEntry extends BaseDialogDataEntry {
    type: "Tone";
    tone: string;
    triggeredBargeIn: boolean;
}
export interface TranscriptionDialogDataEntry extends BaseDialogDataEntry {
    type: "Transcription";
    text: string;
    confidence: number;
    vendor: string;
    language: string;
    triggeredBargeIn: boolean;
}
export interface EndDialogDataEntry extends BaseDialogDataEntry {
    type: "End";
    reason: string;
}
export type DialogDataEntry = StartDialogDataEntry | SynthesisDialogDataEntry | ToneDialogDataEntry | TranscriptionDialogDataEntry | EndDialogDataEntry | BaseDialogDataEntry;
export interface DialogDataResponse {
    dialogId: string;
    callId?: string;
    data: Array<DialogDataEntry>;
}
export declare function getDialogDataUrl(environment: string, resellerToken: string, dialogId: string): string;
export declare function fetchDialogData(environment: string, resellerToken: string, dialogId: string): Promise<DialogDataResponse>;
export declare function delay(millis: number): Promise<void>;
