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
  call(target: string, timeout: number, iceGatheringTimeout: number, extraHeaders?: HeaderList): Promise<CallApi>

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

function setupSessionAndMedia(
  userAgent: UA,
  authDetails: WebRtcAuthenticationDetails,
  target: string,
  extraSipHeaders: HeaderList,
  iceGatheringTimeout: number,
  abortSignal: AbortSignal,
): Promise<[RTCSession, MediaStream]> {

  const callOptions: CallOptions = {
    extraHeaders: extraSipHeaders?.map(([name, value]) => `${name}: ${value}`),
    mediaConstraints: {
      audio: true,
      video: false,
    },
    pcConfig: {
      iceServers: [
        { urls: authDetails.stunUris },
        { urls: authDetails.turnUris, username: authDetails.username, credential: authDetails.password },
      ],
    },
  }

  const rtcSessionPromise = awaitRtcSession(userAgent, abortSignal)
  userAgent.call(target, callOptions)
  return rtcSessionPromise.then((session) => {
    let resolved: boolean = false

    return new Promise((resolve, reject) => {
      handleIceCandidateGathering(session, iceGatheringTimeout)

      session.once('confirmed', function (e) {
        if (resolved) {
          return
        }
        const mediaStream = new MediaStream()
        for (let receiver of session.connection.getReceivers()) {
          if (receiver.track.kind == 'audio') {
            mediaStream.addTrack(receiver.track)
          }
        }
        console.log('Session confirmed!', e)

        resolve([session, mediaStream])
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
    async call(target: string, timeout, iceGatheringTimeout, extraHeaders): Promise<CallApi> {
      return setupCall(
        ua,
        authDetails,
        target,
        timeout,
        extraHeaders ?? [],
        iceGatheringTimeout,
      )
    },
    disconnect() {
      ua.stop()
    },
  }
}