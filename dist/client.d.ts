export interface WebRtcAuthenticationDetails {
    username: string;
    password: string;
    sipAddress: string;
    websocketUris: Array<string>;
    stunUris: Array<string>;
    turnUris: Array<string>;
}
export declare function fetchWebRtcAuthDetails(environment: string, resellerToken: string): Promise<WebRtcAuthenticationDetails>;
export type HeaderList = Array<[string, string]>;
export interface TelephonyApi {
    call(target: string, timeout: number, iceGatheringTimeout: number, extraHeaders?: HeaderList): Promise<CallApi>;
    disconnect(): void;
}
export type Tone = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#' | 'A' | 'B' | 'C' | 'D';
export type ToneKind = 'digit' | 'control' | 'letter';
export interface DtmfTone {
    value: Tone;
    kind: ToneKind;
    name: string;
}
export declare const ToneMap: {
    [key: string]: DtmfTone;
};
export interface CallApi {
    readonly media: MediaStream;
    readonly callCompletion: Promise<void>;
    sendTone(tone: Tone): void;
    setMicrophoneMuted(mute: boolean): void;
    drop(): void;
}
export interface CallCreationTimedOut {
    type: 'call-creation-timeout';
    sipAddress: string;
    timeout: number;
}
export interface UserAgentCreationTimedOut {
    type: 'user-agent-creation-timeout';
    sipAddress: string;
    timeout: number;
}
export declare const DEFAULT_ICE_GATHERING_TIMEOUT = 250;
export declare function setupSipClient(authDetails: WebRtcAuthenticationDetails, timeout: number): Promise<TelephonyApi>;
