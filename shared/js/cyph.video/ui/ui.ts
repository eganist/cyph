module Cyph.video {
	export module UI {
		/**
		 * Controls the entire cyph.video UI.
		 */
		export class UI extends Cyph.UI.BaseButtonManager {
			/** UI state/view. */
			public state: States	= States.none;

			/** Chat UI. */
			public chat: Cyph.UI.Chat.IChat;

			/** The link connection to join this cyph. */
			public cyphConnection: Cyph.UI.ILinkConnection;

			/** Signup form to be displayed at the end of a cyph. */
			public signupForm: Cyph.UI.ISignupForm;

			private onUrlStateChange (urlState: string) : void {
				if (urlState === Cyph.UrlState.states.notFound) {
					this.changeState(States.error);
				}
				else {
					Cyph.UrlState.set(Cyph.UrlState.states.notFound);
					return;
				}

				Cyph.UrlState.set(urlState, true, true);
			}

			/**
			 * Initiates UI for sending cyph link to friend.
			 */
			public beginWaiting () : void {
				this.cyphConnection.beginWaiting(
					Cyph.Env.cyphVideoBaseUrl,
					this.chat.session.state.sharedSecret,
					this.chat.session.state.wasInitiatedByAPI
				);

				this.changeState(States.waitingForFriend);
			}

			/**
			 * Changes UI state.
			 * @param state
			 */
			public changeState (state: States) : void {
				this.state	= state;
				this.controller.update();
			}

			/**
			 * @param controller
			 * @param dialogManager
			 * @param mobileMenu
			 * @param notifier
			 */
			public constructor (
				controller: Cyph.IController,
				private dialogManager: Cyph.UI.IDialogManager,
				mobileMenu: Cyph.UI.ISidebar,
				private notifier: Cyph.UI.INotifier
			) {
				super(controller, mobileMenu);

				if (!Cyph.WebRTC.isSupported) {
					/* If unsupported, warn and then close window */

					this.dialogManager.alert({
						title: Cyph.Strings.p2pTitle,
						content: Cyph.Strings.videoDisabledLocal,
						ok: Cyph.Strings.ok
					}, ok =>
						self.close()
					);

					this.changeState(States.blank);

					return;
				}

				this.chat			= new Cyph.UI.Chat.Chat(
					this.controller,
					this.dialogManager,
					this.mobileMenu,
					this.notifier
				);

				this.cyphConnection	= new Cyph.UI.LinkConnection(
					Config.newCyphCountdown,
					this.controller,
					() => this.chat.abortSetup()
				);

				this.signupForm		= new Cyph.UI.SignupForm(this.controller);

				this.chat.p2pManager.preemptivelyInitiate();



				Cyph.UrlState.onchange(urlState => this.onUrlStateChange(urlState));

				this.chat.session.on(Cyph.Session.Events.abort, () => {
					this.changeState(States.chat);
					Cyph.UI.Elements.window.off('beforeunload');
				});

				this.chat.session.on(Cyph.Session.Events.beginChatComplete, () => {
					Cyph.UI.Elements.window.
						unload(() => this.chat.session.close(true)).
						on('beforeunload', () => Cyph.Strings.disconnectWarning)
					;

					if (this.chat.session.state.isCreator) {
						this.chat.p2pManager.p2p.requestCall('video');
					}
				});

				this.chat.session.on(Cyph.Session.Events.beginWaiting, () =>
					this.beginWaiting()
				);

				this.chat.session.on(Cyph.Session.Events.connect, () => {
					this.changeState(States.chat);
					
					if (this.cyphConnection) {
						this.cyphConnection.stop();
					}

					this.dialogManager.toast({
						content: Cyph.Strings.p2pWarningVideoPassive,
						delay: 5000
					});
				});

				this.chat.session.on(Cyph.Session.Events.newCyph, () =>
					this.changeState(States.spinningUp)
				);


				Cyph.UrlState.set(locationData.pathname, false, true);
				self.onhashchange	= () => location.reload();
				self.onpopstate		= null;
			}
		}
	}
}
