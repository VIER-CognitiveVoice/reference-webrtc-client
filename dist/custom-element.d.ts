import { CallApi } from './client';
export declare const ELEMENT_NAME = "cvg-webrtc-button";
export interface CvgWebRtcButtonEventMap extends HTMLElementEventMap {
    new_call: NewCallEvent;
    call_ended: CallEndedEvent;
    attribute_validation_failed: AttributeValidationFailedEvent;
}
export declare class CvgWebRtcButton extends HTMLElement {
    private currentCall;
    private readonly buttonContainer;
    private readonly button;
    private connected;
    private readonly onBeforeUnload;
    get call(): CallApi | null;
    constructor();
    private getNumberAttribute;
    private onButtonClicked;
    connectedCallback(): void;
    disconnectedCallback(): void;
    addEventListener<K extends keyof CvgWebRtcButtonEventMap>(type: K, listener: (this: HTMLElement, ev: CvgWebRtcButtonEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof CvgWebRtcButtonEventMap>(type: K, listener: (this: HTMLElement, ev: CvgWebRtcButtonEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    trigger(): void;
}
export declare class CallEvent<T> extends CustomEvent<T> {
    constructor(type: keyof CvgWebRtcButtonEventMap, detail?: T);
}
export declare class NewCallEvent extends CallEvent<void> {
    constructor();
}
export declare class CallEndedEvent extends CallEvent<any | null> {
    constructor(error: any | null);
}
export type AttributeName = 'reseller-token' | 'destination';
export type ValidationError = 'missing';
export interface AttributeValidationError {
    attributeName: AttributeName;
    error: ValidationError;
}
export declare class AttributeValidationFailedEvent extends CallEvent<AttributeValidationError> {
    constructor(attributeName: AttributeName, error: ValidationError);
}
