export type WebInAppEvent =
    | 'back'
    | 'close'
    | 'getToken'
    | 'refreshToken'
    | 'hide_toolbar'
    | 'show_toolbar'
    | 'openPage'
    | 'payment'
    | 'screenshot_share'
    | 'share'
    | 'update_title'

// export const IN_APP_SCREEN = {
//   balance: `ahamove://balance`,
//   topup: `ahamove://balance?open_topup=true`,
//   records: `ahamove://records`,
//   orderDetail: (orderId: string) =>
//     `ahamove://order_detail?pay_now=true&order_id=${orderId}`,
// };

declare global {
    class WebJSInterface {
        static requestAction: (event: string) => void
    }
    interface Window {
        webkit: {
            messageHandlers: {
                requestAction: {
                    postMessage: (event: string) => void
                }
            }
        }
    }
}

export class JSFunction {
    static loggerEnabled = false

    static enableLogger(enable: boolean = true) {
        this.loggerEnabled = enable
    }

    static isIOS() {
        return !!window?.webkit
    }

    static isAndroid() {
        return typeof WebJSInterface !== 'undefined'
    }

    static postMessageToIOS(event: string) {
        try {
            window.webkit.messageHandlers.requestAction.postMessage(event)
            if (this.loggerEnabled) {
                console.log(
                    `[Sent] window.webkit.messageHandlers.requestAction.postMessage("${event}")`,
                )
            }
        } catch (error) {
            console.warn(
                `[Error] window.webkit.messageHandlers.requestAction.postMessage("${event}")`,
                error,
            )
        }
    }

    static postMessageToAndroid(event: string) {
        try {
            WebJSInterface.requestAction(event)
            if (this.loggerEnabled) {
                console.log(`[Sent] WebJSInterface.requestAction("${event}")`)
            }
        } catch (error) {
            console.warn(`[Error] WebJSInterface.requestAction("${event}")`, error)
        }
    }

    static call(
        data: {
            name: WebInAppEvent
            title?: string
            body?:
                | string
                | ({
                title?: string
                description?: string
                image?: string | string[]
                text?: string
                type?: string
                item_id?: string
                amount?: number
                return_url?: string
                method_id?: string
                method_type?: string
            } & Record<string, any>)
        },
        options: { timeout?: number } = {},
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            // Detect platform and post message accordingly
            if (this.isIOS()) {
                const eventPayload =
                    Object.keys(data).length === 1 && data.name !== 'refreshToken'
                        ? data.name
                        : JSON.stringify(data)
                this.postMessageToIOS(eventPayload)
            } else if (this.isAndroid()) {
                this.postMessageToAndroid(JSON.stringify(data))
            } else {
                const errorMsg = `[Error] Device type not recognized for event: ${JSON.stringify(
                    data,
                )}`
                console.warn(errorMsg)
                // If we can't send, we should probably reject immediately unless it's just a log
                // But for safety, let's reject
                return reject(new Error(errorMsg))
            }

            if (!['getToken', 'refreshToken'].includes(data.name)) {
                return resolve(undefined)
            }

            // If the event is one that expects a response (like getToken), set up listener
            // For now, we assume if the caller awaits, they expect a response.
            // We can add a flag in options if needed, but let's default to listening.

            const timeoutMs = options.timeout ?? 10000 // Default 10s
            let timer: NodeJS.Timeout

            const messageHandler = (event: MessageEvent) => {
                if (this.loggerEnabled) {
                    console.log('Message received:', event)
                }

                // Check if this is a relevant message
                // We check for 'webinapp' property as per original code
                if (event.data?.webinapp) {
                    if (this.loggerEnabled) {
                        console.log('Event data contains webInApp:', event.data)
                    }

                    // Cleanup
                    clearTimeout(timer)
                    window.removeEventListener('message', messageHandler)

                    resolve(event.data)
                } else {
                    // Do NOT remove listener if it's not our message
                    // Just log warning if enabled
                    if (this.loggerEnabled) {
                        console.warn(
                            'Event data does not contain webInApp (ignored):',
                            event.data,
                        )
                    }
                }
            }

            // Setup timeout
            timer = setTimeout(() => {
                window.removeEventListener('message', messageHandler)
                reject(new Error(`Timeout waiting for response to ${data.name}`))
            }, timeoutMs)

            window.addEventListener('message', messageHandler)
            if (this.loggerEnabled) {
                console.log('Subscribed to message events')
            }
        })
    }
}

export type JSFunctionType = typeof JSFunction
