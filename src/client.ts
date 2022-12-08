import { UA, WebSocketInterface } from 'jssip';
import {
  CallOptions,
  IncomingRTCSessionEvent,
  UAConfiguration,
} from "jssip/lib/UA";
import {
  EndEvent,
  RTCSession,
} from "jssip/lib/RTCSession";

export interface WebRtcAuthenticationDetails {
  username: string
  password: string
  sipAddress: string
  websocketUris: Array<string>
  stunUris: Array<string>
  turnUris: Array<string>
}

export async function fetchWebRtcAuthDetails(environment: string, resellerToken: string, projectToken: string): Promise<WebRtcAuthenticationDetails> {
  let request: RequestInit = {
    method: 'POST',
    body: JSON.stringify({ resellerToken, projectToken }),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  const response = await fetch(`${environment}/v1/call/webrtc/authenticate`, request)
  if (!response.ok) {
    throw new Error("Failed to fetch authentication details!")
  }

  return await response.json() as WebRtcAuthenticationDetails
}

export interface TelephonyApi {
  call(target: string, timeout: number): Promise<CallApi>
  disconnect(): void
}

export type Tone = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#' | 'A' | 'B' | 'C' | 'D'

export interface CallApi {
  readonly media: MediaStream
  readonly callCompleted: Promise<void>
  sendTone(tone: Tone): void
  drop(): void
}

async function setupRegisteredUserAgent(authDetails: WebRtcAuthenticationDetails): Promise<UA> {
  const configuration: UAConfiguration = {
    sockets: authDetails.websocketUris.map(uri => new WebSocketInterface(uri.toString())),
    uri: authDetails.sipAddress,
    password: authDetails.password,
  }

  return new Promise<UA>((resolve, reject) => {
    const ua = new UA(configuration)
    let resolved = false

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
      if (!resolved) {
        resolved = true
        reject(e)
      }
    })

    ua.on('unregistered', (e) => {
      console.log('UA unregistered', e)
      if (!resolved) {
        resolved = true
        reject(e)
      }
    })

    ua.start();
  })
}

function awaitRtcSession(userAgent: UA, cancel: AbortSignal): Promise<RTCSession> {
  return new Promise((resolve, reject) => {
    cancel.addEventListener('cancel', reject, { once: true })
    userAgent.once('newRTCSession', (e: IncomingRTCSessionEvent) => {
      console.log("RTCSession received", e)
      cancel.removeEventListener('cancel', reject)
      if (cancel.aborted) {
        reject(cancel.reason)
      } else {
        resolve(e.session)
      }
    })
  })
}

function setupSessionAndMedia(
  userAgent: UA,
  authDetails: WebRtcAuthenticationDetails,
  target: string,
  abort: AbortSignal,
): Promise<[RTCSession, MediaStream]> {

  const callOptions: CallOptions = {
    mediaConstraints: {
      audio: true,
      video: false,
    },
    pcConfig: {
      iceServers: [
        { urls: authDetails.stunUris },
        { urls: authDetails.turnUris, username: authDetails.username, credential: authDetails.password },
      ]
    },
  }

  const rtcSessionPromise = awaitRtcSession(userAgent, abort)
  userAgent.call(target, callOptions)
  return rtcSessionPromise.then((session) => {
    let resolved: boolean = false

    return new Promise((resolve, reject) => {
      session.on('icecandidate', (e) => {
        e.ready()
      })


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
        console.log("Session confirmed!", e)

        resolve([session, mediaStream])
      })

      session.once('failed', (e: EndEvent ) => {
        if (resolved) {
          return
        }
        console.log("Session failed!", e)
        reject(e)
      })
    })
  })
}

async function setupCall(
  userAgent: UA,
  authDetails: WebRtcAuthenticationDetails,
  target: string,
  timeout: number,
  ): Promise<CallApi> {
  const abort = new AbortController()
  const timeoutId = window.setTimeout(() => {
    abort.abort()
    userAgent.terminateSessions()
  }, timeout);

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
    abort.signal,
  )
  clearConnectionTimeout()

  session.once('ended', (e: EndEvent) => {
    console.log("session ended!", e)
    completeCall()
  })

  return {
    media: mediaTrack,
    callCompleted: callCompletedPromise,
    sendTone(tone: Tone) {
      session.sendDTMF(tone)
    },
    drop() {
      session.terminate()
    },
  }
}

export async function setupSipClient(authDetails: WebRtcAuthenticationDetails): Promise<TelephonyApi> {
  const ua = await setupRegisteredUserAgent(authDetails)

  return {
    async call(target: string, timeout): Promise<CallApi> {
      return setupCall(ua, authDetails, target, timeout)
    },
    disconnect() {
      ua.stop()
    },
  }
}