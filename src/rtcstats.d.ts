declare module '@rtcstats/rtcstats-js/peerconnection' {
  export function wrapRTCPeerConnection(trace, window: Window & typeof globalThis, {getStatsInterval}: {getStatsInterval?: number}): void;
}

declare module '@rtcstats/rtcstats-js/media' {
  export function wrapGetUserMedia(trace, {navigator, MediaStreamTrack}: Window & typeof globalThis): void;
  export function wrapEnumerateDevices(trace, {navigator}: Window & typeof globalThis): void;
}

