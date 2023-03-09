import {
  UA,
  WebSocketInterface,
} from 'jssip'
import {
  CallOptions,
  IncomingRTCSessionEvent,
  UAConfiguration,
} from 'jssip/lib/UA'
import {
  EndEvent,
  IceCandidateEvent,
  RTCSession,
} from 'jssip/lib/RTCSession'

export interface WebRtcAuthenticationDetails {
  username: string
  password: string
  sipAddress: string
  websocketUris: Array<string>
  stunUris: Array<string>
  turnUris: Array<string>
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
export async function fetchWebRtcAuthDetails(environment: string, resellerToken: string): Promise<WebRtcAuthenticationDetails> {
  let request: RequestInit = {
    method: 'POST',
    body: JSON.stringify({ resellerToken }),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  }

  const response = await fetch(`${environment}/v1/call/webrtc/authenticate`, request)
  if (!response.ok) {
    throw new Error('Failed to fetch authentication details!')
  }

  return await response.json() as WebRtcAuthenticationDetails
}

export type HeaderList = Array<[string, string]>

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
   */
  call(
    target: string,
    timeout: number,
    iceGatheringTimeout: number,
    extraHeaders?: HeaderList,
    mediaStream?: MediaStream,
  ): Promise<CallApi>

  /**
   * This method disconnects the user agent from the SIP proxy.
   */
  disconnect(): void
}

export type Tone = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#' | 'A' | 'B' | 'C' | 'D'
export type ToneKind = 'digit' | 'control' | 'letter'

export interface DtmfTone {
  value: Tone,
  kind: ToneKind,
  name: string,
}

export const ToneMap: { [key: string]: DtmfTone } = {
  ZERO: {
    value: '0',
    kind: 'digit',
    name: 'zero',
  },
  ONE: {
    value: '1',
    kind: 'digit',
    name: 'one',
  },
  TWO: {
    value: '2',
    kind: 'digit',
    name: 'two',
  },
  THREE: {
    value: '3',
    kind: 'digit',
    name: 'three',
  },
  FOUR: {
    value: '4',
    kind: 'digit',
    name: 'four',
  },
  FIVE: {
    value: '5',
    kind: 'digit',
    name: 'five',
  },
  SIX: {
    value: '6',
    kind: 'digit',
    name: 'six',
  },
  SEVEN: {
    value: '7',
    kind: 'digit',
    name: 'seven',
  },
  EIGHT: {
    value: '8',
    kind: 'digit',
    name: 'eight',
  },
  NINE: {
    value: '9',
    kind: 'digit',
    name: 'nine',
  },
  STAR: {
    value: '*',
    kind: 'control',
    name: 'star',
  },
  POUND: {
    value: '#',
    kind: 'control',
    name: 'pound',
  },
  A: {
    value: 'A',
    kind: 'letter',
    name: 'letter-a',
  },
  B: {
    value: 'B',
    kind: 'letter',
    name: 'letter-b',
  },
  C: {
    value: 'C',
    kind: 'letter',
    name: 'letter-c',
  },
  D: {
    value: 'D',
    kind: 'letter',
    name: 'letter-d',
  },
} as const

export interface CallApi {
  readonly media: MediaStream
  readonly callCompletion: Promise<void>

  sendTone(tone: Tone): void
  setMicrophoneMuted(mute: boolean): void

  drop(): void
}

async function setupRegisteredUserAgent(authDetails: WebRtcAuthenticationDetails, abortSignal: AbortSignal): Promise<UA> {
  const configuration: UAConfiguration = {
    sockets: authDetails.websocketUris.map(uri => new WebSocketInterface(uri.toString())),
    uri: authDetails.sipAddress,
    password: authDetails.password,
  }

  return new Promise<UA>((resolve, reject) => {
    const ua = new UA(configuration)
    let resolved = false

    function rejectUserAgent(reason: any) {
      if (!resolved) {
        ua.stop()
        resolved = true
        reject(reason)
      }
    }

    ua.on('connecting', (e) => {
      console.log('UA connecting', e)
    })

    ua.on('connected', (e) => {
      console.log('UA connected', e)
    })

    ua.on('registered', (e) => {
      resolved = true
      console.log('UA registered', e)
      resolve(ua)
    })

    ua.on('disconnected', (e) => {
      console.log('UA disconnected', e)
      rejectUserAgent(e)
    })

    ua.on('unregistered', (e) => {
      console.log('UA unregistered', e)
      rejectUserAgent(e)
    })

    ua.start()

    abortSignal.addEventListener('abort', () => {
      rejectUserAgent(abortSignal.reason)
    }, { once: true })
  })
}

function awaitRtcSession(userAgent: UA, abortSignal: AbortSignal): Promise<RTCSession> {
  return new Promise((resolve, reject) => {
    abortSignal.addEventListener('cancel', reject, { once: true })
    userAgent.once('newRTCSession', (e: IncomingRTCSessionEvent) => {
      console.log('RTCSession received', e)
      abortSignal.removeEventListener('cancel', reject)
      if (abortSignal.aborted) {
        reject(abortSignal.reason)
      } else {
        resolve(e.session)
      }
    })
  })
}

/**
 * This function listens for RTCSession's first `icecandidate` to get access to the ready function.
 * After that it listens to the `icecandidate` and `icegatheringstatechange` events
 * on the RTCPeerConnection for logging purposes and to properly cancel the timeout.
 *
 * If the timeout is not properly cancelled, JsSIP might invoke its ICE gathering finish logic
 * twice: https://github.com/versatica/JsSIP/pull/800
 */
function handleIceCandidateGathering(session: RTCSession, timeout: number): void {
  const connection = session.connection

  session.once('icecandidate', (e: IceCandidateEvent) => {
    const acceptCandidates: VoidFunction = e.ready
    let iceReadyTimeout: number | undefined = undefined

    function logCandidate({ candidate }: { candidate: RTCIceCandidate | null }) {
      if (candidate) {
        console.log('ice candidate', candidate)
      }
    }

    function clearReadyTimeout() {
      if (iceReadyTimeout !== undefined) {
        window.clearTimeout(iceReadyTimeout)
        iceReadyTimeout = undefined
      }
    }

    function resetReadyTimeout() {
      clearReadyTimeout()
      iceReadyTimeout = window.setTimeout(acceptCandidates, timeout)
    }

    function handleGatheringStateChange() {
      if (connection.iceGatheringState == 'complete') {
        clearReadyTimeout()
        // we are not interested in future events after the first completion.
        connection.removeEventListener('icegatheringstatechange', handleGatheringStateChange)
      }
    }
    connection.addEventListener('icegatheringstatechange', handleGatheringStateChange)

    connection.addEventListener('icecandidate', e => {
      logCandidate(e)
    })

    logCandidate(e)
    resetReadyTimeout()
  })
}

function awaitSessionConfirmation(session: RTCSession, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved: boolean = false
    session.once('confirmed', function (e) {
      if (resolved) {
        return
      }
      console.log('Session confirmed!', e)

      resolve()
    })

    session.once('failed', (e: EndEvent) => {
      if (resolved) {
        return
      }
      console.log('Session failed!', e)
      if (abortSignal.aborted) {
        reject(abortSignal.reason)
      } else {
        reject(e)
      }
    })
  })
}

function awaitMediaConnection(session: RTCSession, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const connection = session.connection
    let resolved: boolean = false

    function resolvePromise() {
      if (!resolved) {
        resolved = true;
        if (abortSignal.aborted) {
          reject(abortSignal.reason)
        } else {
          resolve()
        }
      }
    }

    function onConnectionStateChanged() {
      const state = connection.connectionState
      console.log('RTC connection state changed:', state)
      if (state === 'connected') {
        resolvePromise()
      }
    }

    function onTrack(e: RTCTrackEvent) {
      console.log('Received media track', e.track)
    }

    function onSignalingStateChanged() {
      const state = connection.signalingState
      console.log('RTC signaling state changed:', state)
    }

    function onIceConnectionStateChange() {
      const state = connection.iceConnectionState
      console.log('ICE connection state changed:', state)
      if (state === 'connected') {
        resolvePromise()
      }
    }

    connection.addEventListener('connectionstatechange', onConnectionStateChanged)
    connection.addEventListener('track', onTrack)
    connection.addEventListener('signalingstatechange', onSignalingStateChanged)
    connection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange)
    abortSignal.addEventListener('abort', () => {
      connection.removeEventListener('connectionstatechange', onConnectionStateChanged)
      connection.removeEventListener('track', onConnectionStateChanged)
      connection.removeEventListener('signalingstatechange', onSignalingStateChanged)
      connection.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange)
      if (!resolved) {
        reject(abortSignal.reason)
        resolved = true;
      }
    }, { once: true })
  })
}

function setupSessionAndMedia(
  userAgent: UA,
  authDetails: WebRtcAuthenticationDetails,
  target: string,
  extraSipHeaders: HeaderList,
  iceGatheringTimeout: number,
  abortSignal: AbortSignal,
  mediaStream: MediaStream | undefined,
): Promise<[RTCSession, MediaStream]> {
  const iceServers: Array<RTCIceServer> = []
  if (authDetails.stunUris.length > 0) {
    iceServers.push({ urls: authDetails.stunUris })
  }
  if (authDetails.turnUris.length > 0) {
    iceServers.push({ urls: authDetails.turnUris, username: authDetails.username, credential: authDetails.password })
  }
  const callOptions: CallOptions = {
    extraHeaders: extraSipHeaders?.map(([name, value]) => `${name}: ${value}`),
    mediaStream,
    mediaConstraints: {
      audio: true,
      video: false,
    },
    pcConfig: {
      iceServers,
    },
  }

  const rtcSessionPromise = awaitRtcSession(userAgent, abortSignal)
  userAgent.call(target, callOptions)
  return rtcSessionPromise.then((session) => {
    handleIceCandidateGathering(session, iceGatheringTimeout)
    const confirmationPromise = awaitSessionConfirmation(session, abortSignal)
    const mediaPromise = awaitMediaConnection(session, abortSignal)

    return Promise.all([confirmationPromise, mediaPromise]).then(() => {
      const mediaStream = new MediaStream()
      for (let receiver of session.connection.getReceivers()) {
        if (receiver.track.kind == 'audio') {
          mediaStream.addTrack(receiver.track)
        }
      }
      return [session, mediaStream]
    })
  })
}

export interface CallCreationTimedOut {
  type: 'call-creation-timeout'
  sipAddress: string
  timeout: number
}

async function setupCall(
  userAgent: UA,
  authDetails: WebRtcAuthenticationDetails,
  target: string,
  timeout: number,
  extraHeaders: HeaderList,
  iceGatheringTimeout: number,
  mediaStream: MediaStream | undefined,
): Promise<CallApi> {
  const callAbortController = new AbortController()
  callAbortController.signal.addEventListener('abort', () => {
    userAgent.terminateSessions()
  }, { once: true })

  const timeoutId = window.setTimeout(() => {
    const error: CallCreationTimedOut = {
      type: 'call-creation-timeout',
      sipAddress: authDetails.sipAddress,
      timeout: timeout,
    }
    callAbortController.abort(error)
  }, timeout)

  function clearConnectionTimeout() {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
  }

  let completeCall: () => void
  const callCompletedPromise = new Promise<void>((resolve) => {
    completeCall = resolve
  })

  const [session, mediaTrack] = await setupSessionAndMedia(
    userAgent,
    authDetails,
    target,
    extraHeaders,
    iceGatheringTimeout,
    callAbortController.signal,
    mediaStream,
  )
  clearConnectionTimeout()

  session.once('ended', (e: EndEvent) => {
    console.log('session ended!', e)
    completeCall()
  })

  return {
    media: mediaTrack,
    callCompletion: callCompletedPromise,
    sendTone(tone: Tone) {
      session.sendDTMF(tone)
    },
    setMicrophoneMuted(mute: boolean) {
      if (mute) {
        if (!session.isMuted().audio) {
          session.mute()
        }
      } else {
        if (session.isMuted().audio) {
          session.unmute()
        }
      }
    },
    drop() {
      session.terminate()
    },
  }
}

export interface UserAgentCreationTimedOut {
  type: 'user-agent-creation-timeout'
  sipAddress: string
  timeout: number
}

export const DEFAULT_ICE_GATHERING_TIMEOUT = 250

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
 * @param timeout The maximum time (in milliseconds) that the SIP proxy connect may take to establish.
 */
export async function setupSipClient(authDetails: WebRtcAuthenticationDetails, timeout: number): Promise<TelephonyApi> {
  const userAgentAbortController = new AbortController()
  const timeoutId = setTimeout(() => {
    const error: UserAgentCreationTimedOut = {
      type: 'user-agent-creation-timeout',
      sipAddress: authDetails.sipAddress,
      timeout
    }
    userAgentAbortController.abort(error)
  }, timeout)
  const ua = await setupRegisteredUserAgent(authDetails, userAgentAbortController.signal)
  clearTimeout(timeoutId)

  return {
    async call(target, timeout, iceGatheringTimeout, extraHeaders, mediaStream): Promise<CallApi> {
      return setupCall(
        ua,
        authDetails,
        target,
        timeout,
        extraHeaders ?? [],
        iceGatheringTimeout,
        mediaStream,
      )
    },
    disconnect() {
      ua.stop()
    },
  }
}