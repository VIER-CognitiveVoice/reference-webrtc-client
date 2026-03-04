import { CallApi, CodecFilter, HeaderList, UriArgumentList } from './client';
export interface VolumeOptions {
    masterVolume?: number;
    callVolume?: number;
    dtmfVolume?: number;
}
export declare const DEFAULT_TIMEOUT = 10000;
export interface TimeoutOptions {
    register?: number;
    invite?: number;
    iceGatheringTimeout?: number;
}
export interface AudioOptions {
    context?: AudioContext;
    outputNode?: AudioNode;
    codecFilter?: CodecFilter;
}
export type KeypadMode = 'none' | 'standard' | 'full';
export type DarkMode = 'yes' | 'no' | 'auto';
export type UiPositionSide = 'top' | 'left' | 'bottom' | 'right';
export interface UiPosition {
    side: UiPositionSide;
    distance?: [number, number];
}
export declare const DEFAULT_KEYPAD: KeypadMode;
export declare const DEFAULT_DARK_MODE: DarkMode;
export interface UiOptions {
    keypad?: KeypadMode;
    dark?: DarkMode;
    anchor?: Element;
    position?: UiPosition;
}
export interface TelephonyOptions {
    sipHeaders?: HeaderList;
    sipUriArguments?: UriArgumentList;
}
export interface CallControlOptions {
    audio?: AudioOptions;
    volume?: VolumeOptions;
    timeout?: TimeoutOptions;
    ui?: UiOptions;
    telephony?: TelephonyOptions;
}
export type CleanupFunction = () => void;
export declare function enableMediaStreamAudioInChrome(stream: MediaStream): void;
export declare function generateCallControls(callApi: CallApi, options?: CallControlOptions): [HTMLDivElement, CleanupFunction];
export declare function triggerControls(environment: string, resellerToken: string, destination: string, options?: CallControlOptions): Promise<CallApi>;
export declare function mountControlsTo(triggerElement: Element | string, options?: CallControlOptions): Promise<CallApi>;
