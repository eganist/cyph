module Cyph.im {
	export module UI {
		/**
		 * Controls the entire cyph.im UI.
		 */
		export class UI {
			/** The link to join this cyph. */
			public cyphLink: string			= '';

			/** URL-encoded version of this.cyphLink (for sms and mailto links). */
			public cyphLinkEncoded: string	= '';

			/** UI state/view. */
			public state: States			= States.none;

			/** Chat UI. */
			public chat: Cyph.UI.Chat.IChat;

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
				this.changeState(States.waitingForFriend);

				const cyphLink: string	=
					Env.newCyphBaseUrl +
					'#' +
					this.chat.session.state.cyphId +
					this.chat.session.state.sharedSecret
				;

				this.cyphLinkEncoded	= encodeURIComponent(cyphLink);


				const setCopyUrl: Function	= () => {
					if (this.cyphLink !== cyphLink) {
						this.cyphLink	= cyphLink;
						this.controller.update();
					}
				};

				const selectCopyUrl: Function	= () =>
					Util.getValue(
						Cyph.UI.Elements.cyphLinkInput[0],
						'setSelectionRange',
						() => {}
					).call(
						Cyph.UI.Elements.cyphLinkInput[0],
						0,
						cyphLink.length
					);
				;

				if (Cyph.Env.isMobile) {
					setCopyUrl();

					/* Only allow right-clicking (for copying the link) */
					Cyph.UI.Elements.cyphLinkLink.click(e =>
						e.preventDefault()
					);
				}
				else {
					const cyphLinkInterval	= setInterval(() => {
						if (this.state === States.waitingForFriend) {
							setCopyUrl();
							Cyph.UI.Elements.cyphLinkInput.focus();
							selectCopyUrl();
						}
						else {
							clearInterval(cyphLinkInterval);
						}
					}, 250);
				}

				if (Cyph.Env.isIE) {
					const expireTime: string	= new Date(Date.now() + 600000)
						.toLocaleTimeString()
						.toLowerCase()
						.replace(/(.*:.*):.*? /, '$1')
					;

					Cyph.UI.Elements.timer.parent().text(
						Cyph.Strings.linkExpiresAt +
						' ' +
						expireTime
					);
				}
				else {
					Cyph.UI.Elements.timer[0]['start']();
				}

				setTimeout(
					() => {
						if (this.state === States.waitingForFriend) {
							this.chat.abortSetup();
						}
					},
					Config.newCyphCountdown * 1000
				);
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
			 * Opens mobile sidenav menu.
			 */
			public openMobileMenu () : void {
				setTimeout(() =>
					this.mobileMenu.open()
				, 250);
			}

			/**
			 * @param controller
			 * @param dialogManager
			 * @param mobileMenu
			 * @param notifier
			 */
			public constructor (
				private controller: Cyph.IController,
				private dialogManager: Cyph.UI.IDialogManager,
				private mobileMenu: Cyph.UI.ISidebar,
				private notifier: Cyph.UI.INotifier
			) {
				if (
					WebSign &&
					!Config.webSignHashes[localStorage.webSignBootHash]
				) {
					Cyph.Errors.logWebSign();
					// this.changeState(States.webSignChanged);
				// }
				// else {
					Cyph.UrlState.onchange(urlState => this.onUrlStateChange(urlState));

					this.chat	= new Cyph.UI.Chat.Chat(
						this.controller,
						this.dialogManager,
						this.mobileMenu,
						this.notifier
					);

					this.signupForm	= new Cyph.UI.SignupForm(this.controller);



					this.chat.session.on(Cyph.Session.Events.abort, () => {
						this.changeState(States.chat);
						Cyph.UI.Elements.window.off('beforeunload');
					});

					this.chat.session.on(Cyph.Session.Events.beginChatComplete, () =>
						Cyph.UI.Elements.window.
							unload(() => this.chat.session.close(true)).
							on('beforeunload', () => Cyph.Strings.disconnectWarning)
					);

					this.chat.session.on(Cyph.Session.Events.beginWaiting, () =>
						this.beginWaiting()
					);

					this.chat.session.on(Cyph.Session.Events.connect, () =>
						this.changeState(States.chat)
					);

					this.chat.session.on(Cyph.Session.Events.newCyph, () =>
						this.changeState(States.spinningUp)
					);
				// }


				Cyph.UrlState.set(location.pathname, false, true);
				self.onhashchange	= () => location.reload();
				self.onpopstate		= null;


				if (!Cyph.Env.isMobile && Cyph.Env.isIE) {
					this.dialogManager.alert({
						title: Cyph.Strings.warningTitle,
						ok: Cyph.Strings.ok,
						content: Cyph.Strings.IEWarning
					});
				}
			}
		}
	}
}
