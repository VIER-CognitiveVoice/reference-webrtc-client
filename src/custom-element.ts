import {
  CallControlOptions,
  DarkMode,
  KeypadMode,
  triggerControls,
} from './controls'
import { CallApi } from './client'
import css from './webcomponent.css'

export const ELEMENT_NAME = 'cvg-webrtc-button'

const TRIGGER_BUTTON_PART = 'trigger'
const TRIGGER_BUTTON_ENABLED_PART = `${TRIGGER_BUTTON_PART}-enabled`
const TRIGGER_BUTTON_DISABLED_PART = `${TRIGGER_BUTTON_PART}-disabled`

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

  private onButtonClicked() {
    if (this.currentCall) {
      return
    }

    const environment = this.getAttribute('environment') || 'https://cognitivevoice.io'
    const resellerToken = this.getAttribute('reseller-token')
    if (!resellerToken) {
      console.error('No reseller-token given!')
      return
    }
    const destination = this.getAttribute('destination')
    if (!destination) {
      console.error('No destination given!')
      return
    }

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

    const options: CallControlOptions = {
      ui: {
        anchor: this.buttonContainer,
        position: {
          side: 'right',
          distance: [5, -5],
        },
        dark: darkMode,
        keypad: keypadMode,
      },
      volume: {
        dtmfVolume: Number(dtmfVolume)
      }
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
          this.dispatchEvent(new CallEndedEvent())
        })
      }, (reason) => {
        setTriggerButtonEnabled(true)
        console.log('Call failed', reason)
        this.dispatchEvent(new CallEndedEvent())
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

  trigger() {
    this.onButtonClicked()
  }
}

export class CallEvent<T> extends CustomEvent<T> {
  constructor(type: string, detail?: T) {
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

export class CallEndedEvent extends CallEvent<void> {
  constructor() {
    super('call_ended')
  }
}