export interface WebRtcAuthenticationDetails {
    username: string;
    password: string;
    sipAddress: string;
    websocketUris: Array<string>;
    stunUris: Array<string>;
    turnUris: Array<string>;
}
/**
 * This function requests new credentials needed for SIP proxy connections for the given environment and reseller.
 *
 * Note: Due to the authentication mechanism being used, each set of credentials can only be used for
 *       a single successful call. After a call is successfully established, the credentials will be invalidated
 *       and new credentials must be requested for additional calls.
 *
 * @param environment The base URL of the CVG environment. This will almost always be `https://cognitivevoice.io`
 * @param resellerToken The reseller token identifying your CVG reseller. This token can be found in settings
 *                      of the CVG project you want to call.
 */
export declare function fetchWebRtcAuthDetails(environment: string, resellerToken: string): Promise<WebRtcAuthenticationDetails>;
export type HeaderList = Array<[string, string]>;
export type UriArgumentList = Array<[string, string | undefined]>;
export interface TelephonyApi {
    /**
     * This method starts a new SIP call using the connected user agent.
     *
     * Note: Due to the authentication mechanism being used, each `TelephonyApi` instance can only be used for
     *       a single successful call. After a call is successfully established, the credentials will be invalidated
     *       and new credentials must be requested for additional calls.
     *
     * @param target The destination SIP address to be called. Since the user agent is only privileged to call
     *               destinations local the SIP proxy, the local part of a SIP address is enough
     *               (typically an E164 number).
     * @param timeout This timeout (in milliseconds) is the maximum time it may take for the call to be fully established
     *                (accepted by the remote party). The promise will be rejected with an object of
     *                type `CallCreationTimedOut`.
     * @param iceGatheringTimeout This timeout (in milliseconds) is the maximum time the client waits for a new
     *                            ICE candidate to arrive during the ICE gathering stage. So given a timeout of 250ms,
     *                            if 3 candidates after a 100ms delay each, then the ICE gathering will take ~550ms
     *                            in total. The time taken by ICE gathering also counts towards the time it takes to
     *                            establish the call, so this value should always be lower than `timeout`.
     * @param extraHeaders This is an optional list of additional SIP headers that are sent as part of the INVITE message.
     *                     Keep in mind that CVG will only forward custom headers (starting with `x-`) to bots.
     *                     No additional headers are sent by default.
     * @param mediaStream This is an optional media stream that can be supplied as the audio input to the call.
     *                    By default, UserMedia is requested and used without modification.
     * @deprecated "use #createCall instead
     */
    call(target: string, timeout: number, iceGatheringTimeout: number, extraHeaders?: HeaderList, mediaStream?: MediaStream): Promise<CallApi>;
    /**
     * This method starts a new SIP call using the connected user agent.
     *
     * Note: Due to the authentication mechanism being used, each `TelephonyApi` instance can only be used for
     *       a single successful call. After a call is successfully established, the credentials will be invalidated
     *       and new credentials must be requested for additional calls.
     *
     * @param target The destination SIP address to be called. Since the user agent is only privileged to call
     *               destinations local the SIP proxy, the local part of a SIP address is enough
     *               (typically an E164 number).
     * @param options This timeout (in milliseconds) is the maximum time it may take for the call to be fully established
     *                (accepted by the remote party). The promise will be rejected with an object of
     *                type `CallCreationTimedOut`.
     */
    createCall(target: string, options: CreateCallOptions): Promise<CallApi>;
    /**
     * This method disconnects the user agent from the SIP proxy.
     */
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
    readonly acceptHeaders: HeaderList;
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
export declare const DEFAULT_REGISTRATION_TIMEOUT = 10000;
export interface SipClientOptions {
    /**
     * The maximum time (in milliseconds) that the SIP proxy connect may take to establish.
     */
    timeout?: number;
    /**
     * A list of SIP URI arguments that are appended to the SIP URI given in the auth details
     */
    sipUriArguments?: UriArgumentList;
}
export type CodecFilter = (name: string) => boolean;
/**
 * This interfaces specifies options to configure the call.
 */
export interface CreateCallOptions {
    /**
     * This timeout (in milliseconds) is the maximum time it may take for the call to be fully established
     * (accepted by the remote party). The promise will be rejected with an object of
     * type `CallCreationTimedOut`.
     */
    timeout: number;
    /**
     * This timeout (in milliseconds) is the maximum time the client waits for a new
     * ICE candidate to arrive during the ICE gathering stage. So given a timeout of 250ms,
     * if 3 candidates after a 100ms delay each, then the ICE gathering will take ~550ms
     * in total. The time taken by ICE gathering also counts towards the time it takes to
     * establish the call, so this value should always be lower than `timeout`.
     */
    iceGatheringTimeout: number;
    /**
     * This is an optional list of additional SIP headers that are sent as part of the INVITE message.
     * Keep in mind that CVG will only forward custom headers (starting with `x-`) to bots.
     * No additional headers are sent by default.
     */
    extraHeaders?: HeaderList;
    /**
     * This is an optional media stream that can be supplied as the audio input to the call.
     * By default, UserMedia is requested and used without modification.
     */
    mediaStream?: MediaStream;
    /**
     * This function can be supplied to filter the list of codecs requested by the browser.
     * Some codecs will always be included due to technical reasons.
     * @param name the name of the codec as supplied by the browser
     * @returns true to include the codec, false to exclude it
     */
    codecFilter?: CodecFilter;
}
/**
 * This function takes the give webrtc authentication details and uses them to connect to the SIP proxy
 * in order to allow SIP calling.
 *
 * Note: Due to the authentication mechanism being used, each `TelephonyApi` instance can only be used for
 *       a single successful call. After a call is successfully established, the credentials will be invalidated
 *       and new credentials must be requested for additional calls.
 *
 * @param authDetails The auth details as provided by `fetchWebRtcAuthDetails` used for authentication against the
 *                    SIP proxy and TURN server.
 * @param options This object allows customization of the resulting user agent as well as how it is created.
 */
export declare function setupSipClient(authDetails: WebRtcAuthenticationDetails, options?: SipClientOptions): Promise<TelephonyApi>;
