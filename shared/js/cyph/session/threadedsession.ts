/// <reference path="enums.ts" />
/// <reference path="imessage.ts" />
/// <reference path="isession.ts" />


module Cyph {
	export module Session {
		/**
		 * Wrapper around Session that spawns it in a new thread.
		 */
		export class ThreadedSession implements ISession {
			private thread: Thread;
			private outQueue: Channel.Queue;

			public state	= {
				cyphId: <string> '',
				sharedSecret: <string> '',
				isAlive: <boolean> true,
				isCreator: <boolean> false,
				isStartingNewCyph: <boolean> false,
				wasInitiatedByAPI: <boolean> false
			};

			public close (shouldSendEvent: boolean = true) : void {
				/* Synchronously destroy in main thread, because
					onunload won't wait on cross-thread messages */
				if (shouldSendEvent && this.outQueue) {
					this.outQueue.send(RPCEvents.destroy, undefined, true);
				}

				this.trigger(ThreadedSessionEvents.close, {shouldSendEvent});
			}

			public off (event: string, handler: Function) : void {
				EventManager.off(event + this.id, handler);
			}

			public on (event: string, handler: Function) : void {
				EventManager.on(event + this.id, handler);
			}

			public receive (data: string) : void {
				this.trigger(ThreadedSessionEvents.receive, {data});
			}

			public send (...messages: IMessage[]) : void {
				this.sendBase(messages);
			}

			public sendBase (messages: IMessage[]) : void {
				this.trigger(ThreadedSessionEvents.send, {messages});
			}

			public sendText (text: string) : void {
				this.trigger(ThreadedSessionEvents.sendText, {text});
			}

			public trigger (event: string, data?: any) : void {
				EventManager.trigger(event + this.id, data);
			}

			public updateState (key: string, value: any) : void {
				this.trigger(ThreadedSessionEvents.updateState, {key, value});
			}

			/**
			 * @param descriptor Descriptor used for brokering the session.
			 * @param controller
			 * @param id
			 */
			public constructor (
				descriptor?: string,
				private controller?: IController,
				private id: string = Util.generateGuid()
			) {
				this.on(
					ThreadedSessionEvents.updateStateThread,
					(e: { key: string; value: any; }) => {
						this.state[e.key]	= e.value;

						if (this.controller) {
							this.controller.update();
						}
					}
				);

				this.on(
					Events.newChannel,
					(e: { queueName: string; region: string; }) =>
						this.outQueue	= new Channel.Queue(
							e.queueName,
							undefined,
							{region: e.region}
						)
				);

				this.thread	= new Thread((vars: any, importScripts: Function, Cyph: any) => {
					importScripts('/cryptolib/bower_components/libsodium.js/dist/browsers/combined/sodium.min.js');
					importScripts('/cryptolib/bower_components/ntru.js/dist/ntru.js');

					importScripts('/lib/bower_components/aws-sdk-js/dist/aws-sdk.min.js');
					importScripts('/lib/aws-xml.js');
					self['AWS'].XML.Parser	= self['AWS_XML'];

					importScripts('/js/cyph/session/session.js');

					const session: ISession	= new Cyph.Session.Session(
						vars.descriptor,
						null,
						vars.id
					);

					session.on(vars.events.close, (e: { shouldSendEvent: boolean; }) =>
						session.close(e.shouldSendEvent)
					);

					session.on(vars.events.receive, (e: { data: string; }) =>
						session.receive(e.data)
					);

					session.on(vars.events.send, (e: { messages: IMessage[]; }) =>
						session.sendBase(e.messages)
					);

					session.on(vars.events.sendText, (e: { text: string; }) =>
						session.sendText(e.text)
					);

					session.on(vars.events.updateState, (e: { key: string; value: any; }) =>
						session.updateState(e.key, e.value)
					);
				}, {
					descriptor,
					id: this.id,
					events: ThreadedSessionEvents
				});
			}
		}
	}
}
