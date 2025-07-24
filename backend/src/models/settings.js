var mongoose = require('mongoose');//.set('debug', true);
var Schema = mongoose.Schema;
var fs = require('fs');
var _ = require('lodash');
var Utils = require('../lib/utils.js');

// https://stackoverflow.com/questions/25822289/what-is-the-best-way-to-store-color-hex-values-in-mongodb-mongoose
const colorValidator = (v) => (/^#([0-9a-f]{3}){1,2}$/i).test(v);

const SettingSchema = new Schema({
    report: { 
        enabled: {type: Boolean, default: true},
        public: {
            cvssColors: {
                noneColor: { type: String, default: "#4a86e8", validate: [colorValidator, 'Invalid color'] },
                lowColor: { type: String, default: "#008000", validate: [colorValidator, 'Invalid color'] },
                mediumColor: { type: String, default: "#f9a009", validate: [colorValidator, 'Invalid color'] },
                highColor: { type: String, default: "#fe0000", validate: [colorValidator, 'Invalid color'] },
                criticalColor: { type: String, default: "#212121", validate: [colorValidator, 'Invalid color'] }
            },
            remediationColorsComplexity: {
                lowColor: { type: String, default: "#4472c4", validate: [colorValidator, 'Invalid color'] },
                mediumColor: { type: String, default: "#ffc000", validate: [colorValidator, 'Invalid color'] },
                highColor: { type: String, default: "#FF2F2F", validate: [colorValidator, 'Invalid color'] }
            },
            remediationColorsPriority: {
                lowColor: { type: String, default: "#4472c4", validate: [colorValidator, 'Invalid color'] },
                mediumColor: { type: String, default: "#ffc000", validate: [colorValidator, 'Invalid color'] },
                highColor: { type: String, default: "#ff2f2f", validate: [colorValidator, 'Invalid color'] },
                urgentColor: { type: String, default: "#C00000", validate: [colorValidator, 'Invalid color'] }
            },
            captions: {
                type: [{type: String, unique: true}],
                default: ['Figure']
            },
            extendCvssTemporalEnvironment: { 
                type: Boolean, 
                default: false 
            }
        },
        private: {
            imageBorder: { type: Boolean, default: false },
            imageBorderColor: { type: String, default: "#000000", validate: [colorValidator, 'Invalid color'] }
        }
     },
    reviews: {
        enabled: { type: Boolean, default: false },
        public: {
            mandatoryReview: { type: Boolean, default: false },
            minReviewers: { type: Number, default: 1, min: 1, max: 100, validate: [Number.isInteger, 'Invalid integer'] }
        },
        private: {
            removeApprovalsUponUpdate: { type: Boolean, default: false }
        }
    },
    danger: { 
      enabled: { type: Boolean, default: false },
      public: {
        nbdaydelete: { type: Number, default: 1, min: 1, max: 365, validate: [Number.isInteger, 'Invalid integer'] }
      },
      private: {}
     },
    toolIntegrations: {
        pingcastle: {
            pingcastleMap: {
                type: Schema.Types.Mixed,
                default: {
                    "A-Krbtgt": "Kerberos password last change",
                    "P-Delegated": "Administrator Accounts without the \"this account is sensitive and cannot be delegated\" flag",
                    "P-Kerberoasting": "Admin users vulnerable to Kerberoast attack",
                    "S-PwdLastSet-DC": "DC without password change",
                    "S-PwdLastSet-90": "Computer(s) without password change for at least 3 months",
                    "P-ServiceDomainAdmin": "Presence of service accounts in the domain admin group",
                    "P-UnkownDelegation": "Presence of unknown delegation",
                    "S-SMB-v1": "SMB Version 1 Activated",
                    "P-AdminPwdTooOld": "Admin users with password older than 3 years",
                    "P-ProtectedUsers": "Privileged accounts not in the \"Protected Group\"",
                    "P-ControlPathIndirectMany": "Large Number of Privileged Accounts",
                    "A-PreWin2000Anonymous": "Everyone and/or Anonymous present in the Pre-Windows 2000 group",
                    "S-PwdNeverExpires": "Accounts with never-expiring password",
                    "A-NoGPOLLMNR": "No GPO has been found which disables LLMNR",
                    "T-Inactive": "At least one inactive trust has been found",
                    "A-MinPwdLen": "Password policy length is less than 8 characters",
                    "S-ADRegistration": "Non-admin users can add up to 10 computers to a domain",
                    "P-DelegationFileDeployed": "Files can be modified by everyone (GPO)",
                    "A-PwdGPO": "Password(s) found in GPO",
                    "P-AdminLogin": "Native administrator usage",
                    "S-PwdNotRequired": "Password not required",
                    "T-SIDHistoryUnknownDomain": "Unknown domain(s) used in SIDHistory",
                    "P-DelegationLoginScript": "Login scripts can be modified by any user",
                    "P-AdminNum": "Large Number of users in Admins group",
                    "P-PrivilegeEveryone": "Privileges granted to everyone by GPO",
                    "P-ExchangePrivEsc": "Exchange Windows Permissions group can change security descriptor",
                    "A-CertTempAgent": "Certificate template can be used to issue agent certiticates to everyone",
                    "S-NoPreAuth": "Kerberos Preauthentication Not Required",
                    "P-Inactive": "Inactive Domain Administrators",
                    "S-Inactive": "Inactive User or Computers",
                    "P-UnconstrainedDelegation": "Unconstrained delegation",
                    "S-DesEnabled": "Presence of DES Enabled Account",
                    "A-DnsZoneAUCreateChild": "Authenticated Users can create DNS records",
                    "S-WSUS-HTTP": "WSUS configuration using HTTP instead of HTTPS",
                    "A-BackupMetadata": "AD last backup date",
                    "S-ADRegistrationSchema": "Vulnerable Schema Class",
                    "S-DC-2003": "Obsolete Domain Controller (Windows 2003)",
                    "A-DnsZoneUpdate1": "DNS Zones are configured with unsecure update",
                    "S-DCRegistration": "Domain Controllers are misconfigured",
                    "S-DC-Inactive": "Inactive Domain Controllers",
                    "P-DCOwner": "Domain Controller not owned correctly",
                    "A-DCLdapSign": "LDAP Authentication without signature enforcement",
                    "S-DC-NotUpdated": "Domain Controller not updated",
                    "A-CertTempAnyone": "Certificate template can be modified by everyone",
                    "P-DelegationGPOData": "Any user can modify GPO items",
                    "T-SIDFiltering": "Trusts without SID filtering",
                    "S-SIDHistory": "Domain(s) used in SID history",
                    "A-DsHeuristicsAnonymous": "Access without any account via a forest wide setting",
                    "A-MD5IntermediateCert": "Intermediate Certificates using unsafe hashing algorithm (MD5)",
                    "S-OldNtlm": "The LAN Manager Authentication Level allows the use of NTLMv1 or LM",
                    "A-AdminSDHolder": "Check for suspicious account(s) used in administrator activities",
                    "A-HardenedPaths": "Hardened UNC Paths weakness",
                    "A-DCLdapsProtocolAdvanced": "Domain Controller(s) using TLS1.0 or TLS1.1",
                    "S-PrimaryGroup": "Users and computers with non-default Primary Group IDs",
                    "P-SchemaAdmin": "The Schema Admin group is not empty",
                    "A-LAPS-Not-Installed": "Local Administration Password Solution (LAPS) not implemented",
                    "A-AuditDC": "Audit Policy on the Domain Controller does not Collect Key Events",
                    "S-C-Inactive": "Inactive Computers Check",
                    "S-OS-W10": "Presence of non-supported version of Windows 10 or Windows 11",
                    "A-CertEnrollHttp": "Certificate Enrollment Interface Accessible via HTTP",
                    "P-LogonDenied": "No GPO Preventing the Logon of Administrators",
                    "A-WeakRSARootCert2": "Trusted Certificate with Weak RSA Key",
                    "A-DnsZoneUpdate2": "DNS Zone Configured with Unsecure Updates",
                    "A-SHA1IntermediateCert": "Intermediate Certificate Using Unsafe Hashing Algorithm (SHA1)",
                    "A-MD5RootCert": "Root Certificate Using MD5 Signature",
                    "A-NoNetSessionHardening": "No GPO Found which Implements NetCease",
                    "A-AuditPowershell": "Powershell Audit Configuration Not Fully Enabled",
                    "A-SHA1RootCert": "ROOT Certificate Using SHA1 Signature",
                    "A-PreWin2000AuthenticatedUsers": "Pre-Windows 2000 Compatible Group Contains Authenticated Users",
                    "A-DCLdapsChannelBinding": "Channel binding is not enabled for all DC for LDAPS"
                }
            }
        },
        nessus: {
            // Add nessus-specific settings here in the future
        },
        acunetix: {
            serverAddress: { type: String, default: '' },
            email: { type: String, default: '' },
            password: { type: String, default: '' } // Note: This should be encrypted in production
        }
    }
}, {strict: true});

// Get all settings
SettingSchema.statics.getAll = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOne({});
        query.select('-_id -__v');
        query.exec()
            .then(settings => {
                resolve(settings)
            })
            .catch(err => reject(err));
    });
};

// Get public settings
SettingSchema.statics.getPublic = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOne({});
        query.select('-_id report.enabled report.public reviews.enabled reviews.public danger.enabled danger.public toolIntegrations');
        query.exec()
            .then(settings => resolve(settings))
            .catch(err => reject(err));
    });
};

// Update Settings
SettingSchema.statics.update = (settings) => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOneAndUpdate({}, settings, { new: true, runValidators: true });
        query.exec()
            .then(settings => resolve(settings))
            .catch(err => reject(err));
    });
};


// Restore settings to default
SettingSchema.statics.restoreDefaults = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.deleteMany({});
        query.exec()
            .then(_ => {
                const query = new Settings({});
                query.save()
                    .then(_ => resolve("Restored default settings."))
                    .catch(err => reject(err));
            })
            .catch(err => reject(err));
    });
};

const Settings = mongoose.model('Settings', SettingSchema);

// Populate/update settings when server starts
Settings.findOne()
.then((liveSettings) => {
  if (!liveSettings) {
    console.log("Initializing Settings");
    Settings.create({}).catch((err) => {
      throw "Error creating the settings in the database : " + err;
    });
  } 
  else {
    var needUpdate = false
    var liveSettingsPaths = Utils.getObjectPaths(liveSettings.toObject())

    liveSettingsPaths.forEach(path => {
        if (!SettingSchema.path(path) && !path.startsWith('_')) {
            needUpdate = true
            _.set(liveSettings, path, undefined)
        }
    })

    if (needUpdate) {
        console.log("Removing unused fields from Settings")
        liveSettings.save()
    }
  }
})
.catch((err) => {
  throw "Error checking for initial settings in the database : " + err;
});

module.exports = Settings;
