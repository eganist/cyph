/**
 * @file Entry point of cyph.im.
 */


/// <reference path="../preload/crypto.ts" />
/// <reference path="../preload/unsupportedbrowsers.ts" />
/// <reference path="../preload/dompurify.ts" />
/// <reference path="../preload/fonts.ts" />
/// <reference path="../preload/translations.ts" />
/// <reference path="../preload/base.ts" />

/// <reference path="../cyph/controller.ts" />
/// <reference path="../cyph/ui/chat/chat.ts" />
/// <reference path="../cyph/ui/dialogmanager.ts" />
/// <reference path="../cyph/ui/linkconnection.ts" />
/// <reference path="../cyph/ui/notifier.ts" />
/// <reference path="../cyph/ui/signupform.ts" />
/// <reference path="../cyph/ui/directives/chat.ts" />
/// <reference path="../cyph/ui/directives/linkconnection.ts" />
/// <reference path="../cyph/ui/directives/markdown.ts" />
/// <reference path="../cyph/ui/directives/signupform.ts" />
/// <reference path="../cyph/ui/directives/static.ts" />
/// <reference path="config.ts" />
/// <reference path="ui/enums.ts" />
/// <reference path="ui/ui.ts" />


angular.
	module('Cyph', [
		'ngMaterial',
		'timer',
		Cyph.UI.Directives.Chat.title,
		Cyph.UI.Directives.LinkConnection.title,
		Cyph.UI.Directives.Markdown.title,
		Cyph.UI.Directives.SignupForm.title,
		Cyph.UI.Directives.Static.title
	]).
	controller('CyphController', [
		'$scope',
		'$mdDialog',
		'$mdToast',
		'chatSidenav',

		($scope, $mdDialog, $mdToast, chatSidenav) => $(() => {
			Cyph.UI.Elements.load();

			const controller: Cyph.IController			= new Cyph.Controller($scope);
			const dialogManager: Cyph.UI.IDialogManager	= new Cyph.UI.DialogManager($mdDialog, $mdToast);
			const notifier: Cyph.UI.INotifier			= new Cyph.UI.Notifier();

			const mobileMenu: Cyph.UI.ISidebar	=
				Cyph.Env.isMobile ?
					chatSidenav() :
					{close: () => {}, open: () => {}}
			;

			$scope.Cyph	= Cyph;
			$scope.ui	= new Cyph.im.UI.UI(controller, dialogManager, mobileMenu, notifier);

			self['ui']	= $scope.ui;
		})
	]).
	config([
		'$compileProvider',

		$compileProvider => $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|sms):/)
	])
;
