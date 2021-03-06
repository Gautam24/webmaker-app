var view = require('../../lib/view');
var i18n = require('../../lib/i18n');
var publish = require('../../lib/publish');
var page = require('page');
var app;

var PUBLISH_TIMEOUT = 20000;

module.exports = view.extend({
    id: 'share',
    template: require('./index.html'),
    data: {
        title: 'Share',
        error: false,
        doneDisabled: true,
        showPicker: false,
        cancel: true,
        contacts: [],
        modeledContacts: {},
        isDiscoverable: false,
        disableDiscovery: true
    },
    methods: {
        login: function (e) {
            e.preventDefault();
            this.model.auth.login();
        },
        onDone: function () {
            this.sendSMS();
        },
        sendSMS: function () {
            var self = this;
            if (!self.$data.app.url) return;

            app.update({
                isDiscoverable: self.isDiscoverable
            });

            var contacts = [];
            Object.keys(self.modeledContacts).forEach(function (letter) {
                self.modeledContacts[letter].forEach(function (contact) {
                    if (contact.selected) contacts.push(contact);
                });
            });
            contacts = contacts.map(function (contact) {
                return contact.phoneNumbers[0].value;
            });

            if (!contacts.length) {
                self.$data.error = 'noContactsError';
                return;
            } else {
                self.$data.error = false;
            }

            window.SMS.sendSMS(contacts, self.shareMessage, function () {
                console.log('Sent!');
                page('/make/' + self.$parent.$data.params.id + '/detail');
            }, function (err) {
                console.log(err);
                self.$data.error = 'Sorry, there was a problem sending an SMS.';
                var id = self.$parent.$data.params.id;
                self.onDone = '/make/' + id + '/detail';
            });

        },
        onSMSClick: function (e) {
            e.preventDefault();
            this.$broadcast('openContactPicker');
        }
    },
    created: function () {
        this.$root.isReady = false;
    },
    ready: function () {
        var self = this;
        var id = self.$root.$data.params.id;

        app = self.$root.storage.getApp(id);

        self.$data.cancel = '/make/' + id;

        // Bind user
        self.$data.user = self.model.data.session.user;

        // Enable discovery for non-guests (users w. email)
        if (self.$data.user.email) {
            self.disableDiscovery = false;
            self.isDiscoverable = app.data.isDiscoverable || false;
        }

        var message;

        var offlineError = 'We couldn\'t reach the publishing server. Sorry!';

        function startPublish() {
            var publishUrl = global.location.search.match('publish=true');
            if (!publishUrl && self.$data.app.url) {
                self.$root.isReady = true;
                return;
            }

            // Publish
            console.log('Starting publish...');
            self.$data.doneDisabled = true;

            var syncTimeout = global.setTimeout(function () {
                console.log('timed out');
                self.$root.isReady = true;
                self.$data.error = 'Oops! Your publish is taking too long';
            }, PUBLISH_TIMEOUT);

            publish(id, self.$data.user, function (err, data) {
                global.clearTimeout(syncTimeout);
                self.$root.isReady = true;
                if (err) {
                    console.error(err);
                    if (err.status === 0) {
                        self.$data.error = offlineError;
                    } else {
                        self.$data.error = (err.status || 'Error') +
                            ': ' + err.message;
                    }
                    return;
                }
                console.log('Published!');
                self.$data.error = false;
                self.$data.doneDisabled = false;
                app.update({
                    url: data.url
                });
                self.$data.shareMessage = message + ': ' + data.url;
            });
        }

        function onValue(val) {
            self.$data.app = val;
            // Share message
            message = i18n
                .get('share_message')
                .replace('{{app.name}}', val.name);

            if (val.url) {
                self.$data.shareMessage = message + ': ' + val.url;
            }
            startPublish();
        }

        // Bind app
        if (app.data) {
            onValue(app.data);
        } else {
            self.$once(id, onValue);
        }
    }
});
