import { Notify, Dialog } from 'quasar'

import SettingsService from '@/services/settings'
import UserService from '@/services/user'
import AcunetixApiService from '@/services/acunetix-api'

import { $t } from 'boot/i18n'
import LanguageSelector from '@/components/language-selector';

export default {
    data: () => ({
        loading: true,
        UserService: UserService,
        settings: {danger:{enabled:false,public:{nbdaydelete: 0}},reviews:{enabled:false}},
        settingsOrig : {danger:{enabled:false},reviews:{enabled:false}},
        canEdit: false,
        
        // PingCastle dialog state and data
        pingcastleDialog: false,
        pingcastleTab: 'table',
        pingcastleMapArray: [],
        pingcastleMapJson: '',
        pingcastleMapJsonError: false,
        pingcastleMapJsonErrorMsg: '',
        
        // Acunetix connection testing
        acunetixTesting: false,
        acunetixConnectionStatus: null,
    }),
    components: {
        LanguageSelector
    },

    beforeRouteLeave (to, from , next) {
        if (this.unsavedChanges()) {
            Dialog.create({
            title: $t('msg.thereAreUnsavedChanges'),
            message: $t('msg.doYouWantToLeave'),
            ok: {label: $t('btn.comfirm'), color: 'negative'},
            cancel: {label: $t('btn.cancel'), color: 'white'}
            })
            .onOk(() => next())
        }
        else
            next()
    },

    mounted: function() {
        if (UserService.isAllowed('settings:read')) {
            this.getSettings()
            this.canEdit = this.UserService.isAllowed('settings:update');
            document.addEventListener('keydown', this._listener, false)
        }
        else {
            this.loading = false
        }
    },

    destroyed: function() {
        document.removeEventListener('keydown', this._listener, false)
    },

    methods: {
        _listener: function(e) {
            if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode == 83) {
                e.preventDefault();
                this.updateSettings();
            }
        },

        getSettings: function() {
            SettingsService.getSettings()
            .then((data) => {
                this.settings = data.data.datas || {};
                if (!this.settings.danger) this.settings.danger = { enabled: false, public: { nbdaydelete: 0 } };
                if (!this.settings.reviews) this.settings.reviews = { enabled: false, public: { minReviewers: 1 } };
                
                // Initialize toolIntegrations section if it doesn't exist
                if (!this.settings.toolIntegrations) this.settings.toolIntegrations = {};
                if (!this.settings.toolIntegrations.acunetix) {
                    this.settings.toolIntegrations.acunetix = {
                        serverAddress: '',
                        email: '',
                        password: ''
                    };
                }
                  
                this.settingsOrig = this.$_.cloneDeep(this.settings);
                // Populate the array for the table UI
                const mapObj = this.settings.toolIntegrations?.pingcastle?.pingcastleMap || {};
                this.pingcastleMapArray = Object.entries(mapObj).map(([key, value]) => ({
                  key,
                  value
                }));
                this.loading = false
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor:'white',
                    position: 'top-right'
                })
            })
        },

        addPingcastleMapRow() {
            this.pingcastleMapArray.push({ key: '', value: '' });
        },
        removePingcastleMapRow(index) {
            this.pingcastleMapArray.splice(index, 1);
        },
        syncPingcastleMapToSettings() {
            let mapObj;
            if (this.pingcastleTab === 'json') {
                try {
                    mapObj = JSON.parse(this.pingcastleMapJson);
                    this.pingcastleMapJsonError = false;
                    this.pingcastleMapJsonErrorMsg = '';
                } catch (e) {
                    this.pingcastleMapJsonError = true;
                    this.pingcastleMapJsonErrorMsg = 'Invalid JSON: ' + e.message;
                    return false;
                }
            } else {
                mapObj = {};
                for (const row of this.pingcastleMapArray) {
                    if (row.key) mapObj[row.key] = row.value;
                }
            }
            this.settings.toolIntegrations = this.settings.toolIntegrations || {};
            this.settings.toolIntegrations.pingcastle = this.settings.toolIntegrations.pingcastle || {};
            this.settings.toolIntegrations.pingcastle.pingcastleMap = mapObj;
            return true;
        },
        savePingcastleDialog() {
            if (!this.syncPingcastleMapToSettings()) return;
            this.pingcastleDialog = false;
            // Optionally, update the array/json for next open
            const mapObj = this.settings.toolIntegrations?.pingcastle?.pingcastleMap || {};
            this.pingcastleMapArray = Object.entries(mapObj).map(([key, value]) => ({ key, value }));
            this.pingcastleMapJson = JSON.stringify(mapObj, null, 2);
        },
        onPingcastleJsonInput() {
            try {
                JSON.parse(this.pingcastleMapJson);
                this.pingcastleMapJsonError = false;
                this.pingcastleMapJsonErrorMsg = '';
            } catch (e) {
                this.pingcastleMapJsonError = true;
                this.pingcastleMapJsonErrorMsg = 'Invalid JSON: ' + e.message;
            }
        },
        openPingcastleDialog() {
            const mapObj = this.settings.toolIntegrations?.pingcastle?.pingcastleMap || {};
            this.pingcastleMapArray = Object.entries(mapObj).map(([key, value]) => ({ key, value }));
            this.pingcastleMapJson = JSON.stringify(mapObj, null, 2);
            this.pingcastleMapJsonError = false;
            this.pingcastleMapJsonErrorMsg = '';
            this.pingcastleTab = 'table';
            this.pingcastleDialog = true;
        },

        async testAcunetixConnection() {
            this.acunetixTesting = true;
            this.acunetixConnectionStatus = null;

            try {
                const settings = this.settings.toolIntegrations?.acunetix || {};
                
                if (!settings.serverAddress || !settings.email || !settings.password) {
                    throw new Error('Please fill in all connection settings');
                }

                // Test the connection
                const result = await AcunetixApiService.testConnection(
                    settings.serverAddress,
                    settings.email, 
                    settings.password
                );
                
                this.acunetixConnectionStatus = {
                    success: result,
                    message: result ? 'Connection successful!' : 'Connection failed'
                };

                if (result) {
                    Notify.create({
                        message: 'Successfully connected to Acunetix',
                        color: 'positive',
                        position: 'top-right'
                    });
                } else {
                    Notify.create({
                        message: 'Connection failed',
                        color: 'negative',
                        position: 'top-right'
                    });
                }
            } catch (error) {
                console.error('Acunetix connection test failed:', error);
                
                // Extract the specific error message from the response
                let errorMessage = 'Connection failed'
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message
                } else if (error.message) {
                    errorMessage = error.message
                }
                
                this.acunetixConnectionStatus = {
                    success: false,
                    message: errorMessage
                };
                
                Notify.create({
                    message: `Connection test failed: ${errorMessage}`,
                    color: 'negative',
                    position: 'top-right'
                });
            } finally {
                this.acunetixTesting = false;
            }
        },

        updateSettings: function() {
            var min = 1;
            var max = 99;
            if(this.settings.reviews.public.minReviewers < min || this.settings.reviews.public.minReviewers > max) {
                this.settings.reviews.public.minReviewers = this.settings.reviews.public.minReviewers < min ? min: max;
            }
            this.syncPingcastleMapToSettings();
            SettingsService.updateSettings(this.settings)
            .then((data) => {
                this.settingsOrig = this.$_.cloneDeep(this.settings);
                this.$settings.refresh();
                // Update the array after save
                const mapObj = this.settings.toolIntegrations?.pingcastle?.pingcastleMap || {};
                this.pingcastleMapArray = Object.entries(mapObj).map(([key, value]) => ({
                  key,
                  value
                }));
                Notify.create({
                    message: $t('msg.settingsUpdatedOk'),
                    color: 'positive',
                    textColor:'white',
                    position: 'top-right'
                })
            })
            .catch((err) => {
                Notify.create({
                    message: err.message || err.response.data.datas,
                    color: 'negative',
                    textColor:'white',
                    position: 'top-right'
                })
            })
        },

        revertToDefaults: function() {
            Dialog.create({
                title: $t('msg.revertingSettings'),
                message: $t('msg.revertingSettingsConfirm'),
                ok: {label: $t('btn.confirm'), color: 'negative'},
                cancel: {label: $t('btn.cancel'), color: 'white'}
            })
            .onOk(async () => {
                await SettingsService.revertDefaults();
                this.$settings.refresh();
                this.getSettings();
                Notify.create({
                    message: $t('settingsUpdatedOk'),
                    color: 'positive',
                    textColor:'white',
                    position: 'top-right'
                })
            })
        },

        importSettings: function(file) {
            var fileReader = new FileReader();
            fileReader.onloadend = async (e) => {
                try {
                    var settings = JSON.parse(fileReader.result);
                    if (typeof settings === 'object') {
                        Dialog.create({
                            title: $t('msg.importingSettings'),
                            message: $t('msg.importingSettingsConfirm'),
                            ok: {label: $t('btn.confirm'), color: 'negative'},
                            cancel: {label: $t('btn.cancel'), color: 'white'}
                        })
                        .onOk(async () => {
                            await SettingsService.updateSettings(settings);
                            this.getSettings();
                            Notify.create({
                                message: $t('msg.settingsImportedOk'),
                                color: 'positive',
                                textColor:'white',
                                position: 'top-right'
                            })
                        })
                    } else {
                        throw $t('err.jsonMustBeAnObject');
                    }
                }
                catch (err) {
                    console.log(err);
                    var errMsg = $t('err.importingSettingsError')
                    if (err.message) errMsg = $t('err.errorWhileParsingJsonContent',[err.message]);
                    Notify.create({
                        message: errMsg,
                        color: 'negative',
                        textColor: 'white',
                        position: 'top-right'
                    })
                }
            };
            var fileContent = new Blob(file, {type : 'application/json'});
            fileReader.readAsText(fileContent);
        },

        exportSettings: async function() {
            var response = await SettingsService.exportSettings();
            var blob = new Blob([JSON.stringify(response.data)], {type: "application/json"});
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = decodeURIComponent(response.headers['content-disposition'].split('"')[1]);
            document.body.appendChild(link);
            link.click();
            link.remove();
        },

        unsavedChanges() {
            return JSON.stringify(this.settingsOrig) !== JSON.stringify(this.settings);
        }
    }
}