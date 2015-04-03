var
	abortSetup,
	addMessageToChat,
	alertDialog,
	beginChatUi,
	beginWaiting,
	changeState,
	closeChat,
	confirmDialog,
	enableWebRTC,
	friendIsTyping,
	warnWebSignObsolete,
	insertPhoto,
	isMobile,
	logCyphertext,
	markAllAsSent,
	notify,
	platformString,
	scrolling,
	sendFileButton,
	sendMessage,
	state,
	states,
	statusNotFound,
	toggleVideoCall,
	updateUI
;


/* Stuff for ng-markdown directive */

var markdown	= new markdownit({
	html: false,
	linkify: true,
	typographer: true,
	quotes: (language == 'ru' ? '«»' : language == 'de' ? '„“' : '“”') + '‘’',
	highlight: function (str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return hljs.highlight(lang, str).value;
			}
			catch (__) {}
		}

		try {
			return hljs.highlightAuto(str).value;
		}
		catch (__) {}

		return '';
	}
}).
	disable('image').
	use(markdownitSup).
	use(markdownitEmoji)
;

markdown.renderer.rules.emoji	= function(token, idx) {
	return twemoji.parse(token[idx].content, {base: '/lib/bower_components/twemoji/'});
};


angular.
	module('Cyph', ['ngMaterial', 'timer']).
	controller('CyphController', ['$scope', '$mdSidenav', '$mdToast', '$mdDialog', function ($scope, $mdSidenav, $mdToast, $mdDialog) {
		var $window				= $(window);
		var $html				= $('html');
		var $everything			= $('*');
		var $messageBox			= $('#message-box');
		var $messageList		= $('#message-list, #message-list > md-content');
		var $timer				= $('#timer');
		var $buttons			= $('.md-button:not(#templates *)');
		var $copyUrlInput		= $('#copy-url-input input');
		var $copyUrlLink		= $('#copy-url-link');
		var $cyphertext			= $('#cyphertext.curtain, #cyphertext.curtain > md-content');
		var $sendButton			= $('#send-button');
		var $insertPhotoMobile	= $('#insert-photo-mobile');

		$scope.language			= language;
		$scope.isConnected		= false;
		$scope.isDisconnected	= false;
		$scope.isFriendTyping	= false;
		$scope.cyphertext		= [];
		$scope.messages			= [];
		$scope.message			= '';
		$scope.unreadMessages	= 0;
		$scope.authors			= authors;
		$scope.copyUrl			= '';
		$scope.copyUrlEncoded	= '';
		$scope.isOnion			= isOnion;
		$scope.isWebRTCEnabled	= false;
		$scope.isVideoCall		= false;
		$scope.streamOptions	= webRTC.streamOptions;
		$scope.incomingStream	= webRTC.incomingStream;
		$scope.incomingFile		= webRTC.incomingFile;
		$scope.outgoingFile		= webRTC.outgoingFile;

		$scope.smsRecipient		= isIOS ? '+1' : '';

		$scope.webSignHashes	= encodeURIComponent(
			'Hello Ryan and Josh,\n\n\n\n\n\n---\n\n' +
				(typeof webSign == 'undefined' ? '' : webSign.toString())
		);

		isAlive = $scope.isAlive = true;

		states = $scope.states = {
			none: 0,
			spinningUp: 1,
			waitingForFriend: 2,
			chatBeginMessage: 3,
			keyExchange: 4,
			blank: 100,
			chat: 200,
			aborted: 400,
			error: 404,
			webSignObsolete: 666
		};
		state = $scope.state = $scope.states.none;


		/* https://coderwall.com/p/ngisma */
		updateUI	= function (fn) {
			var phase = $scope['$root']['$$phase'];

			if (phase == '$apply' || phase == '$digest') {
				fn && (typeof(fn) === 'function') && fn();
			}
			else {
				$scope.$apply(fn);
			}
		};



		abortSetup = $scope.abortSetup = function () {
			$window.off('beforeunload');
			changeState($scope.states.aborted);
			channelClose();
		};


		var newMessageNotification	= getString('newMessageNotification');

		addMessageToChat = $scope.addMessageToChat = function (text, author, shouldNotify) {
			if ($scope.state == $scope.states.aborted) {
				return;
			}

			if (text) {
				if (shouldNotify !== false) {
					switch (author) {
						case authors.friend:
							notify(newMessageNotification);
							break;

						case authors.app:
							notify(text);
							break;
					}
				}

				updateUI(function () {
					$scope.messages.push({
						author: author,
						authorClass: 'author-' + (
							author == authors.me ? 'me' :
								author == authors.friend ? 'friend' : 'app'
						),
						isFromApp: author == authors.app,
						isFromFriend: author == authors.friend,
						isFromMe: author == authors.me,
						text: text,
						// timestamp: ($scope.isConnected || author == authors.app) ? getTimestamp() : ''
						timestamp: getTimestamp()
					});
				});

				$scope.scrollDown(true);

				if (author == authors.me) {
					$scope.scrollDown();
				}
				else {
					scrolling.update();
				}
			}
		};


		alertDialog = $scope.alertDialog = function (o, callback) {
			$mdDialog.show($mdDialog.alert(o)).then(callback);
		};


		beginChatUi = $scope.beginChatUi = function (callback) {
			if ($scope.state == $scope.states.aborted) {
				return;
			}

			function dothemove () {
				notify(connectedNotification);
				changeState($scope.states.chatBeginMessage);

				/* Stop mobile browsers from keeping this selected */
				$copyUrlInput.remove();

				setTimeout(function () {
					if ($scope.state == $scope.states.aborted) {
						return;
					}

					callback && callback();

					changeState($scope.states.chat);

					/* Adjust font size for translations */
					if (!isMobile) {
						setTimeout(function () {
							$buttons.each(function () {
								var $this		= $(this);
								var $clone		= $this
									.clone()
									.css({display: 'inline', width: 'auto', visibility: 'hidden', position: 'fixed'})
									.appendTo('body')
								;
								var $both		= $this.add($clone);

								var fontSize	= parseInt($this.css('font-size'), 10);

								for (var i = 0 ; i < 20 && $clone.width() > $this.width() ; ++i) {
									fontSize	-= 1;
									$both.css('font-size', fontSize + 'px');
								}

								$clone.remove();
							});
						}, 500);
					}

					addMessageToChat(getString('introductoryMessage'), authors.app, false);
				}, 3000);
			}


			$timer && $timer[0].stop();

			if (hasKeyExchangeBegun) {
				dothemove();
			}
			else {
				changeState($scope.states.keyExchange);

				var intervalId	= setInterval(function () {
					if (hasKeyExchangeBegun) {
						clearInterval(intervalId);
						dothemove();
					}
				}, 250);
			}
		};


		beginWaiting = $scope.beginWaiting = function () {
			changeState($scope.states.waitingForFriend);

			var copyUrl		=
				((!isOnion && document.location.origin) || 'https://www.cyph.im') +
				'/#' +
				cyphId +
				sharedSecret
			;

			function setCopyUrl () {
				if ($scope.copyUrl != copyUrl) {
					updateUI(function () {
						$scope.copyUrl			= copyUrl;
						$scope.copyUrlEncoded	= encodeURIComponent(copyUrl);
					});
				}
			}

			function selectCopyUrl () {
				$copyUrlInput[0].setSelectionRange(0, copyUrl.length);
			}

			if (isMobile) {
				setCopyUrl();

				/* Only allow right-clicking (for copying the link) */
				$copyUrlLink.click(function (e) {
					e.preventDefault();
				});
			}
			else {
				var copyUrlInterval	= setInterval(function () {
					if ($scope.state == $scope.states.waitingForFriend) {
						setCopyUrl();
						$copyUrlInput.focus();
						selectCopyUrl();
					}
					else {
						clearInterval(copyUrlInterval);
					}
				}, 250);
			}

			if (isIE) {
				var expireTime	= new Date(Date.now() + 600000)
					.toLocaleTimeString()
					.toLowerCase()
					.replace(/(.*:.*):.*? /, '$1')
				;

				$timer.parent().text('Link expires at ' + expireTime)
				delete $timer;
			}
			else {
				$timer[0].start();
			}
		};


		changeState = $scope.changeState = function (s) {
			if (isWebSignObsolete) {
				return;
			}

			updateUI(function () {
				state = $scope.state = s;
			});
		};


		var disconnectedNotification	= getString('disconnectedNotification');

		closeChat = $scope.closeChat = function () {
			if ($scope.state == $scope.states.aborted) {
				return;
			}

			if ($scope.isAlive) {
				friendIsTyping(false);

				if ($scope.isConnected) {
					addMessageToChat(disconnectedNotification, authors.app);

					updateUI(function () {
						isAlive = $scope.isAlive = false;
						$scope.isDisconnected	= true;
					});
				}
				else if (!isWebSignObsolete) {
					abortSetup();
				}
			}
		};


		confirmDialog = $scope.confirmDialog = function (o, callback, opt_timeout) {
			var promise	= $mdDialog.show($mdDialog.confirm(o));

			var timeoutId;
			if (opt_timeout) {
				timeoutId	= setTimeout(function () {
					$mdDialog.cancel(promise);
				}, opt_timeout);
			}

			function f (ok) {
				timeoutId && clearTimeout(timeoutId);
				callback && callback(ok === true);
			}

			promise.then(f).catch(f);
		};


		enableWebRTC = $scope.enableWebRTC = function () {
			updateUI(function () {
				$scope.isWebRTCEnabled	= true;
			});
		};


		friendIsTyping = $scope.friendIsTyping = function (isFriendTyping) {
			updateUI(function () {
				$scope.isFriendTyping	= isFriendTyping;
			});
		};


		sendFileButton = $scope.sendFileButton = function () {
			$scope.baseButtonClick(function () {
				if ($scope.isWebRTCEnabled) {
					if (!$scope.isVideoCall) {
						webRTC.helpers.requestCall('file');
					}
					else {
						webRTC.helpers.sendFile();
					}
				}
			});
		};


		warnWebSignObsolete = $scope.warnWebSignObsolete = function () {
			$window.off('beforeunload');
			channelClose();
			changeState($scope.states.webSignObsolete);

			isWebSignObsolete	= true;
			isAlive				= false;

			webSignError();
		};


		var imageFile;
		var photoMax	= 1920;
		var canvas		= document.createElement('canvas');
		var ctx			= canvas.getContext('2d');
		var img			= new Image;
		var reader		= new FileReader;

		function sendImage (result) {
			sendMessage('![](' + result + ')');
		}

		reader.onload	= function () {
			sendImage(reader.result);
		};

		img.onload	= function () {
			var widthFactor		= photoMax / img.width;
			widthFactor			= widthFactor > 1 ? 1 : widthFactor;
			var heightFactor	= photoMax / img.height;
			heightFactor		= heightFactor > 1 ? 1 : heightFactor;
			var factor			= Math.min(widthFactor, heightFactor);

			canvas.width		= img.width * factor;
			canvas.height		= img.height * factor;

			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			var hasTransparency	=
				imageFile.type != 'image/jpeg' &&
				ctx.getImageData(0, 0, img.width, img.height).data[3] != 255
			;

			var result	= hasTransparency ? canvas.toDataURL() : canvas.toDataURL(
				'image/jpeg',
				Math.min(960 / Math.max(canvas.width, canvas.height), 1)
			);

			URL.revokeObjectURL(img.src);

			sendImage(result);
		};

		/* More reliable hack to handle these buttons */
		$(function () {
			$buttons.find('input[type="file"]').each(function () {
				var elem	= this;

				var isClicked;

				$(this).click(function (e) {
					e.stopPropagation();
					e.preventDefault();
				}).parent().click(function () {
					if (!isClicked) {
						isClicked	= true;

						var e	= document.createEvent('MouseEvents');
						e.initEvent('click', true, false);
						elem.dispatchEvent(e);

						var finish, intervalId;

						finish	= function () {
							clearInterval(intervalId);
							setTimeout(function () {
								isClicked	= false;
							}, 500);
						};

						intervalId	= setInterval(function () {
							if (elem.files.length > 0) {
								finish();
							}
						}, 500);

						setTimeout(finish, 5000);
					}
				});
			});
		});

		insertPhoto = $scope.insertPhoto = function (elem) {
			if (elem.files && elem.files.length > 0) {
				imageFile	= elem.files[0];

				if (imageFile.type == 'image/gif') {
					reader.readAsDataURL(imageFile);
				}
				else {
					img.src		= URL.createObjectURL(imageFile);
				}

				$(elem).val('');
			}
		};


		logCyphertext = $scope.logCyphertext = function (text, author) {
			if (text) {
				updateUI(function () {
					if (isMobile && $scope.cyphertext.length > 5) {
						$scope.cyphertext.shift();
					}

					$scope.cyphertext.push({author: author, text: JSON.parse(text).message});
				});
			}
		};


		markAllAsSent = $scope.markAllAsSent = function () {
			updateUI(function () {
				/*
				for (var i = 0 ; i < $scope.messages.length ; ++i) {
					var message	= $scope.messages[i];

					if (!message.timestamp) {
						message.timestamp	= getTimestamp();
					}
				}
				*/

				$scope.isConnected	= true;
			});
		};


		sendMessage = $scope.sendMessage = function (message) {
			if (!message) {
				message	= $scope.message;

				updateUI(function () {
					$scope.message	= '';
				});

				$scope.onMessageChange();
			}

			if (message) {
				addMessageToChat(message, authors.me);
				$scope.scrollDown();
				otr.sendMsg(message);
			}
		};

		/* Crazy fix to prevent jankiness upon message send on mobile */
		if (isMobile) {
			var mobileButtons	= [$sendButton, $insertPhotoMobile];

			$messageBox.click(function (e) {
				for (var i = 0 ; i < mobileButtons.length ; ++i) {
					var $button	= mobileButtons[i];
					var bounds	= $button.bounds();

					if (
						(e.pageY > bounds.top && e.pageY < bounds.bottom) &&
						(e.pageX > bounds.left && e.pageX < bounds.right)
					) {
						$button.click();
						return;
					}
				}
			});
		}


		toggleVideoCall = $scope.toggleVideoCall = function (isVideoCall) {
			updateUI(function () {
				$scope.isVideoCall	= isVideoCall;
			});
		};



		var isButtonClickLocked;

		$scope.baseButtonClick	= function (callback) {
			if (!isButtonClickLocked) {
				isButtonClickLocked	= true;

				setTimeout(function () {
					if (isMobile) {
						$mdSidenav('menu').close();
					}

					updateUI(callback);

					setTimeout(function () {
						isButtonClickLocked	= false;
					});
				}, 250);
			}
		};


		$scope.disconnect	= function () {
			$scope.baseButtonClick(function () {
				confirmDialog({
					title: getString('disconnectTitle'),
					content: getString('disconnectConfirm'),
					ok: getString('continue'),
					cancel: getString('cancel')
				}, function (ok) {
					if (ok) {
						channelClose();
					}
				});
			});
		};


		$scope.formattingHelp	= function () {
			$scope.baseButtonClick(function () {
				$mdDialog.show({
					template: $('#templates > .formatting-help')[0].outerHTML
				});

				anal.send({
					hitType: 'event',
					eventCategory: 'formatting-help',
					eventAction: 'show',
					eventValue: 1
				});
			});
		};


		var imtypingyo, previousMessage;

		$scope.onMessageChange	= function () {
			var newImtypingYo	= $scope.message != '' && $scope.message != previousMessage;
			previousMessage		= $scope.message;

			if (imtypingyo != newImtypingYo) {
				imtypingyo	= newImtypingYo;
				sendChannelData({Misc: imtypingyo ? channelDataMisc.imtypingyo : channelDataMisc.donetyping});
			}
		};

		setInterval($scope.onMessageChange, 5000);


		$scope.openMobileMenu	= function () {
			setTimeout(function () {
				$mdSidenav('menu').open();
			}, 250);
		};


		var scrollDownLock	= 0;

		$scope.scrollDown	= function (shouldScrollCyphertext) {
			if (scrollDownLock < 1) {
				try {
					++scrollDownLock;

					(shouldScrollCyphertext ?
						$cyphertext :
						$messageList
					).each(function () {
						++scrollDownLock;

						$(this).animate({scrollTop: this.scrollHeight}, 350, function () {
							--scrollDownLock;
						});
					});

					scrolling.update();
				}
				finally {
					--scrollDownLock;
				}
			}
		};


		var showCyphertextLock	= false;
		var curtainClass		= 'curtain';
		var cypherToastPosition	= 'top right';
		var cypherToast1		= getString('cypherToast1');
		var cypherToast2		= getString('cypherToast2');
		var cypherToast3		= getString('cypherToast3');

		$scope.closeCyphertext	= function () {
			if ($('.' + curtainClass).length < 1) {
				return;
			}

			$everything.removeClass(curtainClass);

			setTimeout(function () {
				$mdToast.show({
					template: '<md-toast>' + cypherToast3 + '</md-toast>',
					hideDelay: 1000,
					position: cypherToastPosition,
					detachSwipe: function () {}
				});

				/* Workaround for Angular Material bug */
				setTimeout(function () {
					$('md-toast:visible').remove();
					showCyphertextLock	= false;
				}, 2000);
			}, 2000);
		};

		/* Close cyphertext on esc */
		$(document).keyup(function (e) {
			if (e.keyCode == 27) {
				$scope.closeCyphertext();
			}
		});

		$scope.showCyphertext	= function () {
			$scope.baseButtonClick(function () {
				if (showCyphertextLock) {
					return;
				}

				showCyphertextLock	= true;

				$mdToast.show({
					template: '<md-toast>' + cypherToast1 + '</md-toast>',
					hideDelay: 2000,
					position: cypherToastPosition,
					detachSwipe: function () {}
				});

				setTimeout(function () {
					$mdToast.show({
						template: '<md-toast>' + cypherToast2 + '</md-toast>',
						hideDelay: 3000,
						position: cypherToastPosition,
						detachSwipe: function () {}
					});

					setTimeout(function () {
						$everything.addClass(curtainClass);

						anal.send({
							hitType: 'event',
							eventCategory: 'cyphertext',
							eventAction: 'show',
							eventValue: 1
						});
					}, 3500);
				}, 2500);
			});
		};


		$scope.twoFactor	= function () {
			$scope.baseButtonClick(function () {
				alert(
					'This feature hasn\'t been implemented yet, but it will ' +
					'freeze the chat until both users have verified their ' +
					'identities via two-factor authentication.'
				);
			});
		};


		$scope.videoCallButton	= function () {
			$scope.baseButtonClick(function () {
				if ($scope.isWebRTCEnabled) {
					if (!$scope.isVideoCall) {
						webRTC.helpers.requestCall('video');
					}
					else {
						webRTC.helpers.setUpStream({video: !webRTC.streamOptions.video});
					}
				}
			});
		};


		$scope.videoCallClose	= function () {
			$scope.baseButtonClick(function () {
				webRTC.helpers.kill();
			});
		};


		$scope.voiceCallButton	= function () {
			$scope.baseButtonClick(function () {
				if ($scope.isWebRTCEnabled) {
					if (!$scope.isVideoCall) {
						webRTC.helpers.requestCall('voice');
					}
					else {
						webRTC.helpers.setUpStream({audio: !webRTC.streamOptions.audio});
					}
				}
			});
		};


		$scope.webRTCDisabledAlert	= function () {
			var message	= $('#webrtc-disabled-message').attr('title');

			if (message) {
				alertDialog({
					title: getString('videoCallingTitle'),
					content: message,
					ok: getString('ok')
				});
			}
		};


		/* Visibility */

		if (!isMobile) {
			window.Visibility	= new FocusVisibility;
		}


		/* Notifications */

		var notifyTitle			= 'Cyph';
		var notifyIcon			= '/img/favicon/apple-touch-icon-180x180.png';
		var notifyAudio			= new Audio('/audio/beep.mp3');
		var disableNotify		= false;
		var openNotifications	= [];

		notify	= function (message) {
			if (!disableNotify && Visibility.hidden()) {
				if (window.Notification) {
					var notification	= new Notification(notifyTitle, {body: message, icon: notifyIcon});

					openNotifications.push(notification);

					notification.onclose	= function () {
						while (openNotifications.length > 0) {
							openNotifications.pop().close();
						}

						if (Visibility.hidden()) {
							disableNotify	= true;
						}
					};

					notification.onclick	= function () {
						window.focus();
						notification.onclose();
					};
				}

				notifyAudio.play();

				if (navigator.vibrate) {
					navigator.vibrate(200);
				}
			}
		};


		/* Init */

		var userAgent	= navigator.userAgent.toLowerCase();

		var setUpFullScreenEvent;

		if (isMobile) {
			$html.addClass('mobile');

			$messageBox.focus(function () {
				$scope.scrollDown();
			});


			/* $(function () {
				var $body	= $('body');
				var heights	= {};

				if (window.outerHeight > window.outerWidth) {
					heights.portrait	= window.outerHeight;
					heights.landscape	= window.outerWidth;
				}
				else {
					heights.portrait	= window.outerWidth;
					heights.landscape	= window.outerHeight;
				}

				function setBodyHeight () {
					$body.height(
						((window.outerHeight >= heights.portrait ? heights.portrait : heights.landscape) + 50)
							+ 'px'
					);
				}

				setBodyHeight();
				$(window).on('orientationchange', function () {
					setTimeout(setBodyHeight, 1000);
				});
			}); */
		}
		else {
			var messageBoxLineHeight	= parseInt($messageBox.css('line-height'), 10);
			$messageBox.on('keyup', function () {
				$messageBox.height(messageBoxLineHeight * $messageBox.val().split('\n').length);
			});
		}


		/* OS X-style scrollbars */

		scrolling	= {
			isNanoScroller: !isMobile && navigator.userAgent.toLowerCase().indexOf('mac os x') < 0,
			update: function () {
				if (this.isNanoScroller) {
					$('.nano').nanoScroller();
				}
			}
		};

		if (!scrolling.isNanoScroller) {
			$('.nano, .nano-content').removeClass('nano').removeClass('nano-content');
		}


		/* For notify and mobile fullscreen */

		Visibility.change(function (e, state) {
			if (state != 'hidden') {
				disableNotify	= false;
				while (openNotifications.length > 0) {
					openNotifications.pop().close();
				}
			}
			else if (setUpFullScreenEvent) {
				setUpFullScreenEvent();
			}
		});

		var observer	= new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				var $elem		= $(mutation.addedNodes.length > 0 ? mutation.addedNodes[0] : mutation.target);

				/* Process read-ness and scrolling */
				if ($elem.is('.message-item.unread')) {
					var isHidden	= Visibility.hidden();
					var currentScrollPosition	=
						$messageList[0].scrollHeight -
						($messageList[0].scrollTop + $messageList[0].clientHeight)
					;

					if (!isHidden && ($elem.height() + 50) > currentScrollPosition) {
						$scope.scrollDown();
						$elem.removeClass('unread');
					}

					setTimeout(function () {
						if ((isHidden || !$elem.is(':appeared')) && !$elem.find('*').add($elem.parentsUntil().addBack()).is('.app-message')) {
							updateUI(function () { $scope.unreadMessages += 1 });

							var intervalId	= setInterval(function () {
								if (!Visibility.hidden() && ($elem.is(':appeared') || $elem.nextAll('.message-item:not(.unread)').length > 0)) {
									clearInterval(intervalId);
									$elem.removeClass('unread');
									updateUI(function () { $scope.unreadMessages -= 1 });

									if ($elem.nextAll().length == 0) {
										$scope.scrollDown();
									}
								}
							}, 100);
						}
					}, 250);
				}

				/* Process image lightboxes */
				else if ($elem.is('p:not(.processed)')) {
					var $html	= $($elem[0].outerHTML);

					$html.find('img:not(.emoji)').each(function () {
						var $this	= $(this);

						if ($this.parent().prop('tagName').toLowerCase() != 'a') {
							var $a	= $('<a></a>')
							$a.attr('href', $this.attr('src'));

							$this.before($a);
							$this.detach();
							$a.append($this);

							$a.magnificPopup({type: 'image'});
						}
					});

					$html.addClass('processed');

					$elem.replaceWith($html);
				}

				/* Amazon affiliate links */
				$elem.find('a').click(function (e) {
					var originalUrl	= $(this).attr('href') || '';

					if (originalUrl.substring(0, 5) == 'data:') {
						return;
					}

					var asin	= (originalUrl.match(/.*amazon.com\/.*\/([A-Za-z0-9]{10}).*/) || [])[1];

					if (asin) {
						e.preventDefault();

						var affiliateUrl	= 'https://www.amazon.com/dp/' + asin + '?tag=cyph-20';
						var openAmazonUrl	= function (ok) { openUrl(ok ? affiliateUrl : originalUrl) };

						if (shouldAddAffiliateCode === undefined) {
							$mdDialog.show({
								template: $('#templates > .amazon-link')[0].outerHTML,
								controller: ['$scope', '$mdDialog', function ($scope, $mdDialog) {
									$scope.remember	= false;

									$scope.close	= function (ok) {
										if ($scope.remember) {
											shouldAddAffiliateCode	= ok;
										}

										$mdDialog.hide();
										openAmazonUrl(ok);

										if (ok) {
											anal.send({
												hitType: 'event',
												eventCategory: 'affiliate',
												eventAction: 'approve',
												eventValue: 1
											});
										}
									};
								}],

								/* Temporary hack for Angular Material bug */
								onComplete: function () {
									if (isMobile) {
										$('.amazon-link:visible md-checkbox').click(function () {
											var $this	= $(this);

											try {
												$this.css('pointer-events', 'none');
											}
											finally {
												setTimeout(function () {
													$this.css('pointer-events', '');
												}, 500);
											}
										});
									}
								}
							});
						}
						else {
							openAmazonUrl(shouldAddAffiliateCode);
						}
					}
				});
			});
		});

		observer.observe($('#message-list md-list')[0], {
			childList: true,
			attributes: false,
			characterData: false,
			subtree: true
		});





		/***** Temporarily copypasta'd beta signup stuff from cyph.com.ui.js, pending refactor *****/

		var $betaSignupForm		= $('.beta-signup-form');

		$scope.betaSignupState	= 0;

		$scope.betaSignup		= {
			Language: language
		};

		$scope.submitBetaSignup	= function () {
			updateUI(function () {
				++$scope.betaSignupState;
			});

			if ($scope.betaSignupState == 2) {
				setTimeout(function () {
					updateUI(function () {
						++$scope.betaSignupState;
					});
				}, 1500);
			}

			setTimeout(function () {
				/* Temporary workaround */
				var $input	= $betaSignupForm.find('input:visible');
				if ($input.length == 1) {
					$input.focus();
				}
			}, 100);

			var retries	= 0;
			function dothemove () {
				$.ajax({
					type: 'PUT',
					url: BASE_URL + 'betasignups',
					data: $scope.betaSignup,
					error: function () {
						if (++retries < 5) {
							dothemove();
						}
						else {
							retries	= 0;
						}
					},
					success: function (isNew) {
						if (isNew == 'true') {
							anal.send({
								hitType: 'event',
								eventCategory: 'signup',
								eventAction: 'new',
								eventValue: 1
							});
						}
					}
				});
			}

			dothemove();
		};

		setTimeout(function () {
			$betaSignupForm.addClass('visible');
		}, 500);




		
		/* Do the move lad */

		tabIndent.renderAll();

		scrolling.update();

		if (window.Notification) {
			Notification.requestPermission();
		}

		window.onhashchange = function () { document.location.reload() };


		/* Temporary warning for desktop IE */

		if (!isMobile && isIE) {
			alert(
				"We won't stop you from using Internet Explorer, but it is a *very* poor life choice.\n\n" +
				"IE doesn't work very well with Cyph (or in general).\n\nYou have been warned."
			);
		}
	}]).
	config(['$compileProvider', function ($compileProvider) {
		$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|sms):/);
	}]).
	directive('ngMarkdown', function () {
		return {
			restrict: 'A',
			replace: true,
			link: function (scope, element, attrs) {
				function set(val) {
					val	= markdown.render(val);

					/* TODO: Get markdown-it team to implement these features natively */

					/* Merge blockquotes like reddit */
					val	= val.replace(/\<\/blockquote\>\n\<blockquote\>\n/g, '');

					/* Images */
					val	= val.replace(/!\<a href="(data:image\/(png|jpeg|gif)\;.*?)"><\/a>/g, function (match, value) {
						return '<img src="' + value + '" />';
					});

					element.html(val);
				}

				set(scope.ngMarkdown || '');
				scope.$watch(attrs.ngMarkdown, set);
			}
		};
	});
;