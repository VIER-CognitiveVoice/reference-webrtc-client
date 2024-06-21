import {
  CallControlOptions,
  DarkMode,
  KeypadMode,
  triggerControls,
  UiPositionSide,
} from './controls'
import {
  CallApi,
  HeaderList,
} from './client'
import css from './webcomponent.css'

export const ELEMENT_NAME = 'cvg-webrtc-button'

const TRIGGER_BUTTON_PART = 'trigger'
const TRIGGER_BUTTON_ENABLED_PART = `${TRIGGER_BUTTON_PART}-enabled`
const TRIGGER_BUTTON_DISABLED_PART = `${TRIGGER_BUTTON_PART}-disabled`

export interface CvgWebRtcButtonEventMap extends HTMLElementEventMap {
  new_call: NewCallEvent
  call_accepted: CallAcceptedEvent
  call_ended: CallEndedEvent
  attribute_validation_failed: AttributeValidationFailedEvent
}

export class CvgWebRtcButton extends HTMLElement {

  private currentCall: CallApi | undefined = undefined
  private readonly buttonContainer: HTMLDivElement
  private readonly button: HTMLButtonElement
  private connected: boolean = false

  private readonly onBeforeUnload = () => {
    if (this.currentCall) {
      this.currentCall.drop()
      this.currentCall = undefined
    }
  }

  get call(): CallApi | null {
    return this.currentCall ?? null
  }

  constructor() {
    super()

    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = css
    shadow.appendChild(style)

    this.buttonContainer = document.createElement('div')
    this.buttonContainer.classList.add('button-container')
    this.button = document.createElement('button')
    this.button.part.add(TRIGGER_BUTTON_PART, TRIGGER_BUTTON_ENABLED_PART)
    this.button.type = 'button'
    this.button.appendChild(document.createElement('slot'))

    this.buttonContainer.appendChild(this.button)
    this.button.addEventListener('click', this.onButtonClicked.bind(this))
    shadow.appendChild(this.buttonContainer)
  }

  private getNumberAttribute(name: string, def: number): number {
    const value = this.getAttribute(name)
    if (!value) {
      return def
    }
    const number = Number(value)
    if (isNaN(number)) {
      return def
    }
    return number
  }

  private getCustomSipHeadersFromAttributes(): HeaderList {
    const attributesLength = this.attributes.length
    const headerList: HeaderList = []
    for (let i = 0; i < attributesLength; ++i) {
      const attribute = this.attributes.item(i)
      if (attribute && attribute.localName.toLowerCase().startsWith("x-")) {
        headerList.push([attribute.localName, attribute.value])
      }
    }

    return headerList
  }

  private onButtonClicked() {
    if (this.currentCall) {
      return
    }

    const environment = this.getAttribute('environment') || 'https://cognitivevoice.io'
    const resellerToken = this.getAttribute('reseller-token')
    if (!resellerToken) {
      console.error('No reseller-token given!')
      this.dispatchEvent(new AttributeValidationFailedEvent('reseller-token', 'missing'))
      return
    }
    const destination = this.getAttribute('destination')
    if (!destination) {
      this.dispatchEvent(new AttributeValidationFailedEvent('destination', 'missing'))
      console.error('No destination given!')
      return
    }

    const forceCodec = this.getAttribute('force-codec')
    const dtmfVolume = this.getAttribute('volume-dtmf') || '0'

    let darkMode: DarkMode | undefined = undefined
    switch (this.getAttribute('dark-mode')) {
      case 'yes':
        darkMode = 'yes'
        break;
      case 'no':
        darkMode = 'no'
        break;
      case 'auto':
        darkMode = 'auto'
        break;
    }

    let keypadMode: KeypadMode | undefined = undefined
    switch (this.getAttribute('keypad')) {
      case 'none':
        keypadMode = 'none'
        break;
      case 'standard':
        keypadMode = 'standard'
        break;
      case 'full':
        keypadMode = 'full'
        break;
    }

    let controlsSide: UiPositionSide = 'right'
    switch (this.getAttribute('controls-side')) {
      case 'top':
        controlsSide = 'top'
        break;
      case 'right':
        controlsSide = 'right'
        break;
      case 'bottom':
        controlsSide = 'bottom'
        break;
      case 'left':
        controlsSide = 'left'
        break;
    }

    const options: CallControlOptions = {
      ui: {
        anchor: this.buttonContainer,
        position: {
          side: controlsSide,
          distance: [
            this.getNumberAttribute('controls-left-distance', 0),
            this.getNumberAttribute('controls-top-distance', 0),
          ],
        },
        dark: darkMode,
        keypad: keypadMode,
      },
      volume: {
        dtmfVolume: Number(dtmfVolume)
      },
      telephony: {
        sipHeaders: this.getCustomSipHeadersFromAttributes()
      },
      audio: {
        codecFilter: forceCodec ? name => name.toLowerCase() == forceCodec.toLowerCase() : undefined
      },
    }

    const setTriggerButtonEnabled = (enabled: boolean): void => {
      this.button.disabled = !enabled
      if (enabled) {
        this.button.part.replace(TRIGGER_BUTTON_DISABLED_PART, TRIGGER_BUTTON_ENABLED_PART)
      } else {
        this.button.part.replace(TRIGGER_BUTTON_ENABLED_PART, TRIGGER_BUTTON_DISABLED_PART)
      }
    }

    this.dispatchEvent(new NewCallEvent())
    setTriggerButtonEnabled(false)
    triggerControls(environment, resellerToken, destination, options)
      .then(async (callApi) => {
        this.currentCall = callApi
        console.log('Call was accepted!', callApi)
        callApi.callCompletion.then(() => {
          this.currentCall = undefined
          setTriggerButtonEnabled(true)
          this.dispatchEvent(new CallEndedEvent(null))
        })
      }, (reason) => {
        setTriggerButtonEnabled(true)
        this.dispatchEvent(new CallEndedEvent(reason))
      })
  }

  connectedCallback() {
    this.connected = true
    window.addEventListener('beforeunload', this.onBeforeUnload)
  }

  disconnectedCallback() {
    this.connected = false
    window.removeEventListener('beforeunload', this.onBeforeUnload)

    if (this.currentCall) {
      this.currentCall.drop()
      this.currentCall = undefined
    }
  }

  addEventListener<K extends keyof CvgWebRtcButtonEventMap>(type: K, listener: (this: HTMLElement, ev: CvgWebRtcButtonEventMap[K]) => any, options?: boolean | AddEventListenerOptions) {
    super.addEventListener(type, listener as EventListenerOrEventListenerObject, options);
  }

  removeEventListener<K extends keyof CvgWebRtcButtonEventMap>(type: K, listener: (this: HTMLElement, ev: CvgWebRtcButtonEventMap[K]) => any, options?: boolean | EventListenerOptions) {
    super.removeEventListener(type, listener as EventListenerOrEventListenerObject, options);
  }

  trigger() {
    this.onButtonClicked()
  }
}

export class CallEvent<T> extends CustomEvent<T> {
  constructor(type: keyof CvgWebRtcButtonEventMap, detail?: T) {
    super(type, {
      bubbles: false,
      cancelable: false,
      detail,
    })
  }
}

export class NewCallEvent extends CallEvent<void> {
  constructor() {
    super('new_call')
  }
}

export interface CallAcceptedDetails {
  headers: HeaderList,
}

export class CallAcceptedEvent extends CallEvent<CallAcceptedDetails> {
  constructor(headers: HeaderList) {
    super('call_accepted', { headers })
  }
}

export class CallEndedEvent extends CallEvent<any | null> {
  constructor(error: any | null) {
    if (error === undefined) {
      error = null
    }
    super('call_ended', error)
  }
}

export type AttributeName = 'reseller-token' | 'destination'
export type ValidationError = 'missing'

export interface AttributeValidationError {
  attributeName: AttributeName
  error: ValidationError
}

export class AttributeValidationFailedEvent extends CallEvent<AttributeValidationError> {
  constructor(attributeName: AttributeName, error: ValidationError) {
    super('attribute_validation_failed', { attributeName, error })
  }
}